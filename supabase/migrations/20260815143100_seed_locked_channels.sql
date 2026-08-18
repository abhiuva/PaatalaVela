insert into public.channels (
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
  active
) values
  ('suprabhata-melodies', 'Suprabhata Melodies', 'సుప్రభాత మాధుర్యాలు', 'Temple bells, soft strings and sunrise voices.', 5, 9, null, '#5d2f0d', '#c67122', '#ffd166', 1, true),
  ('tea-shop-classics', 'Tea Shop Classics', 'టీ షాప్ క్లాసిక్స్', 'Brass tumblers, roadside chatter and evergreen hooks.', 9, 13, null, '#243b2f', '#8d5b2f', '#7bd389', 2, true),
  ('ilaiyaraaja-era', 'Ilaiyaraaja Era', 'ఇళయరాజా యుగం', 'Analog warmth, village winds and orchestral pulse.', 13, 17, null, '#143d4c', '#3d6d68', '#f4d35e', 3, true),
  ('prema-viraham', 'Prema & Viraham', 'ప్రేమ & విరహం', 'Evening rain, letters, longing and luminous refrains.', 17, 21, null, '#251f47', '#6e315f', '#f7a8b8', 4, true),
  ('mass-beat-centre', 'Mass Beat Centre', 'మాస్ బీట్ సెంటర్', 'Festival lights, dappu hits and theatre-first energy.', 21, 23, null, '#1d1b1b', '#a02c2c', '#ff4d4d', 5, true),
  ('highway-ratri', 'Highway Ratri', 'హైవే రాత్రి', 'Late-night roads, sodium lamps and steady cruising songs.', 23, 5, null, '#050712', '#12324a', '#8be9fd', 6, true)
on conflict (slug) do update set
  name = excluded.name,
  telugu_name = excluded.telugu_name,
  positioning = excluded.positioning,
  start_hour = excluded.start_hour,
  end_hour = excluded.end_hour,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  display_order = excluded.display_order,
  active = excluded.active;

with sample_songs as (
  select *
  from (values
    ('sm-1', 'Suprabhata Placeholder 1', 'Replace With Film', 1990, array['Replace Singer'], 'Replace Composer', 'dQw4w9WgXcQ', 213, 'suprabhata-melodies', 10),
    ('sm-2', 'Suprabhata Placeholder 2', 'Replace With Film', 1991, array['Replace Singer'], 'Replace Composer', 'M7lc1UVf-VE', 186, 'suprabhata-melodies', 20),
    ('sm-3', 'Suprabhata Placeholder 3', 'Replace With Film', 1992, array['Replace Singer'], 'Replace Composer', 'ScMzIvxBSi4', 242, 'suprabhata-melodies', 30),
    ('sm-4', 'Suprabhata Placeholder 4', 'Replace With Film', 1993, array['Replace Singer'], 'Replace Composer', 'ysz5S6PUM-U', 205, 'suprabhata-melodies', 40),
    ('sm-5', 'Suprabhata Placeholder 5', 'Replace With Film', 1994, array['Replace Singer'], 'Replace Composer', 'aqz-KE-bpKQ', 231, 'suprabhata-melodies', 50),
    ('tc-1', 'Tea Shop Placeholder 1', 'Replace With Film', 1978, array['Replace Singer'], 'Replace Composer', 'tc000000001', 213, 'tea-shop-classics', 10),
    ('tc-2', 'Tea Shop Placeholder 2', 'Replace With Film', 1980, array['Replace Singer'], 'Replace Composer', 'tc000000002', 186, 'tea-shop-classics', 20),
    ('tc-3', 'Tea Shop Placeholder 3', 'Replace With Film', 1982, array['Replace Singer'], 'Replace Composer', 'tc000000003', 242, 'tea-shop-classics', 30),
    ('tc-4', 'Tea Shop Placeholder 4', 'Replace With Film', 1984, array['Replace Singer'], 'Replace Composer', 'tc000000004', 205, 'tea-shop-classics', 40),
    ('tc-5', 'Tea Shop Placeholder 5', 'Replace With Film', 1986, array['Replace Singer'], 'Replace Composer', 'tc000000005', 231, 'tea-shop-classics', 50),
    ('ir-1', 'Ilaiyaraaja Era Placeholder 1', 'Replace With Film', 1983, array['Replace Singer'], 'Replace Composer', 'ir000000001', 213, 'ilaiyaraaja-era', 10),
    ('ir-2', 'Ilaiyaraaja Era Placeholder 2', 'Replace With Film', 1985, array['Replace Singer'], 'Replace Composer', 'ir000000002', 186, 'ilaiyaraaja-era', 20),
    ('ir-3', 'Ilaiyaraaja Era Placeholder 3', 'Replace With Film', 1987, array['Replace Singer'], 'Replace Composer', 'ir000000003', 242, 'ilaiyaraaja-era', 30),
    ('ir-4', 'Ilaiyaraaja Era Placeholder 4', 'Replace With Film', 1989, array['Replace Singer'], 'Replace Composer', 'ir000000004', 205, 'ilaiyaraaja-era', 40),
    ('ir-5', 'Ilaiyaraaja Era Placeholder 5', 'Replace With Film', 1991, array['Replace Singer'], 'Replace Composer', 'ir000000005', 231, 'ilaiyaraaja-era', 50),
    ('pv-1', 'Prema Viraham Placeholder 1', 'Replace With Film', 1998, array['Replace Singer'], 'Replace Composer', 'pv000000001', 213, 'prema-viraham', 10),
    ('pv-2', 'Prema Viraham Placeholder 2', 'Replace With Film', 2000, array['Replace Singer'], 'Replace Composer', 'pv000000002', 186, 'prema-viraham', 20),
    ('pv-3', 'Prema Viraham Placeholder 3', 'Replace With Film', 2002, array['Replace Singer'], 'Replace Composer', 'pv000000003', 242, 'prema-viraham', 30),
    ('pv-4', 'Prema Viraham Placeholder 4', 'Replace With Film', 2004, array['Replace Singer'], 'Replace Composer', 'pv000000004', 205, 'prema-viraham', 40),
    ('pv-5', 'Prema Viraham Placeholder 5', 'Replace With Film', 2006, array['Replace Singer'], 'Replace Composer', 'pv000000005', 231, 'prema-viraham', 50),
    ('mb-1', 'Mass Beat Placeholder 1', 'Replace With Film', 2009, array['Replace Singer'], 'Replace Composer', 'mb000000001', 213, 'mass-beat-centre', 10),
    ('mb-2', 'Mass Beat Placeholder 2', 'Replace With Film', 2011, array['Replace Singer'], 'Replace Composer', 'mb000000002', 186, 'mass-beat-centre', 20),
    ('mb-3', 'Mass Beat Placeholder 3', 'Replace With Film', 2013, array['Replace Singer'], 'Replace Composer', 'mb000000003', 242, 'mass-beat-centre', 30),
    ('mb-4', 'Mass Beat Placeholder 4', 'Replace With Film', 2015, array['Replace Singer'], 'Replace Composer', 'mb000000004', 205, 'mass-beat-centre', 40),
    ('mb-5', 'Mass Beat Placeholder 5', 'Replace With Film', 2017, array['Replace Singer'], 'Replace Composer', 'mb000000005', 231, 'mass-beat-centre', 50),
    ('hr-1', 'Highway Ratri Placeholder 1', 'Replace With Film', 1996, array['Replace Singer'], 'Replace Composer', 'hr000000001', 213, 'highway-ratri', 10),
    ('hr-2', 'Highway Ratri Placeholder 2', 'Replace With Film', 1999, array['Replace Singer'], 'Replace Composer', 'hr000000002', 186, 'highway-ratri', 20),
    ('hr-3', 'Highway Ratri Placeholder 3', 'Replace With Film', 2003, array['Replace Singer'], 'Replace Composer', 'hr000000003', 242, 'highway-ratri', 30),
    ('hr-4', 'Highway Ratri Placeholder 4', 'Replace With Film', 2007, array['Replace Singer'], 'Replace Composer', 'hr000000004', 205, 'highway-ratri', 40),
    ('hr-5', 'Highway Ratri Placeholder 5', 'Replace With Film', 2012, array['Replace Singer'], 'Replace Composer', 'hr000000005', 231, 'highway-ratri', 50)
  ) as rows(local_id, title, film, release_year, singers, composer, youtube_video_id, duration_seconds, channel_slug, sequence)
),
upserted_songs as (
  insert into public.songs (
    title,
    film,
    release_year,
    singers,
    composer,
    youtube_video_id,
    youtube_url,
    duration_seconds,
    embed_status,
    active
  )
  select
    title,
    film,
    release_year,
    singers,
    composer,
    youtube_video_id,
    'https://www.youtube.com/watch?v=' || youtube_video_id,
    duration_seconds,
    'unchecked'::public.embed_status,
    true
  from sample_songs
  on conflict (youtube_video_id) do update set
    title = excluded.title,
    film = excluded.film,
    release_year = excluded.release_year,
    singers = excluded.singers,
    composer = excluded.composer,
    youtube_url = excluded.youtube_url,
    duration_seconds = excluded.duration_seconds
  returning id, youtube_video_id
)
insert into public.channel_songs (channel_id, song_id, sequence, active)
select c.id, s.id, ss.sequence, true
from sample_songs ss
join public.channels c on c.slug = ss.channel_slug
join public.songs s on s.youtube_video_id = ss.youtube_video_id
on conflict (channel_id, song_id) do update set
  sequence = excluded.sequence,
  active = true;
