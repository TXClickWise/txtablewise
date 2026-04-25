-- Extend waitlist_status enum
ALTER TYPE public.waitlist_status ADD VALUE IF NOT EXISTS 'matched' BEFORE 'notified';
ALTER TYPE public.waitlist_status ADD VALUE IF NOT EXISTS 'confirmed' BEFORE 'converted';

-- Add matching/conversion fields to waitlist_entries
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS zone_preference uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS matched_reservation_id uuid,
  ADD COLUMN IF NOT EXISTS matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS matched_table_id uuid,
  ADD COLUMN IF NOT EXISTS matched_start_time timestamptz;

CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date_status
  ON public.waitlist_entries (restaurant_id, desired_date, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_status
  ON public.waitlist_entries (restaurant_id, status);