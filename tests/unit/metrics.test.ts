import { describe, expect, it } from 'vitest';
import { BUCKET_MS, percentile, SpikeMetrics } from '../../src/camera-host/metrics';

describe('percentile', () => {
  it('uses nearest rank', () => {
    const v = [5, 1, 4, 2, 3, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 95)).toBe(10);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 50)).toBeNull();
  });
});

describe('SpikeMetrics', () => {
  it('counts observations per second and inference latency', () => {
    const m = new SpikeMetrics(0);
    for (let t = 0; t < 2_000; t += 100) m.record(t, 20, true);
    const s = m.snapshot(2_000);
    expect(s.observations).toBe(20);
    expect(s.observationsPerSecond).toBe(10);
    expect(s.inferenceP50).toBe(20);
    expect(s.stalls).toBe(0);
  });

  it('detects stalls and records the max gap', () => {
    const m = new SpikeMetrics(0);
    m.record(0, 10, true);
    m.record(100, 10, true);
    m.record(1_300, 10, true); // 1.2 s gap
    const s = m.snapshot(1_300);
    expect(s.stalls).toBe(1);
    expect(s.maxGapMs).toBe(1_200);
  });

  it('reports an in-progress stall in the live max gap', () => {
    const m = new SpikeMetrics(0);
    m.record(0, 10, true);
    expect(m.snapshot(3_000).maxGapMs).toBe(3_000);
  });

  it('creates empty buckets for silent periods and tags context', () => {
    const m = new SpikeMetrics(0);
    m.setContext({ youtubeFocused: true }, 0);
    m.record(1_000, 10, false);
    m.record(3 * BUCKET_MS + 1, 10, true);
    const { buckets } = m.snapshot(3 * BUCKET_MS + 2);
    expect(buckets.map((b) => b.observations)).toEqual([1, 0, 0, 1]);
    expect(buckets.every((b) => b.youtubeFocused)).toBe(true);
    expect(buckets[0]?.handPresent).toBe(0);
    expect(buckets[3]?.handPresent).toBe(1);
  });

  it('marks a bucket hidden if the panel was hidden at any point in it', () => {
    const m = new SpikeMetrics(0);
    m.setContext({ panelHidden: true }, 1_000);
    m.setContext({ panelHidden: false }, 2_000);
    m.record(BUCKET_MS + 1, 10, true);
    const { buckets } = m.snapshot(BUCKET_MS + 2);
    expect(buckets[0]?.panelHidden).toBe(true);
    expect(buckets[1]?.panelHidden).toBe(false);
  });

  it('reports frames reaching the loop alongside observations', () => {
    const m = new SpikeMetrics(0);
    for (let t = 0; t < 1_000; t += 100) m.record(t, 20, true, 2);
    const s = m.snapshot(1_000);
    expect(s.observationsPerSecond).toBe(10);
    expect(s.framesPerSecond).toBe(20);
    expect(s.buckets[0]?.frames).toBe(20);
  });
});
