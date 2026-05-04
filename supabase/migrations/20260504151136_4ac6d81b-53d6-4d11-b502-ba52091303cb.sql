ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS custom_widget_domain text DEFAULT NULL;

COMMENT ON COLUMN public.restaurants.custom_widget_domain IS
  'White-label domein voor de publieke widget, bijv. reserveer.mijnrestaurant.nl. Alleen beschikbaar op Pro-plan. Vereist DNS-configuratie door de klant.';

-- Trigger: voorkom dat niet-system-admins public_base_url wijzigen
CREATE OR REPLACE FUNCTION public.protect_restaurant_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.public_base_url IS DISTINCT FROM OLD.public_base_url THEN
    IF NOT public.is_system_admin() THEN
      NEW.public_base_url := OLD.public_base_url;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_restaurant_admin_fields_trg ON public.restaurants;
CREATE TRIGGER protect_restaurant_admin_fields_trg
BEFORE UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.protect_restaurant_admin_fields();