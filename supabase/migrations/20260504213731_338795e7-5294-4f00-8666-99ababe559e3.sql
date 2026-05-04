
CREATE TABLE public.demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit demo request"
  ON public.demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(restaurant_name)) BETWEEN 1 AND 200
    AND length(trim(contact_name)) BETWEEN 1 AND 200
    AND length(trim(email)) BETWEEN 3 AND 255
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (phone IS NULL OR length(phone) <= 50)
    AND status = 'new'
  );

CREATE POLICY "system admin read demo requests"
  ON public.demo_requests FOR SELECT
  TO authenticated
  USING (public.is_system_admin());

CREATE POLICY "system admin update demo requests"
  ON public.demo_requests FOR UPDATE
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

CREATE TRIGGER update_demo_requests_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
