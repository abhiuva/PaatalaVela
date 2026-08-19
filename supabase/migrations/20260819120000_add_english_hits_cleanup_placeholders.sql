alter table public.channels
add column if not exists scheduled boolean not null default true;

comment on column public.channels.scheduled is
'True for automatic Asia/Kolkata schedule channels; false for manually selected add-on channels.';

update public.channels
set scheduled = true
where slug in (
  'suprabhata-melodies',
  'tea-shop-classics',
  'ilaiyaraaja-era',
  'prema-viraham',
  'mass-beat-centre',
  'highway-ratri'
);

insert into public.channels (
  id,
  slug,
  name,
  telugu_name,
  positioning,
  start_hour,
  end_hour,
  background_image_url,
  primary_color,
  secondary_color,
  accent_color,
  display_order,
  scheduled,
  active
) values (
  '6f3fc628-a517-4dc5-a479-334d6bce7558',
  'english-hits',
  'English Hits',
  'English Hits',
  'Global pop, rock and timeless English-language favourites.',
  0,
  0,
  null,
  '#132f2e',
  '#704f38',
  '#73e0c1',
  7,
  false,
  true
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
  active = excluded.active;

create temporary table if not exists dummy_song_cleanup_candidates (
  song_id uuid primary key
) on commit drop;

truncate table dummy_song_cleanup_candidates;

insert into dummy_song_cleanup_candidates (song_id)
select id
from public.songs
where youtube_video_id in (
  'dQw4w9WgXcQ', 'M7lc1UVf-VE', 'ScMzIvxBSi4', 'ysz5S6PUM-U', 'aqz-KE-bpKQ',
  'tc000000001', 'tc000000002', 'tc000000003', 'tc000000004', 'tc000000005',
  'ir000000001', 'ir000000002', 'ir000000003', 'ir000000004', 'ir000000005',
  'pv000000001', 'pv000000002', 'pv000000003', 'pv000000004', 'pv000000005',
  'mb000000001', 'mb000000002', 'mb000000003', 'mb000000004', 'mb000000005',
  'hr000000001', 'hr000000002', 'hr000000003', 'hr000000004', 'hr000000005'
)
and title ilike '%Placeholder%'
and film = 'Replace With Film'
and composer = 'Replace Composer'
and singers = array['Replace Singer']::text[]
and embed_status = 'unchecked';

delete from public.channel_songs assignment
using dummy_song_cleanup_candidates candidate
where assignment.song_id = candidate.song_id;

update public.songs song
set active = false
from dummy_song_cleanup_candidates candidate
where song.id = candidate.song_id
and (
  exists (select 1 from public.listening_events event where event.song_id = song.id)
  or exists (select 1 from public.feedback_submissions feedback where feedback.song_id = song.id)
  or exists (select 1 from public.takedown_requests request where request.song_id = song.id)
  or exists (select 1 from public.active_listener_sessions presence where presence.song_id = song.id)
  or exists (
    select 1
    from public.youtube_import_queue queue
    where queue.duplicate_song_id = song.id or queue.imported_song_id = song.id
  )
);

delete from public.songs song
using dummy_song_cleanup_candidates candidate
where song.id = candidate.song_id
and not exists (select 1 from public.listening_events event where event.song_id = song.id)
and not exists (select 1 from public.feedback_submissions feedback where feedback.song_id = song.id)
and not exists (select 1 from public.takedown_requests request where request.song_id = song.id)
and not exists (select 1 from public.active_listener_sessions presence where presence.song_id = song.id)
and not exists (
  select 1
  from public.youtube_import_queue queue
  where queue.duplicate_song_id = song.id or queue.imported_song_id = song.id
);

do $$
begin
  if not exists (
    select 1
    from public.channels
    where id = '6f3fc628-a517-4dc5-a479-334d6bce7558'
      and slug = 'english-hits'
      and display_order = 7
      and scheduled = false
      and active = true
  ) then
    raise exception 'English Hits channel verification failed';
  end if;
end;
$$;
