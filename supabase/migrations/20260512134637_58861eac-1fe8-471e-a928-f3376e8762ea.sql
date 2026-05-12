-- Add email notification preferences per restaurant
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS email_notification_settings jsonb
  NOT NULL
  DEFAULT '{"reservation_confirmed":true,"reminder_24h":true,"reminder_2h":true,"reservation_cancelled":true,"reservation_completed":true,"reconfirmation_requested":true}'::jsonb;

-- Ensure pg_net is available for the trigger that will dispatch emails
CREATE EXTENSION IF NOT EXISTS pg_net;