// Turns per-frame observations into deliberate gesture intents (ADR-003, ADR-006).
// Pure and clock-free: time comes from observation timestamps, so recordings replay exactly.
// Every gesture is a held pose; swipes were dropped because the swipe a user means and the
// positioning move around it look alike (ADR-006).

import { palmCenter } from '../recognition/hand-placement';
import type { GestureObservation } from '../recognition/types';

export type Pose = 'OPEN_PALM' | 'THUMB_UP' | 'THUMB_DOWN';
export type GestureIntent = { kind: 'POSE_HOLD'; pose: Pose };

/** MediaPipe canned gesture category → pose. Anything else (e.g. Closed_Fist) is not a pose. */
const POSES: Record<string, Pose> = {
  Open_Palm: 'OPEN_PALM',
  Thumb_Up: 'THUMB_UP',
  Thumb_Down: 'THUMB_DOWN',
};

export const DEFAULT_ENGINE_CONFIG = {
  /** Score floor. Real palm holds scored ~0.6, so stillness carries the decision. */
  minScore: 0.5,
  holdMs: 700,
  /** Palm-center tolerance while holding, for a hand 40 % of frame height; scales with size. */
  holdRadius: 0.07,
  /** Relative hand-size change tolerated while holding (pushing toward the camera). */
  holdSizeTolerance: 0.15,
  /** Movement needed after a hold before the same pose can fire again. */
  rearmRadius: 0.06,
  /** Holds only count with the palm this far inside the frame edges. */
  edgeMargin: 0.1,
  /** Short pose dropouts tolerated (classifier flicker). */
  poseGapMs: 250,
  /** Points further apart than this, or jumps bigger than maxStep, restart the hold. */
  maxGapMs: 200,
  maxStep: 0.35,
  cooldownMs: 1_000,
};

export type EngineConfig = typeof DEFAULT_ENGINE_CONFIG;

type Point = { t: number; x: number; y: number; size: number };

export class GestureEngine {
  private readonly cfg: EngineConfig;
  private last: Point | null = null;
  private pose: Pose | null = null;
  private lastPoseAt = -Infinity;
  private anchor: Point | null = null;
  private firedAt: Point | null = null;
  private lastIntentAt = -Infinity;

  constructor(config: Partial<EngineConfig> = {}) {
    this.cfg = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  reset(): void {
    this.last = null;
    this.pose = null;
    this.lastPoseAt = -Infinity;
    this.anchor = null;
    this.firedAt = null;
  }

  push(obs: GestureObservation): GestureIntent | null {
    const cfg = this.cfg;
    const t = obs.timestamp;
    const lm = obs.landmarks;
    const pose = obs.confidence >= cfg.minScore ? POSES[obs.category] : undefined;

    if (!obs.handPresent || !lm || lm.length < 21) {
      this.last = null;
      this.dropPoseAfterGap(t);
      return null;
    }
    const c = palmCenter(lm);
    const ys = lm.map((p) => p.y);
    const p: Point = { t, x: c.x, y: c.y, size: Math.max(...ys) - Math.min(...ys) };
    const prev = this.last;
    this.last = p;
    if (
      prev &&
      (t - prev.t > cfg.maxGapMs || Math.hypot(p.x - prev.x, p.y - prev.y) > cfg.maxStep)
    ) {
      this.anchor = null; // a gap or tracking jump is not one continuous hold
    }

    const inFrame =
      p.x > cfg.edgeMargin &&
      p.x < 1 - cfg.edgeMargin &&
      p.y > cfg.edgeMargin &&
      p.y < 1 - cfg.edgeMargin;
    if (!pose || !inFrame) {
      this.dropPoseAfterGap(t);
      return null;
    }
    this.lastPoseAt = t;

    if (pose !== this.pose) {
      // A different pose starts a fresh hold but does not re-arm by itself: a one-frame
      // misclassification must not fire twice. Real pose changes alter the hand's shape,
      // which counts as movement below.
      this.pose = pose;
      this.anchor = p;
      return null;
    }
    if (this.firedAt) {
      // Re-arm only after the hand clearly moves (users often keep the pose in view).
      if (this.moved(p, this.firedAt, cfg.rearmRadius)) {
        this.firedAt = null;
        this.anchor = p;
      }
      return null;
    }
    if (!this.anchor || this.moved(p, this.anchor, cfg.holdRadius)) {
      this.anchor = p;
      return null;
    }
    if (t - this.anchor.t < cfg.holdMs || t - this.lastIntentAt < cfg.cooldownMs) return null;

    this.firedAt = p;
    this.anchor = null;
    this.lastIntentAt = t;
    return { kind: 'POSE_HOLD', pose };
  }

  private dropPoseAfterGap(t: number): void {
    if (t - this.lastPoseAt > this.cfg.poseGapMs) {
      this.pose = null;
      this.anchor = null;
      this.firedAt = null;
    }
  }

  private moved(p: Point, ref: Point, radius: number): boolean {
    // A closer (bigger) hand moves more in the image for the same real movement.
    const scaled = radius * Math.max(1, p.size / 0.4);
    return (
      Math.hypot(p.x - ref.x, p.y - ref.y) > scaled ||
      Math.abs(p.size - ref.size) > this.cfg.holdSizeTolerance * ref.size
    );
  }
}
