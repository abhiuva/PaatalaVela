# Sprint 2 Implementation

Sprint 2 adds Supabase-backed catalogue administration while preserving the Sprint 1 public radio page.

## Public Radio

- `/api/catalogue` reads active channels and playable songs from Supabase.
- The browser fetches the catalogue once through `useCatalogue`.
- If Supabase env vars are absent, the request fails, or the remote catalogue is incomplete, the app uses `src/data/channels.ts` as a read-only fallback.
- The existing YouTube player stays visible and keeps one player instance.
- India-time scheduling remains in `src/lib/schedule.ts`.

## Admin

- `/admin/login` uses Supabase email/password authentication.
- `/admin` is protected by server-side auth checks and an active `admin_profiles` record.
- The dashboard supports song creation, status updates, archive/activate, channel assignment, assignment reordering, channel metadata edits, and takedown moderation.
- Schedules are intentionally read-only in Sprint 2.

## Security

- The service-role key is only read in server-only modules.
- Public catalogue responses include normalized non-sensitive channel/song data.
- Takedown requests are inserted server-side and are not publicly readable.
- Editors can archive/update records but delete policies are admin-only.

## Limitations

- There is no public registration.
- The admin UI is intentionally compact and operational.
- YouTube availability checks require `YOUTUBE_API_KEY`.
- YouTube checks cannot guarantee playback in every region; runtime player errors still skip broken videos.
