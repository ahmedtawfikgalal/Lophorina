import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the labeled replay dataset that the Week 3 gesture engine is tested against.

type Range = [number, number];
type Segment = { fromS: number; toS: number; kind: string; expected: Record<string, Range> };
type Manifest = {
  recordings: { file: string; status: string; segments: Segment[] }[];
  superseded: string[];
};
type Recording = { kind: string; observations: { timestamp: number }[] };

const dir = join(import.meta.dirname, '..', 'replay');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;
const INTENTS = ['PALM_HOLD', 'SWIPE_LEFT', 'SWIPE_RIGHT'];
const KINDS = ['palm-hold', 'swipe-left', 'swipe-right', 'negative'];

describe('replay manifest', () => {
  it.each(manifest.recordings.map((r) => [r.file, r] as const))(
    '%s is well formed',
    (file, rec) => {
      expect(existsSync(join(dir, file))).toBe(true);
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Recording;
      expect(data.kind).toBe('lophorina-landmark-recording');
      const first = data.observations[0]?.timestamp ?? 0;
      const spanS = ((data.observations.at(-1)?.timestamp ?? 0) - first) / 1000;

      let prevEnd = 0;
      for (const seg of rec.segments) {
        expect(KINDS).toContain(seg.kind);
        expect(seg.fromS).toBeGreaterThanOrEqual(prevEnd);
        expect(seg.toS).toBeGreaterThan(seg.fromS);
        prevEnd = seg.toS;
        for (const [intent, [min, max]] of Object.entries(seg.expected)) {
          expect(INTENTS).toContain(intent);
          expect(min).toBeLessThanOrEqual(max);
        }
        if (seg.kind === 'negative') {
          expect(Object.values(seg.expected).every(([, max]) => max === 0)).toBe(true);
        }
      }
      expect(prevEnd).toBeGreaterThanOrEqual(spanS - 1);
    },
  );

  it('does not label superseded recordings', () => {
    const labeled = new Set(manifest.recordings.map((r) => r.file));
    expect(manifest.superseded.filter((f) => labeled.has(f))).toEqual([]);
  });
});
