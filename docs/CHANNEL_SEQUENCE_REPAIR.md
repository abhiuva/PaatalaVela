# Channel Sequence Repair

## Applied Repair

Migration `20260824130000_channel_sequence_integrity.sql` stores every original assignment in `channel_sequence_repair_backup` under repair ID `20260824130000`. Each mapping preserves assignment, channel, song, active state, creation time, original sequence, and repaired sequence.

Rows are ranked per channel with active rows first, then existing sequence, `created_at`, and assignment UUID. The active-first rule keeps every playable queue contiguous while retaining inactive history after it. A temporary sequence range is used before final `1..N` values, then the migration validates duplicates, positivity, active contiguity, and source/backup row counts.

The database now enforces:

- `CHECK (sequence > 0)`
- `UNIQUE (channel_id, sequence)`
- the existing `UNIQUE (channel_id, song_id)`

Sequence is not globally unique. The same song can remain assigned to different channels.

## Verification

Before: 105 rows, 25 rows in all duplicate groups, 23 active duplicate rows, and one sequence-zero row. After: 105 rows, zero duplicate/null/non-positive rows, and contiguous active queues in every populated channel.

Repeat with `node scripts/audit-channel-sequences.mjs`. The complete before/after evidence is in `CHANNEL_SEQUENCE_INTEGRITY_AUDIT.md`.

## Rollback

Rollback requires an explicit maintenance window because restored values intentionally violate the new constraints:

1. Stop catalogue writes.
2. Drop `channel_songs_channel_sequence_key` and `channel_songs_sequence_positive`.
3. Move mapped rows into a safe temporary range.
4. Restore `original_sequence` by joining `channel_songs.id` to `channel_sequence_repair_backup.assignment_id` for repair ID `20260824130000`.
5. Reconcile all 105 relationships and rerun the audit.

Do not drop the backup table or restore old sequence values during normal operation.
