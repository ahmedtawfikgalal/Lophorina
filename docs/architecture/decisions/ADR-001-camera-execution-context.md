# ADR-001: Camera and recognition execution context

Status: **Accepted** (2026-10-12, Week 1 gate)
Supersedes: the "dedicated extension control page" recommendation in `context-00/Architecture Decision Record`.

## Context

The camera owner must keep running inference while the user's YouTube tab is focused. The earlier plan put the camera in a dedicated extension page opened as a tab. When the user switches to YouTube, that tab is hidden; Chrome pauses `requestAnimationFrame` and throttles timers in hidden documents, so recognition would stop when it is needed.

## Decision

1. The camera, frame loop, MediaPipe, and state machine run in a single **camera host** context that remains active while another tab is focused.
2. Preferred host: **Chrome Side Panel**. Fallback: **offscreen document** with `reason: "USER_MEDIA"`, permission granted beforehand from a visible extension page.
3. The frame loop must not rely on `requestAnimationFrame`. Use `MediaStreamTrackProcessor` + worker or `requestVideoFrameCallback`, whichever the spike shows to be reliable.
4. The service worker never owns camera or inference.
5. Rejected: tab-hosted control page, popup, service worker.

## Spike exit criteria

- [x] Inference keeps ≥ 15 observations/s for 10 minutes while the YouTube tab is focused (target rate to be tuned). Average 14.9 over 10 min 56 s, limited by the camera's ~15 fps in indoor light; every delivered frame was processed.
- [x] Camera permission can be obtained for the host (directly or via one-time grant page). Via the grant page; see Evidence.
- [x] Closing the host releases the camera (OS/browser camera indicator off).
- [x] Extension reload / service-worker restart does not restart the camera. Extension reload checked; a service-worker-only restart is covered by design (the worker never touches the camera).

If the Side Panel passes, accept it. If not, evaluate the offscreen document against the same criteria plus a mandatory always-visible "camera on" indicator.

## Evidence so far

Manual run 1 (2026-10-12, [week-1-spike.md](../../delivery/week-1-spike.md)):

- Side Panel: recognition ran steadily for 6 minutes with YouTube focused; the panel was never hidden.
- Side Panel cannot show the camera permission prompt; the one-time grant page works. Treat it as a required onboarding step.
- Manual run 2, worker + GPU after the pacing fix: 10 min 56 s, 14.9 obs/s, 0 stalls, inference P95 30 ms; camera indicator off after Stop, after closing the panel, and after reloading the extension.

## Outcome

- Camera host: **Side Panel**.
- Frame loop: **worker + MediaStreamTrackProcessor** (main-thread requestVideoFrameCallback also worked; the worker keeps the UI thread free).
- Delegate: **GPU** (5–6× faster than CPU). Fall back to CPU if GPU initialization fails. To be implemented in Week 2.
- Onboarding must include the one-time camera permission page.
- The offscreen-document fallback is not needed.

## Consequences

- Closing the Side Panel stops control — a natural, discoverable emergency stop.
- If the offscreen document is chosen, the privacy review must confirm the camera indicator is always visible and the user can stop from the action button and keyboard shortcut.
