import { useEffect, useState } from 'react';
import type { SessionView } from '../../camera-host/camera-session';
import type { GestureIntent } from '../../interaction/gesture-engine';

const SHOW_MS = 2_500;

// Command each gesture will trigger (ADR-004).
const LABEL: Record<GestureIntent['pose'], string> = {
  OPEN_PALM: 'Play/Pause',
  THUMB_UP: 'Seek +10 s',
  THUMB_DOWN: 'Seek −10 s',
};

/** Briefly names the recognized gesture; announced to screen readers. */
export function GestureFeedback({ lastIntent }: { lastIntent: SessionView['lastIntent'] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastIntent) return setVisible(false);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [lastIntent]);

  return (
    <p className="gesture-feedback" aria-live="polite">
      {visible && lastIntent ? `${LABEL[lastIntent.intent.pose]} recognized` : ''}
    </p>
  );
}
