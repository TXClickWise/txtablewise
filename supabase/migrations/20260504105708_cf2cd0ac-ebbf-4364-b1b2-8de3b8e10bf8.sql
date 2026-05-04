-- FIX-003: Add RLS policies for public booking widget (anon access)

DROP POLICY IF EXISTS "public read restaurant by slug" ON public.restaurants;
CREATE POLICY "public read restaurant by slug"
  ON public.restaurants
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "public read active pre_order_items" ON public.pre_order_items;
CREATE POLICY "public read active pre_order_items"
  ON public.pre_order_items
  FOR SELECT
  TO anon
  USING (is_active = true AND deleted_at IS NULL);