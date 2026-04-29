CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(_name text, _slug text, _timezone text DEFAULT 'Europe/Amsterdam'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _new_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF _slug IS NULL OR length(trim(_slug)) = 0 THEN RAISE EXCEPTION 'Slug required'; END IF;

  INSERT INTO public.restaurants (name, slug, timezone, plan, trial_ends_at, plan_started_at)
  VALUES (trim(_name), lower(trim(_slug)), _timezone, 'trial', now() + interval '14 days', now())
  RETURNING id INTO _new_id;

  INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
  VALUES (_new_id, _uid, 'owner');

  RETURN _new_id;
END;
$function$;