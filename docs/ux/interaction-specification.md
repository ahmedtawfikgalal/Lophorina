# Interaction Specification

Owner: Lead Frontend Engineer + UX

The UI must always answer four questions: _Is the camera on? Is control enabled? What just happened? How do I stop?_

## Screens (MVP)

Based on the reference mockup in `context-00/Gesture Control UI Design System.png`, adjusted to MVP scope.

| Screen                    | Content                                                                                                  | Changes vs mockup                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A. Onboarding (first run) | Welcome, what the camera is used for, "works locally", how to stop                                       | Copy says **"Control YouTube videos"**, not "YouTube, presentations, and more"         |
| B. Camera permission      | Why access is needed, Allow Camera                                                                       | —                                                                                      |
| C. Control panel (active) | Control Active + timer, camera preview with tracking state, controlled tab, Stop Control, quick gestures | Quick gestures: Play/Pause, Seek Back, Seek Forward only; add **controlled tab** line  |
| D. Inactive               | Control is Off, Start Control, lighting tip                                                              | —                                                                                      |
| E. Settings               | Gesture sensitivity, hold time, visual feedback, sound feedback (optional, off by default)               | **Remove "Start automatically"**; remove Applications/Appearance sections from MVP     |
| F. Gestures               | Three gestures with enable/disable toggle                                                                | **Remove Volume Up/Down and "Add Gesture"**; action dropdown replaced by enable toggle |
| G. Feedback               | Command executed, no hand, low lighting, multiple hands                                                  | —                                                                                      |

## State → UI mapping

| Lifecycle state         | Status badge (text + icon)         | Primary action | Secondary info                                |
| ----------------------- | ---------------------------------- | -------------- | --------------------------------------------- |
| `OFF`                   | "Control is off" (camera-off icon) | Start Control  | Lighting tip                                  |
| `REQUESTING_PERMISSION` | "Camera permission needed"         | Allow Camera   | Privacy line                                  |
| `INITIALIZING`          | "Starting camera…"                 | Stop Control   | Spinner with text                             |
| `READY`                 | "Camera on — not controlling"      | Stop Control   | Reason: no YouTube tab / tab changed / paused |
| `TRACKING`              | "Control active" (check icon)      | Stop Control   | Controlled tab title; hand status             |
| `ERROR`                 | "Camera error" (alert icon)        | Retry          | What failed and how to fix                    |

Hand sub-status in `TRACKING`: "Hand detected" / "No hand detected — keep your hand visible" / "Multiple hands — use one hand". Neutral tone; never alarming.

## Feedback

| Event                           | Feedback                                         | Duration               |
| ------------------------------- | ------------------------------------------------ | ---------------------- |
| Gesture in progress (palm hold) | Progress ring on the gesture card                | Live                   |
| Intent recognized               | "Play/Pause recognized"                          | Until result           |
| Command succeeded               | "Video paused" / "Playing" / "−10 s" / "+10 s"   | 2 s toast              |
| Command failed                  | Reason + recovery ("No video found on this tab") | Until dismissed or 6 s |
| Command rejected (cooldown)     | No toast; optional subtle indicator              | —                      |

All status changes are announced through an `aria-live="polite"` region; errors use `role="alert"`.

## Stop Control — always reachable

- Large danger button, always visible in active states, never scrolled out of view.
- Keyboard shortcut (`Alt+Shift+G`, user-rebindable via `chrome://extensions/shortcuts`).
- Closing the Side Panel stops control (ADR-001).
- Stop never requires a gesture and never asks for confirmation.

## Accessibility requirements

- Every gesture action has a keyboard/button alternative in the panel (Play/Pause, −10 s, +10 s buttons).
- Full keyboard operation with visible focus.
- State never communicated by color alone.
- No reliance on sound; sound feedback is optional and off by default.
- Hold time adjustable.
- Individual gestures can be disabled.
- Layout works at Side Panel widths (≈ 320–400 px).
