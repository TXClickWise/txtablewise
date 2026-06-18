
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_clickwise_subscription_id text,
  ADD COLUMN IF NOT EXISTS clickwise_addon_active boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_restaurant_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.public_base_url IS DISTINCT FROM OLD.public_base_url THEN
    IF NOT public.is_system_admin() THEN
      NEW.public_base_url := OLD.public_base_url;
    END IF;
  END IF;
  IF NOT public.is_system_admin() THEN
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.stripe_clickwise_subscription_id := OLD.stripe_clickwise_subscription_id;
    NEW.clickwise_addon_active := OLD.clickwise_addon_active;
    NEW.plan := OLD.plan;
    NEW.plan_started_at := OLD.plan_started_at;
    NEW.trial_ends_at := OLD.trial_ends_at;
  END IF;
  RETURN NEW;
END;
$function$;
