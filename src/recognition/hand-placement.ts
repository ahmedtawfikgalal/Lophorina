import type { Landmark } from './types';

// Where the hand sits in the camera frame, used for the "keep your hand here" guide.
// In Week 1 recordings the wrist was at the bottom edge in about a quarter of palm-hold
// frames; that did not lower gesture scores, but it risks losing the hand mid-gesture
// (docs/delivery/week-1-spike.md, S11).

/** Guide area in normalized, non-mirrored image coordinates. */
export const GUIDE = { left: 0.2, right: 0.8, top: 0.1, bottom: 0.8 } as const;

/** Hand height as a fraction of frame height. */
const MIN_HAND_SIZE = 0.15;
const MAX_HAND_SIZE = 0.7;
/** Wrist below this (normalized y) is at or past the bottom edge of the frame. */
const MAX_WRIST_Y = 0.95;

export type HandPlacement =
  'good' | 'too-low' | 'too-high' | 'too-far-left' | 'too-far-right' | 'too-far-away' | 'too-close';

// Palm center: wrist and the four finger bases (MediaPipe hand landmark indices).
const PALM = [0, 5, 9, 13, 17];

export function handPlacement(landmarks: ReadonlyArray<Landmark>): HandPlacement {
  if (landmarks.length < 21) return 'too-far-away';
  const palm = PALM.map((i) => landmarks[i]).filter((p): p is Landmark => p !== undefined);
  const cx = palm.reduce((s, p) => s + p.x, 0) / palm.length;
  const cy = palm.reduce((s, p) => s + p.y, 0) / palm.length;
  const ys = landmarks.map((p) => p.y);
  const size = Math.max(...ys) - Math.min(...ys);

  if (size > MAX_HAND_SIZE) return 'too-close';
  if (size < MIN_HAND_SIZE) return 'too-far-away';
  if (cy > GUIDE.bottom || (landmarks[0]?.y ?? 0) > MAX_WRIST_Y) return 'too-low';
  if (cy < GUIDE.top) return 'too-high';
  // Raw image x grows toward the user's left (the frame is not mirrored).
  if (cx > GUIDE.right) return 'too-far-left';
  if (cx < GUIDE.left) return 'too-far-right';
  return 'good';
}

export const PLACEMENT_HINT: Record<HandPlacement, string> = {
  good: 'Hand in position',
  'too-low': 'Raise your hand a little',
  'too-high': 'Lower your hand a little',
  'too-far-left': 'Move your hand a little to the right',
  'too-far-right': 'Move your hand a little to the left',
  'too-far-away': 'Move your hand closer to the camera',
  'too-close': 'Move your hand a little further from the camera',
};
