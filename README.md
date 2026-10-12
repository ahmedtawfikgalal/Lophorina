# Lophorina

Privacy-first Chrome extension (Manifest V3) for hands-free YouTube control. Hand gestures are recognized on-device with MediaPipe; no video leaves the machine.

**Status:** Week 3 — gesture engine (palm hold, swipes) recognizes gestures and shows them in the panel. Commands are not sent to YouTube yet (Week 4). See [docs/delivery/roadmap.md](docs/delivery/roadmap.md) and the [Week 1 results](docs/delivery/week-1-spike.md).

## Quick start

Requires Node 22+ and Chrome 116+.

```bash
npm install
npm run build:spike   # spike build with the dev-only landmark recorder
```

Then open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, select `dist/`, and click the toolbar icon to open the Side Panel.

## Scripts

| Script                            | Purpose                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run build`                   | Production build (copies MediaPipe assets, type-checks, builds pages, worker, and content script) |
| `npm run build:spike`             | Same, with the landmark recorder enabled                                                          |
| `npm run watch`                   | Rebuild extension pages on change (content script is not watched)                                 |
| `npm test`                        | Unit tests (Vitest)                                                                               |
| `npm run smoke`                   | Headless Chromium + fake camera smoke test of `dist/`                                             |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                                 |
| `npm run assets`                  | Copy MediaPipe WASM and fetch the checksum-pinned model into `public/mediapipe/`                  |

## Layout

```
docs/          product, architecture (ADRs), security, UX, testing, delivery
src/
  background/      MV3 service worker — routing only, never the camera
  camera-host/     camera, frame loops, recognition worker, lifecycle, metrics
  recognition/     MediaPipe wrapper and normalized observations
  messaging/       message contracts and runtime validation
  adapters/youtube/ content script (read-only probe in Week 1)
  pages/           Side Panel UI and one-time camera permission page
  design-system/   tokens
public/        manifest.json (+ generated mediapipe/ assets)
scripts/       asset preparation, smoke test
tests/unit/    Vitest
context-*/     local planning notes (not in git; superseded by docs/)
```

Start with [docs/README.md](docs/README.md).
