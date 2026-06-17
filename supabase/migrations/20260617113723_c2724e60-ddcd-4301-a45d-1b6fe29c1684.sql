-- Drop vestigial reservation_reminders table (pipeline runs on integration_events).
DROP TABLE IF EXISTS public.reservation_reminders CASCADE;

-- Update purge function to no longer reference the dropped table.
CREATE OR REPLACE FUNCTION public.purge_restaurant_operational_data(_restaurant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_owner boolean;
  _counts jsonb := '{}'::jsonb;
  _n integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_members
    WHERE restaurant_id = _restaurant_id
      AND user_id = _uid
      AND role = 'owner'
  ) INTO _is_owner;

  IF NOT _is_owner AND NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Only owners can purge operational data';
  END IF;

  DELETE FROM public.pre_orders pre
    USING public.reservations r
    WHERE pre.reservation_id = r.id AND r.restaurant_id = _restaurant_id;

  DELETE FROM public.reservation_tables rt
    USING public.reservations r
    WHERE rt.reservation_id = r.id AND r.restaurant_id = _restaurant_id;

  DELETE FROM public.reservation_status_history WHERE restaurant_id = _restaurant_id;
  DELETE FROM public.review_requests WHERE restaurant_id = _restaurant_id;

  DELETE FROM public.reservations WHERE restaurant_id = _restaurant_id;
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('reservations', _n);

  BEGIN
    EXECUTE 'DELETE FROM public.waitlist_entries WHERE restaurant_id = $1' USING _restaurant_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  DELETE FROM public.guest_notes WHERE restaurant_id = _restaurant_id;

  DELETE FROM public.guests WHERE restaurant_id = _restaurant_id;
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('guests', _n);

  DELETE FROM public.integration_events WHERE restaurant_id = _restaurant_id;
  DELETE FROM public.integration_logs WHERE restaurant_id = _restaurant_id;
  DELETE FROM public.agent_call_logs WHERE restaurant_id = _restaurant_id;
  DELETE FROM public.pos_orders WHERE restaurant_id = _restaurant_id;
  DELETE FROM public.large_group_requests WHERE restaurant_id = _restaurant_id;
  DELETE FROM public.audit_log WHERE restaurant_id = _restaurant_id;

  INSERT INTO public.audit_log (restaurant_id, action, entity, actor_user_id, after_data)
  VALUES (_restaurant_id, 'restaurant.purge_operational_data', 'restaurant', _uid, _counts);

  RETURN _counts;
END;
$function$;