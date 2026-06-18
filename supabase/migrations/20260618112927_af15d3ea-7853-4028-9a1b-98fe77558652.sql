
-- Fix RLS: restrict member/manager policies to authenticated role so anon
-- queries don't error on is_restaurant_member()/is_restaurant_manager() (which
-- require auth.uid()) and instead fall through to the public read policies.

-- restaurants
DROP POLICY IF EXISTS "members read restaurant" ON public.restaurants;
CREATE POLICY "members read restaurant" ON public.restaurants
  FOR SELECT TO authenticated USING (public.is_restaurant_member(id));

DROP POLICY IF EXISTS "managers update restaurant" ON public.restaurants;
CREATE POLICY "managers update restaurant" ON public.restaurants
  FOR UPDATE TO authenticated USING (public.is_restaurant_manager(id));

-- zones
DROP POLICY IF EXISTS "members read zones" ON public.zones;
CREATE POLICY "members read zones" ON public.zones
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write zones" ON public.zones;
CREATE POLICY "manager write zones" ON public.zones
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- tables
DROP POLICY IF EXISTS "members read tables" ON public.tables;
CREATE POLICY "members read tables" ON public.tables
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write tables" ON public.tables;
CREATE POLICY "manager write tables" ON public.tables
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- opening_hours
DROP POLICY IF EXISTS "members read hours" ON public.opening_hours;
CREATE POLICY "members read hours" ON public.opening_hours
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write hours" ON public.opening_hours;
CREATE POLICY "manager write hours" ON public.opening_hours
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- shifts
DROP POLICY IF EXISTS "members read shifts" ON public.shifts;
CREATE POLICY "members read shifts" ON public.shifts
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write shifts" ON public.shifts;
CREATE POLICY "manager write shifts" ON public.shifts
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- closures
DROP POLICY IF EXISTS "members read closures" ON public.closures;
CREATE POLICY "members read closures" ON public.closures
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write closures" ON public.closures;
CREATE POLICY "manager write closures" ON public.closures
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- special_days
DROP POLICY IF EXISTS "members read special_days" ON public.special_days;
CREATE POLICY "members read special_days" ON public.special_days
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write special_days" ON public.special_days;
CREATE POLICY "manager write special_days" ON public.special_days
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- pre_order_items
DROP POLICY IF EXISTS "members read pre_order_items" ON public.pre_order_items;
CREATE POLICY "members read pre_order_items" ON public.pre_order_items
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write pre_order_items" ON public.pre_order_items;
CREATE POLICY "manager write pre_order_items" ON public.pre_order_items
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- deposit_policies
DROP POLICY IF EXISTS "members read deposit_policies" ON public.deposit_policies;
CREATE POLICY "members read deposit_policies" ON public.deposit_policies
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write deposit_policies" ON public.deposit_policies;
CREATE POLICY "manager write deposit_policies" ON public.deposit_policies
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- table_combinations
DROP POLICY IF EXISTS "members read combos" ON public.table_combinations;
CREATE POLICY "members read combos" ON public.table_combinations
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager write combos" ON public.table_combinations;
CREATE POLICY "manager write combos" ON public.table_combinations
  FOR ALL TO authenticated
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- large_group_requests
DROP POLICY IF EXISTS "members read large group" ON public.large_group_requests;
CREATE POLICY "members read large group" ON public.large_group_requests
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "members update large group" ON public.large_group_requests;
CREATE POLICY "members update large group" ON public.large_group_requests
  FOR UPDATE TO authenticated
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "manager delete large group" ON public.large_group_requests;
CREATE POLICY "manager delete large group" ON public.large_group_requests
  FOR DELETE TO authenticated USING (public.is_restaurant_manager(restaurant_id));

-- waitlist_entries
DROP POLICY IF EXISTS "members read waitlist" ON public.waitlist_entries;
CREATE POLICY "members read waitlist" ON public.waitlist_entries
  FOR SELECT TO authenticated USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "members write waitlist" ON public.waitlist_entries;
CREATE POLICY "members write waitlist" ON public.waitlist_entries
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));
