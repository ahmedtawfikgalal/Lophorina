// Wires camera, recognition pipeline, lifecycle and metrics for the camera host.
// UI subscribes via subscribe()/getView() (useSyncExternalStore-compatible).

import { GestureEngine, type GestureIntent } from '../interaction/gesture-engine';
import type { Delegate, GestureObservation } from '../recognition/types';
import { CameraManager, cameraPermissionState, type PermissionProbe } from './camera-manager';
import { cameraIsOn, transition, type LifecycleEvent, type LifecycleState } from './lifecycle';
import { SpikeMetrics, type MetricsSnapshot } from './metrics';
import {
  createPipeline,
  type PipelineCallbacks,
  type PipelineConfig,
  type RecognitionPipeline,
  type Strategy,
} from './pipelines';

export type SessionSettings = { strategy: Strategy; delegate: Delegate; targetFps: number };

export type SessionEvent = { t: number; kind: string; detail?: string };

export type SessionView = {
  lifecycle: LifecycleState;
  settings: SessionSettings;
  permission: PermissionProbe;
  stream: MediaStream | null;
  error: string | null;
  /** Non-blocking information, e.g. running on CPU because the GPU was unavailable. */
  notice: string | null;
  /** Side Panel could not show the permission prompt; offer the one-time grant page. */
  needsPermissionPage: boolean;
  /** Delegate actually in use, which may differ from settings after a fallback. */
  activeDelegate: Delegate | null;
  latest: GestureObservation | null;
  /** Most recent deliberate gesture (preview only until commands exist, Week 4). */
  lastIntent: { intent: GestureIntent; at: number } | null;
  metrics: MetricsSnapshot | null;
  lastStopLatencyMs: number | null;
  /** What the camera actually negotiated (resolution, frame rate). */
  trackSettings: MediaTrackSettings | null;
  recording: boolean;
  recordedCount: number;
  events: readonly SessionEvent[];
};

export type CameraPort = { start(): Promise<MediaStream>; stop(): number };

export type SessionDeps = {
  camera: CameraPort;
  createPipeline: (
    strategy: Strategy,
    config: PipelineConfig,
    callbacks: PipelineCallbacks,
  ) => RecognitionPipeline;
  permissionState: () => Promise<PermissionProbe>;
};

const UI_REFRESH_MS = 250;
// GPU health check. A GPU delegate can initialize fine on a software renderer and then take
// seconds per frame (seen in headless Chromium), so performance is checked after start.
const GPU_CHECK_WARMUP = 3; // first inferences include shader compilation
const GPU_CHECK_SAMPLES = 5;
const GPU_SLOW_MS = 150;
const GPU_CHECK_DEADLINE_MS = 8_000;
const MAX_EVENTS = 500;
const MAX_RECORDED = 200_000;

export class CameraSession {
  private readonly deps: SessionDeps;
  private pipeline: RecognitionPipeline | null = null;
  private readonly engine = new GestureEngine();
  private metrics: SpikeMetrics | null = null;
  private generation = 0;
  private gpuCheck: { samples: number[]; timer: ReturnType<typeof setTimeout> } | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private recorded: GestureObservation[] = [];
  private panelHidden = false;
  private youtubeFocused = false;
  private readonly listeners = new Set<() => void>();
  private readonly observationListeners = new Set<(obs: GestureObservation | null) => void>();
  private view: SessionView;

  constructor(
    private readonly assetBase: string,
    settings: SessionSettings,
    deps: Partial<SessionDeps> = {},
  ) {
    this.deps = {
      camera: deps.camera ?? new CameraManager(),
      createPipeline: deps.createPipeline ?? createPipeline,
      permissionState: deps.permissionState ?? cameraPermissionState,
    };
    this.view = {
      lifecycle: 'OFF',
      settings,
      permission: 'unsupported',
      stream: null,
      error: null,
      notice: null,
      needsPermissionPage: false,
      activeDelegate: null,
      latest: null,
      lastIntent: null,
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
    return () => {
      this.listeners.delete(fn);
    };
  };

  getView = () => this.view;

  /** Every observation (15/s) without re-rendering subscribers of the whole view. */
  subscribeObservations = (fn: (obs: GestureObservation | null) => void) => {
    this.observationListeners.add(fn);
    return () => {
      this.observationListeners.delete(fn);
    };
  };

  setSettings(settings: SessionSettings): void {
    if (this.view.lifecycle !== 'OFF' && this.view.lifecycle !== 'ERROR') return;
    this.update({ settings });
  }

  /** Called with the current camera permission and whenever it changes. */
  setPermission(permission: PermissionProbe): void {
    if (permission === this.view.permission) return;
    this.log('permission', permission);
    // Granting access in the permission tab resolves a "needs permission page" error.
    const resolved = permission === 'granted' && this.view.needsPermissionPage;
    this.update({
      permission,
      ...(resolved ? { needsPermissionPage: false, error: null } : {}),
    });
  }

  async start(): Promise<void> {
    const { lifecycle } = this.view;
    const event: LifecycleEvent = lifecycle === 'ERROR' ? 'RETRY' : 'START';
    if (!this.dispatch(event)) return;
    const gen = ++this.generation;
    this.engine.reset();
    this.update({
      error: null,
      notice: null,
      needsPermissionPage: false,
      activeDelegate: null,
      lastIntent: null,
    });

    let stream: MediaStream;
    try {
      stream = await this.deps.camera.start();
    } catch (e) {
      if (gen !== this.generation) return;
      const name = e instanceof DOMException || e instanceof Error ? e.name : 'Error';
      const permission = await this.deps.permissionState();
      // A Side Panel rejects without ever showing a prompt (confirmed in the Week 1 spike).
      const needsPermissionPage = name === 'NotAllowedError' && permission !== 'denied';
      this.dispatch('PERMISSION_DENIED', `${name} (permission: ${permission})`);
      this.update({
        permission,
        error: describeCameraError(name, permission),
        needsPermissionPage,
      });
      return;
    }
    if (gen !== this.generation) {
      this.deps.camera.stop();
      return;
    }
    this.dispatch('PERMISSION_GRANTED');
    const track = stream.getVideoTracks()[0];
    track?.addEventListener('ended', () =>
      this.fail(gen, 'The camera was disconnected or is being used by another application.'),
    );
    this.update({
      stream,
      permission: 'granted',
      trackSettings: track?.getSettings() ?? null,
    });

    const { delegate: preferred } = this.view.settings;
    const pipeline = await this.startPipeline(
      gen,
      stream,
      preferred === 'GPU' ? ['GPU', 'CPU'] : ['CPU'],
    );
    if (!pipeline || gen !== this.generation) return;

    this.metrics = new SpikeMetrics(performance.now());
    this.metrics.setContext(
      { panelHidden: this.panelHidden, youtubeFocused: this.youtubeFocused },
      performance.now(),
    );
    this.dispatch('INIT_SUCCEEDED', `${pipeline.strategy}, ${this.view.activeDelegate}`);
    this.refreshTimer = setInterval(() => this.refresh(), UI_REFRESH_MS);
    if (this.view.activeDelegate === 'GPU') this.armGpuCheck(gen);
  }

  /** Starts recognition with the first delegate that initializes. Returns null on failure. */
  private async startPipeline(
    gen: number,
    stream: MediaStream,
    delegates: Delegate[],
  ): Promise<RecognitionPipeline | null> {
    const { strategy, delegate: preferred, targetFps } = this.view.settings;

    for (const delegate of delegates) {
      // Errors reported while initializing are handled through start()'s rejection, so a
      // failed GPU attempt does not end the session before the CPU attempt.
      let initialized = false;
      const pipeline = this.deps.createPipeline(
        strategy,
        { assetBase: this.assetBase, delegate, targetFps },
        {
          // Only the current pipeline may report, e.g. not a GPU pipeline being replaced.
          onObservation: (obs, ms, frames) => {
            if (this.pipeline === pipeline) this.onObservation(gen, obs, ms, frames);
          },
          onError: (message) => {
            if (initialized) this.fail(gen, message);
          },
        },
      );
      this.pipeline = pipeline;
      try {
        await pipeline.start(stream);
      } catch (e) {
        pipeline.stop();
        if (gen !== this.generation) return null;
        const message = e instanceof Error ? e.message : String(e);
        if (delegate === 'GPU') {
          this.log('gpu-fallback', message);
          continue;
        }
        this.fail(gen, `Gesture recognition could not start: ${message}`);
        return null;
      }
      if (gen !== this.generation) {
        pipeline.stop();
        return null;
      }
      initialized = true;
      this.update({
        activeDelegate: delegate,
        notice:
          delegate !== preferred
            ? 'Graphics acceleration is unavailable, so recognition runs on the CPU and may be slower.'
            : null,
      });
      return pipeline;
    }
    return null;
  }

  private armGpuCheck(gen: number): void {
    const timer = setTimeout(() => {
      if (this.gpuCheck) void this.fallBackToCpu(gen, 'no recognition results within 8 s');
    }, GPU_CHECK_DEADLINE_MS);
    this.gpuCheck = { samples: [], timer };
  }

  private checkGpu(gen: number, inferenceMs: number): void {
    const check = this.gpuCheck;
    if (!check) return;
    check.samples.push(inferenceMs);
    if (check.samples.length < GPU_CHECK_WARMUP + GPU_CHECK_SAMPLES) return;
    this.clearGpuCheck();
    const sorted = check.samples.slice(GPU_CHECK_WARMUP).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    if (median > GPU_SLOW_MS) {
      void this.fallBackToCpu(gen, `GPU inference too slow (median ${median.toFixed(0)} ms)`);
    } else {
      this.log('gpu-ok', `median ${median.toFixed(0)} ms`);
    }
  }

  private clearGpuCheck(): void {
    if (this.gpuCheck) clearTimeout(this.gpuCheck.timer);
    this.gpuCheck = null;
  }

  /** Replaces a working-but-unusable GPU pipeline with a CPU one; the camera keeps running. */
  private async fallBackToCpu(gen: number, reason: string): Promise<void> {
    const stream = this.view.stream;
    if (gen !== this.generation || !stream) return;
    this.clearGpuCheck();
    this.log('gpu-fallback', reason);
    this.pipeline?.stop();
    this.pipeline = null;
    await this.startPipeline(gen, stream, ['CPU']);
  }

  /** Stop order (execution-contexts.md): disable dispatch, stop tracks, stop loop, close model. */
  stop(): void {
    if (this.view.lifecycle === 'OFF') return;
    this.generation++;
    this.dispatch('STOP');
    const stopLatency = this.deps.camera.stop();
    this.release();
    this.log('camera-stopped', `${stopLatency.toFixed(1)} ms`);
    this.update({
      stream: null,
      latest: null,
      activeDelegate: null,
      notice: null,
      lastStopLatencyMs: stopLatency,
    });
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
    this.checkGpu(gen, inferenceMs);
    this.view = { ...this.view, latest: obs };
    this.observationListeners.forEach((fn) => fn(obs));
    const intent = this.engine.push(obs);
    if (intent) {
      this.log('intent', intent.pose);
      this.update({ lastIntent: { intent, at: Date.now() } });
    }
    if (this.view.recording && this.recorded.length < MAX_RECORDED) this.recorded.push(obs);
  }

  private fail(gen: number, message: string): void {
    if (gen !== this.generation) return;
    this.generation++;
    const event: LifecycleEvent =
      this.view.lifecycle === 'INITIALIZING' ? 'INIT_FAILED' : 'FAILURE';
    this.dispatch(event, message);
    this.deps.camera.stop();
    this.release();
    this.update({ stream: null, latest: null, activeDelegate: null, error: message });
  }

  private release(): void {
    this.clearGpuCheck();
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
    if ('latest' in patch && patch.latest === null)
      this.observationListeners.forEach((fn) => fn(null));
    this.listeners.forEach((fn) => fn());
  }
}

function describeCameraError(name: string, permission: PermissionProbe): string {
  switch (name) {
    case 'NotAllowedError':
      return permission === 'denied'
        ? 'Camera access is blocked for Lophorina. Allow it in Chrome settings → Privacy and security → Site settings → Camera, then try again.'
        : 'Camera access has not been granted yet.';
    case 'NotFoundError':
      return 'No camera was found. Connect a camera and try again.';
    case 'NotReadableError':
      return 'The camera is in use by another application or could not be started.';
    default:
      return `The camera could not be started (${name}).`;
  }
}
