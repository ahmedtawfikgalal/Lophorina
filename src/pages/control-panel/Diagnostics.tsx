import { useState } from 'react';
import type { CameraSession, SessionSettings, SessionView } from '../../camera-host/camera-session';
import { cameraIsOn } from '../../camera-host/lifecycle';
import type { Strategy } from '../../camera-host/pipelines';
import { buildRecording, buildSpikeReport, downloadJson } from '../../camera-host/spike-report';
import { Button } from '../../design-system/components/Button';
import type { Delegate } from '../../recognition/types';
import type { YouTubeTarget } from './youtube-target';

const RECORDER_ENABLED = import.meta.env.VITE_DEV_TOOLS === 'true';

const fmt = (v: number | null | undefined, digits = 1) => (v == null ? '—' : v.toFixed(digits));

type Props = { session: CameraSession; view: SessionView; target: YouTubeTarget | null };

/** Week 1 spike tools: YouTube probe, pipeline settings, measurements, recorder. */
export function Diagnostics({ session, view, target }: Props) {
  const [label, setLabel] = useState('');
  const on = cameraIsOn(view.lifecycle);
  const editable = view.lifecycle === 'OFF' || view.lifecycle === 'ERROR';
  const setSetting = (patch: Partial<SessionSettings>) =>
    session.setSettings({ ...view.settings, ...patch });
  const m = view.metrics;

  return (
    <details className="diagnostics">
      <summary>Diagnostics</summary>

      <h3>YouTube tab</h3>
      <p>{target?.focused ? `Focused: ${target.title ?? 'YouTube'}` : 'No YouTube tab focused'}</p>
      {target?.focused && (
        <p className="hint">
          {target.probe
            ? `Content script OK · watch page: ${target.probe.onWatchPage ? 'yes' : 'no'} · main video: ${target.probe.hasMainVideo ? (target.probe.paused ? 'paused' : 'playing') : 'none'}${target.probe.adShowing ? ' · ad showing' : ''}`
            : 'Content script not reachable — reload the YouTube tab.'}
        </p>
      )}

      <h3>Recognition settings</h3>
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
          Preferred delegate
          <select
            value={view.settings.delegate}
            onChange={(e) => setSetting({ delegate: e.target.value as Delegate })}
          >
            <option value="GPU">GPU (falls back to CPU)</option>
            <option value="CPU">CPU</option>
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

      <h3>Commands since Start Control</h3>
      <dl className="grid">
        <dt>From gestures</dt>
        <dd>{view.commandStats.gesture}</dd>
        <dt>From buttons</dt>
        <dd>{view.commandStats.button}</dd>
        <dt>Failed</dt>
        <dd>{view.commandStats.failed}</dd>
        <dt>Response P50 / P95</dt>
        <dd>
          {fmt(view.commandStats.latencyP50, 0)} / {fmt(view.commandStats.latencyP95, 0)} ms
        </dd>
      </dl>

      <h3>Measurements</h3>
      <dl className="grid">
        <dt>Delegate in use</dt>
        <dd>{view.activeDelegate ?? '—'}</dd>
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
      <Button
        disabled={!m}
        onClick={() =>
          void buildSpikeReport(view).then((r) =>
            downloadJson(r, `lophorina-spike-${view.settings.strategy}-${Date.now()}.json`),
          )
        }
      >
        Export spike report
      </Button>

      {RECORDER_ENABLED && (
        <>
          <h3>Landmark recorder (dev only)</h3>
          <label>
            Session label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. palm-hold-bright-50cm"
            />
          </label>
          {view.recording ? (
            <Button
              onClick={() => {
                const obs = session.stopRecording();
                void buildRecording(obs, label).then((r) =>
                  downloadJson(r, `lophorina-recording-${label || 'unlabeled'}-${Date.now()}.json`),
                );
              }}
            >
              Stop and save ({view.recordedCount})
            </Button>
          ) : (
            <Button disabled={!on} onClick={() => session.startRecording()}>
              Start recording
            </Button>
          )}
          <p className="hint">Saves landmarks and gesture scores only — never video frames.</p>
        </>
      )}
    </details>
  );
}
