# Channel Playback Lifecycle

## Root Cause

Channel selection previously updated the selected channel and cued its first video but did not set the requested playback state to playing. A fresh or paused listener therefore saw the selected channel with no audio. In addition, the persistent YouTube instance captured the first render's `onEnded` and `onError` closures, allowing a later event to advance an obsolete channel queue. An index-based fallback could also retain a filtered or stale song after the new queue became empty.

## Selection Contract

1. A channel tile click is the user gesture and resolves the selected channel by its internal Supabase UUID and slug.
2. The UI selects the channel immediately, clears prior failure state, creates a new verified queue, and requests playback when that queue is populated.
3. A UUID-keyed no-store channel refresh starts in parallel. The prior request is aborted and its response is ignored if a newer selection exists.
4. The persistent player receives the new video and request revision. It waits for IFrame readiness, then calls `loadVideoById` from the user-requested playing state.
5. Playback is considered started only when YouTube emits `PLAYING`. That transition clears `Tap to play` and emits song-start analytics once for the channel, song, and revision.
6. If the browser blocks playback, the request times out to `Tap to play`; the selected channel and song remain intact for a second user gesture.
7. `ENDED` advances once. Player errors mark the current song failed and skip to another eligible song without retrying failed IDs. Exhaustion stops playback.

## Empty And Boundary Behavior

The IFrame remains mounted for the page lifetime. Selecting an empty channel sends a null video, explicitly stops the old media, and shows `No verified songs available` plus the catalogue empty state. It never borrows a song from another channel.

Scheduled channel changes still finish the current song before returning to the calculated live position. Manual selection remains selected until the existing schedule-boundary policy returns the listener to live radio.

## User States

- `Loading songs`: selected-channel catalogue request is pending.
- `Starting playback`: a play request is waiting for confirmed YouTube playback.
- `Tap to play`: autoplay was blocked and another gesture is required.
- `Song unavailable, trying next.`: bounded player-error recovery is in progress.
- `No verified songs available.`: the selected verified queue is empty or exhausted.
- `Unable to load channel. Retry`: selected-channel refresh failed without changing the selected channel.

## Visibility And Suspension

Tab visibility is not a playback initialization signal. The player load identity is the stable assignment UUID plus video ID, independent of seek revision and mutable catalogue object identity. A normally playing tab return sends no player command. Scheduled recovery ignores drift up to five seconds, seeks the same assignment without reloading when drift is material, and loads only when the authoritative scheduled assignment genuinely changed. On-demand recovery retains assignment, queue index, shuffle cycle, and last position. A suspended player receives one resume attempt; browser-policy refusal preserves the entry and shows `Tap to resume`.

Presence and listener-count refresh remain independent from player state. Details and browser evidence are in `PLAYBACK_VISIBILITY_LIFECYCLE.md`.
