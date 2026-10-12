# ADR-002: Local gesture recognition with MediaPipe; no backend

Status: Accepted

## Context

Camera frames are sensitive. A server would add deployment, cost, and privacy risk without solving the core problem (reliable intent detection).

## Decision

1. Use MediaPipe Tasks Vision `GestureRecognizer` in the camera host. Built-in categories handle static poses; the 21 hand landmarks drive swipe detection.
2. **All runtime assets are bundled** in the extension package: `@mediapipe/tasks-vision` JS, its WASM files, and the `.task` model. `FilesetResolver` must point at an extension-local path, not the default CDN. The model must not be fetched from Google storage at runtime.
3. Extension pages CSP includes `'wasm-unsafe-eval'` (required to instantiate WASM under MV3). No remote script sources.
4. Pin MediaPipe package and model versions; record them in every test run.
5. Start with inference on the camera host's main thread for simplicity; move to a dedicated worker if the UI janks or ADR-001 requires it.
6. No backend, database, accounts, or telemetry in the MVP.
7. **Block MediaPipe's built-in usage logging.** `@mediapipe/tasks-vision` 1.1.0 creates a logger for every task that POSTs usage statistics (task type, running mode, OS, latency — no frames) to `https://odml.pa.googleapis.com/v1/log` every 60 s and on `close()`. The extension pages CSP therefore includes `connect-src 'self'`. Re-check the bundle for new endpoints on every MediaPipe upgrade (`grep -o 'https://[^"]*' node_modules/@mediapipe/tasks-vision/vision_bundle.mjs`).

## Consequences

- Package size grows by the WASM and model files: ≈ 21 MB (13 MB WASM + 8.4 MB model); `dist/` ≈ 24 MB including source maps.
- Model updates ship only with extension releases — consistent with MV3's ban on remotely hosted code.
- Network inspection must show zero requests from the camera host during a session. The blocked logging attempt shows up as a CSP violation in the console; that is expected.
- Spike evidence: [../../delivery/week-1-spike.md](../../delivery/week-1-spike.md).
