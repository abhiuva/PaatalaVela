create table if not exists public.listening_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id text not null check (length(anonymous_session_id) <= 80),
  event_name text not null check (event_name in (
    'radio_session_started',
    'radio_session_ended',
    'song_started',
    'song_completed',
    'song_skipped',
    'player_error',
    'channel_changed',
    'manual_mode_started',
    'returned_to_live',
    'scheduled_channel_transitioned',
    'playback_resynchronised',
    'fallback_catalogue_used',
    'whatsapp_share_clicked',
    'youtube_source_clicked',
    'schedule_viewed',
    'song_request_started',
    'song_request_submitted',
    'sponsor_impression',
    'sponsor_clicked',
    'takedown_form_opened'
  )),
  channel_id uuid references public.channels(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  playback_mode text check (playback_mode is null or playback_mode in ('live', 'manual')),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  event_date_ist date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_channel_metrics (
  metric_date_ist date not null,
  channel_id uuid not null references public.channels(id) on delete cascade,
  listening_sessions integer not null default 0,
  unique_anonymous_sessions integer not null default 0,
  songs_started integer not null default 0,
  songs_completed integer not null default 0,
  listening_seconds bigint not null default 0,
  skips integer not null default 0,
  player_errors integer not null default 0,
  shares integer not null default 0,
  fallback_catalogue_uses integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (metric_date_ist, channel_id)
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text not null check (website_url ~ '^https://'),
  contact_name text,
  contact_email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  campaign_name text not null,
  placement_type text not null check (placement_type in ('homepage', 'channel', 'now_playing', 'schedule', 'footer')),
  channel_id uuid references public.channels(id) on delete cascade,
  headline text not null,
  description text,
  image_url text,
  destination_url text not null check (destination_url ~ '^https://'),
  start_at timestamptz not null,
  end_at timestamptz not null,
  priority integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check ((placement_type = 'channel' and channel_id is not null) or (placement_type <> 'channel'))
);

create table if not exists public.daily_sponsor_metrics (
  metric_date_ist date not null,
  campaign_id uuid not null references public.sponsor_campaigns(id) on delete cascade,
  impressions integer not null default 0,
  clicks integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (metric_date_ist, campaign_id)
);

create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  song_name text not null,
  film_name text not null,
  singer text,
  youtube_url text,
  requested_channel_id uuid not null references public.channels(id) on delete restrict,
  reason text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'rejected', 'duplicate')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists listening_events_event_date_idx on public.listening_events (event_date_ist, event_name);
create index if not exists listening_events_session_idx on public.listening_events (anonymous_session_id, occurred_at);
create index if not exists sponsor_campaigns_active_idx on public.sponsor_campaigns (status, start_at, end_at, priority desc, created_at);
create index if not exists song_requests_status_idx on public.song_requests (status, created_at desc);

drop trigger if exists set_sponsors_updated_at on public.sponsors;
create trigger set_sponsors_updated_at
before update on public.sponsors
for each row execute function public.set_updated_at();

drop trigger if exists set_sponsor_campaigns_updated_at on public.sponsor_campaigns;
create trigger set_sponsor_campaigns_updated_at
before update on public.sponsor_campaigns
for each row execute function public.set_updated_at();

alter table public.listening_events enable row level security;
alter table public.daily_channel_metrics enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_campaigns enable row level security;
alter table public.daily_sponsor_metrics enable row level security;
alter table public.song_requests enable row level security;

create policy "Admins read listening events"
on public.listening_events for select
using (public.is_active_admin());

create policy "Service inserts listening events"
on public.listening_events for insert
with check (false);

create policy "Admins read channel metrics"
on public.daily_channel_metrics for select
using (public.is_active_admin_or_editor());

create policy "Admins manage channel metrics"
on public.daily_channel_metrics for all
using (public.is_active_admin())
with check (public.is_active_admin());

create policy "Admins manage sponsors"
on public.sponsors for all
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());

create policy "Public read renderable campaigns"
on public.sponsor_campaigns for select
using (status = 'active' and now() >= start_at and now() < end_at);

create policy "Admins manage campaigns"
on public.sponsor_campaigns for all
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());

create policy "Admins read sponsor metrics"
on public.daily_sponsor_metrics for select
using (public.is_active_admin_or_editor());

create policy "Admins manage sponsor metrics"
on public.daily_sponsor_metrics for all
using (public.is_active_admin())
with check (public.is_active_admin());

create policy "Public create song requests"
on public.song_requests for insert
with check (status = 'new' and reviewed_at is null);

create policy "Admins manage song requests"
on public.song_requests for all
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());

create or replace function public.delete_old_listening_events(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.listening_events
  where created_at < now() - make_interval(days => retention_days);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
