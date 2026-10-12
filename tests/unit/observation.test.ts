import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { toObservation } from '../../src/recognition/types';

const cat = (categoryName: string, score: number) => ({
  categoryName,
  score,
  index: -1,
  displayName: '',
});
const hand = (x: number) => Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0, visibility: 0 }));

function result(
  hands: { gesture: string; score: number; side: string; x: number }[],
): GestureRecognizerResult {
  return {
    landmarks: hands.map((h) => hand(h.x)),
    worldLandmarks: hands.map((h) => hand(h.x)),
    handedness: hands.map((h) => [cat(h.side, 0.99)]),
    handednesses: hands.map((h) => [cat(h.side, 0.99)]),
    gestures: hands.map((h) => [cat(h.gesture, h.score)]),
  };
}

describe('toObservation', () => {
  it('reports no hand as a non-command observation', () => {
    expect(toObservation(result([]), 5)).toEqual({
      timestamp: 5,
      handPresent: false,
      category: 'None',
      confidence: 0,
      handCount: 0,
    });
  });

  it('describes a single hand', () => {
    const obs = toObservation(
      result([{ gesture: 'Open_Palm', score: 0.9, side: 'Right', x: 0.3 }]),
      10,
    );
    expect(obs).toMatchObject({
      handPresent: true,
      category: 'Open_Palm',
      confidence: 0.9,
      handedness: 'Right',
      handCount: 1,
    });
    expect(obs.landmarks).toHaveLength(21);
    expect(obs.landmarks?.[0]).toEqual({ x: 0.3, y: 0.5, z: 0 });
  });

  it('picks the most confident hand when several are visible', () => {
    const obs = toObservation(
      result([
        { gesture: 'None', score: 0.4, side: 'Left', x: 0.1 },
        { gesture: 'Open_Palm', score: 0.85, side: 'Right', x: 0.7 },
      ]),
      10,
    );
    expect(obs).toMatchObject({ category: 'Open_Palm', handedness: 'Right', handCount: 2 });
    expect(obs.landmarks?.[0]?.x).toBe(0.7);
  });
});
