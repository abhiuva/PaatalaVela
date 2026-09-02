# CassettePlay

An immersive Telugu, English and Hindi music radio built with Next.js, TypeScript, React, Tailwind CSS, and the official YouTube IFrame Player API.

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
npm run verify:playback-visibility
```

Run the playback-visibility verifier while the local development server is available at `http://localhost:3000`.

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
read -s "ADMIN_PASSWORD?Admin password: " && echo
export ADMIN_PASSWORD
ADMIN_EMAIL=admin@example.com ADMIN_DISPLAY_NAME='Admin Name' npm run admin:bootstrap
unset ADMIN_PASSWORD
```

If the Supabase CLI is not linked yet, run `npx supabase login`, `npx supabase link --project-ref YOUR_PROJECT_REF`, `npx supabase migration list`, then `npx supabase db push`.

Start the app and visit `/admin/login`.

The migrations insert the six locked Telugu schedule channels plus the optional on-demand English Hits and Hindi Hits channels. Public playback uses only active, available Supabase songs assigned through `channel_songs`; no placeholder media is bundled.

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
| English Hits | On demand |
| Hindi Hits | On demand |

The `Highway Ratri` range crosses midnight and is covered by unit tests. English Hits and Hindi Hits are manually selectable and do not alter the six-channel Telugu schedule.

## Song Data

`src/data/channels.ts` contains display shells only and no playable fallback songs. Curate songs through the authenticated admin YouTube import workflow, which stores verified metadata in Supabase and creates an ordered `channel_songs` assignment. On-demand channels can remain empty until verified songs in the matching language are imported.

Do not download or commit audio/video files. The repository contains metadata only.

## Admin Operations

- Add songs from `/admin` with core metadata, controlled language/era taxonomy, optional mood/occasion tags, and a YouTube URL or 11-character video ID.
- Assign songs to one or more channels while adding them, or use the assignment form in the songs table.
- Reorder songs inside a channel in the `Channel Order` section.
- Remove one channel relationship, move an assignment, or soft-delete a song through distinct confirmed controls. Soft delete preserves analytics and feedback history.
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
- Normal playback is deterministic. Queues are ordered by `channel_songs.sequence`, assignment `created_at`, then song ID.
- Shuffle is listener-local and never changes database order. Its first cycle prioritizes a randomized group from the channel's last five upcoming songs, then consumes the shuffled remainder without premature repeats.
- Scheduled live mode calculates the current song from India time, channel start time, ordered song durations, and total playlist duration.
- Manual channel mode starts from song 1, advances sequentially, and can be reset with `Return to Live Radio`.
- Songs without a positive duration are excluded from scheduled live positioning and shown as admin warnings.

## Deployment

The public radio can render from local fallback data without Supabase. Production admin, song requests, takedown storage, sponsorship storage and analytics require Supabase environment variables configured in the hosting provider.

### Netlify

Import the root-level repository into Netlify and use these settings:

| Setting | Value |
| --- | --- |
| Base directory | blank |
| Package directory | blank |
| Build command | `npm run build` |
| Publish directory | `.next` |
| Functions directory | blank |
| Runtime | Next.js |

Netlify's Next.js/OpenNext runtime generates the server functions required for SSR, route handlers, Server Actions and Supabase Auth. Do not configure a custom Functions directory or use a static export.

Configure these environment-variable names in Netlify without committing their values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
NEXT_PUBLIC_APP_VERSION
SUPABASE_SERVICE_ROLE_KEY
YOUTUBE_API_KEY
ANALYTICS_INGESTION_SECRET
ANALYTICS_RETENTION_DAYS
SENTIMENT_API_URL
SENTIMENT_API_KEY
SOCIAL_PROOF_DAILY_THRESHOLD
SOCIAL_PROOF_CONCURRENT_THRESHOLD
SOCIAL_PROOF_CHANNEL_THRESHOLD
```

Keep `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `ANALYTICS_INGESTION_SECRET` and `SENTIMENT_API_KEY` server-only. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS site URL, then add that URL and its `/admin/login` callback to the Supabase Auth URL configuration.

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
- `docs/DEVELOPMENT_BACKLOG_AUDIT.md`
- `docs/PHASE1_IMPLEMENTATION_REPORT.md`
- `docs/CONTENT_TAXONOMY.md`
- `docs/LISTENER_PRESENCE_DEFINITION.md`
- `docs/ON_DEMAND_CHANNELS.md`
- `docs/FEEDBACK_UUID_FIX.md`
- `docs/PHASE1_EXIT_CRITERIA.md`
- `docs/PLAYBACK_VISIBILITY_LIFECYCLE.md`
