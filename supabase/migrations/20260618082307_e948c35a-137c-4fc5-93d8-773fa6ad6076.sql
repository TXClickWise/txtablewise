
-- 1) Restrict public restaurant SELECT to active+non-deleted, and lock column access via GRANTs

DROP POLICY IF EXISTS "public read restaurant by slug" ON public.restaurants;
CREATE POLICY "public read restaurant by slug"
  ON public.restaurants
  FOR SELECT
  TO anon
  USING (is_active = true AND deleted_at IS NULL);

-- Revoke broad SELECT from anon and grant only widget-safe columns
REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, slug, name, logo_url, brand_primary, brand_accent,
  timezone, locale, default_locale, default_language, country,
  is_active, deleted_at,
  max_party_size_online, booking_horizon_days, booking_lead_time_minutes,
  allow_zone_preference, allow_guest_notes,
  large_group_threshold, large_group_manual_approval_from,
  large_group_extra_info_from, large_group_max_online_request,
  extra_large_group_threshold, large_group_confirmation_text,
  large_group_cancellation_terms, large_group_default_status,
  large_group_response_sla_label, large_group_response_channel_label,
  large_group_minutes, large_group_extra_minutes, large_group_deposit_recommended_from,
  preorders_enabled, preorders_allow_free_text, preorders_payment_required,
  slot_duration_minutes, default_reservation_minutes, hold_minutes,
  walkins_enabled,
  google_review_url, website, custom_widget_domain, public_base_url,
  city
) ON public.restaurants TO anon;

-- 2) Restrict anon read of pre_order_items to restaurants that are publicly available

DROP POLICY IF EXISTS "public read active pre_order_items" ON public.pre_order_items;
CREATE POLICY "public read active pre_order_items"
  ON public.pre_order_items
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = pre_order_items.restaurant_id
        AND r.is_active = true
        AND r.deleted_at IS NULL
    )
  );

-- 3) Restrict anon read of restaurant_modules to publicly available restaurants

DROP POLICY IF EXISTS "anon read pre_orders module" ON public.restaurant_modules;
CREATE POLICY "anon read pre_orders module"
  ON public.restaurant_modules
  FOR SELECT
  TO anon
  USING (
    module_key = 'pre_orders'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_modules.restaurant_id
        AND r.is_active = true
        AND r.deleted_at IS NULL
    )
  );

-- 4) Prevent managers from granting the 'owner' role (privilege escalation)

DROP POLICY IF EXISTS "manager manage members" ON public.restaurant_members;
CREATE POLICY "manager manage members" ON public.restaurant_members
  FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (
    public.is_restaurant_manager(restaurant_id)
    AND (
      role <> 'owner'
      OR public.has_restaurant_role(restaurant_id, 'owner')
      OR public.is_system_admin()
    )
  );
