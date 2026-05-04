ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS public_base_url text DEFAULT NULL;

COMMENT ON COLUMN public.restaurants.public_base_url IS
  'Optionele basis-URL voor de publieke widget. Bijv. https://reserveer.mijnrestaurant.nl of https://txtablewise.lovable.app. Als leeg, wordt het huidige domein gebruikt.';