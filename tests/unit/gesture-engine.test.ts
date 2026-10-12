import { describe, expect, it } from 'vitest';
import { GestureEngine, type Pose } from '../../src/interaction/gesture-engine';
import type { GestureObservation } from '../../src/recognition/types';

const FRAME_MS = 66;

/** A hand of height `size` with its palm center at (x, y), showing `category`. */
function obs(t: number, category = 'Open_Palm', x = 0.5, y = 0.5, size = 0.4): GestureObservation {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({
    x,
    y: y + (i / 20 - 0.5) * size,
    z: 0,
  }));
  // Palm-center indices (0, 5, 9, 13, 17) average to y; keep them on the center line.
  for (const i of [0, 5, 9, 13, 17]) landmarks[i] = { x, y, z: 0 };
  return { timestamp: t, handPresent: true, category, confidence: 0.6, handCount: 1, landmarks };
}

const none = (t: number): GestureObservation => ({
  timestamp: t,
  handPresent: false,
  category: 'None',
  confidence: 0,
  handCount: 0,
});

/** Feeds `frames` observations from `at` and returns the poses that fired. */
function feed(
  engine: GestureEngine,
  frames: number,
  at: (t: number, i: number) => GestureObservation,
  t0 = 0,
): Pose[] {
  const out: Pose[] = [];
  for (let i = 0; i < frames; i++) {
    const intent = engine.push(at(t0 + i * FRAME_MS, i));
    if (intent) out.push(intent.pose);
  }
  return out;
}

describe('GestureEngine', () => {
  it.each([
    ['Open_Palm', 'OPEN_PALM'],
    ['Thumb_Up', 'THUMB_UP'],
    ['Thumb_Down', 'THUMB_DOWN'],
  ] as const)('fires %s once after a 700 ms still hold', (category, pose) => {
    const e = new GestureEngine();
    expect(feed(e, 10, (t) => obs(t, category))).toEqual([]); // 594 ms: not yet
    expect(feed(e, 30, (t) => obs(t, category), 10 * FRAME_MS)).toEqual([pose]);
  });

  it('fires again only after the hand moves (re-arm), not while held', () => {
    const e = new GestureEngine();
    expect(feed(e, 40, (t) => obs(t))).toEqual(['OPEN_PALM']);
    // Push toward the camera and back: the hand size changes, re-arming the hold.
    let t = 40 * FRAME_MS;
    feed(e, 4, (tt) => obs(tt, 'Open_Palm', 0.5, 0.5, 0.6), t);
    t += 4 * FRAME_MS;
    expect(feed(e, 40, (tt) => obs(tt), t)).toEqual(['OPEN_PALM']);
  });

  it('does not fire twice when one frame is misclassified as another pose', () => {
    const flicker = (t: number, i: number) => obs(t, i === 20 ? 'Thumb_Up' : 'Open_Palm');
    expect(feed(new GestureEngine(), 60, flicker)).toEqual(['OPEN_PALM']);
  });

  it('switches from palm to thumb when the hand shape changes', () => {
    const e = new GestureEngine();
    expect(feed(e, 40, (t) => obs(t))).toEqual(['OPEN_PALM']);
    // A thumbs-up hand is shorter than an open palm.
    const thumb = (t: number) => obs(t, 'Thumb_Up', 0.5, 0.5, 0.25);
    expect(feed(e, 40, thumb, 40 * FRAME_MS)).toEqual(['THUMB_UP']);
  });

  it('respects the cooldown between gestures', () => {
    const e = new GestureEngine({ holdMs: 100 });
    const got = [
      ...feed(e, 6, (t) => obs(t)),
      ...feed(e, 6, (t) => obs(t, 'Thumb_Up', 0.5, 0.5, 0.25), 6 * FRAME_MS),
    ];
    expect(got).toEqual(['OPEN_PALM']); // the thumb hold completed inside the 1 s cooldown
  });

  it('ignores fists, poses at the frame edge, low scores, and missing hands', () => {
    expect(feed(new GestureEngine(), 40, (t) => obs(t, 'Closed_Fist'))).toEqual([]);
    expect(feed(new GestureEngine(), 40, (t) => obs(t, 'Open_Palm', 0.03))).toEqual([]);
    const weak = (t: number) => ({ ...obs(t, 'Thumb_Up'), confidence: 0.4 });
    expect(feed(new GestureEngine(), 40, weak)).toEqual([]);
    expect(feed(new GestureEngine(), 40, (t) => none(t))).toEqual([]);
  });

  it('does not fire for a pose that keeps moving', () => {
    const waving = (t: number, i: number) => obs(t, 'Open_Palm', 0.3 + (i % 10) * 0.04);
    expect(feed(new GestureEngine(), 60, waving)).toEqual([]);
  });

  it('never fires a pose the user turned off', () => {
    const enabled = { OPEN_PALM: true, THUMB_UP: false, THUMB_DOWN: true };
    expect(feed(new GestureEngine({ enabled }), 40, (t) => obs(t, 'Thumb_Up'))).toEqual([]);
    expect(feed(new GestureEngine({ enabled }), 40, (t) => obs(t))).toEqual(['OPEN_PALM']);
  });

  it('uses the configured hold time', () => {
    const e = new GestureEngine({ holdMs: 1_500 });
    expect(feed(e, 20, (t) => obs(t))).toEqual([]); // 1.25 s
    expect(feed(e, 10, (t) => obs(t), 20 * FRAME_MS)).toEqual(['OPEN_PALM']);
  });
});
