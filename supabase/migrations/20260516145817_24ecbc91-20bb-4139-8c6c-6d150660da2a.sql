
CREATE TABLE public.guest_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  reason_code TEXT,
  current_reservation_date DATE,
  current_start_time TIMESTAMPTZ,
  current_party_size INTEGER,
  desired_reservation_date DATE,
  desired_time TEXT,
  desired_party_size INTEGER,
  message TEXT,
  contact_patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  dietary_notes TEXT,
  guest_name TEXT,
  guest_email TEXT,
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guest_change_requests_status_chk CHECK (status IN ('new','approved','rejected','cancelled'))
);

CREATE INDEX idx_gcr_restaurant_status ON public.guest_change_requests (restaurant_id, status);
CREATE INDEX idx_gcr_reservation ON public.guest_change_requests (reservation_id);

ALTER TABLE public.guest_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read guest_change_requests"
ON public.guest_change_requests FOR SELECT
USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "managers update guest_change_requests"
ON public.guest_change_requests FOR UPDATE
USING (public.is_restaurant_manager(restaurant_id))
WITH CHECK (public.is_restaurant_manager(restaurant_id));

CREATE POLICY "system_admin_read_all_gcr"
ON public.guest_change_requests FOR SELECT
TO authenticated
USING (public.is_system_admin());

CREATE TRIGGER update_gcr_updated_at
BEFORE UPDATE ON public.guest_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_change_requests;
ALTER TABLE public.guest_change_requests REPLICA IDENTITY FULL;
