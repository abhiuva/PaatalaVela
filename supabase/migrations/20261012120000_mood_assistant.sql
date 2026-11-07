-- Mood Assistant controlled intelligence and privacy-safe generation metrics.
-- Listener messages are never stored. AI suggestions remain private and pending
-- until an active administrator or editor approves them.

insert into public.content_moods (code, name, display_order) values
  ('happy', 'Happy', 10),
  ('sad', 'Sad', 11),
  ('breakup', 'Breakup', 12)
on conflict (code) do update set name = excluded.name;

insert into public.content_occasions (code, name, display_order) values
  ('rain', 'Rain', 9),
  ('party', 'Party', 10),
  ('work', 'Work', 11),
  ('workout', 'Workout', 12),
  ('sleep', 'Sleep', 13)
on conflict (code) do update set name = excluded.name;

create table if not exists public.content_energy_levels (
  code text primary key check (code in ('low', 'medium', 'high')),
  name text not null unique,
  display_order integer not null check (display_order > 0),
  active boolean not null default true
);

insert into public.content_energy_levels (code, name, display_order) values
  ('low', 'Low', 1), ('medium', 'Medium', 2), ('high', 'High', 3)
on conflict (code) do update set name = excluded.name, display_order = excluded.display_order;

create table if not exists public.content_valences (
  code text primary key check (code in ('negative', 'neutral', 'positive')),
  name text not null unique,
  display_order integer not null check (display_order > 0),
  active boolean not null default true
);

insert into public.content_valences (code, name, display_order) values
  ('negative', 'Negative', 1), ('neutral', 'Neutral', 2), ('positive', 'Positive', 3)
on conflict (code) do update set name = excluded.name, display_order = excluded.display_order;

create table if not exists public.content_regions (
  code text primary key check (code ~ '^[a-z0-9-]+$'),
  name text not null unique,
  display_order integer not null check (display_order > 0),
  active boolean not null default true
);

insert into public.content_regions (code, name, display_order) values
  ('andhra-pradesh', 'Andhra Pradesh', 1),
  ('telangana', 'Telangana', 2),
  ('south-india', 'South India', 3),
  ('north-india', 'North India', 4),
  ('global', 'Global', 5)
on conflict (code) do update set name = excluded.name, display_order = excluded.display_order;

alter table public.songs
  add column if not exists energy_code text references public.content_energy_levels(code),
  add column if not exists valence_code text references public.content_valences(code),
  add column if not exists classification_confidence numeric(4,3),
  add column if not exists classification_source text,
  add column if not exists classification_review_status text not null default 'unclassified';

alter table public.songs drop constraint if exists songs_classification_confidence_check;
alter table public.songs add constraint songs_classification_confidence_check
  check (classification_confidence is null or (classification_confidence >= 0 and classification_confidence <= 1));
alter table public.songs drop constraint if exists songs_classification_source_check;
alter table public.songs add constraint songs_classification_source_check
  check (classification_source is null or classification_source in ('editorial', 'AI-suggested', 'admin-approved'));
alter table public.songs drop constraint if exists songs_classification_review_status_check;
alter table public.songs add constraint songs_classification_review_status_check
  check (classification_review_status in ('unclassified', 'pending', 'approved', 'rejected'));
alter table public.songs drop constraint if exists songs_ai_classification_requires_review_check;
alter table public.songs add constraint songs_ai_classification_requires_review_check
  check (classification_source <> 'AI-suggested' or classification_review_status in ('pending', 'rejected'));

create index if not exists songs_mood_intelligence_idx
  on public.songs (language_code, energy_code, valence_code, era_code, active, embed_status);

create table if not exists public.song_regions (
  song_id uuid not null references public.songs(id) on delete cascade,
  region_code text not null references public.content_regions(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (song_id, region_code)
);
create index if not exists song_regions_region_idx on public.song_regions (region_code, song_id);

create table if not exists public.song_classification_suggestions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  suggested_moods text[] not null default '{}',
  suggested_occasions text[] not null default '{}',
  suggested_energy_code text references public.content_energy_levels(code),
  suggested_valence_code text references public.content_valences(code),
  suggested_regions text[] not null default '{}',
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  source text not null default 'AI-suggested' check (source = 'AI-suggested'),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists song_classification_suggestions_review_idx
  on public.song_classification_suggestions (review_status, confidence, created_at);

create table if not exists public.mood_assistant_generations (
  id uuid primary key,
  session_hash text not null check (char_length(session_hash) = 64),
  normalized_intent jsonb not null default '{}'::jsonb,
  provider_mode text not null check (provider_mode in ('provider', 'fallback')),
  status text not null check (status in ('generated', 'clarification', 'empty', 'failed')),
  result_count integer not null default 0 check (result_count >= 0 and result_count <= 50),
  playlist_duration_seconds integer not null default 0 check (playlist_duration_seconds >= 0),
  total_ms integer not null default 0 check (total_ms >= 0),
  created_at timestamptz not null default now()
);
create index if not exists mood_assistant_generations_created_idx on public.mood_assistant_generations (created_at desc);
create index if not exists mood_assistant_generations_status_idx on public.mood_assistant_generations (status, provider_mode, created_at desc);

alter table public.content_energy_levels enable row level security;
alter table public.content_valences enable row level security;
alter table public.content_regions enable row level security;
alter table public.song_regions enable row level security;
alter table public.song_classification_suggestions enable row level security;
alter table public.mood_assistant_generations enable row level security;

create policy "Public read active energy levels" on public.content_energy_levels for select using (active = true);
create policy "Public read active valences" on public.content_valences for select using (active = true);
create policy "Public read active regions" on public.content_regions for select using (active = true);
create policy "Editors manage energy levels" on public.content_energy_levels for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Editors manage valences" on public.content_valences for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Editors manage regions" on public.content_regions for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Public read approved song regions" on public.song_regions for select using (
  exists (
    select 1 from public.songs song
    where song.id = song_id and song.active = true and song.embed_status = 'available'
      and song.classification_review_status = 'approved'
  )
);
create policy "Editors manage song regions" on public.song_regions for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
create policy "Editors review classification suggestions" on public.song_classification_suggestions for all using (public.is_active_admin_or_editor()) with check (public.is_active_admin_or_editor());
-- mood_assistant_generations intentionally has no anon/authenticated policy.

create or replace function public.get_mood_assistant_candidates(
  p_languages text[] default '{}',
  p_eras text[] default '{}',
  p_singers text[] default '{}',
  p_composers text[] default '{}',
  p_require_duration boolean default false,
  p_limit integer default 300
)
returns table (
  song_id uuid,
  assignment_id uuid,
  channel_id uuid,
  title text,
  film text,
  release_year integer,
  singers text[],
  composer text,
  thumbnail_url text,
  song_story text,
  context text,
  language_code text,
  era_code text,
  moods text[],
  occasions text[],
  energy_code text,
  valence_code text,
  regions text[],
  classification_confidence numeric,
  classification_source text,
  youtube_video_id text,
  duration_seconds integer
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (song.id)
    song.id,
    assignment.id,
    assignment.channel_id,
    song.title,
    song.film,
    song.release_year,
    song.singers,
    song.composer,
    song.thumbnail_url,
    song.song_story,
    song.context,
    song.language_code,
    song.era_code,
    coalesce((select array_agg(sm.mood_code order by sm.mood_code) from public.song_moods sm where sm.song_id = song.id), '{}'),
    coalesce((select array_agg(so.occasion_code order by so.occasion_code) from public.song_occasions so where so.song_id = song.id), '{}'),
    case when song.classification_review_status = 'approved' then song.energy_code else null end,
    case when song.classification_review_status = 'approved' then song.valence_code else null end,
    case when song.classification_review_status = 'approved'
      then coalesce((select array_agg(sr.region_code order by sr.region_code) from public.song_regions sr where sr.song_id = song.id), '{}')
      else '{}'::text[] end,
    case when song.classification_review_status = 'approved' then song.classification_confidence else null end,
    case when song.classification_review_status = 'approved' and song.classification_source in ('editorial', 'admin-approved') then song.classification_source else null end,
    song.youtube_video_id,
    song.duration_seconds
  from public.songs song
  join public.channel_songs assignment on assignment.song_id = song.id and assignment.active = true
  join public.channels channel on channel.id = assignment.channel_id and channel.active = true
  where song.active = true
    and song.embed_status = 'available'
    and song.youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
    and (not p_require_duration or song.duration_seconds > 0)
    and (cardinality(p_languages) = 0 or song.language_code = any(p_languages))
    and (cardinality(p_eras) = 0 or song.era_code = any(p_eras))
    and (cardinality(p_singers) = 0 or exists (
      select 1 from unnest(song.singers) singer, unnest(p_singers) wanted
      where lower(singer) like '%' || lower(wanted) || '%'
    ))
    and (cardinality(p_composers) = 0 or exists (
      select 1 from unnest(p_composers) wanted where lower(song.composer) like '%' || lower(wanted) || '%'
    ))
  order by song.id, assignment.created_at, assignment.id
  limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.get_mood_assistant_candidates(text[], text[], text[], text[], boolean, integer) from public, anon, authenticated;
grant execute on function public.get_mood_assistant_candidates(text[], text[], text[], text[], boolean, integer) to service_role;

alter table public.listening_events drop constraint if exists listening_events_event_name_check;
alter table public.listening_events add constraint listening_events_event_name_check check (event_name in (
  'radio_session_started', 'radio_session_ended', 'radio_paused', 'song_started', 'song_completed', 'song_skipped',
  'player_error', 'channel_changed', 'manual_mode_started', 'returned_to_live', 'scheduled_channel_transitioned',
  'playback_resynchronised', 'fallback_catalogue_used', 'whatsapp_share_clicked', 'youtube_source_clicked',
  'schedule_viewed', 'song_request_started', 'song_request_submitted', 'sponsor_impression', 'sponsor_clicked',
  'takedown_form_opened', 'channel_impression', 'channel_selected', 'listening_duration_recorded', 'shuffle_mode_changed',
  'mood_assistant_opened', 'mood_request_submitted', 'mood_clarification_requested', 'mood_playlist_generated',
  'mood_playlist_started', 'mood_playlist_refined', 'mood_playlist_empty', 'mood_provider_fallback',
  'mood_generation_failed', 'assistant_song_skipped'
));
