CREATE POLICY "system_admin_insert_audit_log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());