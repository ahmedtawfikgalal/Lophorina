# ADR-004: YouTube adapter scope

Status: Accepted

## Decision

| Input                                         | Command          | Behavior                                                      |
| --------------------------------------------- | ---------------- | ------------------------------------------------------------- |
| Start Control (button / shortcut)             | —                | Start camera, arm after initialization                        |
| Hold open palm                                | `MEDIA_TOGGLE`   | `video.paused ? play() : pause()`                             |
| Hold thumb down (ADR-006)                     | `MEDIA_SEEK -10` | `currentTime = max(0, t − 10)`                                |
| Hold thumb up (ADR-006)                       | `MEDIA_SEEK +10` | `currentTime = min(duration, t + 10)` when duration is finite |
| Stop Control (button / shortcut / close host) | —                | Disable dispatch, release camera                              |

Supported pages: `https://www.youtube.com/watch*` only.

## Adapter rules

1. Locate the main player video (`#movie_player video` or equivalent), not the first `<video>` in the document — hover previews and the miniplayer add extra video elements. Selector lives in one constant and is covered by an integration test.
2. Re-resolve the video element on each command; YouTube is an SPA and replaces it on navigation (`yt-navigate-finish`).
3. If an ad is playing (player has the ad-showing state), reject seek with `AD_PLAYING`; toggle is allowed.
4. `play()` returns a promise; a rejection (autoplay policy) becomes `PLAY_REJECTED` with a user-visible hint.
5. Always return a structured `CommandResult`; never fail silently.
6. Use the native `HTMLVideoElement` API. Synthetic keyboard events and the IFrame Player API are not used.
7. Reject every command with `UNSUPPORTED_PAGE` unless `location.pathname === '/watch'`, checked on each command. YouTube keeps `#movie_player` and its video element in the page after leaving a watch page (seen in the Week 1 spike, S10), so finding a video is not enough.

## Excluded

Shorts, embedded players, YouTube Music, live streams' DVR edge cases, volume, next/previous, fullscreen.

## Consequences

- YouTube DOM changes affect only `adapters/youtube/`; recognition and interaction code are unaffected.
- Google Slides becomes a second `SiteAdapter` in the next release, adding `PRESENTATION_NEXT` / `PRESENTATION_PREVIOUS` via a new ADR.
