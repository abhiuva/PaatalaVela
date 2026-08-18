# Admin Operations

## First Admin

Create a Supabase Auth user manually, then link it:

```sql
insert into public.admin_profiles (id, display_name, role, active)
values ('AUTH_USER_UUID', 'Admin Name', 'admin', true);
```

Only users with an active profile can access `/admin`.

## Adding A Song

1. Go to `/admin`.
2. Fill title, film, release year, singers, composer, and YouTube URL or video ID.
3. Choose an availability status. Use `unchecked` until reviewed.
4. Select channel assignments.
5. Save.

Duplicate YouTube video IDs are rejected by validation and the database unique constraint.

## Assigning And Reordering

Use the song row assignment form to assign an existing song to a channel. Use `Channel Order` to adjust `sequence`, move items up/down, preview the next five songs, and remove an assignment without deleting the song globally.

Scheduled live playback requires positive song duration. Missing durations are shown as warnings and excluded from live positioning.

## Channels

Admins may edit English/Telugu names, positioning, mood image URL, colours, and display order. Start and end hours are locked and read-only in Sprint 2.

## Takedowns

Requests submitted at `/takedown` appear in the admin dashboard. Admins/editors can change status, add internal notes, and optionally disable the affected song.

## YouTube Checks

Set `YOUTUBE_API_KEY` to enable availability checks. The checker only accepts a song ID, reads the stored YouTube video ID, validates it, calls YouTube Data API, and updates `embed_status` plus `last_checked_at`.
