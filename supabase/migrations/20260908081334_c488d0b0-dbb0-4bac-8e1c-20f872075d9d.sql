ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_idempotency_key_uidx
  ON public.reservations (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE public.mcp_service_identities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  profile text NOT NULL,
  capabilities text[] NOT NULL DEFAULT '{}',
  label text,
  revoked_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mcp_service_identities_user_unique UNIQUE (user_id),
  CONSTRAINT mcp_service_identities_profile_check CHECK (profile IN (
    'guest_voice','guest_conversation','workflow_agent','operations_agent',
    'manager_agent','revenue_agent','system_automation'
  ))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_service_identities TO authenticated;
GRANT ALL ON public.mcp_service_identities TO service_role;

ALTER TABLE public.mcp_service_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage service identities"
  ON public.mcp_service_identities FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id) OR public.is_system_admin())
  WITH CHECK (public.is_restaurant_manager(restaurant_id) OR public.is_system_admin());

CREATE POLICY "Service identity can read itself"
  ON public.mcp_service_identities FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_mcp_service_identities_updated
  BEFORE UPDATE ON public.mcp_service_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();