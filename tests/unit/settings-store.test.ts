import { describe, expect, it } from 'vitest';
import { DEFAULT_GESTURE_SETTINGS, sanitizeSettings } from '../../src/storage/settings-store';

describe('sanitizeSettings', () => {
  it('falls back to defaults for missing or malformed storage', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_GESTURE_SETTINGS);
    expect(sanitizeSettings('nonsense')).toEqual(DEFAULT_GESTURE_SETTINGS);
    expect(sanitizeSettings({ enabled: { OPEN_PALM: 'yes' }, holdMs: 1 })).toEqual(
      DEFAULT_GESTURE_SETTINGS,
    );
  });

  it('keeps valid values and fills in the rest', () => {
    expect(sanitizeSettings({ enabled: { THUMB_DOWN: false }, holdMs: 1_500 })).toEqual({
      enabled: { OPEN_PALM: true, THUMB_UP: true, THUMB_DOWN: false },
      holdMs: 1_500,
    });
  });
});
