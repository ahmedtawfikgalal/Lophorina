// Frame-loop strategies under evaluation in the Week 1 spike (ADR-001). Neither uses
// requestAnimationFrame, which Chrome pauses in hidden documents.

import { LocalGestureRecognizer } from '../recognition/gesture-recognizer';
import type { Delegate, GestureObservation } from '../recognition/types';
import { FramePacer } from './frame-pacer';
import type { WorkerInbound, WorkerOutbound } from './worker-protocol';

export type Strategy = 'main-rvfc' | 'worker-mstp';

export type PipelineConfig = {
  assetBase: string;
  delegate: Delegate;
  targetFps: number;
};

export type PipelineCallbacks = {
  /** `frames` = camera frames that reached the loop since the previous observation. */
  onObservation: (obs: GestureObservation, inferenceMs: number, frames: number) => void;
  onError: (message: string) => void;
};

export interface RecognitionPipeline {
  readonly strategy: Strategy;
  /** Resolves once the model is loaded and the loop is running. */
  start(stream: MediaStream): Promise<void>;
  stop(): void;
}

export function createPipeline(
  strategy: Strategy,
  config: PipelineConfig,
  callbacks: PipelineCallbacks,
): RecognitionPipeline {
  return strategy === 'worker-mstp'
    ? new WorkerPipeline(config, callbacks)
    : new MainThreadPipeline(config, callbacks);
}

/** Inference on the camera host's main thread, paced by requestVideoFrameCallback. */
class MainThreadPipeline implements RecognitionPipeline {
  readonly strategy = 'main-rvfc' as const;
  private recognizer: LocalGestureRecognizer | null = null;
  private video: HTMLVideoElement | null = null;
  private callbackId: number | null = null;
  private pacer: FramePacer;
  private stopped = false;

  constructor(
    private readonly config: PipelineConfig,
    private readonly cb: PipelineCallbacks,
  ) {
    this.pacer = new FramePacer(config.targetFps);
  }

  async start(stream: MediaStream): Promise<void> {
    this.recognizer = await LocalGestureRecognizer.create(this.config);
    if (this.stopped) return this.release();

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    // Kept in the DOM (but invisible) because frame callbacks are tied to compositing.
    // [To verify] whether a detached element would also work.
    video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.append(video);
    await video.play();
    this.video = video;
    this.schedule();
  }

  private schedule(): void {
    if (this.stopped || !this.video) return;
    this.callbackId = this.video.requestVideoFrameCallback(() => this.onFrame());
  }

  private onFrame(): void {
    const { recognizer, video } = this;
    if (this.stopped || !recognizer || !video) return;
    const now = performance.now();
    const frames = this.pacer.offer(now);
    if (frames > 0) {
      try {
        const obs = recognizer.recognize(video, now);
        this.cb.onObservation(obs, performance.now() - now, frames);
      } catch (e) {
        this.cb.onError(`Recognition failed: ${String(e)}`);
        return;
      }
    }
    this.schedule();
  }

  stop(): void {
    this.stopped = true;
    this.release();
  }

  private release(): void {
    if (this.video && this.callbackId !== null)
      this.video.cancelVideoFrameCallback(this.callbackId);
    this.callbackId = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.remove();
    }
    this.video = null;
    this.recognizer?.close();
    this.recognizer = null;
  }
}

type TrackProcessorCtor = new (init: { track: MediaStreamTrack; maxBufferSize?: number }) => {
  readable: ReadableStream<VideoFrame>;
};

/**
 * Frames pulled with MediaStreamTrackProcessor and recognized in a dedicated worker.
 * Off the main thread and independent of the host document's rendering.
 */
class WorkerPipeline implements RecognitionPipeline {
  readonly strategy = 'worker-mstp' as const;
  private worker: Worker | null = null;
  private rejectStart: ((e: Error) => void) | null = null;

  constructor(
    private readonly config: PipelineConfig,
    private readonly cb: PipelineCallbacks,
  ) {}

  start(stream: MediaStream): Promise<void> {
    const track = stream.getVideoTracks()[0];
    if (!track) return Promise.reject(new Error('No video track'));

    const worker = new Worker(new URL('./recognition.worker.ts', import.meta.url));
    this.worker = worker;

    const Processor = (globalThis as { MediaStreamTrackProcessor?: TrackProcessorCtor })
      .MediaStreamTrackProcessor;
    // Chrome exposes MediaStreamTrackProcessor on Window; if not, transfer the track and let
    // the worker create the processor.
    const source: WorkerInbound['source'] = Processor
      ? { kind: 'readable', readable: new Processor({ track, maxBufferSize: 1 }).readable }
      : // A clone, so the session keeps (and can stop) the original track.
        { kind: 'track', track: track.clone() };

    return new Promise<void>((resolve, reject) => {
      this.rejectStart = reject;
      worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          this.rejectStart = null;
          resolve();
        } else if (msg.type === 'observation')
          this.cb.onObservation(msg.observation, msg.inferenceMs, msg.frames);
        else if (msg.type === 'error') {
          reject(new Error(msg.message));
          this.cb.onError(msg.message);
        }
      };
      worker.onerror = (e) => {
        const message = `Recognition worker error: ${e.message}`;
        reject(new Error(message));
        this.cb.onError(message);
      };
      const init: WorkerInbound = {
        type: 'init',
        assetBase: this.config.assetBase,
        delegate: this.config.delegate,
        targetFps: this.config.targetFps,
        source,
      };
      const transfer: Transferable[] = [
        source.kind === 'readable' ? source.readable : (source.track as unknown as Transferable),
      ];
      worker.postMessage(init, transfer);
    });
  }

  stop(): void {
    // terminate() releases the recognizer and any VideoFrames the worker still holds.
    this.worker?.terminate();
    this.worker = null;
    // Settle a start() that is still loading the model, so callers never wait forever.
    this.rejectStart?.(new Error('Stopped'));
    this.rejectStart = null;
  }
}
