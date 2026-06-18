import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "host" | "staff";

export type RestaurantMember = {
  member_id: string;
  user_id: string;
  role: AppRole;
  display_name: string;
  email: string;
  created_at: string;
};

export type MemberInvitation = {
  id: string;
  restaurant_id: string;
  email: string;
  role: AppRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  invited_by: string | null;
};

export async function listMembers(restaurantId: string): Promise<RestaurantMember[]> {
  const { data, error } = await supabase.rpc("list_restaurant_members", {
    _restaurant_id: restaurantId,
  });
  if (error) throw error;
  return (data ?? []) as RestaurantMember[];
}

export async function listPendingInvitations(restaurantId: string): Promise<MemberInvitation[]> {
  const { data, error } = await supabase
    .from("member_invitations")
    .select("id, restaurant_id, email, role, status, expires_at, created_at, invited_by")
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MemberInvitation[];
}

export async function inviteMember(
  restaurantId: string,
  email: string,
  role: Exclude<AppRole, "owner">
): Promise<{ invitation_id: string }> {
  const { data, error } = await supabase.rpc("invite_member", {
    _restaurant_id: restaurantId,
    _email: email,
    _role: role,
  });
  if (error) throw error;
  const invitationId = (data as any)?.invitation_id;
  if (!invitationId) throw new Error("Geen invitation_id terug");
  const { error: sendErr } = await supabase.functions.invoke("send-member-invite", {
    body: { invitationId },
  });
  if (sendErr) throw sendErr;
  return { invitation_id: invitationId };
}

export async function revokeInvitation(invitationId: string) {
  const { error } = await supabase.rpc("revoke_member_invitation", {
    _invitation_id: invitationId,
  });
  if (error) throw error;
}

export async function resendInvitation(invitationId: string) {
  const { error } = await supabase.rpc("resend_member_invitation", {
    _invitation_id: invitationId,
  });
  if (error) throw error;
  const { error: sendErr } = await supabase.functions.invoke("send-member-invite", {
    body: { invitationId },
  });
  if (sendErr) throw sendErr;
}

export async function updateMemberRole(memberId: string, role: Exclude<AppRole, "owner">) {
  const { error } = await supabase.rpc("update_member_role", {
    _member_id: memberId,
    _role: role,
  });
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.rpc("remove_member", { _member_id: memberId });
  if (error) throw error;
}

export type InvitationPreview =
  | { valid: true; email: string; role: AppRole; restaurant_name: string; expires_at: string }
  | { valid: false; reason: string };

export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  const { data, error } = await supabase.rpc("get_invitation_preview", { _token: token });
  if (error) throw error;
  return data as InvitationPreview;
}

export async function acceptInvitation(token: string): Promise<{ restaurant_id: string; role: AppRole }> {
  const { data, error } = await supabase.rpc("accept_member_invitation", { _token: token });
  if (error) throw error;
  return data as { restaurant_id: string; role: AppRole };
}
