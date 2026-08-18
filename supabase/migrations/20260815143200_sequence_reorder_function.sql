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
  assignment_id uuid;
  position integer := 1;
begin
  if not public.is_active_admin_or_editor() then
    raise exception 'not authorized';
  end if;

  if exists (
    select 1
    from unnest(p_assignment_ids) as requested(id)
    left join public.channel_songs cs on cs.id = requested.id and cs.channel_id = p_channel_id
    where cs.id is null
  ) then
    raise exception 'invalid assignment order';
  end if;

  foreach assignment_id in array p_assignment_ids loop
    update public.channel_songs
    set sequence = position * 10
    where id = assignment_id
      and channel_id = p_channel_id;
    position := position + 1;
  end loop;
end;
$$;
