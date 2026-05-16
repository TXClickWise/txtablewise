-- 1. Add guest snapshot columns to reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_first_name text,
  ADD COLUMN IF NOT EXISTS guest_last_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text;

-- 2. Backfill from integration_events (reservation.created payload) where available
UPDATE public.reservations r
SET
  guest_first_name = COALESCE(r.guest_first_name, ie.payload->'guest'->>'first_name'),
  guest_last_name  = COALESCE(r.guest_last_name,  ie.payload->'guest'->>'last_name'),
  guest_email      = COALESCE(r.guest_email,      ie.payload->'guest'->>'email'),
  guest_phone      = COALESCE(r.guest_phone,      ie.payload->'guest'->>'phone'),
  guest_language   = COALESCE(r.guest_language,   ie.payload->'guest'->>'language')
FROM public.integration_events ie
WHERE ie.event_type = 'reservation.created'
  AND ie.payload->>'reservation_id' = r.id::text
  AND (r.guest_first_name IS NULL OR r.guest_last_name IS NULL OR r.guest_email IS NULL OR r.guest_phone IS NULL);

-- 3. Fallback backfill from the current linked guests row for anything still empty
UPDATE public.reservations r
SET
  guest_first_name = COALESCE(r.guest_first_name, g.first_name),
  guest_last_name  = COALESCE(r.guest_last_name,  g.last_name),
  guest_email      = COALESCE(r.guest_email,      g.email),
  guest_phone      = COALESCE(r.guest_phone,      g.phone),
  guest_language   = COALESCE(r.guest_language,   g.language)
FROM public.guests g
WHERE g.id = r.guest_id
  AND (r.guest_first_name IS NULL OR r.guest_last_name IS NULL OR r.guest_email IS NULL OR r.guest_phone IS NULL);