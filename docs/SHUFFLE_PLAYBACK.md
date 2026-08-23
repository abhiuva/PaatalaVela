# Shuffle Playback

## Scope

Shuffle is a listener-only playback mode shared by every active database channel. It changes the order in which the current listener advances through a channel; it never updates `channel_songs.sequence` or any catalogue record.

## Queue Contract

- The normal queue remains the deterministic `sequence`, assignment creation time, then song ID order from `buildChannelQueue`.
- Enabling or disabling shuffle does not reload or restart the current song.
- Shuffle uses a Fisher-Yates queue, consumes each eligible song once per cycle, and avoids an immediate cycle-boundary repeat when at least two songs are available.
- Recent songs are deprioritized for queues of three or more songs. Previous follows listener history while shuffle remains enabled.
- A channel change creates a new shuffle state keyed by the internal channel UUID. A catalogue fingerprint change removes unavailable/deleted songs and rebuilds the remaining cycle.
- Empty and one-song channels disable the control. Two-song channels alternate without an immediate repeat.
- Turning shuffle off affects the next transition; the current song continues and normal deterministic order resumes from it.

## Persistence And Analytics

The non-sensitive global preference is stored as version 1 under `paatalavela.shuffle.v1`. Malformed or incompatible data is removed safely. Queue history is kept only in memory.

Each actual toggle emits one `shuffle_mode_changed` event with the channel UUID, channel slug, previous mode, new mode, and anonymous session ID. Song-start analytics are emitted only after the YouTube player reports `PLAYING`.

## Accessibility

The shuffle button has a visible focus ring, an accessible label, `aria-pressed`, a tooltip, and a 48px minimum touch target. It is disabled with an explanation when fewer than two verified songs are available.

## Rollback

Remove the shuffle control and hook integration, then remove `shuffle_mode_changed` from the application event schema and database constraint. Normal queue ordering remains unchanged throughout.
