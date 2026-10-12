import type { CameraSession } from '../../camera-host/camera-session';
import type { Pose } from '../../interaction/gesture-engine';
import { HOLD_OPTIONS_MS, saveSettings, type GestureSettings } from '../../storage/settings-store';

const POSE_LABELS: [Pose, string][] = [
  ['OPEN_PALM', 'Open palm — Play/Pause'],
  ['THUMB_UP', 'Thumb up — +10 s'],
  ['THUMB_DOWN', 'Thumb down — −10 s'],
];

type Props = { session: CameraSession; settings: GestureSettings };

/** Per-gesture on/off and hold time (accessibility); saved locally. */
export function GestureSettingsPanel({ session, settings }: Props) {
  const apply = (next: GestureSettings) => {
    session.setGestureSettings(next);
    void saveSettings(next);
  };

  return (
    <details className="diagnostics">
      <summary>Gesture settings</summary>
      <fieldset>
        <legend className="visually-hidden">Gestures</legend>
        {POSE_LABELS.map(([pose, label]) => (
          <label key={pose} className="checkbox">
            <input
              type="checkbox"
              checked={settings.enabled[pose]}
              onChange={(e) =>
                apply({ ...settings, enabled: { ...settings.enabled, [pose]: e.target.checked } })
              }
            />
            {label}
          </label>
        ))}
        <label>
          Hold time
          <select
            value={settings.holdMs}
            onChange={(e) => apply({ ...settings, holdMs: Number(e.target.value) })}
          >
            {HOLD_OPTIONS_MS.map((ms) => (
              <option key={ms} value={ms}>
                {ms / 1000} s{ms === 700 ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          A longer hold makes accidental commands less likely; a shorter one reacts faster.
        </p>
      </fieldset>
    </details>
  );
}
