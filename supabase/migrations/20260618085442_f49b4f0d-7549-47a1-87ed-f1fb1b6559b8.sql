
-- 1) Tighten anon SELECT on restaurants to safe widget columns only (structural, not GRANT-list-only)
REVOKE SELECT ON public.restaurants FROM anon;

GRANT SELECT (
  id, name, slug, timezone,
  max_party_size_online,
  large_group_threshold,
  large_group_manual_approval_from,
  large_group_extra_info_from,
  large_group_max_online_request,
  extra_large_group_threshold,
  large_group_confirmation_text,
  preorders_enabled,
  preorders_allow_free_text,
  allow_zone_preference,
  brand_primary,
  logo_url,
  booking_horizon_days,
  is_active,
  deleted_at
) ON public.restaurants TO anon;

-- 2) Prevent restaurant managers (and even existing owners) from inserting/updating owner-role
--    members via the Data API. Owner membership is only created via the SECURITY DEFINER
--    function create_restaurant_with_owner() or by system admins.
DROP POLICY IF EXISTS "manager manage members" ON public.restaurant_members;

CREATE POLICY "manager manage members"
ON public.restaurant_members
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_restaurant_manager(restaurant_id))
WITH CHECK (
  public.is_restaurant_manager(restaurant_id)
  AND role <> 'owner'::app_role
);

-- 3) Allow system admins to read suppressed_emails via RLS (no service-role bypass needed).
CREATE POLICY "System admins can read suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.is_system_admin());
