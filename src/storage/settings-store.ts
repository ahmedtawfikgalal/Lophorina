// User gesture settings, persisted in chrome.storage.local (PRD: per-gesture enable/disable,
// adjustable hold time for accessibility). Values from storage are untrusted and sanitized.
import type { Pose } from '../interaction/gesture-engine';

export type GestureSettings = { enabled: Record<Pose, boolean>; holdMs: number };

export const HOLD_OPTIONS_MS = [500, 700, 1_000, 1_500] as const;

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  enabled: { OPEN_PALM: true, THUMB_UP: true, THUMB_DOWN: true },
  holdMs: 700,
};

const KEY = 'gestureSettings';

export function sanitizeSettings(raw: unknown): GestureSettings {
  const d = DEFAULT_GESTURE_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as { enabled?: Record<string, unknown>; holdMs?: unknown };
  const flag = (pose: Pose) =>
    typeof r.enabled?.[pose] === 'boolean' ? (r.enabled[pose] as boolean) : d.enabled[pose];
  const holdMs = (HOLD_OPTIONS_MS as readonly unknown[]).includes(r.holdMs)
    ? (r.holdMs as number)
    : d.holdMs;
  return {
    enabled: {
      OPEN_PALM: flag('OPEN_PALM'),
      THUMB_UP: flag('THUMB_UP'),
      THUMB_DOWN: flag('THUMB_DOWN'),
    },
    holdMs,
  };
}

export async function loadSettings(): Promise<GestureSettings> {
  const stored = await chrome.storage.local.get(KEY);
  return sanitizeSettings(stored[KEY]);
}

export async function saveSettings(settings: GestureSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}
