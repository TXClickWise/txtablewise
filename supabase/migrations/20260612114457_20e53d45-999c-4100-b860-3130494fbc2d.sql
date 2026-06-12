
DROP POLICY IF EXISTS "self insert as owner" ON public.restaurant_members;

REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, slug, timezone, locale, is_live,
  max_party_size_online, large_group_threshold, large_group_manual_approval_from,
  large_group_extra_info_from, large_group_max_online_request,
  extra_large_group_threshold, large_group_confirmation_text,
  preorders_enabled, preorders_allow_free_text, allow_zone_preference,
  brand_primary, logo_url, booking_horizon_days
) ON public.restaurants TO anon;

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_reservation_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_table_booking_overlap() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_clickwise_admin_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_restaurant_admin_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_reservation_email() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_clickwise_addon_ts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.create_restaurant_with_owner(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.restaurant_plan(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_restaurant_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_restaurant_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_restaurant_manager(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_system_admin() FROM anon, public;
