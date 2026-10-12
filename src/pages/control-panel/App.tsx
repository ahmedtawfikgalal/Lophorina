import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CameraSession, SessionView } from '../../camera-host/camera-session';
import { cameraIsOn } from '../../camera-host/lifecycle';
import { Button } from '../../design-system/components/Button';
import { StatusBadge } from '../../design-system/components/StatusBadge';
import { CameraPreview } from './CameraPreview';
import { Diagnostics } from './Diagnostics';
import { GestureFeedback } from './GestureFeedback';
import type { YouTubeTarget } from './youtube-target';

type Props = {
  session: CameraSession;
  watchYouTube: (onChange: (t: YouTubeTarget) => void) => () => void;
};

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
        <span className="tag">Preview build</span>
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

      {on && view.stream && (
        <section aria-labelledby="camera-heading">
          <h2 id="camera-heading">Camera</h2>
          <CameraPreview session={session} stream={view.stream} />
          <GestureFeedback lastIntent={view.lastIntent} />
          <p className="hint">
            Gestures: hold an open palm still for Play/Pause; swipe left or right to seek. In this
            build they are only shown here, not sent to YouTube.
          </p>
        </section>
      )}

      <Diagnostics session={session} view={view} target={target} />
    </main>
  );
}
