ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS guest_changes_auto_apply boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guest_changes_min_notice_minutes integer NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS guest_changes_auto_reject_party_size integer;