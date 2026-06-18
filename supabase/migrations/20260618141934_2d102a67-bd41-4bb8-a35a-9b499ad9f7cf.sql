create or replace function public.delete_guests_safe(_guest_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _deleted uuid[] := '{}';
  _blocked jsonb := '[]'::jsonb;
  _g record;
  _blocking_count int;
  _restaurant_ids uuid[] := '{}';
  _rid uuid;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;

  for _g in select id, restaurant_id, first_name, last_name from public.guests where id = any(_guest_ids) loop
    if not (public.is_restaurant_manager(_g.restaurant_id) or public.is_system_admin()) then
      continue;
    end if;

    select count(*) into _blocking_count
      from public.reservations
      where guest_id = _g.id
        and (status::text in ('pending','confirmed','seated')
             or start_time > now());

    if _blocking_count > 0 then
      _blocked := _blocked || jsonb_build_array(jsonb_build_object(
        'guest_id', _g.id,
        'name', nullif(trim(coalesce(_g.first_name,'') || ' ' || coalesce(_g.last_name,'')), ''),
        'active_reservations', _blocking_count
      ));
    else
      delete from public.guest_notes where guest_id = _g.id;
      delete from public.guests where id = _g.id;
      _deleted := array_append(_deleted, _g.id);
      _restaurant_ids := array_append(_restaurant_ids, _g.restaurant_id);
    end if;
  end loop;

  if array_length(_deleted, 1) > 0 then
    foreach _rid in array _restaurant_ids loop
      insert into public.audit_log (restaurant_id, action, entity, actor_user_id, after_data)
      values (_rid, 'guest.deleted', 'guest', _uid,
              jsonb_build_object('deleted_ids', _deleted));
      exit;
    end loop;
  end if;

  return jsonb_build_object('deleted', to_jsonb(_deleted), 'blocked', _blocked);
end;
$$;

grant execute on function public.delete_guests_safe(uuid[]) to authenticated;