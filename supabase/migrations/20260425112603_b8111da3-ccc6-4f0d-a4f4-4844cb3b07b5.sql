-- Extend integration_event_status
ALTER TYPE integration_event_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE integration_event_status ADD VALUE IF NOT EXISTS 'skipped';

-- Extend integration_events
ALTER TABLE public.integration_events
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS clickwise_workflow_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.integration_events(restaurant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON public.integration_events(entity_type, entity_id);

-- ClickWise settings per restaurant
CREATE TABLE IF NOT EXISTS public.clickwise_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  connection_mode text NOT NULL DEFAULT 'prepared',  -- prepared | test | live | error | disabled
  location_id text,
  api_base_url text,
  sandbox_mode boolean NOT NULL DEFAULT true,
  contact_sync_enabled boolean NOT NULL DEFAULT false,
  contact_sync_rules jsonb NOT NULL DEFAULT '{
    "match_by": ["phone","email"],
    "create_if_missing": true,
    "update_if_exists": true,
    "overwrite_hospitality_notes": false,
    "sync_marketing_opt_in_only_if_true": true,
    "sync_allergies": true,
    "sync_dietary_preferences": true
  }'::jsonb,
  tag_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  workflow_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_options jsonb NOT NULL DEFAULT '{
    "share_internal_notes": false,
    "share_no_show_count": true,
    "share_visit_count": true,
    "share_allergies": true
  }'::jsonb,
  last_test_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clickwise_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read clickwise_settings"
  ON public.clickwise_settings FOR SELECT
  USING (is_restaurant_member(restaurant_id));

CREATE POLICY "manager write clickwise_settings"
  ON public.clickwise_settings FOR ALL
  USING (is_restaurant_manager(restaurant_id))
  WITH CHECK (is_restaurant_manager(restaurant_id));

CREATE TRIGGER trg_clickwise_settings_updated
  BEFORE UPDATE ON public.clickwise_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();