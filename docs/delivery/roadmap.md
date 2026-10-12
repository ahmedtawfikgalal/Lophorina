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

## Week 4 — Chrome integration and YouTube

Message contracts + validators, service-worker routing with `chrome.storage.session`, YouTube adapter (ADR-004), controlled-tab tracking, feedback toasts, per-gesture enable/sensitivity settings.
**Gate:** webcam → gesture → command → controlled tab → YouTube action → feedback, and Stop with no unintended commands.

## Week 5 — Reliability, accessibility, privacy

Run T1–T8; fix by severity; keyboard alternatives and shortcut; privacy review; performance baseline.
**Gate:** acceptance criteria met in the supported environment; known failures have recovery paths.

## Week 6 — Pilot and packaging

Production build tests, onboarding, privacy notice, troubleshooting guide, T9 pilot, release notes, version tag; Web Store submission or private unpacked pilot.
**Gate:** a new user installs, activates, controls, and stops without help.

## Next release (not in the 6 weeks)

Google Slides adapter (new ADR), calibration, configurable mappings, dark mode. OS-wide control is a separate project.
