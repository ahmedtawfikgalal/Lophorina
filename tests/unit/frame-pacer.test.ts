import { describe, expect, it } from 'vitest';
import { FramePacer } from '../../src/camera-host/frame-pacer';

/** Feeds frames at a fixed interval (with optional jitter) and returns processed-per-second. */
function processedRate(targetFps: number, cameraFps: number, jitterMs = 0, seconds = 10) {
  const pacer = new FramePacer(targetFps);
  const interval = 1000 / cameraFps;
  let processed = 0;
  let frames = 0;
  for (let i = 0; i < cameraFps * seconds; i++) {
    const jitter = i % 2 === 0 ? jitterMs : -jitterMs;
    const got = pacer.offer(i * interval + jitter);
    if (got > 0) processed++;
    frames += got;
  }
  return { rate: processed / seconds, frames };
}

describe('FramePacer', () => {
  it('does not halve the rate when the camera is slightly faster than the target', () => {
    // Regression: a strict 66.7 ms check against a 16.7 fps camera produced 8.3 fps.
    expect(processedRate(15, 16.7).rate).toBeCloseTo(16.7, 0);
    expect(processedRate(15, 15, 3).rate).toBeCloseTo(15, 0);
  });

  it('caps a 30 fps camera near the target', () => {
    expect(processedRate(15, 30).rate).toBeCloseTo(15, 0);
    expect(processedRate(10, 30).rate).toBeCloseTo(10, 0);
  });

  it('processes every frame of a camera slower than the target', () => {
    expect(processedRate(15, 10).rate).toBeCloseTo(10, 0);
  });

  it('accounts for every frame it was offered', () => {
    const { frames } = processedRate(15, 30, 0, 2);
    expect(frames).toBe(60 - 1); // the last skipped frame is carried into the next observation
  });
});
