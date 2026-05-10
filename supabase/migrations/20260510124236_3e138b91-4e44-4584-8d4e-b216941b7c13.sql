ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS large_group_extra_info_from integer NULL,
  ADD COLUMN IF NOT EXISTS large_group_max_online_request integer NULL;

COMMENT ON COLUMN public.restaurants.large_group_extra_info_from IS 'Vanaf dit aantal personen is een bericht aan het restaurant verplicht in de widget. NULL = nooit verplicht.';
COMMENT ON COLUMN public.restaurants.large_group_max_online_request IS 'Bovengrens voor groepsaanvragen via widget. NULL = gelijk aan max_party_size_online.';