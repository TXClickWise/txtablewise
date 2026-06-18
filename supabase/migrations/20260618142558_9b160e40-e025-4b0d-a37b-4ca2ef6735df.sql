
-- ============================================================
-- Team member invitations
-- ============================================================

CREATE TABLE public.member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_invitations_role_check CHECK (role IN ('manager','host','staff')),
  CONSTRAINT member_invitations_status_check CHECK (status IN ('pending','accepted','revoked','expired'))
);

CREATE UNIQUE INDEX member_invitations_unique_pending
  ON public.member_invitations(restaurant_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT ON public.member_invitations TO authenticated;
GRANT ALL ON public.member_invitations TO service_role;

ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read invitations"
  ON public.member_invitations FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id) OR public.is_system_admin());

CREATE TRIGGER update_member_invitations_updated_at
  BEFORE UPDATE ON public.member_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RPC: invite a member (manager/owner only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.invite_member(
  _restaurant_id uuid, _email text, _role public.app_role
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email_norm text := lower(trim(_email));
  _inv public.member_invitations%ROWTYPE;
  _existing_user_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_restaurant_manager(_restaurant_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Only owners or managers can invite members';
  END IF;
  IF _role NOT IN ('manager','host','staff') THEN
    RAISE EXCEPTION 'Invalid role for invitation';
  END IF;
  IF _email_norm IS NULL OR _email_norm = '' OR _email_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  -- Already a member?
  SELECT u.id INTO _existing_user_id FROM auth.users u WHERE lower(u.email) = _email_norm LIMIT 1;
  IF _existing_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.restaurant_members
    WHERE restaurant_id = _restaurant_id AND user_id = _existing_user_id
  ) THEN
    RAISE EXCEPTION 'Deze gebruiker is al lid van dit restaurant';
  END IF;

  -- Reuse existing pending invite (refresh token + expiry + role)
  SELECT * INTO _inv FROM public.member_invitations
   WHERE restaurant_id = _restaurant_id
     AND lower(email) = _email_norm
     AND status = 'pending'
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.member_invitations
       SET role = _role,
           token = gen_random_uuid(),
           expires_at = now() + interval '14 days',
           invited_by = _uid,
           updated_at = now()
     WHERE id = _inv.id
     RETURNING * INTO _inv;
  ELSE
    INSERT INTO public.member_invitations (restaurant_id, email, role, invited_by)
    VALUES (_restaurant_id, _email_norm, _role, _uid)
    RETURNING * INTO _inv;
  END IF;

  INSERT INTO public.audit_log (restaurant_id, action, entity, actor_user_id, after_data)
  VALUES (_restaurant_id, 'member.invited', 'member_invitation', _uid,
          jsonb_build_object('invitation_id', _inv.id, 'email', _email_norm, 'role', _role));

  RETURN jsonb_build_object(
    'invitation_id', _inv.id,
    'token', _inv.token,
    'email', _inv.email,
    'role', _inv.role,
    'expires_at', _inv.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_member(uuid, text, public.app_role) TO authenticated;

-- ============================================================
-- RPC: get invitation preview (by token)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _inv public.member_invitations%ROWTYPE;
  _restaurant_name text;
BEGIN
  SELECT * INTO _inv FROM public.member_invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF _inv.status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'reason', _inv.status);
  END IF;
  IF _inv.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  SELECT name INTO _restaurant_name FROM public.restaurants WHERE id = _inv.restaurant_id;
  RETURN jsonb_build_object(
    'valid', true,
    'email', _inv.email,
    'role', _inv.role,
    'restaurant_name', _restaurant_name,
    'expires_at', _inv.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid) TO anon, authenticated;

-- ============================================================
-- RPC: accept invitation (logged-in user, matching email)
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_member_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _user_email text;
  _inv public.member_invitations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = _uid;
  IF _user_email IS NULL THEN RAISE EXCEPTION 'No email on account'; END IF;

  SELECT * INTO _inv FROM public.member_invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Uitnodiging niet gevonden'; END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'Deze uitnodiging is niet meer geldig'; END IF;
  IF _inv.expires_at <= now() THEN
    UPDATE public.member_invitations SET status = 'expired' WHERE id = _inv.id;
    RAISE EXCEPTION 'Deze uitnodiging is verlopen';
  END IF;
  IF lower(_inv.email) <> _user_email THEN
    RAISE EXCEPTION 'Deze uitnodiging is voor een ander e-mailadres (%). Log in met dat adres.', _inv.email;
  END IF;

  INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
  VALUES (_inv.restaurant_id, _uid, _inv.role)
  ON CONFLICT (restaurant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.member_invitations
     SET status = 'accepted', accepted_at = now(), accepted_by = _uid
   WHERE id = _inv.id;

  INSERT INTO public.audit_log (restaurant_id, action, entity, actor_user_id, after_data)
  VALUES (_inv.restaurant_id, 'invitation.accepted', 'member_invitation', _uid,
          jsonb_build_object('invitation_id', _inv.id, 'role', _inv.role));

  RETURN jsonb_build_object('restaurant_id', _inv.restaurant_id, 'role', _inv.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_member_invitation(uuid) TO authenticated;

-- ============================================================
-- RPC: revoke / resend invitation
-- ============================================================

CREATE OR REPLACE FUNCTION public.revoke_member_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _rid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT restaurant_id INTO _rid FROM public.member_invitations WHERE id = _invitation_id;
  IF _rid IS NULL THEN RAISE EXCEPTION 'Niet gevonden'; END IF;
  IF NOT (public.is_restaurant_manager(_rid) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Geen rechten';
  END IF;
  UPDATE public.member_invitations SET status = 'revoked' WHERE id = _invitation_id AND status = 'pending';
  INSERT INTO public.audit_log (restaurant_id, action, entity, actor_user_id, after_data)
  VALUES (_rid, 'invitation.revoked', 'member_invitation', _uid, jsonb_build_object('invitation_id', _invitation_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_member_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resend_member_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _inv public.member_invitations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _inv FROM public.member_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Niet gevonden'; END IF;
  IF NOT (public.is_restaurant_manager(_inv.restaurant_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Geen rechten';
  END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'Uitnodiging is niet meer actief'; END IF;
  UPDATE public.member_invitations
     SET token = gen_random_uuid(), expires_at = now() + interval '14 days', updated_at = now()
   WHERE id = _invitation_id
   RETURNING * INTO _inv;
  RETURN jsonb_build_object('invitation_id', _inv.id, 'token', _inv.token, 'email', _inv.email, 'role', _inv.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resend_member_invitation(uuid) TO authenticated;

-- ============================================================
-- RPC: update role / remove member
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_member_role(_member_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _m public.restaurant_members%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _m FROM public.restaurant_members WHERE id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lid niet gevonden'; END IF;
  IF NOT (public.is_restaurant_manager(_m.restaurant_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Geen rechten';
  END IF;
  IF _m.role = 'owner' THEN RAISE EXCEPTION 'Eigenaar kan niet worden gewijzigd via deze actie'; END IF;
  IF _role = 'owner' THEN RAISE EXCEPTION 'Eigenaar-rol kan niet worden toegekend via deze actie'; END IF;
  IF _m.user_id = _uid THEN RAISE EXCEPTION 'Je kunt je eigen rol niet wijzigen'; END IF;

  UPDATE public.restaurant_members SET role = _role WHERE id = _member_id;
  INSERT INTO public.audit_log (restaurant_id, action, entity, actor_user_id, after_data)
  VALUES (_m.restaurant_id, 'member.role_changed', 'restaurant_member', _uid,
          jsonb_build_object('member_id', _member_id, 'new_role', _role));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_member(_member_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _m public.restaurant_members%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _m FROM public.restaurant_members WHERE id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lid niet gevonden'; END IF;
  IF NOT (public.is_restaurant_manager(_m.restaurant_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Geen rechten';
  END IF;
  IF _m.role = 'owner' THEN RAISE EXCEPTION 'Eigenaar kan niet worden verwijderd'; END IF;
  IF _m.user_id = _uid THEN RAISE EXCEPTION 'Je kunt jezelf niet verwijderen'; END IF;

  DELETE FROM public.restaurant_members WHERE id = _member_id;
  INSERT INTO public.audit_log (restaurant_id, action, entity, actor_user_id, after_data)
  VALUES (_m.restaurant_id, 'member.removed', 'restaurant_member', _uid,
          jsonb_build_object('member_id', _member_id, 'user_id', _m.user_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;

-- ============================================================
-- RPC: list members (with profile/email enrichment) for managers
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_restaurant_members(_restaurant_id uuid)
RETURNS TABLE (
  member_id uuid,
  user_id uuid,
  role public.app_role,
  display_name text,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_restaurant_member(_restaurant_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Geen rechten';
  END IF;
  RETURN QUERY
    SELECT rm.id, rm.user_id, rm.role,
           COALESCE(p.display_name, ''),
           COALESCE(u.email, ''),
           rm.created_at
      FROM public.restaurant_members rm
      LEFT JOIN public.profiles p ON p.user_id = rm.user_id
      LEFT JOIN auth.users u ON u.id = rm.user_id
     WHERE rm.restaurant_id = _restaurant_id
     ORDER BY CASE rm.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'host' THEN 2 ELSE 3 END,
              rm.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_restaurant_members(uuid) TO authenticated;
