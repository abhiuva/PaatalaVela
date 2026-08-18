create table if not exists public.active_listener_sessions (
  session_hash text primary key check (char_length(session_hash) = 64),
  channel_id uuid references public.channels(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  player_state text not null check (player_state in ('playing', 'paused', 'stopped')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_test boolean not null default false,
  heartbeat_window_started_at timestamptz not null default now(),
  heartbeat_count integer not null default 1 check (heartbeat_count >= 0)
);

create index if not exists active_listener_last_seen_idx on public.active_listener_sessions (last_seen_at desc);
create index if not exists active_listener_expires_idx on public.active_listener_sessions (expires_at);
create index if not exists active_listener_channel_idx on public.active_listener_sessions (channel_id);
create index if not exists active_listener_state_idx on public.active_listener_sessions (player_state);

alter table public.active_listener_sessions enable row level security;

create policy "Active administrators read listener health"
on public.active_listener_sessions for select
using (public.is_active_admin());

-- Public roles receive no insert, update or delete policies. Presence mutations
-- use the server-only service role through the controlled endpoint.

create or replace function public.upsert_listener_presence(
  p_session_hash text,
  p_channel_id uuid,
  p_song_id uuid,
  p_player_state text,
  p_expires_at timestamptz,
  p_is_test boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(p_session_hash) <> 64 or p_player_state not in ('playing', 'paused', 'stopped') then
    raise exception 'invalid presence input';
  end if;

  insert into public.active_listener_sessions (
    session_hash, channel_id, song_id, player_state, expires_at, is_test,
    heartbeat_count, heartbeat_window_started_at
  ) values (
    p_session_hash, p_channel_id, p_song_id, p_player_state, p_expires_at, p_is_test,
    case when p_player_state = 'playing' then 1 else 0 end, now()
  )
  on conflict (session_hash) do update set
    channel_id = excluded.channel_id,
    song_id = excluded.song_id,
    player_state = excluded.player_state,
    last_seen_at = now(),
    expires_at = excluded.expires_at,
    is_test = excluded.is_test,
    heartbeat_count = case
      when active_listener_sessions.heartbeat_window_started_at < now() - interval '5 minutes'
        then case when excluded.player_state = 'playing' then 1 else 0 end
      when excluded.player_state = 'playing' then active_listener_sessions.heartbeat_count + 1
      else active_listener_sessions.heartbeat_count
    end,
    heartbeat_window_started_at = case
      when active_listener_sessions.heartbeat_window_started_at < now() - interval '5 minutes' then now()
      else active_listener_sessions.heartbeat_window_started_at
    end;
end;
$$;

revoke all on function public.upsert_listener_presence(text, uuid, uuid, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.upsert_listener_presence(text, uuid, uuid, text, timestamptz, boolean) to service_role;

create or replace function public.delete_expired_listener_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.active_listener_sessions where expires_at < now() - interval '5 minutes';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_listener_sessions() from public, anon, authenticated;
grant execute on function public.delete_expired_listener_sessions() to service_role;
