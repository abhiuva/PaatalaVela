# Supabase Admin Setup

This project uses Supabase for the admin catalogue, requests, sponsorship and analytics tables. Secrets must stay in `.env.local` or your deployment provider secrets. Do not commit real keys.

## Required Environment

Create `/Users/abhishekkola/Documents/Telugu_MusicApp/.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional values:

```bash
YOUTUBE_API_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
ANALYTICS_INGESTION_SECRET=
ANALYTICS_RETENTION_DAYS=90
```

## Verify The Database

Run the redacted verification script:

```bash
npm run supabase:verify
```

The script checks required env vars, Auth reachability, expected tables, six locked channels, admin profile fields and basic public RLS behavior. It does not print keys, passwords, user records or table row contents.

## Link And Push Migrations

This repository currently expects local migration files under `supabase/migrations`. If the Supabase CLI is not linked, run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push
```

Find `YOUR_PROJECT_REF` in the Supabase dashboard URL or project settings.

## Bootstrap The First Admin

After migrations are applied, create or promote one admin account:

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='Use-A-Strong-Password-123' \
ADMIN_DISPLAY_NAME='Admin Name' \
npm run admin:bootstrap
```

The bootstrap script is idempotent. It creates the Auth user if missing, confirms that bootstrap email, upserts `admin_profiles` as an active `admin`, verifies login once and never prints the password or Supabase keys.

Then open:

```text
http://localhost:3000/admin/login
```

## Reset An Admin Password

Use this only for an existing Supabase Auth user that already has an active `admin_profiles` row with role `admin`. The reset script will not create users or change admin permissions.

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_NEW_PASSWORD='Use-A-New-Strong-Password-123' \
npm run admin:reset-password
```

The script prints only safe status lines. It never prints the password, password length, service-role key, access tokens, auth tokens or the full Auth user record.

The command fails with a non-zero exit code if configuration is missing, the user is missing, multiple Auth users unexpectedly match, the password update fails, or the admin profile is missing, inactive or not role `admin`.

## Safe SQL Checks

These are safe to run in the Supabase SQL editor. They do not expose secrets.

```sql
select slug, name, start_hour, end_hour, active
from public.channels
order by display_order;
```

```sql
select count(*) as admin_profile_count
from public.admin_profiles;
```

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'channels',
    'songs',
    'channel_songs',
    'admin_profiles',
    'takedown_requests',
    'listening_events',
    'daily_channel_metrics',
    'sponsors',
    'sponsor_campaigns',
    'daily_sponsor_metrics',
    'song_requests'
  )
order by tablename;
```

## Troubleshooting

If `/admin/login` says admin login is not configured, check `.env.local` and deployment secrets.

If the login form says Supabase is unreachable, confirm the project is not paused and the URL/key pair belongs to the same project.

If the login form says credentials are invalid, the email/password failed or the account does not match the intended admin. Keep this message generic in production.

If `/admin` says unauthorized after login, run `npm run admin:bootstrap` for that email or check the `admin_profiles` row is active with role `admin` or `editor`.
