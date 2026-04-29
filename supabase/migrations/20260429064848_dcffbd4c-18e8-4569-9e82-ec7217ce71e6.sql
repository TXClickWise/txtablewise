-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('trial','basic','pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Restaurants kolommen
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS plan public.subscription_plan NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz NOT NULL DEFAULT now();

-- 3. Bestaande restaurants → pro (backward compat: niets verliezen)
UPDATE public.restaurants SET plan = 'pro' WHERE created_at < now();

-- 4. Helper
CREATE OR REPLACE FUNCTION public.restaurant_plan(_restaurant_id uuid)
RETURNS public.subscription_plan
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT plan FROM public.restaurants WHERE id = _restaurant_id; $$;

-- 5. Upgrade requests tabel
CREATE TABLE IF NOT EXISTS public.plan_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  current_plan public.subscription_plan NOT NULL,
  requested_plan public.subscription_plan NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requester_note text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers read own upgrade requests"
ON public.plan_upgrade_requests FOR SELECT
USING (public.is_restaurant_manager(restaurant_id) OR public.is_system_admin());

CREATE POLICY "managers create upgrade requests"
ON public.plan_upgrade_requests FOR INSERT
WITH CHECK (public.is_restaurant_manager(restaurant_id) AND requested_by = auth.uid());

CREATE POLICY "system admins update upgrade requests"
ON public.plan_upgrade_requests FOR UPDATE
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

CREATE TRIGGER trg_plan_upgrade_requests_updated
BEFORE UPDATE ON public.plan_upgrade_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_restaurant ON public.plan_upgrade_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_status ON public.plan_upgrade_requests(status);