# Sprint 3 Playback Fix

## Root Cause

The codebase did not contain `Math.random`, shuffle helpers, random database ordering, or weighted random selection in active playback paths. The observed "random" behavior came from incomplete radio semantics:

- Scheduled mode always initialized `trackIndex` to `0`, so a listener joining mid-slot did not hear the station position that should already be in progress.
- Supabase assignment sorting only ordered by `channel_songs.sequence`; it did not include the required stable tie-breakers.
- Local fallback song records had no durations, so deterministic live positioning could not be calculated.
- Manual channel state stored only the selected channel and volume, not the current song/position/mode.

## Correction

Sprint 3 introduces:

- `buildChannelQueue(channel)` for deterministic ordered queues.
- `calculateLivePlaybackPosition(...)` for elapsed-time-based scheduled playback.
- An explicit playback reducer covering start, play, pause, ended, errors, transitions, and return-to-live.
- Local storage validation and 12-hour manual-mode expiry.
- YouTube seek support for calculated live positions.

No random playback path is retained.
