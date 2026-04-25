ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS max_covers_per_slot integer,
  ADD COLUMN IF NOT EXISTS max_new_reservations_per_15min integer,
  ADD COLUMN IF NOT EXISTS peak_warning_threshold_pct integer NOT NULL DEFAULT 85,
  ADD COLUMN IF NOT EXISTS large_group_minutes integer NOT NULL DEFAULT 150;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS max_covers_override integer;