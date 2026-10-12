# Roadmap — 6-week MVP

Planning estimate for one experienced engineer, not a commitment. **The plan is re-evaluated at the Week 1 gate**; if the spike fails, re-plan rather than continue.

## Week 1 — Technical spike (gate)

Goal: prove the riskiest assumptions in the real extension environment. Runbook and results: [week-1-spike.md](week-1-spike.md).

| Task                                                                           | Exit evidence                 |
| ------------------------------------------------------------------------------ | ----------------------------- |
| Vite MV3 skeleton with three explicit entries; production build loads unpacked | Screenshot + build log        |
| MediaPipe WASM + model bundled locally; CSP with `wasm-unsafe-eval`            | Zero network requests on load |
| Side Panel camera host: permission, stream, recognition                        | ADR-001 checklist             |
| Background operation: inference continues while YouTube is focused 10 min      | Observation-rate log (AC-8)   |
| Frame loop without `requestAnimationFrame`                                     | Code + rate log               |
| Fallback: offscreen document evaluated if Side Panel fails                     | ADR-001 decision recorded     |
| Latency measurement on target laptop                                           | P50/P95 numbers               |
| Dev-only landmark recorder                                                     | First replay fixtures         |
| Camera release on stop/close verified                                          | Camera indicator check        |

**Gate:** ADR-001 accepted with evidence; recognition works while YouTube is focused; production build verified.

## Week 2 — Camera and recognition subsystem

`CameraManager`, `FrameScheduler`, `GestureRecognizer`, normalized `GestureObservation`, lifecycle state machine, permission/error states, live preview and status.
**Gate:** repeatable sessions with no camera left active after stop.

Status (2026-10-12): implemented; manual check pending.

| Item                                                                                                                                                                                          | Where                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| GPU → CPU fallback when the GPU fails to initialize **or** runs unusably slow (median > 150 ms after warm-up, or no results within 8 s); the camera stays on and a notice explains the switch | `camera-session.ts`                      |
| Camera disconnect / taken by another app → `ERROR` with "Try again"                                                                                                                           | `camera-session.ts`                      |
| Permission onboarding: the panel detects missing camera access and offers the one-time grant tab before Start; the message clears itself once access is granted                               | `App.tsx`, `camera-manager.ts`           |
| Hand guide: mirrored preview with a "keep your hand here" area, landmark overlay, and placement hints                                                                                         | `CameraPreview.tsx`, `hand-placement.ts` |
| Panel layout: status + control, camera card, Week 1 tools moved into a collapsible Diagnostics section                                                                                        | `App.tsx`, `Diagnostics.tsx`             |
| `CameraSession` injectable and unit-tested (permission, fallbacks, disconnect, stop during load)                                                                                              | `tests/unit/camera-session.test.ts`      |

Found while building: on a software renderer the GPU delegate initializes fine but takes ~5 s per frame (seen in the headless smoke test), which is why the fallback also checks speed.

## Week 3 — Interaction engine

`GestureStateMachine`, swipe detector with return-stroke suppression and stillness rule, mapping engine, unit + replay tests, replay dataset complete.
**Gate:** replay suite produces exact expected intents, including held poses and fluctuating confidence.

Status (2026-10-12): implemented with held poses only: palm = Play/Pause, thumb up/down = ±10 s (ADR-006, after live testing showed swipes fire the wrong direction). `src/interaction/gesture-engine.ts` (ADR-003); replay suite in `tests/unit/replay.test.ts`. The panel shows the recognized gesture as a preview; nothing is sent to YouTube yet. Still to do: a labeled recording of thumb up / thumb down holds.

## Week 4 — Chrome integration and YouTube

Message contracts + validators, service-worker routing with `chrome.storage.session`, YouTube adapter (ADR-004), controlled-tab tracking, feedback toasts, per-gesture enable/sensitivity settings.
**Gate:** webcam → gesture → command → controlled tab → YouTube action → feedback, and Stop with no unintended commands.

Status (2026-10-12): implemented and verified on the target laptop: palm, thumb up/down, buttons, non-YouTube tab, and reload all behaved as expected. **Gate passed.**

- YouTube adapter (`src/adapters/youtube/youtube-adapter.ts`): Play/Pause and ±10 s on the main player, following the ADR-004 rules (watch pages only, ads, blocked `play()`, missing video). Every command gets exactly one result, including invalid ones.
- Arming: `READY → TRACKING` only while a YouTube watch tab is the active tab in the panel's window; gestures are sent only in `TRACKING`.
- Direct routing from the Side Panel to the tab; no service-worker relay (see message-contracts.md).
- Feedback in the panel ("Video paused", "+10 s", or the reason it failed); each command's round-trip time is logged in the diagnostics events (AC-1).
- Play/Pause and ±10 s buttons as the keyboard/manual alternative (AC-13).
- Smoke test drives the real content script on a locally served stand-in watch page.
- Deferred: per-gesture enable/disable and hold-time settings.

## Week 5 — Reliability, accessibility, privacy

Run T1–T8; fix by severity; keyboard alternatives and shortcut; privacy review; performance baseline.
**Gate:** acceptance criteria met in the supported environment; known failures have recovery paths.

Status (2026-10-12): automated checks done, plus gesture settings (on/off per gesture, hold time) and a command counter with P50/P95 response time. Manual steps are in [week-5-reliability.md](week-5-reliability.md).

## Week 6 — Pilot and packaging

Production build tests, onboarding, privacy notice, troubleshooting guide, T9 pilot, release notes, version tag; Web Store submission or private unpacked pilot.
**Gate:** a new user installs, activates, controls, and stops without help.

Status (2026-10-12): release prepared: store build (no developer tools), icons, "How to use" card, `npm run package`, privacy page (`docs/privacy.html` via GitHub Pages), listing texts and steps in [release/chrome-web-store.md](release/chrome-web-store.md). Publishing **Unlisted** first; Public after the 30-minute test and pilot feedback.

## Next release (not in the 6 weeks)

Google Slides adapter (new ADR), calibration, configurable mappings, dark mode. OS-wide control is a separate project.
