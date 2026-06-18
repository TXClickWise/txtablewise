
CREATE OR REPLACE FUNCTION public.get_invitation_link(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _inv public.member_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _inv FROM public.member_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Niet gevonden'; END IF;
  IF NOT (public.is_restaurant_manager(_inv.restaurant_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Geen rechten';
  END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'Uitnodiging is niet meer actief'; END IF;
  RETURN jsonb_build_object('token', _inv.token, 'email', _inv.email, 'expires_at', _inv.expires_at);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_invitation_link(uuid) TO authenticated;
