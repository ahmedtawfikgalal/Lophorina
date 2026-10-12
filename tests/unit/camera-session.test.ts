import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PermissionProbe } from '../../src/camera-host/camera-manager';
import { CameraSession, type SessionDeps } from '../../src/camera-host/camera-session';
import type {
  PipelineCallbacks,
  PipelineConfig,
  RecognitionPipeline,
  Strategy,
} from '../../src/camera-host/pipelines';
import type { Delegate } from '../../src/recognition/types';

type Behavior = 'ok' | 'fail' | 'hang';

class FakeTrack {
  private endedListeners: (() => void)[] = [];
  addEventListener(type: string, fn: () => void) {
    if (type === 'ended') this.endedListeners.push(fn);
  }
  getSettings() {
    return { frameRate: 30, width: 640, height: 480 };
  }
  end() {
    this.endedListeners.forEach((fn) => fn());
  }
}

class FakeCamera {
  track = new FakeTrack();
  starts = 0;
  stops = 0;
  error: Error | null = null;
  async start() {
    this.starts++;
    if (this.error) throw this.error;
    return { getVideoTracks: () => [this.track] } as unknown as MediaStream;
  }
  stop() {
    this.stops++;
    return 0.1;
  }
}

class FakePipeline implements RecognitionPipeline {
  stopped = false;
  private reject: ((e: Error) => void) | null = null;
  constructor(
    readonly strategy: Strategy,
    readonly config: PipelineConfig,
    readonly cb: PipelineCallbacks,
    private readonly behavior: Behavior,
  ) {}
  start() {
    if (this.behavior === 'ok') return Promise.resolve();
    if (this.behavior === 'fail')
      return Promise.reject(new Error(`${this.config.delegate} failed`));
    return new Promise<void>((_, reject) => (this.reject = reject));
  }
  stop() {
    this.stopped = true;
    this.reject?.(new Error('Stopped'));
  }
}

function setup(
  opts: {
    delegate?: Delegate;
    behaviors?: Partial<Record<Delegate, Behavior>>;
    permission?: PermissionProbe;
  } = {},
) {
  const camera = new FakeCamera();
  const pipelines: FakePipeline[] = [];
  const deps: SessionDeps = {
    camera,
    createPipeline: (strategy, config, cb) => {
      const p = new FakePipeline(strategy, config, cb, opts.behaviors?.[config.delegate] ?? 'ok');
      pipelines.push(p);
      return p;
    },
    permissionState: async () => opts.permission ?? 'prompt',
  };
  const session = new CameraSession(
    'chrome-extension://x/mediapipe/',
    { strategy: 'worker-mstp', delegate: opts.delegate ?? 'GPU', targetFps: 15 },
    deps,
  );
  sessions.push(session);
  return { session, camera, pipelines, view: () => session.getView() };
}

const sessions: CameraSession[] = [];
afterEach(() => {
  // Clears the UI refresh timer of any session left running.
  sessions.splice(0).forEach((s) => s.stop());
});

const notAllowed = () => new DOMException('denied', 'NotAllowedError');

describe('CameraSession', () => {
  it('starts on the preferred GPU delegate', async () => {
    const { session, view } = setup();
    await session.start();
    expect(view().lifecycle).toBe('READY');
    expect(view().activeDelegate).toBe('GPU');
    expect(view().permission).toBe('granted');
    expect(view().notice).toBeNull();
  });

  it('falls back to CPU when the GPU fails, and says so', async () => {
    const { session, pipelines, view } = setup({ behaviors: { GPU: 'fail' } });
    await session.start();
    expect(view().lifecycle).toBe('READY');
    expect(view().activeDelegate).toBe('CPU');
    expect(view().notice).toMatch(/CPU/);
    expect(pipelines.map((p) => p.config.delegate)).toEqual(['GPU', 'CPU']);
    expect(pipelines[0]?.stopped).toBe(true);
    expect(view().events.some((e) => e.kind === 'gpu-fallback')).toBe(true);
  });

  it('ignores errors reported by the failed GPU attempt', async () => {
    const { session, pipelines, view } = setup({ behaviors: { GPU: 'fail' } });
    await session.start();
    pipelines[0]?.cb.onError('late GPU error');
    expect(view().lifecycle).toBe('READY');
  });

  it('reports an error and releases the camera when both delegates fail', async () => {
    const { session, camera, view } = setup({ behaviors: { GPU: 'fail', CPU: 'fail' } });
    await session.start();
    expect(view().lifecycle).toBe('ERROR');
    expect(view().error).toMatch(/could not start: CPU failed/);
    expect(camera.stops).toBe(1);
    expect(view().stream).toBeNull();
  });

  it('tries only the CPU when CPU is preferred', async () => {
    const { session, pipelines, view } = setup({ delegate: 'CPU', behaviors: { CPU: 'fail' } });
    await session.start();
    expect(pipelines).toHaveLength(1);
    expect(view().lifecycle).toBe('ERROR');
  });

  it('offers the permission page when the Side Panel cannot prompt, then recovers', async () => {
    const { session, camera, view } = setup({ permission: 'prompt' });
    camera.error = notAllowed();
    await session.start();
    expect(view().lifecycle).toBe('ERROR');
    expect(view().needsPermissionPage).toBe(true);

    session.setPermission('granted'); // granted in the permission tab
    expect(view().needsPermissionPage).toBe(false);
    expect(view().error).toBeNull();

    camera.error = null;
    await session.start(); // RETRY from ERROR
    expect(view().lifecycle).toBe('READY');
  });

  it('explains how to unblock the camera when permission is denied', async () => {
    const { session, camera, view } = setup({ permission: 'denied' });
    camera.error = notAllowed();
    await session.start();
    expect(view().needsPermissionPage).toBe(false);
    expect(view().error).toMatch(/Chrome settings/);
  });

  it('moves to ERROR when the camera disconnects', async () => {
    const { session, camera, view } = setup();
    await session.start();
    camera.track.end();
    expect(view().lifecycle).toBe('ERROR');
    expect(view().error).toMatch(/disconnected/);
    expect(camera.stops).toBe(1);
  });

  it('moves to ERROR when recognition fails after starting', async () => {
    const { session, pipelines, view } = setup();
    await session.start();
    pipelines[0]?.cb.onError('worker crashed');
    expect(view().lifecycle).toBe('ERROR');
    expect(view().error).toBe('worker crashed');
  });

  it('can be stopped while the model is still loading', async () => {
    const { session, camera, pipelines, view } = setup({ behaviors: { GPU: 'hang' } });
    const starting = session.start();
    await Promise.resolve();
    await Promise.resolve();
    session.stop();
    await starting;
    expect(view().lifecycle).toBe('OFF');
    expect(pipelines).toHaveLength(1); // no CPU fallback after Stop
    expect(camera.stops).toBe(1);
  });

  it('drops observations that arrive after Stop', async () => {
    const { session, pipelines, view } = setup();
    await session.start();
    const cb = pipelines[0]?.cb;
    session.stop();
    cb?.onObservation(
      { timestamp: 1, handPresent: true, category: 'Open_Palm', confidence: 0.9, handCount: 1 },
      10,
      1,
    );
    expect(view().latest).toBeNull();
  });

  it('never restarts the camera on its own after Stop', async () => {
    const { session, camera } = setup();
    await session.start();
    session.stop();
    session.setPermission('granted');
    expect(camera.starts).toBe(1);
  });

  describe('GPU health check', () => {
    const obs = {
      timestamp: 1,
      handPresent: false,
      category: 'None',
      confidence: 0,
      handCount: 0,
    };
    const emit = (p: FakePipeline | undefined, ms: number, n: number) => {
      for (let i = 0; i < n; i++) p?.cb.onObservation(obs, ms, 1);
    };
    const settle = () => new Promise((r) => setTimeout(r, 0));

    it('switches to CPU when GPU inference is too slow, keeping the camera on', async () => {
      const { session, camera, pipelines, view } = setup();
      await session.start();
      emit(pipelines[0], 800, 8);
      await settle();
      expect(pipelines.map((p) => p.config.delegate)).toEqual(['GPU', 'CPU']);
      expect(pipelines[0]?.stopped).toBe(true);
      expect(view().lifecycle).toBe('READY');
      expect(view().activeDelegate).toBe('CPU');
      expect(view().notice).toMatch(/CPU/);
      expect(camera.starts).toBe(1);
      expect(camera.stops).toBe(0);
    });

    it('keeps a healthy GPU, ignoring slow warm-up frames', async () => {
      const { session, pipelines, view } = setup();
      await session.start();
      emit(pipelines[0], 400, 3); // shader compilation
      emit(pipelines[0], 20, 5);
      await settle();
      expect(pipelines).toHaveLength(1);
      expect(view().activeDelegate).toBe('GPU');
      expect(view().events.some((e) => e.kind === 'gpu-ok')).toBe(true);
    });

    it('switches to CPU when the GPU produces no results in time', async () => {
      vi.useFakeTimers();
      try {
        const { session, pipelines, view } = setup();
        await session.start();
        await vi.advanceTimersByTimeAsync(8_000);
        expect(pipelines.map((p) => p.config.delegate)).toEqual(['GPU', 'CPU']);
        expect(view().activeDelegate).toBe('CPU');
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores observations from the GPU pipeline once it was replaced', async () => {
      const { session, pipelines, view } = setup();
      await session.start();
      emit(pipelines[0], 800, 8);
      await settle();
      pipelines[0]?.cb.onObservation({ ...obs, handPresent: true, handCount: 1 }, 800, 1);
      expect(view().latest?.handPresent).not.toBe(true);
    });
  });
});
