# Radio Scheduling

All scheduling uses `Asia/Kolkata` through `Intl.DateTimeFormat` with an explicit time zone.

## Locked Slots

| Channel | Time |
| --- | --- |
| Suprabhata Melodies | 05:00-09:00 |
| Tea Shop Classics | 09:00-13:00 |
| Ilaiyaraaja Era | 13:00-17:00 |
| Prema & Viraham | 17:00-21:00 |
| Mass Beat Centre | 21:00-23:00 |
| Highway Ratri | 23:00-05:00 |

`Highway Ratri` crosses midnight. The live-position code treats a 01:00 listener as two hours after the previous 23:00 start.

## Live Position Algorithm

1. Convert the current instant to India wall-clock parts.
2. Build the channel start time for the active channel’s slot.
3. If the start hour is after the current India hour, subtract one day.
4. Calculate elapsed channel seconds.
5. Sum ordered valid song durations.
6. Use `elapsedChannelSeconds % totalPlaylistDuration`.
7. Walk the queue and return song index plus seek seconds.

If the active scheduled channel has no valid live queue, the app uses the next channel with a valid queue and records the fallback reason in the UI/log path.

## Boundary Handling

If a schedule boundary occurs during a song, the current song continues. On `SONG_ENDED`, the app loads the correct live position for the new scheduled channel. If the old song continues more than 15 minutes after the boundary, the app switches to the new live position.
