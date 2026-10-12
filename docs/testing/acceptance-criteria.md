# MVP Acceptance Criteria

Owner: Tech Lead + QA. These are proposed release gates, not measured results. A target without a measurement method is not a release criterion.

| #     | Metric                    | Target                                                                                                                                                          | Measurement                                               |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| AC-1  | Intent-to-command latency | P95 ≤ 500 ms from intent confirmation (excluding hold time) to `COMMAND_RESULT ok`                                                                              | `performance.now()` timestamps keyed by `commandId`       |
| AC-2  | Command-to-visible-action | Recorded (no gate in MVP)                                                                                                                                       | `play`/`pause`/`seeked` event timestamp in content script |
| AC-3  | False activations         | 0 unintended commands in the scripted 30-minute negative test; also run on recorded replay set                                                                  | Count + video of session                                  |
| AC-4  | Gesture success           | ≥ 95 % of valid attempts in the defined set (20 attempts × gesture × condition)                                                                                 | Successful / valid attempts, denominator reported         |
| AC-5  | Pose confusion            | 0 wrong commands in 20 holds each of palm, thumb up and thumb down (a thumb never triggers Play/Pause, and vice versa)                                          | Replay + live test                                        |
| AC-6  | Camera stop               | All tracks stopped ≤ 1 s after Stop                                                                                                                             | Lifecycle timestamps + browser camera indicator           |
| AC-7  | Command routing           | 100 % of tested commands reach only the controlled tab                                                                                                          | Integration tests                                         |
| AC-8  | Background operation      | Recognition continues while YouTube is focused for 10 min, processing ≥ 95 % of delivered camera frames up to 15/s, and never below 10 obs/s in any 10 s window | Observation counter (ADR-001)                             |
| AC-9  | Permission denial         | No camera loop and no commands after denial                                                                                                                     | Negative-path test                                        |
| AC-10 | Local processing          | 0 network requests from extension contexts during a session                                                                                                     | DevTools network inspection                               |
| AC-11 | Error recovery            | Camera, model, and target failures show a visible error and a recovery path                                                                                     | Fault-injection tests                                     |
| AC-12 | No auto-reactivation      | Extension reload, SW restart, browser restart never restart the camera                                                                                          | Lifecycle test                                            |
| AC-13 | Accessibility             | Keyboard-only operation of all functions; status announced to screen readers                                                                                    | Manual a11y test                                          |
| AC-14 | Resource use              | CPU and memory recorded on target laptop (no gate in MVP; gate set after baseline)                                                                              | Chrome Task Manager                                       |

## Release rule

Report actual counts and test conditions. If a gate fails, fix the highest-risk issue and repeat the affected tests. Never report "95 % accurate" without the denominator and test set. Passing a scripted test does not prove accidental activation cannot occur.
