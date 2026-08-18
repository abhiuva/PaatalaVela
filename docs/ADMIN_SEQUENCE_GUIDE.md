# Admin Sequence Guide

## Duration Requirement

Scheduled live mode requires positive `duration_seconds`. Active songs with missing or invalid duration are visible in admin warnings and excluded from live positioning.

## Reordering

The admin dashboard shows exact assignment sequence values, active state, missing-duration warnings, and the next five songs per channel.

Administrators can:

- move a song up
- move a song down
- edit a sequence number
- remove a song from a channel without deleting it globally

Move up/down calls the `reorder_channel_assignments` database function, which rewrites the complete active assignment order as `10, 20, 30, ...` for the channel.

## Duplicate Sequence Values

Duplicate sequence values are shown as warnings. Playback still remains deterministic because equal sequence values are ordered by assignment creation time and then song ID.

## Readiness

A channel is not ready for scheduled playback if it has zero active, available songs with valid duration. The public radio falls back to the next channel with a valid queue instead of choosing an arbitrary song.
