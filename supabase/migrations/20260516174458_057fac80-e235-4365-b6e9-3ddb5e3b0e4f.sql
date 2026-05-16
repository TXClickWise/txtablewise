
-- Add provisioning + add-on fields to clickwise_settings
ALTER TABLE public.clickwise_settings
  ADD COLUMN IF NOT EXISTS clickwise_addon text NOT NULL DEFAULT 'none'
    CHECK (clickwise_addon IN ('none','active','past_due','cancelled')),
  ADD COLUMN IF NOT EXISTS clickwise_addon_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS saas_plan_id text,
  ADD COLUMN IF NOT EXISTS provisioning_status text NOT NULL DEFAULT 'idle'
    CHECK (provisioning_status IN ('idle','provisioning','failed','provisioned')),
  ADD COLUMN IF NOT EXISTS provisioning_error text,
  ADD COLUMN IF NOT EXISTS last_provision_attempt_at timestamptz;

-- Protect admin-only fields: only system admins may change addon status & provisioning state
CREATE OR REPLACE FUNCTION public.protect_clickwise_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    IF NEW.clickwise_addon IS DISTINCT FROM OLD.clickwise_addon THEN
      NEW.clickwise_addon := OLD.clickwise_addon;
      NEW.clickwise_addon_updated_at := OLD.clickwise_addon_updated_at;
    END IF;
    IF NEW.provisioning_status IS DISTINCT FROM OLD.provisioning_status THEN
      NEW.provisioning_status := OLD.provisioning_status;
    END IF;
    IF NEW.provisioned_at IS DISTINCT FROM OLD.provisioned_at THEN
      NEW.provisioned_at := OLD.provisioned_at;
    END IF;
    IF NEW.saas_plan_id IS DISTINCT FROM OLD.saas_plan_id THEN
      NEW.saas_plan_id := OLD.saas_plan_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_clickwise_admin_fields ON public.clickwise_settings;
CREATE TRIGGER trg_protect_clickwise_admin_fields
  BEFORE UPDATE ON public.clickwise_settings
  FOR EACH ROW EXECUTE FUNCTION public.protect_clickwise_admin_fields();

-- Auto-update addon_updated_at
CREATE OR REPLACE FUNCTION public.touch_clickwise_addon_ts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.clickwise_addon IS DISTINCT FROM OLD.clickwise_addon THEN
    NEW.clickwise_addon_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_clickwise_addon_ts ON public.clickwise_settings;
CREATE TRIGGER trg_touch_clickwise_addon_ts
  BEFORE UPDATE ON public.clickwise_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_clickwise_addon_ts();
