ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS extra_large_group_threshold integer;

COMMENT ON COLUMN public.restaurants.extra_large_group_threshold IS
  'Optional second threshold (party_size). At/above this, large_group_extra_minutes is added on top of large_group_minutes. NULL = disabled.';