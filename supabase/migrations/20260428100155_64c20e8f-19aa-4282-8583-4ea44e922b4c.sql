CREATE TABLE public.webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT ARRAY['*']::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_response_code INTEGER,
  last_test_response_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_webhook_endpoints_restaurant ON public.webhook_endpoints(restaurant_id) WHERE is_active = true;

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- Only managers can read/write webhook endpoints (because they contain secrets)
CREATE POLICY "manager read webhook_endpoints"
  ON public.webhook_endpoints FOR SELECT
  USING (public.is_restaurant_manager(restaurant_id));

CREATE POLICY "manager write webhook_endpoints"
  ON public.webhook_endpoints FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

CREATE TRIGGER trg_webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();