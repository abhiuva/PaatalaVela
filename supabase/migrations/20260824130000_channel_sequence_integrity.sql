-- DEV-038/039: reversible sequence repair and collision-safe catalogue writes.

create table if not exists public.channel_sequence_repair_backup (
  repair_id text not null,
  assignment_id uuid not null,
  channel_id uuid not null,
  song_id uuid not null,
  original_sequence integer not null,
  repaired_sequence integer not null,
  assignment_active boolean not null,
  assignment_created_at timestamptz not null,
  backed_up_at timestamptz not null default now(),
  primary key (repair_id, assignment_id)
);

alter table public.channel_sequence_repair_backup enable row level security;
revoke all on public.channel_sequence_repair_backup from public, anon, authenticated;

insert into public.channel_sequence_repair_backup (
  repair_id, assignment_id, channel_id, song_id, original_sequence,
  repaired_sequence, assignment_active, assignment_created_at
)
select
  '20260824130000',
  cs.id,
  cs.channel_id,
  cs.song_id,
  cs.sequence,
  row_number() over (
    partition by cs.channel_id
    order by case when cs.active then 0 else 1 end, cs.sequence, cs.created_at, cs.id
  )::integer,
  cs.active,
  cs.created_at
from public.channel_songs cs
on conflict (repair_id, assignment_id) do nothing;

do $$
declare
  source_count bigint;
  backup_count bigint;
begin
  select count(*) into source_count from public.channel_songs;
  select count(*) into backup_count from public.channel_sequence_repair_backup where repair_id = '20260824130000';
  if source_count <> backup_count then
    raise exception 'channel sequence backup reconciliation failed: source %, backup %', source_count, backup_count;
  end if;
end;
$$;

-- Temporary values avoid collisions while existing duplicates are reindexed.
update public.channel_songs cs
set sequence = 1000000 + backup.repaired_sequence
from public.channel_sequence_repair_backup backup
where backup.repair_id = '20260824130000'
  and backup.assignment_id = cs.id;

update public.channel_songs cs
set sequence = backup.repaired_sequence
from public.channel_sequence_repair_backup backup
where backup.repair_id = '20260824130000'
  and backup.assignment_id = cs.id;

do $$
begin
  if exists (
    select 1 from public.channel_songs
    group by channel_id, sequence having count(*) > 1
  ) then
    raise exception 'channel sequence repair left duplicate values';
  end if;
  if exists (select 1 from public.channel_songs where sequence < 1) then
    raise exception 'channel sequence repair left non-positive values';
  end if;
  if exists (
    select 1
    from (
      select channel_id, count(*) as row_count, min(sequence) as minimum, max(sequence) as maximum,
        count(distinct sequence) as distinct_count
      from public.channel_songs where active group by channel_id
    ) active_rows
    where minimum <> 1 or maximum <> row_count or distinct_count <> row_count
  ) then
    raise exception 'active channel sequence repair is not contiguous';
  end if;
end;
$$;

alter table public.channel_songs
  add constraint channel_songs_sequence_positive check (sequence > 0);
alter table public.channel_songs
  add constraint channel_songs_channel_sequence_key unique (channel_id, sequence);

alter table public.catalogue_admin_events drop constraint if exists catalogue_admin_events_action_check;
alter table public.catalogue_admin_events add constraint catalogue_admin_events_action_check check (action in (
  'channel_unlinked', 'song_soft_deleted', 'assignment_moved', 'sequence_repaired',
  'assignment_added', 'song_imported'
));

insert into public.catalogue_admin_events (action, channel_id, details)
select
  'sequence_repaired',
  channel_id,
  jsonb_build_object(
    'repair_id', '20260824130000',
    'row_count', count(*),
    'changed_count', count(*) filter (where original_sequence <> repaired_sequence)
  )
from public.channel_sequence_repair_backup
where repair_id = '20260824130000'
group by channel_id;

create or replace function public.lock_catalogue_channel(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.channels where id = p_channel_id and active) then
    raise exception using errcode = 'P0002', message = 'channel not found or inactive';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_channel_id::text, 0));
end;
$$;

create or replace function public.shift_channel_sequences_for_insert(
  p_channel_id uuid,
  p_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.channel_songs
  set sequence = sequence + 1000000
  where channel_id = p_channel_id and sequence >= p_position;

  update public.channel_songs
  set sequence = sequence - 999999
  where channel_id = p_channel_id and sequence >= 1000000 + p_position;
end;
$$;

create or replace function public.normalize_channel_sequences(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment record;
  next_position integer := 1;
begin
  perform public.lock_catalogue_channel(p_channel_id);
  update public.channel_songs set sequence = sequence + 2000000 where channel_id = p_channel_id;
  for assignment in
    select id from public.channel_songs
    where channel_id = p_channel_id
    order by case when active then 0 else 1 end, sequence, created_at, id
  loop
    update public.channel_songs set sequence = next_position where id = assignment.id;
    next_position := next_position + 1;
  end loop;
end;
$$;

create or replace function public.set_channel_assignment_atomic(
  p_assignment_id uuid,
  p_position integer,
  p_active boolean,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.channel_songs%rowtype;
  assignment record;
  active_count integer;
  target_position integer;
  next_position integer := 1;
begin
  select * into target from public.channel_songs where id = p_assignment_id;
  if target.id is null then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  perform public.lock_catalogue_channel(target.channel_id);
  update public.channel_songs set active = p_active where id = target.id;
  select count(*) into active_count from public.channel_songs where channel_id = target.channel_id and active;
  target_position := least(greatest(coalesce(p_position, active_count), 1), greatest(active_count, 1));

  update public.channel_songs set sequence = sequence + 3000000 where channel_id = target.channel_id;
  for assignment in
    select id from public.channel_songs
    where channel_id = target.channel_id and active and id <> target.id
    order by sequence, created_at, id
  loop
    if p_active and next_position = target_position then
      update public.channel_songs set sequence = next_position where id = target.id;
      next_position := next_position + 1;
    end if;
    update public.channel_songs set sequence = next_position where id = assignment.id;
    next_position := next_position + 1;
  end loop;
  if p_active and (select sequence from public.channel_songs where id = target.id) >= 3000000 then
    update public.channel_songs set sequence = next_position where id = target.id;
    next_position := next_position + 1;
  end if;
  for assignment in
    select id from public.channel_songs
    where channel_id = target.channel_id and not active
    order by case when id = target.id then 1 else 0 end, sequence, created_at, id
  loop
    update public.channel_songs set sequence = next_position where id = assignment.id;
    next_position := next_position + 1;
  end loop;

  return jsonb_build_object('assignment_id', target.id, 'channel_id', target.channel_id, 'sequence', (select sequence from public.channel_songs where id = target.id), 'active', p_active);
end;
$$;

create or replace function public.assign_song_to_channel_atomic(
  p_channel_id uuid,
  p_song_id uuid,
  p_requested_sequence integer default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_assignment public.channel_songs%rowtype;
  active_count integer;
  target_sequence integer;
  created_assignment public.channel_songs%rowtype;
begin
  perform public.lock_catalogue_channel(p_channel_id);
  if not exists (select 1 from public.songs where id = p_song_id) then
    raise exception using errcode = 'P0002', message = 'song not found';
  end if;

  select * into existing_assignment
  from public.channel_songs
  where channel_id = p_channel_id and song_id = p_song_id
  for update;

  if existing_assignment.id is not null then
    if not existing_assignment.active then
      update public.channel_songs set sequence = sequence + 4000000 where id = existing_assignment.id;
      select count(*) into active_count from public.channel_songs where channel_id = p_channel_id and active;
      target_sequence := least(greatest(coalesce(p_requested_sequence, active_count + 1), 1), active_count + 1);
      perform public.shift_channel_sequences_for_insert(p_channel_id, target_sequence);
      update public.channel_songs set sequence = target_sequence, active = true where id = existing_assignment.id;
      return jsonb_build_object(
        'status', 'reactivated', 'song_id', p_song_id,
        'assignment_id', existing_assignment.id, 'sequence', target_sequence
      );
    end if;
    return jsonb_build_object(
      'status', 'already_assigned', 'song_id', p_song_id,
      'assignment_id', existing_assignment.id, 'sequence', existing_assignment.sequence
    );
  end if;

  select count(*) into active_count
  from public.channel_songs where channel_id = p_channel_id and active;
  target_sequence := least(greatest(coalesce(p_requested_sequence, active_count + 1), 1), active_count + 1);
  perform public.shift_channel_sequences_for_insert(p_channel_id, target_sequence);

  insert into public.channel_songs (channel_id, song_id, sequence, active)
  values (p_channel_id, p_song_id, target_sequence, true)
  returning * into created_assignment;

  insert into public.catalogue_admin_events (action, song_id, channel_id, actor_id, details)
  values ('assignment_added', p_song_id, p_channel_id, p_actor_id,
    jsonb_build_object('assignment_id', created_assignment.id, 'sequence', target_sequence));

  return jsonb_build_object(
    'status', 'assigned', 'song_id', p_song_id,
    'assignment_id', created_assignment.id, 'sequence', target_sequence
  );
end;
$$;

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
  select * into assignment from public.channel_songs where id = p_assignment_id;
  if assignment.id is null then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  perform public.lock_catalogue_channel(assignment.channel_id);
  delete from public.channel_songs where id = assignment.id;
  perform public.normalize_channel_sequences(assignment.channel_id);
  insert into public.catalogue_admin_events (action, song_id, channel_id, actor_id, details)
  values ('channel_unlinked', assignment.song_id, assignment.channel_id, p_actor_id,
    jsonb_build_object('assignment_id', assignment.id, 'sequence', assignment.sequence));
  return jsonb_build_object('song_id', assignment.song_id, 'channel_id', assignment.channel_id);
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
  existing_target public.channel_songs%rowtype;
  old_channel_id uuid;
  result jsonb;
begin
  if p_sequence < 1 then raise exception using errcode = '22023', message = 'invalid sequence'; end if;
  select * into assignment from public.channel_songs where id = p_assignment_id;
  if assignment.id is null then raise exception using errcode = 'P0002', message = 'assignment not found'; end if;
  old_channel_id := assignment.channel_id;
  perform public.lock_catalogue_channel(old_channel_id);
  if p_target_channel_id <> old_channel_id then perform public.lock_catalogue_channel(p_target_channel_id); end if;

  if old_channel_id = p_target_channel_id then
    return public.set_channel_assignment_atomic(assignment.id, p_sequence, true, p_actor_id);
  end if;
  select * into existing_target from public.channel_songs
  where channel_id = p_target_channel_id and song_id = assignment.song_id;
  if existing_target.id is not null then
    delete from public.channel_songs where id = assignment.id;
    perform public.normalize_channel_sequences(old_channel_id);
    result := public.set_channel_assignment_atomic(existing_target.id, p_sequence, true, p_actor_id);
  else
    update public.channel_songs set sequence = sequence + 5000000 where id = assignment.id;
    update public.channel_songs set channel_id = p_target_channel_id where id = assignment.id;
    result := public.set_channel_assignment_atomic(assignment.id, p_sequence, true, p_actor_id);
    perform public.normalize_channel_sequences(old_channel_id);
  end if;
  insert into public.catalogue_admin_events (action, song_id, channel_id, actor_id, details)
  values ('assignment_moved', assignment.song_id, p_target_channel_id, p_actor_id,
    jsonb_build_object('from_channel_id', old_channel_id, 'assignment_id', assignment.id));
  return result || jsonb_build_object('song_id', assignment.song_id, 'channel_id', p_target_channel_id);
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
  channel_row record;
begin
  if p_confirmation <> 'DELETE' then raise exception using errcode = '22023', message = 'confirmation required'; end if;
  select title into song_title from public.songs where id = p_song_id for update;
  if song_title is null then raise exception using errcode = 'P0002', message = 'song not found'; end if;
  update public.channel_songs set active = false where song_id = p_song_id and active;
  get diagnostics affected_channels = row_count;
  update public.songs set active = false where id = p_song_id;
  for channel_row in select distinct channel_id from public.channel_songs where song_id = p_song_id loop
    perform public.normalize_channel_sequences(channel_row.channel_id);
  end loop;
  insert into public.catalogue_admin_events (action, song_id, actor_id, details)
  values ('song_soft_deleted', p_song_id, p_actor_id,
    jsonb_build_object('title', song_title, 'deactivated_assignments', affected_channels));
  return jsonb_build_object('song_id', p_song_id, 'deactivated_assignments', affected_channels);
end;
$$;

create or replace function public.import_song_with_assignment_atomic(
  p_channel_id uuid,
  p_song jsonb,
  p_requested_sequence integer default null,
  p_mood_codes text[] default '{}'::text[],
  p_occasion_codes text[] default '{}'::text[],
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_song_id uuid;
  created_song_id uuid;
  assignment_result jsonb;
  singer_values text[];
begin
  if nullif(trim(p_song->>'youtube_video_id'), '') is null then
    raise exception using errcode = '22023', message = 'youtube video id is required';
  end if;

  -- Serialize same-video imports across different channels before resolving the
  -- globally unique songs.youtube_video_id record. Sequence allocation remains
  -- serialized independently by assign_song_to_channel_atomic.
  perform pg_advisory_xact_lock(hashtextextended('youtube:' || (p_song->>'youtube_video_id'), 0));

  select id into existing_song_id
  from public.songs
  where youtube_video_id = p_song->>'youtube_video_id'
  for update;

  if existing_song_id is not null then
    assignment_result := public.assign_song_to_channel_atomic(
      p_channel_id, existing_song_id, p_requested_sequence, p_actor_id
    );
    return assignment_result || jsonb_build_object(
      'status', case when assignment_result->>'status' = 'already_assigned' then 'already_assigned' else 'assigned_existing' end
    );
  end if;

  select coalesce(array_agg(value), '{}'::text[]) into singer_values
  from jsonb_array_elements_text(coalesce(p_song->'singers', '[]'::jsonb));
  if cardinality(singer_values) = 0 then
    raise exception using errcode = '22023', message = 'at least one singer is required';
  end if;

  insert into public.songs (
    title, telugu_title, film, release_year, singers, composer, lyricist,
    youtube_video_id, youtube_url, duration_seconds, spotify_url, youtube_music_url,
    editorial_note, editorial_note_telugu, language_code, era_code, song_story,
    context, thumbnail_url, embed_status, active
  ) values (
    trim(p_song->>'title'), nullif(trim(p_song->>'telugu_title'), ''), trim(p_song->>'film'),
    (p_song->>'release_year')::integer, singer_values, trim(p_song->>'composer'),
    nullif(trim(p_song->>'lyricist'), ''), p_song->>'youtube_video_id', p_song->>'youtube_url',
    nullif(p_song->>'duration_seconds', '')::integer, nullif(trim(p_song->>'spotify_url'), ''),
    nullif(trim(p_song->>'youtube_music_url'), ''), nullif(trim(p_song->>'editorial_note'), ''),
    nullif(trim(p_song->>'editorial_note_telugu'), ''), p_song->>'language_code', p_song->>'era_code',
    nullif(trim(p_song->>'song_story'), ''), nullif(trim(p_song->>'context'), ''),
    nullif(trim(p_song->>'thumbnail_url'), ''), (p_song->>'embed_status')::public.embed_status, true
  ) returning id into created_song_id;

  insert into public.song_moods (song_id, mood_code)
  select created_song_id, unnest(p_mood_codes);
  insert into public.song_occasions (song_id, occasion_code)
  select created_song_id, unnest(p_occasion_codes);

  assignment_result := public.assign_song_to_channel_atomic(
    p_channel_id, created_song_id, p_requested_sequence, p_actor_id
  );

  insert into public.catalogue_admin_events (action, song_id, channel_id, actor_id, details)
  values ('song_imported', created_song_id, p_channel_id, p_actor_id,
    jsonb_build_object(
      'assignment_id', assignment_result->>'assignment_id',
      'sequence', (assignment_result->>'sequence')::integer,
      'youtube_video_id', p_song->>'youtube_video_id'
    ));

  return assignment_result || jsonb_build_object('status', 'imported', 'song_id', created_song_id);
end;
$$;

-- Reorder is channel-scoped, two-stage, contiguous, and callable only through the service role.
create or replace function public.reorder_channel_assignments(
  p_channel_id uuid,
  p_assignment_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
begin
  perform public.lock_catalogue_channel(p_channel_id);
  select count(*) into active_count from public.channel_songs where channel_id = p_channel_id and active;
  if cardinality(p_assignment_ids) <> active_count or exists (
    select 1 from unnest(p_assignment_ids) requested(id)
    left join public.channel_songs cs on cs.id = requested.id and cs.channel_id = p_channel_id and cs.active
    where cs.id is null
  ) then
    raise exception using errcode = '22023', message = 'invalid assignment order';
  end if;

  update public.channel_songs cs
  set sequence = 1000000 + requested.position
  from unnest(p_assignment_ids) with ordinality requested(id, position)
  where cs.id = requested.id and cs.channel_id = p_channel_id;

  update public.channel_songs cs
  set sequence = requested.position
  from unnest(p_assignment_ids) with ordinality requested(id, position)
  where cs.id = requested.id and cs.channel_id = p_channel_id;
end;
$$;

revoke all on function public.lock_catalogue_channel(uuid) from public, anon, authenticated;
revoke all on function public.shift_channel_sequences_for_insert(uuid, integer) from public, anon, authenticated;
revoke all on function public.normalize_channel_sequences(uuid) from public, anon, authenticated;
revoke all on function public.set_channel_assignment_atomic(uuid, integer, boolean, uuid) from public, anon, authenticated;
revoke all on function public.assign_song_to_channel_atomic(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.import_song_with_assignment_atomic(uuid, jsonb, integer, text[], text[], uuid) from public, anon, authenticated;
revoke all on function public.reorder_channel_assignments(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.unlink_channel_song(uuid, uuid) from public, anon, authenticated;
revoke all on function public.move_channel_song(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.soft_delete_catalogue_song(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_song_to_channel_atomic(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.import_song_with_assignment_atomic(uuid, jsonb, integer, text[], text[], uuid) to service_role;
grant execute on function public.reorder_channel_assignments(uuid, uuid[]) to service_role;
grant execute on function public.set_channel_assignment_atomic(uuid, integer, boolean, uuid) to service_role;
grant execute on function public.unlink_channel_song(uuid, uuid) to service_role;
grant execute on function public.move_channel_song(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.soft_delete_catalogue_song(uuid, uuid, text) to service_role;
