# Week 5 — Reliability Runbook and Results

Goal: measured evidence for the acceptance criteria (`docs/testing/acceptance-criteria.md`) on the target laptop.

## Automated (done, rerun with `npm test` and `npm run smoke`)

| Check                                                             | Result (2026-10-12)                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Unit and replay tests                                             | 91 passing; zero intents in every normal-activity and swipe segment                                |
| WCAG 2.1 A/AA (axe-core) on the panel, idle and camera on (AC-13) | No violations                                                                                      |
| YouTube adapter through real Chrome messaging                     | Pause, play, invalid command rejected, home page rejected                                          |
| Network (AC-10)                                                   | No external requests; MediaPipe's logging blocked by CSP                                           |
| Permissions vs code                                               | `storage`, `sidePanel`, YouTube host only; all used; no `tabs`                                     |
| Production build                                                  | No recorder; only remote strings are XML namespaces, React error links, and the CSP-blocked logger |

## Manual steps (target laptop)

Setup: run `npm run build:spike`, reload Lophorina in `chrome://extensions`, reload the YouTube tab.

**M1 — Recordings (~5 min).** Diagnostics → Landmark recorder. Save files to `tests/replay/`.

- `thumbs`: 10 thumb-up holds, 10 thumb-down holds, 5 palm holds; rest 2 s between holds; hand inside the box.
- `normal-2min`: 2 minutes of normal activity with **no** gestures: type, touch your face, drink, wave, lean back, leave the frame.

**M2 — 30-minute false-activation test (AC-3).** Open a YouTube video, press Start Control, and work normally for 30 minutes without making gestures. At the end, open Diagnostics and note **Commands since Start Control → From gestures**. Every gesture command counts as a false activation. Export the spike report.

**M3 — Gesture success (AC-4, AC-5).** 20 holds of each pose in mixed order. Count how many did the right thing, and whether any did the wrong thing.

**M4 — Failures (AC-6, AC-11, AC-12).** Check each one:

1. Stop Control → camera light off within 1 s.
2. Close the side panel while running → camera light off.
3. Reload the extension while running → camera stays off.
4. Close the YouTube tab while running → panel says "Open a YouTube video…"; gestures don't control anything.
5. Open the Windows Camera app while running → panel shows a camera error with "Try again".

**M5 — Keyboard only (AC-13).** Without the mouse: Tab through the panel, start and stop control, use the −10 s / Play/Pause / +10 s buttons, and change a gesture setting. Check that you can always see which control has focus.

## Results

| Step                                 | Result | Notes |
| ------------------------------------ | ------ | ----- |
| M1 thumbs                            |        |       |
| M1 normal-2min                       |        |       |
| M2 false activations (30 min)        |        |       |
| M3 success: palm / up / down (of 20) |        |       |
| M3 wrong commands                    |        |       |
| M4.1–M4.5                            |        |       |
| M5                                   |        |       |
