# ADR-006: Seek with thumb poses instead of swipes

Status: Accepted (2026-10-12, Week 3)
Supersedes: the swipe gestures in ADR-003 and ADR-004.

## Context

Seeking was planned as swipe left (−10 s) and swipe right (+10 s). The Week 3 engine was fitted to the recorded sessions and passed the replay tests, but live use still fired the wrong direction:

- Every swipe comes with positioning moves: a **wind-up** to the start side before it and a **return** after it.
- For the same user, the move they meant and the positioning move had similar distance and speed. In one recording the return strokes were faster than the swipes; in another the reverse was true.
- Each rule we added (speed threshold, center crossing, "longer motion wins") fixed one recording and broke another.

A wrong-direction seek is worse than a missed one, because it erodes trust in the product.

## Decision

All MVP gestures are **held poses**, recognized by the same rule (ADR-003): hold the pose still for 700 ms; it fires once and re-arms when the hand moves.

| Pose (held ~0.7 s) | Command                     |
| ------------------ | --------------------------- |
| Open palm          | `MEDIA_TOGGLE` (Play/Pause) |
| Thumb up           | `MEDIA_SEEK +10`            |
| Thumb down         | `MEDIA_SEEK −10`            |

- Poses are MediaPipe canned categories (`Open_Palm`, `Thumb_Up`, `Thumb_Down`), so no custom model is needed.
- A different pose starts a new hold, but only re-arms once the hand's shape or position changes. A one-frame misclassification therefore cannot fire twice.
- Swipe detection was removed from the code; it remains in git history (commits up to `29f5228`).

## Consequences

- No direction ambiguity, return strokes, or wind-ups. Swiping is now ordinary hand movement, and the replay tests require it to produce no intents.
- Thumb scores and false triggers are not yet measured: **a labeled recording of thumb up and thumb down holds is required** before Week 4 is accepted.
- Thumbs appeared only briefly during normal activity in the Week 1 recordings (6 frames over ~2.5 minutes), well below the 700 ms hold.
- Accessibility: thumb poses need some finger control. Manual buttons remain available, and per-gesture disable stays in scope.
