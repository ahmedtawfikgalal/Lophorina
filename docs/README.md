# Lophorina — Documentation

Lophorina is a privacy-first Chrome Extension (Manifest V3) that lets a user control YouTube playback with hand gestures recognized locally by MediaPipe.

## Source of truth

- These documents supersede the exploratory notes in `../context-00/`. Where they conflict, `docs/` wins.
- Within `docs/`, the ADRs in `architecture/decisions/` win over every other document.
- Values marked **[To verify]** are hypotheses that the Week 1 spike must confirm or replace.
- Performance targets are proposed release gates, not measured results.

## Index

| Question                                                            | Document                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| What can a user do in the first release? What is out of scope?      | [product/prd.md](product/prd.md)                                               |
| How is the system structured?                                       | [architecture/software-architecture.md](architecture/software-architecture.md) |
| Where does the camera run, and what happens when contexts close?    | [architecture/execution-contexts.md](architecture/execution-contexts.md)       |
| What messages cross context boundaries, and how are they validated? | [architecture/message-contracts.md](architecture/message-contracts.md)         |
| Why was each major decision made?                                   | [architecture/decisions/](architecture/decisions/)                             |
| What data leaves the device? Who may issue commands?                | [security/privacy-and-threat-model.md](security/privacy-and-threat-model.md)   |
| What does the user see in each state?                               | [ux/interaction-specification.md](ux/interaction-specification.md)             |
| Tokens, components, accessibility rules                             | [ux/design-system.md](ux/design-system.md)                                     |
| What evidence proves the MVP is releasable?                         | [testing/acceptance-criteria.md](testing/acceptance-criteria.md)               |
| How is that evidence collected?                                     | [testing/test-plan.md](testing/test-plan.md)                                   |
| Weekly plan and phase gates                                         | [delivery/roadmap.md](delivery/roadmap.md)                                     |
| How to run the Week 1 spike, and its results                        | [delivery/week-1-spike.md](delivery/week-1-spike.md)                           |
| Week 5 reliability checks and results                               | [delivery/week-5-reliability.md](delivery/week-5-reliability.md)               |
| How to publish on the Chrome Web Store                              | [release/chrome-web-store.md](release/chrome-web-store.md)                     |
| Privacy policy (public page)                                        | [privacy.html](privacy.html)                                                   |
| Known risks and owners                                              | [delivery/risk-register.md](delivery/risk-register.md)                         |
| When is a feature done?                                             | [delivery/definition-of-done.md](delivery/definition-of-done.md)               |

## Decision log

| ADR                                                                        | Decision                                                                                                | Status                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [ADR-001](architecture/decisions/ADR-001-camera-execution-context.md)      | Camera and recognition run in an extension context that stays active while YouTube is in the foreground | Accepted — Side Panel, worker, GPU |
| [ADR-002](architecture/decisions/ADR-002-local-gesture-recognition.md)     | MediaPipe runs locally from bundled assets; no backend                                                  | Accepted                           |
| [ADR-003](architecture/decisions/ADR-003-intentional-gesture-detection.md) | Explicit arming, temporal stabilization, re-arming, and return-stroke suppression                       | Accepted                           |
| [ADR-004](architecture/decisions/ADR-004-youtube-adapter-scope.md)         | YouTube adapter supports Play/Pause and ±10 s seek only                                                 | Accepted                           |
| [ADR-005](architecture/decisions/ADR-005-permissions-messaging-build.md)   | Minimal permissions, validated messages, packaged runtime assets                                        | Accepted                           |
| [ADR-006](architecture/decisions/ADR-006-seek-with-thumb-poses.md)         | Seek with thumb up / down poses instead of swipes                                                       | Accepted                           |

## Maintenance rules

- Keep documents short. Each one must support a decision, an implementation task, or a verification activity.
- When an architectural decision changes, write a new ADR that supersedes the old one; do not silently edit history.
- Update the affected document in the same change that alters behavior.
