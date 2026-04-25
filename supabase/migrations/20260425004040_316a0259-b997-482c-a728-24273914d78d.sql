
-- Remove permissive insert on restaurants
DROP POLICY IF EXISTS "authenticated insert restaurant" ON public.restaurants;

-- Security definer function to create restaurant + owner membership atomically
CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  _name TEXT,
  _slug TEXT,
  _timezone TEXT DEFAULT 'Europe/Amsterdam'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _new_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name required';
  END IF;
  IF _slug IS NULL OR length(trim(_slug)) = 0 THEN
    RAISE EXCEPTION 'Slug required';
  END IF;

  INSERT INTO public.restaurants (name, slug, timezone)
  VALUES (trim(_name), lower(trim(_slug)), _timezone)
  RETURNING id INTO _new_id;

  INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
  VALUES (_new_id, _uid, 'owner');

  RETURN _new_id;
END;
$$;

-- Tighten large group public insert
DROP POLICY IF EXISTS "public submit large group" ON public.large_group_requests;
CREATE POLICY "public submit large group" ON public.large_group_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    party_size > 0
    AND length(coalesce(contact_name, '')) > 0
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id)
  );
