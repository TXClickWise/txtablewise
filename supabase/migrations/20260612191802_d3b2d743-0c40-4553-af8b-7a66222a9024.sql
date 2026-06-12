
-- 1. Extend weather_forecasts
ALTER TABLE public.weather_forecasts
  ADD COLUMN IF NOT EXISTS condition_code integer,
  ADD COLUMN IF NOT EXISTS wind_kmh_max numeric,
  ADD COLUMN IF NOT EXISTS uv_index_max numeric,
  ADD COLUMN IF NOT EXISTS sunrise timestamptz,
  ADD COLUMN IF NOT EXISTS sunset timestamptz;

-- 2. Restaurants weather config
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS weather_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weather_location_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weather_location_label text;

-- 3. Hourly forecasts (today + tomorrow only)
CREATE TABLE IF NOT EXISTS public.weather_hourly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  hour_ts timestamptz NOT NULL,
  temp_c numeric,
  precipitation_mm numeric,
  precipitation_prob_pct integer,
  condition_code integer,
  wind_kmh numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, hour_ts)
);

GRANT SELECT ON public.weather_hourly TO authenticated;
GRANT ALL ON public.weather_hourly TO service_role;

ALTER TABLE public.weather_hourly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read weather_hourly"
  ON public.weather_hourly FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id) OR public.is_system_admin());

CREATE INDEX IF NOT EXISTS idx_weather_hourly_rest_hour
  ON public.weather_hourly(restaurant_id, hour_ts);

CREATE TRIGGER trg_weather_hourly_updated
  BEFORE UPDATE ON public.weather_hourly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Advisories (rule-triggered AI tips)
CREATE TABLE IF NOT EXISTS public.weather_advisories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('rain_during_service','heatwave','frost_terrace','great_weather_low_bookings','storm_warning')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn')),
  headline_nl text NOT NULL,
  body_nl text,
  action_route text,
  ai_generated boolean NOT NULL DEFAULT false,
  dismissed_at timestamptz,
  dismissed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, date, type)
);

GRANT SELECT, UPDATE ON public.weather_advisories TO authenticated;
GRANT ALL ON public.weather_advisories TO service_role;

ALTER TABLE public.weather_advisories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read advisories"
  ON public.weather_advisories FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id) OR public.is_system_admin());

CREATE POLICY "members dismiss advisories"
  ON public.weather_advisories FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));

CREATE INDEX IF NOT EXISTS idx_weather_advisories_rest_date
  ON public.weather_advisories(restaurant_id, date);

CREATE TRIGGER trg_weather_advisories_updated
  BEFORE UPDATE ON public.weather_advisories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
