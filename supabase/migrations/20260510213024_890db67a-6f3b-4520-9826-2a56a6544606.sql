ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS noshow_auto_mark_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS noshow_auto_mark_grace_minutes integer NOT NULL DEFAULT 20;