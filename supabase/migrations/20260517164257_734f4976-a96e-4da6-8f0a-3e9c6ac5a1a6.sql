ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS large_group_response_sla_label text,
  ADD COLUMN IF NOT EXISTS large_group_response_channel_label text;

UPDATE public.restaurants
SET large_group_response_sla_label = COALESCE(NULLIF(large_group_response_sla_label, ''), 'binnen 4 uur'),
    large_group_response_channel_label = COALESCE(NULLIF(large_group_response_channel_label, ''), 'per SMS of e-mail')
WHERE lower(slug) = 'eigeweis' OR lower(name) LIKE '%eigeweis%';