CREATE UNIQUE INDEX IF NOT EXISTS pos_connections_restaurant_provider_uniq
  ON public.pos_connections (restaurant_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS pre_order_items_restaurant_external_uniq
  ON public.pre_order_items (restaurant_id, pos_provider, external_product_id)
  WHERE external_product_id IS NOT NULL;