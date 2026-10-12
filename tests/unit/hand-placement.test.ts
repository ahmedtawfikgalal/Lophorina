import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handPlacement } from '../../src/recognition/hand-placement';
import type { Landmark } from '../../src/recognition/types';

/** A 21-point hand centered at (cx, cy) with the given height. */
function hand(cx: number, cy: number, size = 0.3): Landmark[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: cx + ((i % 5) - 2) * 0.02,
    y: cy + (i / 20 - 0.5) * size,
    z: 0,
  }));
}

describe('handPlacement', () => {
  it('accepts a centered hand of normal size', () => {
    expect(handPlacement(hand(0.5, 0.45))).toBe('good');
  });

  it('detects a hand that is too low, high, close or far', () => {
    expect(handPlacement(hand(0.5, 0.9))).toBe('too-low');
    expect(handPlacement(hand(0.5, 0.05))).toBe('too-high');
    expect(handPlacement(hand(0.5, 0.45, 0.8))).toBe('too-close');
    expect(handPlacement(hand(0.5, 0.45, 0.1))).toBe('too-far-away');
  });

  it('uses the user’s left and right (the raw frame is not mirrored)', () => {
    expect(handPlacement(hand(0.9, 0.45))).toBe('too-far-left');
    expect(handPlacement(hand(0.1, 0.45))).toBe('too-far-right');
  });

  it('flags a wrist past the bottom edge even when the palm is centered', () => {
    const h = hand(0.5, 0.6, 0.5);
    h[0] = { x: 0.5, y: 0.98, z: 0 };
    expect(handPlacement(h)).toBe('too-low');
  });

  it('accepts most real Week 1 palm-hold frames', () => {
    const file = join(
      import.meta.dirname,
      '..',
      'replay',
      'lophorina-recording-full-2-minutes-1791804121662.json',
    );
    const { observations } = JSON.parse(readFileSync(file, 'utf8')) as {
      observations: { timestamp: number; landmarks?: Landmark[] }[];
    };
    const t0 = observations[0]?.timestamp ?? 0;
    const palmPart = observations.filter(
      (o) => o.landmarks && o.timestamp - t0 >= 3_000 && o.timestamp - t0 < 25_000,
    );
    const good = palmPart.filter((o) => handPlacement(o.landmarks ?? []) === 'good').length;
    // Thresholds must not nag a user whose gestures were recognized fine.
    expect(good / palmPart.length).toBeGreaterThan(0.75);
  });
});
