import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CameraSession, SessionView } from '../../camera-host/camera-session';
import { cameraIsOn } from '../../camera-host/lifecycle';
import { Button } from '../../design-system/components/Button';
import { StatusBadge } from '../../design-system/components/StatusBadge';
import { CameraPreview } from './CameraPreview';
import { Diagnostics } from './Diagnostics';
import { GestureFeedback } from './GestureFeedback';
import { GestureSettingsPanel } from './GestureSettingsPanel';
import type { YouTubeTarget } from './youtube-target';

type Props = {
  session: CameraSession;
  watchYouTube: (onChange: (t: YouTubeTarget) => void) => () => void;
};

// Developer tools (Diagnostics, recorder) exist only in spike builds, not in the store build.
const DEV_TOOLS = import.meta.env.VITE_DEV_TOOLS === 'true';

const openPermissionPage = () =>
  void chrome.tabs.create({ url: chrome.runtime.getURL('pages/permission/index.html') });

function statusOf(view: SessionView) {
  switch (view.lifecycle) {
    case 'OFF':
      return { tone: 'inactive', text: 'Control is off' } as const;
    case 'REQUESTING_PERMISSION':
      return { tone: 'inactive', text: 'Requesting camera access…' } as const;
    case 'INITIALIZING':
      return { tone: 'active', text: 'Starting camera…' } as const;
    case 'READY':
      return { tone: 'active', text: 'Camera on — not controlling yet' } as const;
    case 'TRACKING':
      return { tone: 'active', text: 'Control active' } as const;
    case 'ERROR':
      return { tone: 'error', text: 'Camera error' } as const;
  }
}

export function App({ session, watchYouTube }: Props) {
  const view = useSyncExternalStore(session.subscribe, session.getView);
  const [target, setTarget] = useState<YouTubeTarget | null>(null);

  useEffect(
    () =>
      watchYouTube((t) => {
        setTarget(t);
        session.setYouTubeFocused(t.focused, t.title ?? undefined);
        // Only a reachable YouTube watch page can be controlled.
        session.setTarget(
          t.focused && t.tabId !== null && t.probe?.onWatchPage
            ? { tabId: t.tabId, title: t.title }
            : null,
        );
      }),
    [session, watchYouTube],
  );

  const on = cameraIsOn(view.lifecycle);
  const idle = view.lifecycle === 'OFF' || view.lifecycle === 'ERROR';
  // The Side Panel cannot show Chrome's camera prompt (Week 1, S1): grant it in a tab first.
  const needsGrant = idle && (view.permission === 'prompt' || view.needsPermissionPage);
  const status = statusOf(view);

  return (
    <main className="panel">
      <header className="panel__header">
        <h1>Lophorina</h1>
        <span className="tag">v{chrome.runtime.getManifest().version}</span>
      </header>

      <section aria-label="Control">
        <StatusBadge tone={status.tone}>{status.text}</StatusBadge>

        {needsGrant ? (
          <div className="onboarding">
            <h2>Allow camera access</h2>
            <p>
              Lophorina recognizes hand gestures on your device; video never leaves your computer.
              Chrome can’t ask for the camera from this panel, so a tab opens where you allow it
              once.
            </p>
            <Button variant="primary" onClick={openPermissionPage}>
              Allow camera access
            </Button>
            <p className="hint">Come back here afterwards; this message disappears by itself.</p>
          </div>
        ) : on || view.lifecycle === 'REQUESTING_PERMISSION' ? (
          <Button variant="danger" onClick={() => session.stop()}>
            Stop Control
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void session.start()}>
            {view.lifecycle === 'ERROR' ? 'Try again' : 'Start Control'}
          </Button>
        )}
        <p className="hint">Shortcut: Alt+Shift+G. Closing this panel also stops the camera.</p>

        {view.error && !view.needsPermissionPage && (
          <div className="alert" role="alert">
            <p>{view.error}</p>
          </div>
        )}
        {view.notice && (
          <p className="notice" role="note">
            {view.notice}
          </p>
        )}
      </section>

      {!on && (
        <section aria-labelledby="howto-heading">
          <h2 id="howto-heading">How to use</h2>
          <ol className="howto">
            <li>Open a YouTube video in this window.</li>
            <li>Press Start Control and keep your hand in front of the camera.</li>
            <li>
              Hold a pose still for about a second: <strong>open palm</strong> = Play/Pause,{' '}
              <strong>thumb up</strong> = +10 s, <strong>thumb down</strong> = −10 s.
            </li>
            <li>Press Stop Control or close this panel to turn the camera off.</li>
          </ol>
          <p className="hint">Video is processed on your device and never leaves it.</p>
        </section>
      )}

      {on && view.stream && (
        <section aria-labelledby="camera-heading">
          <h2 id="camera-heading">Camera</h2>
          <CameraPreview session={session} stream={view.stream} />
          <GestureFeedback feedback={view.feedback} />
          <p className="hint">
            Hold a pose still for about a second: open palm = Play/Pause, thumb up = +10 s, thumb
            down = −10 s.
          </p>
        </section>
      )}

      <section aria-labelledby="youtube-heading">
        <h2 id="youtube-heading">YouTube</h2>
        <p className={view.target ? 'target target--ok' : 'target'}>
          {view.target
            ? `Controlling: ${view.target.title?.replace(/ - YouTube$/, '') ?? 'YouTube video'}`
            : target?.focused && !target.probe
              ? 'Reload the YouTube tab so Lophorina can reach it.'
              : 'Open a YouTube video in this window to control it.'}
        </p>
        <div className="media-buttons" role="group" aria-label="Video controls">
          <Button
            disabled={!view.target}
            onClick={() => session.sendManual({ type: 'MEDIA_SEEK', deltaSeconds: -10 })}
          >
            −10 s
          </Button>
          <Button
            disabled={!view.target}
            onClick={() => session.sendManual({ type: 'MEDIA_TOGGLE' })}
          >
            Play/Pause
          </Button>
          <Button
            disabled={!view.target}
            onClick={() => session.sendManual({ type: 'MEDIA_SEEK', deltaSeconds: 10 })}
          >
            +10 s
          </Button>
        </div>
        {!(on && view.stream) && <GestureFeedback feedback={view.feedback} />}
      </section>

      <GestureSettingsPanel session={session} settings={view.gestureSettings} />
      {DEV_TOOLS && <Diagnostics session={session} view={view} target={target} />}
    </main>
  );
}
