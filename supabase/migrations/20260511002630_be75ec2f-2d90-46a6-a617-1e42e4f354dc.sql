ALTER TABLE public.pre_order_items
  ADD COLUMN IF NOT EXISTS show_in_widget boolean NOT NULL DEFAULT false;

UPDATE public.pre_order_items
   SET show_in_widget = true
 WHERE pos_provider IS NULL
   AND is_active = true
   AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pre_order_items_widget_idx
  ON public.pre_order_items (restaurant_id, show_in_widget)
  WHERE deleted_at IS NULL;

UPDATE public.pre_order_items
   SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('demo_seed', true)
 WHERE pos_provider IS NULL
   AND NOT (metadata ? 'demo_seed')
   AND name IN (
     'Prosecco per glas','Alcoholvrije cocktail','Fles huiswijn wit','Speciaalbier lokaal',
     'Cocktail van de maand','Borrelplank','Verjaardagsdessert','Kinderlimonade'
   );