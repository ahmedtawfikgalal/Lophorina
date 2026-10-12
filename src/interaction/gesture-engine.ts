// Turns per-frame observations into deliberate gesture intents (ADR-003).
// Pure and clock-free: time comes from observation timestamps, so recordings replay exactly.
// Thresholds were fitted to the Week 1 recordings (tests/replay, docs/delivery/week-1-spike.md).

import { palmCenter } from '../recognition/hand-placement';
import type { GestureObservation } from '../recognition/types';

export type SwipeDirection = 'LEFT' | 'RIGHT';
export type GestureIntent = { kind: 'PALM_HOLD' } | { kind: 'SWIPE'; direction: SwipeDirection };

export const DEFAULT_ENGINE_CONFIG = {
  /** Open_Palm score floor. Real holds scored ~0.6, so stillness carries the decision. */
  minPalmScore: 0.5,
  holdMs: 700,
  /** Palm-center tolerance while holding, for a hand 40 % of frame height; scales with size. */
  holdRadius: 0.07,
  /** Relative hand-size change tolerated while holding (pushing toward the camera). */
  holdSizeTolerance: 0.15,
  /** Movement needed after a hold before the next hold can fire. */
  rearmRadius: 0.06,
  /** Holds only count with the palm this far inside the frame edges. */
  edgeMargin: 0.1,
  /** Short palm dropouts tolerated (classifier flicker). */
  palmGapMs: 250,

  /** Horizontal speed (frame widths/s) that counts as moving. */
  moveSpeed: 0.4,
  swipeMinDistance: 0.25,
  /** Swipes peak faster than return strokes (≥ 1.3 vs ≤ 1.1 in Week 1 data). */
  swipeMinPeakSpeed: 0.8,
  swipeMaxMs: 1_000,
  /** Horizontal travel must dominate vertical travel by this factor. */
  swipeDirectionRatio: 1.5,
  /** Single-step jumps bigger than this are tracking glitches (hand switch, re-detection). */
  maxStep: 0.35,
  /** Points further apart than this break a motion. */
  maxGapMs: 200,

  returnSuppressMs: 1_500,
  cooldownMs: 1_000,
};

export type EngineConfig = typeof DEFAULT_ENGINE_CONFIG;

type Point = { t: number; x: number; y: number; size: number };
type Motion = { start: Point; sign: number; peak: number; frames: number; emitted: boolean };

export class GestureEngine {
  private readonly cfg: EngineConfig;
  private last: Point | null = null;
  private motion: Motion | null = null;
  private anchor: Point | null = null;
  private holdFiredAt: Point | null = null;
  private lastPalmAt = -Infinity;
  private lastIntentAt = -Infinity;
  private lastSwipe: { t: number; direction: SwipeDirection } | null = null;

  constructor(config: Partial<EngineConfig> = {}) {
    this.cfg = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  reset(): void {
    this.last = null;
    this.motion = null;
    this.anchor = null;
    this.holdFiredAt = null;
    this.lastPalmAt = -Infinity;
  }

  push(obs: GestureObservation): GestureIntent | null {
    const lm = obs.landmarks;
    if (!obs.handPresent || !lm || lm.length < 21) {
      this.loseTracking(obs.timestamp);
      return null;
    }
    const c = palmCenter(lm);
    const ys = lm.map((p) => p.y);
    const p: Point = { t: obs.timestamp, x: c.x, y: c.y, size: Math.max(...ys) - Math.min(...ys) };

    const prev = this.last;
    this.last = p;
    if (prev && (p.t - prev.t > this.cfg.maxGapMs || dist(p, prev) > this.cfg.maxStep)) {
      // A gap or a jump: whatever was in progress is not one continuous gesture.
      this.motion = null;
      this.anchor = null;
      return null;
    }

    const swipe = prev && obs.category !== 'Closed_Fist' ? this.trackSwipe(prev, p) : null;
    if (swipe) return this.emit(p.t, { kind: 'SWIPE', direction: swipe });

    return this.trackHold(obs, p) ? this.emit(p.t, { kind: 'PALM_HOLD' }) : null;
  }

  private trackSwipe(prev: Point, p: Point): SwipeDirection | null {
    const speed = (p.x - prev.x) / ((p.t - prev.t) / 1000 || 1);
    const sign = Math.abs(speed) >= this.cfg.moveSpeed ? Math.sign(speed) : 0;
    if (sign === 0) {
      this.motion = null;
      return null;
    }
    if (!this.motion || this.motion.sign !== sign) {
      this.motion = { start: prev, sign, peak: 0, frames: 0, emitted: false };
    }
    const m = this.motion;
    m.peak = Math.max(m.peak, Math.abs(speed));
    m.frames++;
    // Return-stroke suppression counts from the end of the swipe motion, not its detection.
    if (m.emitted && this.lastSwipe) this.lastSwipe.t = p.t;

    const dx = p.x - m.start.x;
    const dy = p.y - m.start.y;
    const qualifies =
      !m.emitted &&
      Math.abs(dx) >= this.cfg.swipeMinDistance &&
      Math.abs(dx) >= this.cfg.swipeDirectionRatio * Math.abs(dy) &&
      m.peak >= this.cfg.swipeMinPeakSpeed &&
      m.frames >= 3 &&
      p.t - m.start.t <= this.cfg.swipeMaxMs;
    if (!qualifies) return null;
    m.emitted = true; // one motion, one swipe

    // Raw image x grows toward the user's left (the frame is not mirrored).
    const direction: SwipeDirection = dx > 0 ? 'LEFT' : 'RIGHT';
    const r = this.lastSwipe;
    if (r && r.direction !== direction && p.t - r.t < this.cfg.returnSuppressMs) return null;
    return direction;
  }

  private trackHold(obs: GestureObservation, p: Point): boolean {
    const cfg = this.cfg;
    const isPalm = obs.category === 'Open_Palm' && obs.confidence >= cfg.minPalmScore;
    const inFrame =
      p.x > cfg.edgeMargin &&
      p.x < 1 - cfg.edgeMargin &&
      p.y > cfg.edgeMargin &&
      p.y < 1 - cfg.edgeMargin;
    if (!isPalm || !inFrame) {
      if (p.t - this.lastPalmAt > cfg.palmGapMs) {
        this.anchor = null;
        this.holdFiredAt = null;
      }
      return false;
    }
    this.lastPalmAt = p.t;

    if (this.holdFiredAt) {
      // Re-arm only after the hand clearly moves (users often keep the palm in view).
      if (this.moved(p, this.holdFiredAt, cfg.rearmRadius)) {
        this.holdFiredAt = null;
        this.anchor = p;
      }
      return false;
    }
    if (!this.anchor || this.moved(p, this.anchor, cfg.holdRadius)) {
      this.anchor = p;
      return false;
    }
    if (p.t - this.anchor.t < cfg.holdMs) return false;
    this.holdFiredAt = p;
    this.anchor = null;
    return true;
  }

  private moved(p: Point, ref: Point, radius: number): boolean {
    // A closer (bigger) hand moves more in the image for the same real movement.
    const scaled = radius * Math.max(1, p.size / 0.4);
    return (
      dist(p, ref) > scaled || Math.abs(p.size - ref.size) > this.cfg.holdSizeTolerance * ref.size
    );
  }

  private loseTracking(t: number): void {
    this.last = null;
    this.motion = null;
    if (t - this.lastPalmAt > this.cfg.palmGapMs) {
      this.anchor = null;
      this.holdFiredAt = null;
    }
  }

  private emit(t: number, intent: GestureIntent): GestureIntent | null {
    if (t - this.lastIntentAt < this.cfg.cooldownMs) return null;
    this.lastIntentAt = t;
    this.anchor = null;
    if (intent.kind === 'SWIPE') this.lastSwipe = { t, direction: intent.direction };
    return intent;
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
