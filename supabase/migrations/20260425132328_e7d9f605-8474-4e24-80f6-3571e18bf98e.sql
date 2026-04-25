
-- Voice agent settings (one per restaurant)
CREATE TABLE public.voice_agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'vapi', -- 'vapi' | 'retell' | 'highlevel' | 'other'
  agent_id TEXT,
  phone_number TEXT,
  mode TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'live'
  system_prompt_notes TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager read voice settings" ON public.voice_agent_settings
  FOR SELECT USING (public.is_restaurant_manager(restaurant_id));
CREATE POLICY "manager write voice settings" ON public.voice_agent_settings
  FOR ALL USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

CREATE TRIGGER trg_voice_agent_settings_updated
  BEFORE UPDATE ON public.voice_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agent API keys (API-key auth voor externe voice agents)
CREATE TABLE public.agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  label TEXT NOT NULL,
  provider TEXT,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['availability','book','cancel'],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager read agent keys" ON public.agent_api_keys
  FOR SELECT USING (public.is_restaurant_manager(restaurant_id));
CREATE POLICY "manager write agent keys" ON public.agent_api_keys
  FOR ALL USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

CREATE INDEX idx_agent_api_keys_restaurant ON public.agent_api_keys(restaurant_id) WHERE revoked_at IS NULL;

-- Agent call logs
CREATE TABLE public.agent_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  provider TEXT,
  agent_id TEXT,
  external_call_id TEXT,
  caller_phone TEXT,
  callee_phone TEXT,
  outcome TEXT, -- 'booked' | 'cancelled' | 'failed' | 'transferred' | 'info_only'
  reservation_id UUID,
  duration_seconds INTEGER,
  cost_cents INTEGER,
  transcript_url TEXT,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read agent calls" ON public.agent_call_logs
  FOR SELECT USING (public.is_restaurant_member(restaurant_id));
-- Insert via service role only; no INSERT policy for end users.

CREATE INDEX idx_agent_call_logs_restaurant_created ON public.agent_call_logs(restaurant_id, created_at DESC);
