# Phase 1 Exit Criteria

| Criterion | Status | Evidence or blocker |
| --- | --- | --- |
| Brand decision approved and applied | Blocked | No approved replacement name or tagline; Paatala Vela preserved. |
| Taxonomy schema and admin controls | Implemented | Migration, typed models, manual/edit/YouTube controls, and tests are complete. |
| Existing catalogue backfilled | Implemented with editorial review pending | 94/94 language and era; 43/94 mood and occasion; 51 English songs intentionally await subjective tagging. |
| Remove one channel relationship | Implemented | Confirmed service-only transactional unlink with audit event. |
| Safe song deletion | Implemented | Typed `DELETE` confirmation, dependency preview, soft delete, assignment deactivation, audit event. |
| Duplicate assignment prevention | Implemented | Existing database uniqueness plus idempotent upsert and distinct add/move/remove/delete controls. |
| Now Playing hierarchy | Implemented | Stable artwork/fallback, concise conditional facts, story/context, responsive layout and tests. |
| Presence definition and freshness | Implemented | 30-second heartbeat, 90-second timeout, 15-second refresh, aggregate daily RPC and reconnect behavior. |
| Honest adaptive wording | Implemented | Configurable thresholds and unavailable state; no fabricated counts. |
| Six Telugu schedules unchanged | Implemented | Schedule utility still filters only scheduled channels; boundary tests pass. |
| English Hits remains on demand | Implemented | Existing UUID and mode migration preserved. |
| Hindi Hits launches on demand | Implemented | UUID-backed empty channel and language/availability triggers are live; no songs fabricated. |
| Language analytics reconcile | Implemented | New events/dimensions, DB event constraint, and admin language/mode reports are live and tested. |
| Feedback UUID handling | Complete | Valid, null, omitted, malformed, slug, unknown, insert, and general-feedback tests pass. |
| Type-check, lint, tests, build | Pass | Type-check, lint, 206 tests, and the Next.js 16.3.1 production build pass. |
| Channel sequence integrity | Implemented | 105 rows reconciled; zero collisions/null/non-positive values; reversible mapping and scoped constraints are live. |
| Atomic admin import | Implemented | Video/playlist imports use one locked transaction with idempotent existing-song outcomes and safe staged errors. |
| Stable playback navigation | Implemented | Assignment UUID identity, shared manual/automatic advance, five-transition parity, wrap and duplicate-ended tests pass. |

## User-approved Additions

- [x] Shuffle works for scheduled and on-demand channels without changing database sequence.
- [x] Every active channel is manually tested in normal and shuffle modes in installed Chromium; Firefox/WebKit executables were unavailable locally.
- [x] Populated channel selection starts playback or shows a clear Tap to play fallback.
- [x] Empty and exhausted channels show explicit states.
- [x] Unavailable songs are skipped with a bounded retry count.
- [x] Previous-channel songs cannot resume after a switch.
- [x] Selected-channel catalogue refresh is isolated by internal channel UUID.
- [x] Dynamic catalogue cache behavior is documented and users do not need to clear browser cache.
- [x] Updated type-check, lint, tests, and production build pass.
- [x] Suprabhata, Tea Shop, Prema, and all other active channels have unique contiguous active sequences.
- [x] Automatic and manual Next share one tested queue-advance function.
- [x] Sequence repair backup and rollback mapping are retained in Supabase.
