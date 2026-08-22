-- Phase 1 content platform, on-demand channels, and catalogue administration.
-- Rollback order is documented in docs/CONTENT_TAXONOMY.md. Existing song
-- metadata is preserved; all new song columns can be dropped after join tables.

alter table public.listening_events drop constraint if exists listening_events_event_name_check;
alter table public.listening_events add constraint listening_events_event_name_check check (event_name in (
  'radio_session_started', 'radio_session_ended', 'radio_paused', 'song_started', 'song_completed', 'song_skipped',
  'player_error', 'channel_changed', 'manual_mode_started', 'returned_to_live', 'scheduled_channel_transitioned',
  'playback_resynchronised', 'fallback_catalogue_used', 'whatsapp_share_clicked', 'youtube_source_clicked',
  'schedule_viewed', 'song_request_started', 'song_request_submitted', 'sponsor_impression', 'sponsor_clicked',
  'takedown_form_opened', 'channel_impression', 'channel_selected', 'listening_duration_recorded'
));

create or replace function public.daily_tuned_listener_count(p_date date)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct anonymous_session_id)
  from public.listening_events
  where event_name = 'radio_session_started'
    and event_date_ist = p_date
    and is_test = false;
$$;
revoke all on function public.daily_tuned_listener_count(date) from public, anon, authenticated;
grant execute on function public.daily_tuned_listener_count(date) to service_role;

create table if not exists public.content_languages (
  code text primary key check (code ~ '^[a-z]{2,3}$'),
  name text not null unique,
  native_name text not null,
  display_order integer not null check (display_order > 0),
  active boolean not null default true
);

create table if not exists public.content_eras (
  code text primary key check (code ~ '^(pre-1980|[0-9]{4}s)$'),
  name text not null unique,
  start_year integer,
  end_year integer,
  display_order integer not null check (display_order > 0),
  active boolean not null default true,
  check (start_year is null or end_year is null or start_year <= end_year)
);

create table if not exists public.content_moods (
  code text primary key check (code ~ '^[a-z0-9-]+$'),
  name text not null unique,
  display_order integer not null check (display_order > 0),
  active boolean not null default true
);

create table if not exists public.content_occasions (
  code text primary key check (code ~ '^[a-z0-9-]+$'),
  name text not null unique,
  display_order integer not null check (display_order > 0),
  active boolean not null default true
);

insert into public.content_languages (code, name, native_name, display_order) values
  ('te', 'Telugu', 'తెలుగు', 1),
  ('en', 'English', 'English', 2),
  ('hi', 'Hindi', 'हिन्दी', 3),
  ('ta', 'Tamil', 'தமிழ்', 4),
  ('ml', 'Malayalam', 'മലയാളം', 5)
on conflict (code) do update set
  name = excluded.name,
  native_name = excluded.native_name,
  display_order = excluded.display_order;

insert into public.content_eras (code, name, start_year, end_year, display_order) values
  ('pre-1980', 'Before 1980', null, 1979, 1),
  ('1980s', '1980s', 1980, 1989, 2),
  ('1990s', '1990s', 1990, 1999, 3),
  ('2000s', '2000s', 2000, 2009, 4),
  ('2010s', '2010s', 2010, 2019, 5),
  ('2020s', '2020s', 2020, 2029, 6)
on conflict (code) do update set
  name = excluded.name,
  start_year = excluded.start_year,
  end_year = excluded.end_year,
  display_order = excluded.display_order;

insert into public.content_moods (code, name, display_order) values
  ('devotional', 'Devotional', 1),
  ('peaceful', 'Peaceful', 2),
  ('nostalgic', 'Nostalgic', 3),
  ('uplifting', 'Uplifting', 4),
  ('romantic', 'Romantic', 5),
  ('melancholic', 'Melancholic', 6),
  ('energetic', 'Energetic', 7),
  ('celebratory', 'Celebratory', 8),
  ('reflective', 'Reflective', 9)
on conflict (code) do update set name = excluded.name, display_order = excluded.display_order;

insert into public.content_occasions (code, name, display_order) values
  ('morning', 'Morning', 1),
  ('prayer', 'Prayer', 2),
  ('tea-time', 'Tea time', 3),
  ('afternoon', 'Afternoon', 4),
  ('evening', 'Evening', 5),
  ('celebration', 'Celebration', 6),
  ('driving', 'Driving', 7),
  ('late-night', 'Late night', 8)
on conflict (code) do update set name = excluded.name, display_order = excluded.display_order;

alter table public.songs
  add column if not exists language_code text references public.content_languages(code),
  add column if not exists era_code text references public.content_eras(code),
  add column if not exists song_story text,
  add column if not exists context text;

alter table public.songs drop constraint if exists songs_song_story_length_check;
alter table public.songs add constraint songs_song_story_length_check
  check (song_story is null or char_length(song_story) <= 320);
alter table public.songs drop constraint if exists songs_context_length_check;
alter table public.songs add constraint songs_context_length_check
  check (context is null or char_length(context) <= 240);

update public.songs song
set language_code = case
  when exists (
    select 1 from public.channel_songs assignment
    join public.channels channel on channel.id = assignment.channel_id
    where assignment.song_id = song.id and channel.slug = 'english-hits'
  ) then 'en'
  else 'te'
end
where language_code is null;

update public.songs
set era_code = case
  when release_year < 1980 then 'pre-1980'
  when release_year < 1990 then '1980s'
  when release_year < 2000 then '1990s'
  when release_year < 2010 then '2000s'
  when release_year < 2020 then '2010s'
  else '2020s'
end
where era_code is null;

alter table public.songs alter column language_code set not null;
alter table public.songs alter column era_code set not null;

create index if not exists songs_language_active_idx on public.songs (language_code, active, embed_status);
create index if not exists songs_era_active_idx on public.songs (era_code, active, embed_status);

create table if not exists public.song_moods (
  song_id uuid not null references public.songs(id) on delete cascade,
  mood_code text not null references public.content_moods(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (song_id, mood_code)
);

create table if not exists public.song_occasions (
  song_id uuid not null references public.songs(id) on delete cascade,
  occasion_code text not null references public.content_occasions(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (song_id, occasion_code)
);

create index if not exists song_moods_mood_idx on public.song_moods (mood_code, song_id);
create index if not exists song_occasions_occasion_idx on public.song_occasions (occasion_code, song_id);

with channel_moods(channel_slug, mood_code) as (values
  ('suprabhata-melodies', 'devotional'), ('suprabhata-melodies', 'peaceful'),
  ('tea-shop-classics', 'nostalgic'), ('tea-shop-classics', 'uplifting'),
  ('ilaiyaraaja-era', 'nostalgic'), ('ilaiyaraaja-era', 'reflective'),
  ('prema-viraham', 'romantic'), ('prema-viraham', 'melancholic'),
  ('mass-beat-centre', 'energetic'), ('mass-beat-centre', 'celebratory'),
  ('highway-ratri', 'reflective'), ('highway-ratri', 'energetic')
)
insert into public.song_moods (song_id, mood_code)
select distinct assignment.song_id, mapping.mood_code
from public.channel_songs assignment
join public.channels channel on channel.id = assignment.channel_id
join channel_moods mapping on mapping.channel_slug = channel.slug
where assignment.active = true
on conflict (song_id, mood_code) do nothing;

with channel_occasions(channel_slug, occasion_code) as (values
  ('suprabhata-melodies', 'morning'), ('suprabhata-melodies', 'prayer'),
  ('tea-shop-classics', 'tea-time'), ('tea-shop-classics', 'morning'),
  ('ilaiyaraaja-era', 'afternoon'),
  ('prema-viraham', 'evening'),
  ('mass-beat-centre', 'celebration'),
  ('highway-ratri', 'driving'), ('highway-ratri', 'late-night')
)
insert into public.song_occasions (song_id, occasion_code)
select distinct assignment.song_id, mapping.occasion_code
from public.channel_songs assignment
join public.channels channel on channel.id = assignment.channel_id
join channel_occasions mapping on mapping.channel_slug = channel.slug
where assignment.active = true
on conflict (song_id, occasion_code) do nothing;

alter table public.channels
  add column if not exists channel_mode text not null default 'scheduled',
  add column if not exists primary_language_code text references public.content_languages(code);

alter table public.channels drop constraint if exists channels_channel_mode_check;
alter table public.channels add constraint channels_channel_mode_check
  check (channel_mode in ('scheduled', 'on_demand'));

update public.channels
set channel_mode = 'scheduled', scheduled = true, primary_language_code = 'te'
where slug in (
  'suprabhata-melodies', 'tea-shop-classics', 'ilaiyaraaja-era',
  'prema-viraham', 'mass-beat-centre', 'highway-ratri'
);

update public.channels
set channel_mode = 'on_demand', scheduled = false, primary_language_code = 'en'
where slug = 'english-hits';

insert into public.channels (
  id, slug, name, telugu_name, positioning, start_hour, end_hour,
  background_image_url, primary_color, secondary_color, accent_color,
  display_order, scheduled, channel_mode, primary_language_code, active
) values (
  '82f73275-0c49-4fc9-991d-61d9d6e3c492',
  'hindi-hits',
  'Hindi Hits',
  'हिन्दी हिट्स',
  'Verified Hindi favourites, available whenever you want to listen.',
  0, 0, null, '#3f243d', '#176b68', '#f3c969', 8, false, 'on_demand', 'hi', true
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  telugu_name = excluded.telugu_name,
  positioning = excluded.positioning,
  start_hour = excluded.start_hour,
  end_hour = excluded.end_hour,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  display_order = excluded.display_order,
  scheduled = excluded.scheduled,
  channel_mode = excluded.channel_mode,
  primary_language_code = excluded.primary_language_code,
  active = excluded.active;

create index if not exists channels_mode_language_idx
on public.channels (channel_mode, primary_language_code, active, display_order);

create table if not exists public.catalogue_admin_events (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('channel_unlinked', 'song_soft_deleted', 'assignment_moved')),
  song_id uuid references public.songs(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists catalogue_admin_events_created_idx
on public.catalogue_admin_events (created_at desc);
create index if not exists catalogue_admin_events_song_idx
on public.catalogue_admin_events (song_id, created_at desc);

create or replace function public.unlink_channel_song(
  p_assignment_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment public.channel_songs%rowtype;
begin
  select * into assignment from public.channel_songs where id = p_assignment_id for update;
  if assignment.id is null then
    raise exception 'assignment not found';
  end if;

  delete from public.channel_songs where id = assignment.id;
  insert into public.catalogue_admin_events (action, song_id, channel_id, actor_id, details)
  values ('channel_unlinked', assignment.song_id, assignment.channel_id, p_actor_id,
    jsonb_build_object('assignment_id', assignment.id, 'sequence', assignment.sequence));

  return jsonb_build_object('song_id', assignment.song_id, 'channel_id', assignment.channel_id);
end;
$$;

create or replace function public.soft_delete_catalogue_song(
  p_song_id uuid,
  p_actor_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  song_title text;
  affected_channels integer;
begin
  if p_confirmation <> 'DELETE' then
    raise exception 'confirmation required';
  end if;

  select title into song_title from public.songs where id = p_song_id for update;
  if song_title is null then
    raise exception 'song not found';
  end if;

  update public.channel_songs set active = false where song_id = p_song_id and active = true;
  get diagnostics affected_channels = row_count;
  update public.songs set active = false where id = p_song_id;

  insert into public.catalogue_admin_events (action, song_id, actor_id, details)
  values ('song_soft_deleted', p_song_id, p_actor_id,
    jsonb_build_object('title', song_title, 'deactivated_assignments', affected_channels));

  return jsonb_build_object('song_id', p_song_id, 'deactivated_assignments', affected_channels);
end;
$$;

create or replace function public.move_channel_song(
  p_assignment_id uuid,
  p_target_channel_id uuid,
  p_sequence integer,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment public.channel_songs%rowtype;
begin
  if p_sequence < 1 then raise exception 'invalid sequence'; end if;
  select * into assignment from public.channel_songs where id = p_assignment_id for update;
  if assignment.id is null then raise exception 'assignment not found'; end if;
  if assignment.channel_id = p_target_channel_id then
    update public.channel_songs set sequence = p_sequence, active = true where id = assignment.id;
    return jsonb_build_object('song_id', assignment.song_id, 'channel_id', assignment.channel_id, 'unchanged', true);
  end if;

  insert into public.channel_songs (channel_id, song_id, sequence, active)
  values (p_target_channel_id, assignment.song_id, p_sequence, true)
  on conflict (channel_id, song_id) do update set sequence = excluded.sequence, active = true;
  delete from public.channel_songs where id = assignment.id;

  insert into public.catalogue_admin_events (action, song_id, channel_id, actor_id, details)
  values ('assignment_moved', assignment.song_id, p_target_channel_id, p_actor_id,
    jsonb_build_object('from_channel_id', assignment.channel_id, 'assignment_id', assignment.id));

  return jsonb_build_object('song_id', assignment.song_id, 'channel_id', p_target_channel_id);
end;
$$;

create or replace function public.enforce_channel_language_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  required_language text;
  song_language text;
  song_status public.embed_status;
  song_active boolean;
begin
  select primary_language_code into required_language from public.channels where id = new.channel_id;
  select language_code, embed_status, active into song_language, song_status, song_active
  from public.songs where id = new.song_id;

  if required_language is not null and song_language <> required_language then
    raise exception 'song language does not match channel language';
  end if;
  if required_language = 'hi' and (song_status <> 'available' or song_active is not true) then
    raise exception 'Hindi Hits accepts only active verified songs';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_channel_language_assignment on public.channel_songs;
create trigger enforce_channel_language_assignment
before insert or update of channel_id, song_id, active on public.channel_songs
for each row when (new.active = true)
execute function public.enforce_channel_language_assignment();

create or replace function public.enforce_song_language_assignments()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.channel_songs assignment
    join public.channels channel on channel.id = assignment.channel_id
    where assignment.song_id = new.id
      and assignment.active = true
      and channel.primary_language_code is not null
      and channel.primary_language_code <> new.language_code
  ) then
    raise exception 'song language does not match an active channel assignment';
  end if;
  if exists (
    select 1
    from public.channel_songs assignment
    join public.channels channel on channel.id = assignment.channel_id
    where assignment.song_id = new.id
      and assignment.active = true
      and channel.primary_language_code = 'hi'
  ) and (new.embed_status <> 'available' or new.active is not true) then
    raise exception 'Hindi Hits accepts only active verified songs';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_song_language_assignments on public.songs;
create trigger enforce_song_language_assignments
before update of language_code, embed_status, active on public.songs
for each row execute function public.enforce_song_language_assignments();

alter table public.content_languages enable row level security;
alter table public.content_eras enable row level security;
alter table public.content_moods enable row level security;
alter table public.content_occasions enable row level security;
alter table public.song_moods enable row level security;
alter table public.song_occasions enable row level security;
alter table public.catalogue_admin_events enable row level security;

create policy "Public read active languages" on public.content_languages for select using (active = true);
create policy "Public read active eras" on public.content_eras for select using (active = true);
create policy "Public read active moods" on public.content_moods for select using (active = true);
create policy "Public read active occasions" on public.content_occasions for select using (active = true);
create policy "Editors manage languages" on public.content_languages for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Editors manage eras" on public.content_eras for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Editors manage moods" on public.content_moods for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Editors manage occasions" on public.content_occasions for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Public read active song moods" on public.song_moods for select using (
  exists (select 1 from public.songs song where song.id = song_id and song.active = true and song.embed_status = 'available')
);
create policy "Public read active song occasions" on public.song_occasions for select using (
  exists (select 1 from public.songs song where song.id = song_id and song.active = true and song.embed_status = 'available')
);
create policy "Editors manage song moods" on public.song_moods for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Editors manage song occasions" on public.song_occasions for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Admins read catalogue audit" on public.catalogue_admin_events for select using (public.is_active_admin());

revoke all on function public.unlink_channel_song(uuid, uuid) from public, anon, authenticated;
revoke all on function public.soft_delete_catalogue_song(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.move_channel_song(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.unlink_channel_song(uuid, uuid) to service_role;
grant execute on function public.soft_delete_catalogue_song(uuid, uuid, text) to service_role;
grant execute on function public.move_channel_song(uuid, uuid, integer, uuid) to service_role;
