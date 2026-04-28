CREATE TABLE public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  possible_cause TEXT,
  request_payload JSONB,
  response_payload JSONB,
  guest_id UUID,
  reservation_id UUID,
  api_key_prefix TEXT,
  external_reference TEXT,
  retry_safe BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT integration_logs_status_check CHECK (status IN ('success','warning','failed')),
  CONSTRAINT integration_logs_source_check CHECK (source IN ('dashboard','widget','voice_agent','clickwise','api','webhook','other'))
);

CREATE INDEX idx_integration_logs_restaurant_created ON public.integration_logs (restaurant_id, created_at DESC);
CREATE INDEX idx_integration_logs_status ON public.integration_logs (restaurant_id, status);
CREATE INDEX idx_integration_logs_source ON public.integration_logs (restaurant_id, source);
CREATE INDEX idx_integration_logs_reservation ON public.integration_logs (reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX idx_integration_logs_guest ON public.integration_logs (guest_id) WHERE guest_id IS NOT NULL;

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read integration_logs"
  ON public.integration_logs FOR SELECT
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "manager update integration_logs"
  ON public.integration_logs FOR UPDATE
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));