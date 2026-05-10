-- Add guest email settings to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS guest_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guest_reply_to_email text;