-- System admin SELECT policies
CREATE POLICY "system_admin_read_all_restaurants" ON public.restaurants
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_members" ON public.restaurant_members
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_reservations" ON public.reservations
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_guests" ON public.guests
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_tables" ON public.tables
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_zones" ON public.zones
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_opening_hours" ON public.opening_hours
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_shifts" ON public.shifts
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_audit_log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_integration_logs" ON public.integration_logs
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_clickwise_settings" ON public.clickwise_settings
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_pos_connections" ON public.pos_connections
  FOR SELECT TO authenticated USING (public.is_system_admin());

CREATE POLICY "system_admin_read_all_agent_api_keys" ON public.agent_api_keys
  FOR SELECT TO authenticated USING (public.is_system_admin());

-- System admin UPDATE policies (matching member-level write capabilities)
CREATE POLICY "system_admin_update_restaurants" ON public.restaurants
  FOR UPDATE TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_reservations" ON public.reservations
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_guests" ON public.guests
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_tables" ON public.tables
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_zones" ON public.zones
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_opening_hours" ON public.opening_hours
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_shifts" ON public.shifts
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_members" ON public.restaurant_members
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "system_admin_write_clickwise_settings" ON public.clickwise_settings
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());