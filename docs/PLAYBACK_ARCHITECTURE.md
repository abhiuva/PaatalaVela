# Playback Architecture

## Modes

Scheduled live mode is the default. The active channel is chosen from Asia/Kolkata time, then `calculateLivePlaybackPosition` maps elapsed slot seconds onto the deterministic channel queue.

Manual mode starts when a listener selects a channel. It starts at the first queue item, advances sequentially, and persists the manual channel, song, position, volume, muted state, and timestamp in local storage. Manual state expires after 12 hours and is cleared at the next schedule boundary.

Assistant mode starts only when a listener selects Play on a generated Mood Assistant playlist. Its queue is session-scoped, is not written to local storage, and uses the same reducer, controls, visible iframe, ended-event guard, and error recovery as other modes. Refinement preserves the current song and excludes completed song IDs. Returning to live clears the assistant queue and recalculates the scheduled position.

On-demand YouTube Live mode remains independent when a channel provides that source. Mood Assistant does not create a second player or alter scheduled/manual queue construction.

## Queue

`buildChannelQueue(channel)` is the only queue builder. It:

- sorts by sequence, assignment creation time, then song ID
- removes inactive or unavailable songs
- removes missing-duration songs from live mode
- removes duplicate song IDs
- never mutates the source catalogue
- never randomises

## State Machine

`playbackReducer` models `idle`, `loading`, `ready`, `playing`, `paused`, `transitioning`, `error`, and `exhausted`.

Duplicate YouTube `ENDED` events are guarded in the hook and reducer so one song end advances exactly one queue position. Player errors skip one ordered song and stop only when the queue is exhausted.

In assistant mode, player errors and listener skips advance within the generated queue and emit privacy-safe `assistant_song_skipped` analytics. Internal recommendation scores, confidence, listener text, and song titles are not included.

## YouTube Sync

The player remains a single visible YouTube iframe. Live mode calculates `seekSeconds`; the player loads the video and seeks once after the player is ready or when the song/seek revision changes.

The app does not seek every second. It resynchronises on initial live load, return to live, schedule boundaries, visibility resume, and major player error recovery.

## Drift

When a hidden tab becomes visible, live mode compares the expected live song/position with the player’s last reported position. Drift of five seconds or less is ignored. Larger drift triggers a live recalculation and seek.
