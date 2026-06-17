ALTER TABLE public.large_group_requests
  ADD COLUMN IF NOT EXISTS reservation_id uuid
  REFERENCES public.reservations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS large_group_requests_reservation_id_uniq
  ON public.large_group_requests(reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS large_group_requests_restaurant_status_idx
  ON public.large_group_requests(restaurant_id, status);