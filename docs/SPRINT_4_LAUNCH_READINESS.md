# Sprint 4 Launch Readiness

## Analytics

Analytics uses one abstraction: `trackEvent(eventName, properties)`.

Optional analytics is consent-aware:

- `unknown`: no optional analytics initialises
- `accepted`: browser events may be sent to the validated ingestion route and optional PostHog endpoint
- `rejected`: analytics stays disabled

Events are validated in `src/lib/analytics/events.ts`. Unsupported names, oversized payloads, unknown personal-data fields and unbounded durations are rejected before storage.

## Sponsorship

Sponsors and campaigns are stored in Supabase. Public sponsor placement data is served only through `/api/sponsors/active`, which strips contact fields.

Campaign selection is deterministic:

1. active channel-specific campaign
2. active homepage/general campaign
3. higher priority
4. earliest created campaign

Sponsored placements render outside the YouTube iframe and are clearly labelled.

## Song Requests

Public song requests are anonymous, rate-limited and never publish catalogue records automatically. Admin review is required from `/admin/song-requests`.

## Monitoring

`/admin/health` shows Supabase configuration, active channels, missing durations, unavailable songs, analytics ingestion status, active sponsor campaign and current IST scheduled channel.

## Legal And SEO

Public pages exist for `/about`, `/privacy`, `/terms`, `/rights-and-takedown`, `/song-request` and `/takedown`.

SEO routes include `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, Open Graph/Twitter metadata and WebSite structured data.

## Launch Notes

Legal pages are operational templates and require professional review before commercial launch. External Supabase/PostHog behavior was implemented defensively but still needs verification with production credentials.
