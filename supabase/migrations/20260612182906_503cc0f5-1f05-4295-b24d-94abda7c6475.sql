
-- Zones: fill strategy + condities
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS fill_priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS fill_threshold_pct integer NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS min_party_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_party_size integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS active_weekdays text[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  ADD COLUMN IF NOT EXISTS active_time_from time,
  ADD COLUMN IF NOT EXISTS active_time_to time,
  ADD COLUMN IF NOT EXISTS weather_dependent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weather_min_temp_c numeric,
  ADD COLUMN IF NOT EXISTS weather_blocks_on_precipitation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_terrace boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_zones_fill_priority
  ON public.zones(restaurant_id, fill_priority);

-- Tables: sub-volgorde binnen zone
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS fill_priority integer NOT NULL DEFAULT 100;

-- Reservations: terras-voorkeur
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS prefers_terrace boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terrace_preference_unmet boolean NOT NULL DEFAULT false;

-- Restaurants: feature-flag
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS fill_strategy_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Weather forecasts cache
CREATE TABLE IF NOT EXISTS public.weather_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date date NOT NULL,
  min_temp_c numeric,
  max_temp_c numeric,
  precipitation_mm numeric,
  source text NOT NULL DEFAULT 'open-meteo',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, date)
);

GRANT SELECT ON public.weather_forecasts TO authenticated;
GRANT ALL ON public.weather_forecasts TO service_role;

ALTER TABLE public.weather_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read weather"
  ON public.weather_forecasts FOR SELECT
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "system_admin_read_weather"
  ON public.weather_forecasts FOR SELECT
  TO authenticated
  USING (public.is_system_admin());

CREATE INDEX IF NOT EXISTS idx_weather_forecasts_rest_date
  ON public.weather_forecasts(restaurant_id, date);

CREATE TRIGGER trg_weather_forecasts_updated
  BEFORE UPDATE ON public.weather_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: bestaande zones krijgen fill_priority gebaseerd op huidige sort_order
UPDATE public.zones SET fill_priority = COALESCE(sort_order, 100) WHERE fill_priority = 100;
