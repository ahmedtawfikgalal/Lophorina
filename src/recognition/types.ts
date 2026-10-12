import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';

export type Landmark = { x: number; y: number; z: number };

/** Recognition-layer output: an observation, never a command (ADR-003). */
export type GestureObservation = {
  /** Monotonic timestamp (performance.now() in the producing context). */
  timestamp: number;
  handPresent: boolean;
  /** MediaPipe canned category, e.g. "Open_Palm", "Closed_Fist", "None". */
  category: string;
  confidence: number;
  landmarks?: ReadonlyArray<Landmark>;
  handedness?: 'Left' | 'Right';
  /** Number of hands MediaPipe reported; only the best hand is described above. */
  handCount: number;
};

export type Delegate = 'CPU' | 'GPU';

/**
 * Normalizes a MediaPipe result to a single-hand observation, picking the hand whose
 * top gesture has the highest score (ADR-003: multiple hands → use the most confident).
 */
export function toObservation(
  result: GestureRecognizerResult,
  timestamp: number,
): GestureObservation {
  const handCount = result.landmarks.length;
  if (handCount === 0) {
    return { timestamp, handPresent: false, category: 'None', confidence: 0, handCount: 0 };
  }

  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < handCount; i++) {
    const score = result.gestures[i]?.[0]?.score ?? 0;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }

  const top = result.gestures[best]?.[0];
  const side = result.handedness[best]?.[0]?.categoryName;
  const landmarks = result.landmarks[best]?.map(({ x, y, z }) => ({ x, y, z }));

  return {
    timestamp,
    handPresent: true,
    category: top?.categoryName || 'None',
    confidence: top?.score ?? 0,
    handCount,
    ...(landmarks ? { landmarks } : {}),
    ...(side === 'Left' || side === 'Right' ? { handedness: side } : {}),
  };
}
