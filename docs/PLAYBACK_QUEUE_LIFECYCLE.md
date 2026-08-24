# Playback Queue Lifecycle

Every normalized entry retains `channel_songs.id` as `assignmentId`, channel UUID, song UUID, sequence, YouTube ID, availability, duration, and assignment creation time. Normal order is sequence, assignment creation time, then stable song UUID. Duplicate legacy sequence or YouTube values cannot become playback identity.

The hook stores the current assignment ID, including manual-mode restoration. Manual Previous/Next and automatic `ENDED` both call the same `advanceQueue(direction, userInitiated)` function. Normal mode advances by assignment index and wraps only at queue boundaries. Shuffle stores assignment IDs in its listener-local cycle and never changes database order.

Each load increments a revision. The ended guard uses channel, assignment, and revision and is not cleared by loading the next entry. The IFrame handler also ignores an `ENDED` event whose reported video differs from the currently requested video. One player instance and one listener set are retained until component unmount.

Unavailable entries are tracked by assignment ID and skipped with a bound equal to queue length. Exhaustion stops playback and shows an explicit state. Channel changes rebuild a channel-specific queue; UUID/version-keyed catalogue requests abort or ignore stale responses.

Scheduled live positioning remains time-based only for initial, boundary, return-to-live, and permitted visibility synchronization. Manual navigation marks listener offset, so unrelated refreshes cannot reset its queue position.
