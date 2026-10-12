import { describe, expect, it } from 'vitest';
import { GestureEngine, type GestureIntent } from '../../src/interaction/gesture-engine';
import type { GestureObservation } from '../../src/recognition/types';

const FRAME_MS = 66;

/** A hand of height `size` with its palm center at (x, y). */
function obs(
  t: number,
  x: number,
  y: number,
  category = 'Open_Palm',
  size = 0.4,
): GestureObservation {
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

/** Feeds frames produced by `at(i)` and returns the intents with their frame index. */
function feed(
  engine: GestureEngine,
  frames: number,
  at: (i: number, t: number) => GestureObservation,
  t0 = 0,
) {
  const out: { i: number; intent: GestureIntent }[] = [];
  for (let i = 0; i < frames; i++) {
    const intent = engine.push(at(i, t0 + i * FRAME_MS));
    if (intent) out.push({ i, intent });
  }
  return out;
}

/** Linear horizontal move from x0 to x1 over `frames` frames. */
const move = (x0: number, x1: number, frames: number) => (i: number, t: number) =>
  obs(t, x0 + ((x1 - x0) * Math.min(i, frames)) / frames, 0.5);

describe('GestureEngine — palm hold', () => {
  it('fires once after a still palm is held for 700 ms', () => {
    const got = feed(new GestureEngine(), 40, (_, t) => obs(t, 0.5, 0.5));
    expect(got).toHaveLength(1);
    expect(got[0]?.intent).toEqual({ kind: 'PALM_HOLD' });
    expect((got[0]?.i ?? 0) * FRAME_MS).toBeGreaterThanOrEqual(700);
  });

  it('fires again only after the hand moves (re-arm), not while held', () => {
    const e = new GestureEngine();
    expect(feed(e, 40, (_, t) => obs(t, 0.5, 0.5))).toHaveLength(1);
    // Push toward the camera and back: the hand size changes, re-arming the hold.
    const t1 = 40 * FRAME_MS;
    expect(feed(e, 4, (_, t) => obs(t, 0.5, 0.5, 'Open_Palm', 0.6), t1)).toHaveLength(0);
    expect(feed(e, 40, (_, t) => obs(t, 0.5, 0.5), t1 + 4 * FRAME_MS)).toHaveLength(1);
  });

  it('ignores a held fist and a palm resting at the frame edge', () => {
    expect(feed(new GestureEngine(), 40, (_, t) => obs(t, 0.5, 0.5, 'Closed_Fist'))).toHaveLength(
      0,
    );
    expect(feed(new GestureEngine(), 40, (_, t) => obs(t, 0.03, 0.5))).toHaveLength(0);
  });

  it('never fires from missing hands', () => {
    expect(feed(new GestureEngine(), 40, (_, t) => none(t))).toHaveLength(0);
  });
});

describe('GestureEngine — swipes', () => {
  it('maps image motion to the user’s direction (frame not mirrored)', () => {
    expect(feed(new GestureEngine(), 10, move(0.3, 0.8, 8))[0]?.intent).toEqual({
      kind: 'SWIPE',
      direction: 'LEFT',
    });
    expect(feed(new GestureEngine(), 10, move(0.8, 0.3, 8))[0]?.intent).toEqual({
      kind: 'SWIPE',
      direction: 'RIGHT',
    });
  });

  it('emits one swipe per motion and suppresses the return stroke', () => {
    const e = new GestureEngine();
    const swipe = feed(e, 10, move(0.3, 0.8, 8));
    const ret = feed(e, 12, move(0.8, 0.3, 10), 10 * FRAME_MS); // starts right after the swipe
    expect(swipe).toHaveLength(1);
    expect(ret).toHaveLength(0);
  });

  it('allows a repeated swipe in the same direction after the cooldown', () => {
    const e = new GestureEngine();
    feed(e, 10, move(0.3, 0.8, 8));
    feed(e, 20, (_, t) => none(t), 10 * FRAME_MS); // hand out of view, back to the start
    expect(feed(e, 10, move(0.3, 0.8, 8), 30 * FRAME_MS)).toHaveLength(1);
  });

  it('ignores slow drifts, small moves, and single-frame tracking jumps', () => {
    expect(feed(new GestureEngine(), 40, move(0.3, 0.8, 38))).toHaveLength(0); // ~0.2/s
    expect(feed(new GestureEngine(), 10, move(0.45, 0.6, 5))).toHaveLength(0);
    const jump = (i: number, t: number) => obs(t, i < 5 ? 0.3 : 0.75, 0.5);
    expect(
      feed(new GestureEngine(), 10, jump).filter((g) => g.intent.kind === 'SWIPE'),
    ).toHaveLength(0);
  });

  it('ignores mostly vertical motion', () => {
    const vertical = (i: number, t: number) => obs(t, 0.4 + i * 0.03, 0.2 + i * 0.08);
    expect(feed(new GestureEngine(), 8, vertical)).toHaveLength(0);
  });
});
