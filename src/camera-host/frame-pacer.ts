/**
 * Decides which camera frames to run inference on.
 *
 * A strict `elapsed >= 1000 / targetFps` check halves the rate whenever the camera runs only
 * slightly faster than the target: at 16.7 fps (60 ms) against a 15 fps target (66.7 ms),
 * every other frame fails the check and the result is 8.3 fps. Allowing a quarter-interval
 * of slack processes every frame of a camera at or below ~20 fps and still caps faster ones
 * near the target.
 */
export class FramePacer {
  private readonly minGapMs: number;
  private lastProcessedAt = -Infinity;
  private framesSinceProcessed = 0;

  constructor(targetFps: number) {
    this.minGapMs = (1000 / targetFps) * 0.75;
  }

  /** Call once per camera frame. Returns the frames seen since the last processed one, or 0 to skip. */
  offer(now: number): number {
    this.framesSinceProcessed++;
    if (now - this.lastProcessedAt < this.minGapMs) return 0;
    this.lastProcessedAt = now;
    const frames = this.framesSinceProcessed;
    this.framesSinceProcessed = 0;
    return frames;
  }
}
