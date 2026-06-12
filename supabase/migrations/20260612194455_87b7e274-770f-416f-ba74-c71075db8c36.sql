ALTER TABLE public.weather_forecasts ADD COLUMN IF NOT EXISTS wind_direction_deg smallint;
ALTER TABLE public.weather_hourly ADD COLUMN IF NOT EXISTS wind_direction_deg smallint;