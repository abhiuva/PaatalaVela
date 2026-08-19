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

The script checks required env vars, Auth reachability, expected tables, the six locked Telugu schedule channels, English Hits, admin profile fields and basic public RLS behavior. It does not print keys, passwords, user records or table row contents.

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
read -s "ADMIN_PASSWORD?Admin password: " && echo
export ADMIN_PASSWORD
ADMIN_EMAIL=admin@example.com ADMIN_DISPLAY_NAME='Admin Name' npm run admin:bootstrap
unset ADMIN_PASSWORD
```

The silent prompt keeps the password out of shell history. The bootstrap script is idempotent: invoking it explicitly configures the supplied password in Supabase Auth, creates the Auth user only when missing, confirms the email, and upserts `admin_profiles` as an active `admin`. It never prints the email, password, UUID, user record, tokens or Supabase keys.

Then open:

```text
http://localhost:3000/admin/login
```

## Reset An Admin Password

Use this only for an existing Supabase Auth user that already has an active `admin_profiles` row with role `admin`. The reset script will not create users or change admin permissions.

```bash
read -s "ADMIN_NEW_PASSWORD?New admin password: " && echo
export ADMIN_NEW_PASSWORD
ADMIN_EMAIL=admin@example.com npm run admin:reset-password
unset ADMIN_NEW_PASSWORD
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
    ,'feedback_submissions'
    ,'active_listener_sessions'
  )
order by tablename;
```

## Troubleshooting

The login form always displays `Unable to sign in with those credentials.` for configuration, credential and authorization failures. Check `.env.local`, project availability and the account profile from a trusted administrator environment.

If `/admin` says unauthorized after login, run `npm run admin:bootstrap` for that email or check the `admin_profiles` row is active with role `admin`.
