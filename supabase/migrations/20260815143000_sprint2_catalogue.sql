create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'embed_status') then
    create type public.embed_status as enum (
      'unchecked',
      'available',
      'unavailable',
      'embedding_disabled',
      'region_restricted'
    );
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  telugu_name text not null,
  positioning text not null,
  start_hour integer not null check (start_hour >= 0 and start_hour <= 23),
  end_hour integer not null check (end_hour >= 0 and end_hour <= 23),
  background_image_url text,
  primary_color text not null,
  secondary_color text not null,
  accent_color text not null,
  display_order integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  telugu_title text,
  film text not null,
  release_year integer not null check (release_year >= 1900 and release_year <= 2100),
  singers text[] not null check (array_length(singers, 1) > 0),
  composer text not null,
  lyricist text,
  youtube_video_id text not null unique check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  youtube_url text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  spotify_url text,
  youtube_music_url text,
  editorial_note text,
  editorial_note_telugu text,
  thumbnail_url text,
  embed_status public.embed_status not null default 'unchecked',
  last_checked_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_songs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  sequence integer not null,
  weight integer not null default 1 check (weight > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (channel_id, song_id)
);

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'editor')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.takedown_requests (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references public.songs(id) on delete set null,
  claimant_name text not null,
  claimant_email text not null,
  rights_holder text not null,
  request_details text not null,
  evidence_url text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'rejected')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channels_active_idx on public.channels (active, display_order);
create index if not exists songs_active_idx on public.songs (active, embed_status);
create index if not exists songs_youtube_video_id_idx on public.songs (youtube_video_id);
create index if not exists channel_songs_sequence_idx on public.channel_songs (channel_id, active, sequence);
create index if not exists takedown_requests_status_idx on public.takedown_requests (status, created_at desc);

drop trigger if exists set_channels_updated_at on public.channels;
create trigger set_channels_updated_at
before update on public.channels
for each row execute function public.set_updated_at();

drop trigger if exists set_songs_updated_at on public.songs;
create trigger set_songs_updated_at
before update on public.songs
for each row execute function public.set_updated_at();

drop trigger if exists set_takedown_requests_updated_at on public.takedown_requests;
create trigger set_takedown_requests_updated_at
before update on public.takedown_requests
for each row execute function public.set_updated_at();

create or replace function public.is_active_admin_or_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and active = true
      and role in ('admin', 'editor')
  );
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and active = true
      and role = 'admin'
  );
$$;

alter table public.channels enable row level security;
alter table public.songs enable row level security;
alter table public.channel_songs enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.takedown_requests enable row level security;

drop policy if exists "Public read active channels" on public.channels;
create policy "Public read active channels"
on public.channels for select
using (active = true);

drop policy if exists "Admins manage channels" on public.channels;
drop policy if exists "Admins read all channels" on public.channels;
drop policy if exists "Admins insert channels" on public.channels;
drop policy if exists "Admins update channels" on public.channels;
drop policy if exists "Only admins delete channels" on public.channels;
create policy "Admins read all channels"
on public.channels for select
using (public.is_active_admin_or_editor());
create policy "Admins insert channels"
on public.channels for insert
with check (public.is_active_admin_or_editor());
create policy "Admins update channels"
on public.channels for update
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());
create policy "Only admins delete channels"
on public.channels for delete
using (public.is_active_admin());

drop policy if exists "Public read active available songs" on public.songs;
create policy "Public read active available songs"
on public.songs for select
using (active = true and embed_status = 'available');

drop policy if exists "Admins manage songs" on public.songs;
drop policy if exists "Admins read all songs" on public.songs;
drop policy if exists "Admins insert songs" on public.songs;
drop policy if exists "Admins update songs" on public.songs;
drop policy if exists "Only admins delete songs" on public.songs;
create policy "Admins read all songs"
on public.songs for select
using (public.is_active_admin_or_editor());
create policy "Admins insert songs"
on public.songs for insert
with check (public.is_active_admin_or_editor());
create policy "Admins update songs"
on public.songs for update
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());
create policy "Only admins delete songs"
on public.songs for delete
using (public.is_active_admin());

drop policy if exists "Public read active channel song assignments" on public.channel_songs;
create policy "Public read active channel song assignments"
on public.channel_songs for select
using (
  active = true
  and exists (select 1 from public.channels c where c.id = channel_id and c.active = true)
  and exists (select 1 from public.songs s where s.id = song_id and s.active = true and s.embed_status = 'available')
);

drop policy if exists "Admins manage channel songs" on public.channel_songs;
drop policy if exists "Admins read all channel songs" on public.channel_songs;
drop policy if exists "Admins insert channel songs" on public.channel_songs;
drop policy if exists "Admins update channel songs" on public.channel_songs;
drop policy if exists "Only admins delete channel songs" on public.channel_songs;
create policy "Admins read all channel songs"
on public.channel_songs for select
using (public.is_active_admin_or_editor());
create policy "Admins insert channel songs"
on public.channel_songs for insert
with check (public.is_active_admin_or_editor());
create policy "Admins update channel songs"
on public.channel_songs for update
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());
create policy "Only admins delete channel songs"
on public.channel_songs for delete
using (public.is_active_admin());

drop policy if exists "Admins can read own profile" on public.admin_profiles;
create policy "Admins can read own profile"
on public.admin_profiles for select
using (id = auth.uid() and active = true);

drop policy if exists "Only admins manage profiles" on public.admin_profiles;
create policy "Only admins manage profiles"
on public.admin_profiles for all
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "Admins manage takedowns" on public.takedown_requests;
drop policy if exists "Admins read takedowns" on public.takedown_requests;
drop policy if exists "Admins update takedowns" on public.takedown_requests;
drop policy if exists "Only admins delete takedowns" on public.takedown_requests;
create policy "Admins read takedowns"
on public.takedown_requests for select
using (public.is_active_admin_or_editor());
create policy "Admins update takedowns"
on public.takedown_requests for update
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());
create policy "Only admins delete takedowns"
on public.takedown_requests for delete
using (public.is_active_admin());

drop policy if exists "Public create takedowns" on public.takedown_requests;
create policy "Public create takedowns"
on public.takedown_requests for insert
with check (
  status = 'new'
  and internal_notes is null
);
