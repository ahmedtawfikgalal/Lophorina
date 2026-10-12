// Wires camera, recognition pipeline, lifecycle and metrics for the camera host.
// UI subscribes via subscribe()/getView() (useSyncExternalStore-compatible).

import type { Delegate, GestureObservation } from '../recognition/types';
import { CameraManager, cameraPermissionState } from './camera-manager';
import { cameraIsOn, transition, type LifecycleEvent, type LifecycleState } from './lifecycle';
import { SpikeMetrics, type MetricsSnapshot } from './metrics';
import { createPipeline, type RecognitionPipeline, type Strategy } from './pipelines';

export type SessionSettings = { strategy: Strategy; delegate: Delegate; targetFps: number };

export type SessionEvent = { t: number; kind: string; detail?: string };

export type SessionView = {
  lifecycle: LifecycleState;
  settings: SessionSettings;
  stream: MediaStream | null;
  error: string | null;
  /** Side Panel could not show the permission prompt; offer the one-time grant page. */
  needsPermissionPage: boolean;
  latest: GestureObservation | null;
  metrics: MetricsSnapshot | null;
  lastStopLatencyMs: number | null;
  /** What the camera actually negotiated (resolution, frame rate). */
  trackSettings: MediaTrackSettings | null;
  recording: boolean;
  recordedCount: number;
  events: readonly SessionEvent[];
};

const UI_REFRESH_MS = 250;
const MAX_EVENTS = 500;
const MAX_RECORDED = 200_000;

export class CameraSession {
  private readonly camera = new CameraManager();
  private pipeline: RecognitionPipeline | null = null;
  private metrics: SpikeMetrics | null = null;
  private generation = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private recorded: GestureObservation[] = [];
  private panelHidden = false;
  private youtubeFocused = false;
  private readonly listeners = new Set<() => void>();
  private view: SessionView;

  constructor(
    private readonly assetBase: string,
    settings: SessionSettings,
  ) {
    this.view = {
      lifecycle: 'OFF',
      settings,
      stream: null,
      error: null,
      needsPermissionPage: false,
      latest: null,
      metrics: null,
      lastStopLatencyMs: null,
      trackSettings: null,
      recording: false,
      recordedCount: 0,
      events: [],
    };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getView = () => this.view;

  setSettings(settings: SessionSettings): void {
    if (this.view.lifecycle !== 'OFF' && this.view.lifecycle !== 'ERROR') return;
    this.update({ settings });
  }

  async start(): Promise<void> {
    const { lifecycle } = this.view;
    const event: LifecycleEvent = lifecycle === 'ERROR' ? 'RETRY' : 'START';
    if (!this.dispatch(event)) return;
    const gen = ++this.generation;
    this.update({ error: null, needsPermissionPage: false });

    let stream: MediaStream;
    try {
      stream = await this.camera.start();
    } catch (e) {
      if (gen !== this.generation) return;
      const name = e instanceof DOMException ? e.name : 'Error';
      const permission = await cameraPermissionState();
      // A Side Panel may reject without ever showing a prompt (ADR-001, [To verify]).
      const needsPermissionPage = name === 'NotAllowedError' && permission !== 'denied';
      this.dispatch('PERMISSION_DENIED', `${name} (permission: ${permission})`);
      this.update({ error: describeCameraError(name), needsPermissionPage });
      return;
    }
    if (gen !== this.generation) {
      this.camera.stop();
      return;
    }
    this.dispatch('PERMISSION_GRANTED');
    this.update({ stream, trackSettings: stream.getVideoTracks()[0]?.getSettings() ?? null });

    const pipeline = createPipeline(
      this.view.settings.strategy,
      { assetBase: this.assetBase, ...this.view.settings },
      {
        onObservation: (obs, ms, frames) => this.onObservation(gen, obs, ms, frames),
        onError: (message) => this.fail(gen, message),
      },
    );
    this.pipeline = pipeline;
    try {
      await pipeline.start(stream);
    } catch (e) {
      this.fail(gen, `Initialization failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (gen !== this.generation) return;

    this.metrics = new SpikeMetrics(performance.now());
    this.metrics.setContext(
      { panelHidden: this.panelHidden, youtubeFocused: this.youtubeFocused },
      performance.now(),
    );
    this.dispatch('INIT_SUCCEEDED', pipeline.strategy);
    this.refreshTimer = setInterval(() => this.refresh(), UI_REFRESH_MS);
  }

  /** Stop order (execution-contexts.md): disable dispatch, stop tracks, stop loop, close model. */
  stop(): void {
    if (this.view.lifecycle === 'OFF') return;
    this.generation++;
    this.dispatch('STOP');
    const stopLatency = this.camera.stop();
    this.release();
    this.log('camera-stopped', `${stopLatency.toFixed(1)} ms`);
    this.update({ stream: null, lastStopLatencyMs: stopLatency });
  }

  toggle(): void {
    if (cameraIsOn(this.view.lifecycle) || this.view.lifecycle === 'REQUESTING_PERMISSION') {
      this.stop();
    } else {
      void this.start();
    }
  }

  setPanelHidden(hidden: boolean): void {
    this.panelHidden = hidden;
    this.metrics?.setContext({ panelHidden: hidden }, performance.now());
    this.log('panel-visibility', hidden ? 'hidden' : 'visible');
  }

  setYouTubeFocused(focused: boolean, detail?: string): void {
    if (focused === this.youtubeFocused) return;
    this.youtubeFocused = focused;
    this.metrics?.setContext({ youtubeFocused: focused }, performance.now());
    this.log(focused ? 'youtube-focused' : 'youtube-unfocused', detail);
  }

  startRecording(): void {
    this.recorded = [];
    this.update({ recording: true, recordedCount: 0 });
    this.log('recording-start');
  }

  stopRecording(): GestureObservation[] {
    this.update({ recording: false });
    this.log('recording-stop', `${this.recorded.length} observations`);
    return this.recorded;
  }

  private onObservation(
    gen: number,
    obs: GestureObservation,
    inferenceMs: number,
    frames: number,
  ): void {
    if (gen !== this.generation) return;
    this.metrics?.record(performance.now(), inferenceMs, obs.handPresent, frames);
    this.view = { ...this.view, latest: obs };
    if (this.view.recording && this.recorded.length < MAX_RECORDED) this.recorded.push(obs);
  }

  private fail(gen: number, message: string): void {
    if (gen !== this.generation) return;
    this.generation++;
    const event: LifecycleEvent =
      this.view.lifecycle === 'INITIALIZING' ? 'INIT_FAILED' : 'FAILURE';
    this.dispatch(event, message);
    this.camera.stop();
    this.release();
    this.update({ stream: null, error: message });
  }

  private release(): void {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.pipeline?.stop();
    this.pipeline = null;
    this.refresh();
    this.metrics = null;
  }

  private refresh(): void {
    const metrics = this.metrics?.snapshot(performance.now());
    if (metrics) this.update({ metrics, recordedCount: this.recorded.length });
  }

  private dispatch(event: LifecycleEvent, detail?: string): boolean {
    const next = transition(this.view.lifecycle, event);
    if (!next) {
      this.log('rejected-transition', `${event} in ${this.view.lifecycle}`);
      return false;
    }
    this.log(`${this.view.lifecycle} -> ${next}`, detail ?? event);
    this.update({ lifecycle: next });
    return true;
  }

  private log(kind: string, detail?: string): void {
    const events = [...this.view.events, { t: Date.now(), kind, ...(detail ? { detail } : {}) }];
    this.update({ events: events.slice(-MAX_EVENTS) });
  }

  private update(patch: Partial<SessionView>): void {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }
}

function describeCameraError(name: string): string {
  switch (name) {
    case 'NotAllowedError':
      return 'Camera access was not granted.';
    case 'NotFoundError':
      return 'No camera was found.';
    case 'NotReadableError':
      return 'The camera is in use by another application or could not be started.';
    default:
      return `The camera could not be started (${name}).`;
  }
}
