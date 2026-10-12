import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CameraSession } from '../../camera-host/camera-session';
import { isFromExtensionPage, isSpikeMessage } from '../../messaging/validate';
import { App } from './App';
import { watchYouTubeTarget } from './youtube-target';
import './styles.css';

// The Side Panel document is the camera host (ADR-001, preferred option).
const session = new CameraSession(chrome.runtime.getURL('mediapipe/'), {
  strategy: 'worker-mstp',
  // GPU was 5–6× faster than CPU in manual run 1 (docs/delivery/week-1-spike.md).
  delegate: 'GPU',
  targetFps: 15,
});

document.addEventListener('visibilitychange', () => session.setPanelHidden(document.hidden));
session.setPanelHidden(document.hidden);

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (
    isFromExtensionPage(sender) &&
    isSpikeMessage(message) &&
    message.type === 'SPIKE_TOGGLE_CONTROL'
  ) {
    session.toggle();
  }
});

// Closing the panel ends the document; stop explicitly so tracks are released promptly.
window.addEventListener('pagehide', () => session.stop());

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App session={session} watchYouTube={watchYouTubeTarget} />
    </StrictMode>,
  );
}
