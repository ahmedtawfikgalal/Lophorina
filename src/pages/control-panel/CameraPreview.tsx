import { useEffect, useRef, useState } from 'react';
import type { CameraSession } from '../../camera-host/camera-session';
import {
  GUIDE,
  handPlacement,
  PLACEMENT_HINT,
  type HandPlacement,
} from '../../recognition/hand-placement';
import type { GestureObservation } from '../../recognition/types';

// Standard 21-point hand skeleton.
const CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

type HandStatus = { text: string; tone: 'ok' | 'hint' };

function describe(obs: GestureObservation | null): HandStatus | null {
  if (!obs) return null;
  if (!obs.handPresent) return { text: 'No hand detected — keep your hand in view', tone: 'hint' };
  if (obs.handCount > 1) return { text: 'Multiple hands — use one hand', tone: 'hint' };
  const placement: HandPlacement = obs.landmarks ? handPlacement(obs.landmarks) : 'good';
  return placement === 'good'
    ? { text: PLACEMENT_HINT.good, tone: 'ok' }
    : { text: PLACEMENT_HINT[placement], tone: 'hint' };
}

function draw(
  canvas: HTMLCanvasElement,
  obs: GestureObservation | null,
  cssVar: (n: string) => string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);

  const good = !!obs?.landmarks && handPlacement(obs.landmarks) === 'good';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = good ? cssVar('--color-success') : 'rgba(255,255,255,0.8)';
  ctx.strokeRect(
    GUIDE.left * w,
    GUIDE.top * h,
    (GUIDE.right - GUIDE.left) * w,
    (GUIDE.bottom - GUIDE.top) * h,
  );
  ctx.setLineDash([]);

  const pts = obs?.landmarks;
  if (!pts) return;
  ctx.strokeStyle = good ? cssVar('--color-success') : cssVar('--color-warning');
  ctx.lineWidth = 3;
  for (const [a, b] of CONNECTIONS) {
    const p = pts[a];
    const q = pts[b];
    if (!p || !q) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Mirrored live preview with the hand guide and landmark overlay. */
export function CameraPreview({
  session,
  stream,
}: {
  session: CameraSession;
  stream: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<HandStatus | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const cssVar = (n: string) => styles.getPropertyValue(n).trim();
    let lastText = '';
    return session.subscribeObservations((obs) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video && video.videoWidth) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        draw(canvas, obs, cssVar);
      }
      // Only re-render (and re-announce) when the message changes.
      const next = describe(obs);
      if ((next?.text ?? '') !== lastText) {
        lastText = next?.text ?? '';
        setStatus(next);
      }
    });
  }, [session]);

  return (
    <>
      <div className="preview">
        <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" />
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <p className={`hand-status hand-status--${status?.tone ?? 'hint'}`} aria-live="polite">
        {status?.text ?? 'Looking for your hand…'}
      </p>
    </>
  );
}
