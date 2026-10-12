// Spike instrumentation: observation rate, inference latency, stalls, and context
// (panel visibility, YouTube focus) per time bucket. Evidence for AC-1 and AC-8.

export const BUCKET_MS = 10_000;
/** A gap between observations longer than this counts as a stall. */
export const STALL_MS = 500;

export type Bucket = {
  startedAt: number;
  observations: number;
  /** Camera frames that reached the frame loop (processed or skipped by the pacer). */
  frames: number;
  handPresent: number;
  inferenceMsSum: number;
  /** True if the panel document was hidden at any point in the bucket. */
  panelHidden: boolean;
  /** True if a YouTube tab was the focused tab at any point in the bucket. */
  youtubeFocused: boolean;
};

export type MetricsSnapshot = {
  durationMs: number;
  observations: number;
  observationsPerSecond: number;
  /** Frames reaching the loop in the last second — a lower bound on the camera's delivered rate. */
  framesPerSecond: number;
  inferenceP50: number | null;
  inferenceP95: number | null;
  stalls: number;
  maxGapMs: number;
  buckets: readonly Bucket[];
};

/** Nearest-rank percentile; `p` in (0, 100]. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? null;
}

const MAX_SAMPLES = 5_000;

export class SpikeMetrics {
  private readonly startedAt: number;
  private observations = 0;
  private lastAt: number | null = null;
  private stalls = 0;
  private maxGapMs = 0;
  private readonly inferenceSamples: number[] = [];
  private readonly recent: { at: number; frames: number }[] = [];
  private readonly buckets: Bucket[] = [];
  private panelHidden = false;
  private youtubeFocused = false;

  constructor(now: number) {
    this.startedAt = now;
  }

  setContext(ctx: { panelHidden?: boolean; youtubeFocused?: boolean }, now: number): void {
    if (ctx.panelHidden !== undefined) this.panelHidden = ctx.panelHidden;
    if (ctx.youtubeFocused !== undefined) this.youtubeFocused = ctx.youtubeFocused;
    this.mark(this.bucketAt(now));
  }

  record(now: number, inferenceMs: number, handPresent: boolean, frames = 1): void {
    this.observations++;
    if (this.lastAt !== null) {
      const gap = now - this.lastAt;
      if (gap > STALL_MS) this.stalls++;
      if (gap > this.maxGapMs) this.maxGapMs = gap;
    }
    this.lastAt = now;

    this.inferenceSamples.push(inferenceMs);
    if (this.inferenceSamples.length > MAX_SAMPLES) this.inferenceSamples.shift();
    this.recent.push({ at: now, frames });

    const b = this.bucketAt(now);
    b.observations++;
    b.frames += frames;
    b.inferenceMsSum += inferenceMs;
    if (handPresent) b.handPresent++;
    this.mark(b);
  }

  snapshot(now: number): MetricsSnapshot {
    while (this.recent.length > 0 && (this.recent[0]?.at ?? 0) < now - 1_000) this.recent.shift();
    // A stall that is still in progress counts toward the max gap shown live.
    const openGap = this.lastAt === null ? 0 : now - this.lastAt;
    return {
      durationMs: now - this.startedAt,
      observations: this.observations,
      observationsPerSecond: this.recent.length,
      framesPerSecond: this.recent.reduce((sum, r) => sum + r.frames, 0),
      inferenceP50: percentile(this.inferenceSamples, 50),
      inferenceP95: percentile(this.inferenceSamples, 95),
      stalls: this.stalls,
      maxGapMs: Math.max(this.maxGapMs, openGap),
      buckets: this.buckets,
    };
  }

  private mark(b: Bucket): void {
    if (this.panelHidden) b.panelHidden = true;
    if (this.youtubeFocused) b.youtubeFocused = true;
  }

  private bucketAt(now: number): Bucket {
    const startedAt = this.startedAt + Math.floor((now - this.startedAt) / BUCKET_MS) * BUCKET_MS;
    let last = this.buckets.at(-1);
    // Create empty buckets for silent periods so stalls show up as zero-observation rows.
    while (!last || last.startedAt < startedAt) {
      const next: Bucket = {
        startedAt: last ? last.startedAt + BUCKET_MS : startedAt,
        observations: 0,
        frames: 0,
        handPresent: 0,
        inferenceMsSum: 0,
        panelHidden: this.panelHidden,
        youtubeFocused: this.youtubeFocused,
      };
      this.buckets.push(next);
      last = next;
    }
    return last;
  }
}
