import { useEffect, useState } from 'react';
import type { Feedback } from '../../camera-host/camera-session';

const SHOW_MS = 3_000;

/** Briefly shows the latest gesture or command outcome; announced to screen readers. */
export function GestureFeedback({ feedback }: { feedback: Feedback | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!feedback) return setVisible(false);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <p
      className={`gesture-feedback gesture-feedback--${feedback?.tone ?? 'info'}`}
      aria-live="polite"
    >
      {visible && feedback ? feedback.text : ''}
    </p>
  );
}
