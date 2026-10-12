import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GestureEngine, type GestureIntent } from '../../src/interaction/gesture-engine';
import type { GestureObservation } from '../../src/recognition/types';

// Runs the gesture engine over the labeled Week 1 recordings (tests/replay/manifest.json).
// Negative segments must produce no intents at all; gesture segments must land in range.

type Range = [number, number];
type Segment = { fromS: number; toS: number; kind: string; expected: Record<string, Range> };
type Manifest = { recordings: { file: string; segments: Segment[] }[] };

const dir = join(import.meta.dirname, '..', 'replay');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;

const intentName = (i: GestureIntent) => (i.kind === 'SWIPE' ? `SWIPE_${i.direction}` : i.kind);

function replay(file: string) {
  const { observations } = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
    observations: GestureObservation[];
  };
  const t0 = observations[0]?.timestamp ?? 0;
  const engine = new GestureEngine();
  const intents: { atS: number; name: string }[] = [];
  for (const obs of observations) {
    const intent = engine.push(obs);
    if (intent) intents.push({ atS: (obs.timestamp - t0) / 1000, name: intentName(intent) });
  }
  return intents;
}

describe.each(manifest.recordings.map((r) => [r.file, r] as const))('replay %s', (file, rec) => {
  const intents = replay(file);

  it.each(rec.segments.map((s) => [`${s.kind} ${s.fromS}-${s.toS}s`, s] as const))(
    '%s',
    (_, seg) => {
      const inSeg = intents.filter((i) => i.atS >= seg.fromS && i.atS < seg.toS);
      const counts: Record<string, number> = {};
      for (const i of inSeg) counts[i.name] = (counts[i.name] ?? 0) + 1;
      const report = inSeg.map((i) => `${i.name}@${i.atS.toFixed(1)}`).join(' ');

      if (seg.kind === 'negative') expect(report).toBe('');
      for (const [name, [min, max]] of Object.entries(seg.expected)) {
        const n = counts[name] ?? 0;
        expect(n, `${name}: ${report}`).toBeGreaterThanOrEqual(min);
        expect(n, `${name}: ${report}`).toBeLessThanOrEqual(max);
      }
    },
  );
});
