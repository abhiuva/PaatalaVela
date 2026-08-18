create table if not exists public.youtube_import_queue (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  youtube_url text not null,
  playlist_id text,
  source_title text not null,
  source_description text,
  thumbnail_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  uploader text,
  published_at timestamptz,
  availability text not null default 'unavailable' check (availability in ('available', 'unavailable', 'private', 'deleted', 'embedding_disabled')),
  embeddable boolean not null default false,
  duplicate_song_id uuid references public.songs(id) on delete set null,
  suggested_metadata jsonb not null default '{}'::jsonb,
  channel_id uuid references public.channels(id) on delete set null,
  sequence integer,
  status text not null default 'pending' check (status in ('pending', 'imported', 'rejected', 'duplicate', 'unavailable')),
  imported_song_id uuid references public.songs(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (youtube_video_id, playlist_id)
);

create index if not exists youtube_import_queue_status_idx on public.youtube_import_queue (status, created_at desc);
create index if not exists youtube_import_queue_video_idx on public.youtube_import_queue (youtube_video_id);

drop trigger if exists set_youtube_import_queue_updated_at on public.youtube_import_queue;
create trigger set_youtube_import_queue_updated_at
before update on public.youtube_import_queue
for each row execute function public.set_updated_at();

alter table public.youtube_import_queue enable row level security;

drop policy if exists "Admins manage youtube import queue" on public.youtube_import_queue;
create policy "Admins manage youtube import queue"
on public.youtube_import_queue for all
using (public.is_active_admin_or_editor())
with check (public.is_active_admin_or_editor());
