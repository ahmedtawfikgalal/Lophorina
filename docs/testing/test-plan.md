# Test Plan

## Test layers

| Layer             | Scope                                                                                                      | Tooling                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Unit              | State machine, swipe detector, mapping engine, message validators, settings store                          | Vitest, injected clock                                                          |
| **Replay**        | Recorded landmark sessions fed through recognition-output → state machine; assert exact intent sequence    | Vitest + JSON fixtures in `tests/replay/`                                       |
| Integration       | Service-worker routing, session/target validation, YouTube adapter against a fixture page and real YouTube | Vitest with Chrome API mocks; Playwright with unpacked extension where feasible |
| Manual / scripted | Live camera tests below                                                                                    | Recorded test sheet                                                             |

## Replay dataset (built in Week 1)

A dev-only recorder in the camera host saves `GestureObservation[]` (landmarks, category, confidence, timestamps) — never video frames. Every session is labeled with the expected intents.

Minimum set before Week 3 exit:

- Each gesture × 20 deliberate attempts (bright and dim lighting, ~50 cm and ~1 m).
- Swipe with natural return stroke (both directions).
- Negative sessions: typing, drinking, adjusting hair/glasses, waving to someone, leaving frame, two hands visible, hand partly out of frame.
- Slow and limited-range movements (accessibility).

Threshold changes in ADR-003 must be justified by replay results. Replay fixtures run in CI.

## Environment record (every live run)

Chrome version and OS · laptop model, CPU, RAM, webcam · MediaPipe package and model versions · lighting and distance · test duration, attempts, negative scenarios · video state (playing / paused / buffering / ad / none).

## Live test protocol

**T1 — Recognition baseline.** 20 attempts per gesture under recorded lighting and distance. Record misses and latency (AC-1, AC-4).

**T2 — False activation.** 30 minutes of ordinary activity with control armed: moving, typing, posture changes, leaving the frame (AC-3).

**T3 — Return stroke.** 20 swipes each direction with natural return (AC-5).

**T4 — YouTube integration.** Toggle and both seeks while playing, paused, near start, near end, during an ad, after SPA navigation to another video, with miniplayer active, on a non-watch page, with no video (AC-7).

**T5 — Background operation.** Arm control, focus YouTube for 10 minutes, verify observation rate and command success (AC-8).

**T6 — Failure and recovery.** Deny permission; unplug camera; close the camera host; reload the extension; kill the service worker (`chrome://serviceworker-internals`); switch and close the controlled tab. Verify no stale command executes and no auto-restart (AC-6, AC-9, AC-11, AC-12).

**T7 — Privacy.** Network inspection during a 10-minute session (AC-10).

**T8 — Accessibility.** Keyboard-only flow, screen-reader announcements, focus visibility, adjustable timing, manual recovery (AC-13).

**T9 — Pilot.** 3–5 users complete realistic tasks without help; record misses, false activations, and confusion.
