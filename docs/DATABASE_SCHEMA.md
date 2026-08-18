# Database Schema

Migrations live in `supabase/migrations`.

## Tables

- `channels`: six locked scheduled channels with names, Telugu names, positioning, colors, display order, and active flag.
- `songs`: catalogue metadata, unique `youtube_video_id`, optional external links, availability status, active flag, and check timestamps.
- `channel_songs`: channel-song assignments with sequence, weight, and active flag. Duplicate assignments in the same channel are prevented.
- `admin_profiles`: links `auth.users` to an active `admin` or `editor` role.
- `takedown_requests`: private rights-review submissions with status and internal notes.

## Availability Status

`embed_status` supports:

- `unchecked`
- `available`
- `unavailable`
- `embedding_disabled`
- `region_restricted`

Only active songs with `embed_status = available` are exposed through public Supabase policies. If the remote catalogue has no playable songs, the app falls back to local data.

## RLS

Anonymous users may read active channels, active available songs, and active channel-song assignments. Anonymous users may insert takedown requests but cannot read them.

Active admins and editors may read, insert, and update catalogue and takedown records. Permanent delete policies require the `admin` role.

## Seed Data

The seed migration inserts the six locked channels and placeholder sample songs. It is idempotent and sets imported placeholders to `embed_status = unchecked`.
