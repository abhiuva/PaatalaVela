# Paatala Vela Telugu Radio

A functional single-page Telugu music radio MVP built with Next.js, TypeScript, React, Tailwind CSS, and the official YouTube IFrame Player API.

The app selects a channel from the current `Asia/Kolkata` time, keeps one visible YouTube player instance, and only starts playback after user interaction.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

## Environment

Copy `.env.example` to `.env.local` and fill what is available:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
YOUTUBE_API_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
ANALYTICS_INGESTION_SECRET=
ANALYTICS_RETENTION_DAYS=90
```

The public radio renders without Supabase by using local fallback data. Admin, takedown storage, song requests, pilot feedback, sponsorship storage, aggregate analytics and YouTube availability checks require Supabase. `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `SENTIMENT_API_KEY` and `ANALYTICS_INGESTION_SECRET` are server-only secrets; never expose them in browser code or commit real values.

## Supabase Setup

See `docs/SUPABASE_ADMIN_SETUP.md` for the full safe setup flow.

Quick path:

```bash
npm run supabase:verify
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='Use-A-Strong-Password-123' ADMIN_DISPLAY_NAME='Admin Name' npm run admin:bootstrap
```

If the Supabase CLI is not linked yet, run `npx supabase login`, `npx supabase link --project-ref YOUR_PROJECT_REF`, `npx supabase migration list`, then `npx supabase db push`.

Start the app and visit `/admin/login`.

The seed migration inserts the six locked channels and sample placeholder songs with `embed_status = unchecked`. Placeholder songs are not claimed as verified official uploads.

## Channel Schedule

All schedule calculations use `Asia/Kolkata`.

| Channel | Time |
| --- | --- |
| Suprabhata Melodies | 05:00-09:00 |
| Tea Shop Classics | 09:00-13:00 |
| Ilaiyaraaja Era | 13:00-17:00 |
| Prema & Viraham | 17:00-21:00 |
| Mass Beat Centre | 21:00-23:00 |
| Highway Ratri | 23:00-05:00 |

The `Highway Ratri` range crosses midnight and is covered by unit tests.

## Replace Song Data

All channels and songs live in `src/data/channels.ts`.

Each channel has five clearly marked placeholder records:

```ts
{
  title: "Suprabhata Placeholder 1",
  film: "Replace With Film",
  year: 1990,
  singers: ["Replace Singer"],
  composer: "Replace Composer",
  youtubeVideoId: "dQw4w9WgXcQ",
  placeholder: true,
}
```

To curate the radio:

1. Replace `title`, `film`, `year`, `singers`, and `composer`.
2. Replace `youtubeVideoId` with the official YouTube video ID.
3. Set `placeholder` to `false` after the record is real.

Do not download or commit audio/video files. The repository should contain metadata only.

## Admin Operations

- Add songs from `/admin` with title, film, release year, singers, composer, and a YouTube URL or 11-character video ID.
- Assign songs to one or more channels while adding them, or use the assignment form in the songs table.
- Reorder songs inside a channel in the `Channel Order` section.
- Archive songs instead of deleting them. Permanent deletion is restricted by RLS to `admin` role users and is not exposed in the Sprint 2 UI.
- Channel schedules are displayed as read-only fields and cannot be edited in Sprint 2.
- Public takedown requests are submitted at `/takedown` and moderated in `/admin`.
- Sponsors and campaigns are managed at `/admin/sponsors`.
- Aggregate metrics are viewed at `/admin/analytics`; raw events are not shown in the normal dashboard.
- Song requests are reviewed at `/admin/song-requests`.
- Operational health is available at `/admin/health`.

## Analytics And Consent

The public app uses a consent banner with `unknown`, `accepted`, and `rejected` states. Optional analytics does not initialise before consent and rejecting analytics does not affect playback.

Events are sent through `trackEvent(eventName, properties)` and validated by `/api/analytics/events`. The app does not send names, email addresses, song titles, singer names, raw YouTube URLs, full user-agent strings, Supabase user IDs or admin details.

Pilot feedback, sentiment provider setup, analytics classification and aggregation behavior are documented in `docs/ANALYTICS_AND_FEEDBACK.md`. Apply its forward-only migration with `npx supabase db push` before enabling feedback in an environment.

## Sponsorship

Sponsor placements render outside the YouTube iframe and are labelled `Sponsored`. Campaign selection is deterministic: channel-specific campaigns first, then general homepage campaigns, then priority, then earliest creation time. Sponsor links open externally with `rel="sponsored noopener noreferrer"`.

## YouTube API Setup

Set `YOUTUBE_API_KEY` to enable the admin “Check availability” action. Without the key, the admin interface clearly shows that checks are disabled and the rest of the app continues working. YouTube metadata checks cannot prove playback availability in every country; the existing runtime player error handler remains the final fallback.

## Playback Behavior

- Start/Pause, Previous, Next, volume, YouTube open, and WhatsApp share controls are included.
- Volume and manual channel preference are stored in browser `localStorage`.
- Scheduled channel changes wait until the current song ends before loading the next scheduled channel.
- Failed YouTube videos are skipped and tracked per channel pass to avoid infinite retries.
- The YouTube iframe remains visible for policy compliance.
- Supabase catalogue data is fetched once through `/api/catalogue`; song transitions use the cached browser catalogue instead of querying Supabase repeatedly.
- Playback is deterministic. Queues are ordered by `channel_songs.sequence`, assignment `created_at`, then song ID.
- Scheduled live mode calculates the current song from India time, channel start time, ordered song durations, and total playlist duration.
- Manual channel mode starts from song 1, advances sequentially, and can be reset with `Return to Live Radio`.
- Songs without a positive duration are excluded from scheduled live positioning and shown as admin warnings.

## Deployment

The public radio can render from local fallback data without Supabase. Production admin, song requests, takedown storage, sponsorship storage and analytics require Supabase environment variables configured in the hosting provider.

Deploy with any Next.js-compatible host:

```bash
npm run build
npm run start
```

For Vercel, import the repository and keep the default Next.js settings.

## More Documentation

- `docs/SPRINT_2_IMPLEMENTATION.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/ADMIN_OPERATIONS.md`
- `docs/SPRINT_3_PLAYBACK_FIX.md`
- `docs/PLAYBACK_ARCHITECTURE.md`
- `docs/RADIO_SCHEDULING.md`
- `docs/ADMIN_SEQUENCE_GUIDE.md`
- `docs/SPRINT_4_LAUNCH_READINESS.md`
- `docs/SUPABASE_ADMIN_SETUP.md`
