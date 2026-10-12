// Dedicated (classic) worker: reads VideoFrames and runs MediaPipe off the main thread.
import { LocalGestureRecognizer } from '../recognition/gesture-recognizer';
import { FramePacer } from './frame-pacer';
import type { WorkerInbound, WorkerOutbound } from './worker-protocol';

type TrackProcessorCtor = new (init: { track: MediaStreamTrack; maxBufferSize?: number }) => {
  readable: ReadableStream<VideoFrame>;
};

const post = (msg: WorkerOutbound) => self.postMessage(msg);

self.onmessage = async (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data;
  if (msg.type !== 'init') return;

  let recognizer: LocalGestureRecognizer;
  try {
    recognizer = await LocalGestureRecognizer.create(msg);
  } catch (err) {
    post({ type: 'error', message: `Model load failed: ${String(err)}` });
    return;
  }

  let readable: ReadableStream<VideoFrame>;
  if (msg.source.kind === 'readable') {
    readable = msg.source.readable;
  } else {
    const Processor = (globalThis as { MediaStreamTrackProcessor?: TrackProcessorCtor })
      .MediaStreamTrackProcessor;
    if (!Processor) {
      post({ type: 'error', message: 'MediaStreamTrackProcessor is not available' });
      return;
    }
    readable = new Processor({ track: msg.source.track, maxBufferSize: 1 }).readable;
  }

  post({ type: 'ready' });

  const pacer = new FramePacer(msg.targetFps);
  const reader = readable.getReader();
  try {
    for (;;) {
      const { value: frame, done } = await reader.read();
      if (done) break;
      const now = performance.now();
      try {
        const frames = pacer.offer(now);
        if (frames > 0) {
          const observation = recognizer.recognize(frame, now);
          post({ type: 'observation', observation, inferenceMs: performance.now() - now, frames });
        }
      } finally {
        frame.close();
      }
    }
  } catch (err) {
    post({ type: 'error', message: `Frame loop failed: ${String(err)}` });
  } finally {
    recognizer.close();
  }
};
