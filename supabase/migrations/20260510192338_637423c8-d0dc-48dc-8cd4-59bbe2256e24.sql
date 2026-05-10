-- Add default_locale to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'nl';

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_default_locale_check
  CHECK (default_locale IN ('nl', 'en', 'de', 'fr'));

-- Add guest_language to reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_language text;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_guest_language_check
  CHECK (guest_language IS NULL OR guest_language IN ('nl', 'en', 'de', 'fr'));

-- Email templates per restaurant per template_key per locale
CREATE TABLE IF NOT EXISTS public.restaurant_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('nl', 'en', 'de', 'fr')),
  subject text NOT NULL DEFAULT '',
  heading text NOT NULL DEFAULT '',
  body_intro text NOT NULL DEFAULT '',
  body_outro text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  is_ai_generated boolean NOT NULL DEFAULT false,
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, template_key, locale)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_email_templates_lookup
  ON public.restaurant_email_templates (restaurant_id, template_key, locale);

ALTER TABLE public.restaurant_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read email templates"
  ON public.restaurant_email_templates FOR SELECT
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "managers can insert email templates"
  ON public.restaurant_email_templates FOR INSERT
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

CREATE POLICY "managers can update email templates"
  ON public.restaurant_email_templates FOR UPDATE
  USING (public.is_restaurant_manager(restaurant_id));

CREATE POLICY "managers can delete email templates"
  ON public.restaurant_email_templates FOR DELETE
  USING (public.is_restaurant_manager(restaurant_id));

CREATE TRIGGER set_restaurant_email_templates_updated_at
  BEFORE UPDATE ON public.restaurant_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();