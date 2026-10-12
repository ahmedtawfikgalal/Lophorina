import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CameraSession, SessionSettings } from '../../camera-host/camera-session';
import { cameraIsOn, type LifecycleState } from '../../camera-host/lifecycle';
import type { Strategy } from '../../camera-host/pipelines';
import { buildRecording, buildSpikeReport, downloadJson } from '../../camera-host/spike-report';
import type { Delegate } from '../../recognition/types';
import type { YouTubeTarget } from './youtube-target';

const RECORDER_ENABLED = import.meta.env.VITE_RECORDER === 'true';

const STATUS_TEXT: Record<LifecycleState, string> = {
  OFF: 'Control is off',
  REQUESTING_PERMISSION: 'Camera permission needed',
  INITIALIZING: 'Starting camera…',
  READY: 'Camera on — not controlling',
  TRACKING: 'Control active',
  ERROR: 'Camera error',
};

type Props = {
  session: CameraSession;
  watchYouTube: (onChange: (t: YouTubeTarget) => void) => () => void;
};

export function App({ session, watchYouTube }: Props) {
  const view = useSyncExternalStore(session.subscribe, session.getView);
  const [target, setTarget] = useState<YouTubeTarget | null>(null);
  const [label, setLabel] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(
    () =>
      watchYouTube((t) => {
        setTarget(t);
        session.setYouTubeFocused(t.focused, t.title ?? undefined);
      }),
    [session, watchYouTube],
  );

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = view.stream;
  }, [view.stream]);

  const on = cameraIsOn(view.lifecycle);
  const editable = view.lifecycle === 'OFF' || view.lifecycle === 'ERROR';
  const setSetting = (patch: Partial<SessionSettings>) =>
    session.setSettings({ ...view.settings, ...patch });
  const m = view.metrics;
  const fmt = (v: number | null | undefined, digits = 1) => (v == null ? '—' : v.toFixed(digits));

  return (
    <main className="panel">
      <header className="panel__header">
        <h1>Lophorina</h1>
        <span className="tag">Week 1 spike</span>
      </header>

      <section aria-labelledby="status-heading">
        <h2 id="status-heading" className="visually-hidden">
          Status
        </h2>
        <p
          className={`status status--${on ? 'on' : view.lifecycle === 'ERROR' ? 'error' : 'off'}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{on ? '●' : view.lifecycle === 'ERROR' ? '⚠' : '○'}</span>{' '}
          {STATUS_TEXT[view.lifecycle]}
        </p>

        {on || view.lifecycle === 'REQUESTING_PERMISSION' ? (
          <button type="button" className="btn btn--danger" onClick={() => session.stop()}>
            Stop Control
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => void session.start()}>
            {view.lifecycle === 'ERROR' ? 'Retry' : 'Start Control'}
          </button>
        )}
        <p className="hint">Shortcut: Alt+Shift+G. Closing this panel also stops the camera.</p>

        {view.error && (
          <div className="alert" role="alert">
            <p>{view.error}</p>
            {view.needsPermissionPage && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() =>
                  void chrome.tabs.create({
                    url: chrome.runtime.getURL('pages/permission/index.html'),
                  })
                }
              >
                Grant camera access in a tab
              </button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading">Camera</h2>
        <video
          ref={videoRef}
          className="preview"
          autoPlay
          muted
          playsInline
          aria-label="Camera preview"
          hidden={!on}
        />
        {view.latest && on && (
          <dl className="grid">
            <dt>Hand</dt>
            <dd>
              {view.latest.handPresent
                ? `${view.latest.handedness ?? 'detected'}${view.latest.handCount > 1 ? ` (${view.latest.handCount} hands)` : ''}`
                : 'No hand detected'}
            </dd>
            <dt>Gesture</dt>
            <dd>
              {view.latest.category} ({fmt(view.latest.confidence * 100, 0)}%)
            </dd>
          </dl>
        )}
      </section>

      <section aria-labelledby="target-heading">
        <h2 id="target-heading">YouTube tab</h2>
        <p>
          {target?.focused ? `Focused: ${target.title ?? 'YouTube'}` : 'No YouTube tab focused'}
        </p>
        {target?.focused && (
          <p className="hint">
            {target.probe
              ? `Content script OK · watch page: ${target.probe.onWatchPage ? 'yes' : 'no'} · main video: ${target.probe.hasMainVideo ? (target.probe.paused ? 'paused' : 'playing') : 'none'}${target.probe.adShowing ? ' · ad showing' : ''}`
              : 'Content script not reachable — reload the YouTube tab.'}
          </p>
        )}
      </section>

      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading">Spike settings</h2>
        <fieldset disabled={!editable}>
          <label>
            Frame loop
            <select
              value={view.settings.strategy}
              onChange={(e) => setSetting({ strategy: e.target.value as Strategy })}
            >
              <option value="worker-mstp">Worker + MediaStreamTrackProcessor</option>
              <option value="main-rvfc">Main thread + requestVideoFrameCallback</option>
            </select>
          </label>
          <label>
            Delegate
            <select
              value={view.settings.delegate}
              onChange={(e) => setSetting({ delegate: e.target.value as Delegate })}
            >
              <option value="CPU">CPU</option>
              <option value="GPU">GPU</option>
            </select>
          </label>
          <label>
            Target rate
            <select
              value={view.settings.targetFps}
              onChange={(e) => setSetting({ targetFps: Number(e.target.value) })}
            >
              <option value={10}>10 fps</option>
              <option value={15}>15 fps</option>
              <option value={30}>30 fps</option>
            </select>
          </label>
        </fieldset>
      </section>

      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading">Measurements</h2>
        <dl className="grid">
          <dt>Observations/s</dt>
          <dd>{m ? m.observationsPerSecond : '—'}</dd>
          <dt>Camera frames/s</dt>
          <dd>
            {m ? m.framesPerSecond : '—'}
            {view.trackSettings?.frameRate
              ? ` (camera reports ${fmt(view.trackSettings.frameRate, 0)})`
              : ''}
          </dd>
          <dt>Inference P50 / P95</dt>
          <dd>
            {fmt(m?.inferenceP50)} / {fmt(m?.inferenceP95)} ms
          </dd>
          <dt>Stalls (&gt;500 ms)</dt>
          <dd>{m ? m.stalls : '—'}</dd>
          <dt>Max gap</dt>
          <dd>{fmt(m?.maxGapMs, 0)} ms</dd>
          <dt>Duration</dt>
          <dd>{m ? `${Math.floor(m.durationMs / 1000)} s` : '—'}</dd>
          <dt>Last stop</dt>
          <dd>{view.lastStopLatencyMs == null ? '—' : `${fmt(view.lastStopLatencyMs)} ms`}</dd>
        </dl>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={!m}
          onClick={() =>
            void buildSpikeReport(view).then((r) =>
              downloadJson(r, `lophorina-spike-${view.settings.strategy}-${Date.now()}.json`),
            )
          }
        >
          Export spike report
        </button>
      </section>

      {RECORDER_ENABLED && (
        <section aria-labelledby="recorder-heading">
          <h2 id="recorder-heading">Landmark recorder (dev only)</h2>
          <label>
            Session label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. palm-hold-bright-50cm"
            />
          </label>
          {view.recording ? (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                const obs = session.stopRecording();
                void buildRecording(obs, label).then((r) =>
                  downloadJson(r, `lophorina-recording-${label || 'unlabeled'}-${Date.now()}.json`),
                );
              }}
            >
              Stop and save ({view.recordedCount})
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!on}
              onClick={() => session.startRecording()}
            >
              Start recording
            </button>
          )}
          <p className="hint">Saves landmarks and gesture scores only — never video frames.</p>
        </section>
      )}
    </main>
  );
}
