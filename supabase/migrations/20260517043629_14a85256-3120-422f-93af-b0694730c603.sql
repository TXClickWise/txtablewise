ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS transfer_phone text,
  ADD COLUMN IF NOT EXISTS transfer_hours_start time,
  ADD COLUMN IF NOT EXISTS transfer_hours_end time;