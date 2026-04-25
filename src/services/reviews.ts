// Reviews & aftercare service — voorbereid voor ClickWise; geen echte externe verzending.
import { supabase } from "@/integrations/supabase/client";

export type ReviewStatus =
  | "pending" | "ready_to_send" | "sent" | "responded"
  | "positive" | "neutral" | "negative" | "follow_up_required"
  | "google_review_invited" | "skipped" | "failed";

export type FollowUpStatus = "open" | "in_progress" | "resolved" | "dismissed";

export type ReviewRequest = {
  id: string;
  restaurant_id: string;
  reservation_id: string;
  guest_id: string | null;
  status: ReviewStatus;
  scheduled_for: string;
  sent_at: string | null;
  responded_at: string | null;
  satisfaction: number | null;
  feedback_text: string | null;
  feedback_type: string | null;
  follow_up_status: FollowUpStatus | null;
  follow_up_owner_id: string | null;
  follow_up_due_at: string | null;
  internal_note: string | null;
  google_review_requested: boolean;
  manager_follow_up_required: boolean;
  public_review_url: string | null;
  source_channel: string | null;
  clickwise_workflow_id: string | null;
  routed_to: string | null;
  metadata: Record<string, unknown>;
  token: string;
  created_at: string;
  updated_at: string;
};

export type ReviewWithReservation = ReviewRequest & {
  reservations: {
    id: string;
    reservation_date: string;
    start_time: string;
    party_size: number;
    status: string;
    guests: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
  } | null;
};

const RESERVATION_SELECT =
  "id, reservation_date, start_time, party_size, status, guests:guest_id(first_name,last_name,email,phone)";

// ---------- Audit + integration events ----------

async function createAuditLog(restaurantId: string, action: string, entityId: string, after: Record<string, unknown> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert([{
    restaurant_id: restaurantId,
    entity: "review_request",
    entity_id: entityId,
    action,
    actor_user_id: user?.id ?? null,
    actor_label: user?.email ?? "system",
    after_data: after as never,
  }]);
}

async function createIntegrationEvent(restaurantId: string, eventType: string, payload: Record<string, unknown>) {
  await supabase.from("integration_events").insert([{
    restaurant_id: restaurantId,
    event_type: eventType,
    payload: payload as never,
    status: "pending",
    target: "clickwise",
  }]);
}

// ---------- Trigger after completed reservation ----------

export async function createReviewRequestForReservation(reservationId: string): Promise<{ ok: boolean; created: boolean; id?: string; error?: string }> {
  const { data: r, error: rErr } = await supabase
    .from("reservations")
    .select("id, restaurant_id, guest_id, status, reservation_date, start_time, channel, guests:guest_id(email, phone)")
    .eq("id", reservationId)
    .maybeSingle();
  if (rErr || !r) return { ok: false, created: false, error: rErr?.message ?? "Reservering niet gevonden." };

  // "completed" mapped to enum "finished" in db; accept both for safety
  const completedStatuses = ["finished", "completed"] as const;
  if (!completedStatuses.includes(r.status as typeof completedStatuses[number])) {
    return { ok: false, created: false, error: "Aftercare start nadat het bezoek is afgerond." };
  }

  // No aftercare for cancelled/no_show — already filtered above. Skip walk-in without contact.
  const hasContact = !!(r.guests?.email || r.guests?.phone);
  if (!hasContact && r.channel === "walk_in") {
    return { ok: false, created: false, error: "Geen contactgegevens om aftercare voor te bereiden." };
  }

  // Avoid duplicates
  const { data: existing } = await supabase
    .from("review_requests")
    .select("id")
    .eq("reservation_id", reservationId)
    .maybeSingle();
  if (existing) return { ok: true, created: false, id: existing.id };

  // Schedule next morning 10:00 local-ish (simple: +14h after completion proxy)
  const scheduledFor = new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString();

  const { data: ins, error } = await supabase
    .from("review_requests")
    .insert({
      restaurant_id: r.restaurant_id,
      reservation_id: r.id,
      guest_id: r.guest_id,
      status: "ready_to_send",
      scheduled_for: scheduledFor,
      source_channel: r.channel,
    })
    .select("id")
    .single();
  if (error) return { ok: false, created: false, error: error.message };

  await createAuditLog(r.restaurant_id, "review.request.created", ins.id, { reservation_id: r.id });
  await createIntegrationEvent(r.restaurant_id, "review.requested", {
    reservation_id: r.id, review_request_id: ins.id, guest_id: r.guest_id,
  });

  return { ok: true, created: true, id: ins.id };
}

// ---------- Listing & stats ----------

export type ReviewFilter =
  | "all" | "ready_to_send" | "responded" | "positive" | "neutral"
  | "negative" | "follow_up" | "google_invited" | "skipped" | "failed";

export async function getReviewRequests(restaurantId: string, filter: ReviewFilter = "all"): Promise<ReviewWithReservation[]> {
  let q = supabase
    .from("review_requests")
    .select(`*, reservations:reservation_id(${RESERVATION_SELECT})`)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(200);

  switch (filter) {
    case "ready_to_send": q = q.eq("status", "ready_to_send"); break;
    case "responded":     q = q.not("responded_at", "is", null); break;
    case "positive":      q = q.eq("status", "positive"); break;
    case "neutral":       q = q.eq("status", "neutral"); break;
    case "negative":      q = q.eq("status", "negative"); break;
    case "follow_up":     q = q.eq("manager_follow_up_required", true); break;
    case "google_invited":q = q.eq("google_review_requested", true); break;
    case "skipped":       q = q.eq("status", "skipped"); break;
    case "failed":        q = q.eq("status", "failed"); break;
    default: break;
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ReviewWithReservation[];
}

export type AftercareStats = {
  ready: number; responded: number; positive: number; neutral: number; negative: number;
  followUp: number; googleInvited: number; skipped: number; total: number;
  averageScore: number | null;
};

export async function getAftercareDashboardStats(restaurantId: string): Promise<AftercareStats> {
  const { data } = await supabase
    .from("review_requests")
    .select("status, satisfaction, manager_follow_up_required, google_review_requested, responded_at, follow_up_status")
    .eq("restaurant_id", restaurantId)
    .limit(1000);
  const rows = data ?? [];
  const scores = rows.map((r) => r.satisfaction).filter((s): s is number => typeof s === "number");
  return {
    ready: rows.filter((r) => r.status === "ready_to_send").length,
    responded: rows.filter((r) => !!r.responded_at).length,
    positive: rows.filter((r) => r.status === "positive" || r.status === "google_review_invited").length,
    neutral: rows.filter((r) => r.status === "neutral").length,
    negative: rows.filter((r) => r.status === "negative").length,
    followUp: rows.filter((r) => r.manager_follow_up_required && r.follow_up_status !== "resolved").length,
    googleInvited: rows.filter((r) => r.google_review_requested).length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    total: rows.length,
    averageScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
  };
}

// ---------- Feedback recording ----------

export type RecordFeedbackInput = {
  rating: number; // 1-5
  feedbackText?: string;
  feedbackType?: string;
  internalNote?: string;
  followUpRequired?: boolean;
  followUpOwnerId?: string | null;
  followUpDueAt?: string | null;
};

export function classifyRating(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

export async function recordGuestFeedback(reviewId: string, input: RecordFeedbackInput) {
  if (input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "Kies een score tussen 1 en 5." };
  }
  const cls = classifyRating(input.rating);
  const status: ReviewStatus = cls === "positive" ? "positive" : cls === "neutral" ? "neutral" : "negative";
  const followUp = input.followUpRequired || cls === "negative";

  const { data, error } = await supabase
    .from("review_requests")
    .update({
      satisfaction: input.rating,
      feedback_text: input.feedbackText ?? null,
      feedback_type: input.feedbackType ?? cls,
      internal_note: input.internalNote ?? null,
      responded_at: new Date().toISOString(),
      status,
      manager_follow_up_required: followUp,
      follow_up_status: followUp ? "open" : null,
      follow_up_owner_id: input.followUpOwnerId ?? null,
      follow_up_due_at: input.followUpDueAt ?? null,
    })
    .eq("id", reviewId)
    .select("id, restaurant_id, reservation_id")
    .single();
  if (error) return { ok: false, error: error.message };

  const evt = cls === "positive"
    ? "review.positive_feedback"
    : cls === "neutral" ? "review.neutral_feedback" : "review.negative_feedback";
  await createIntegrationEvent(data.restaurant_id, "review.feedback_received", { review_request_id: data.id, rating: input.rating });
  await createIntegrationEvent(data.restaurant_id, evt, { review_request_id: data.id, rating: input.rating });
  if (followUp) await createIntegrationEvent(data.restaurant_id, "review.follow_up_required", { review_request_id: data.id });
  await createAuditLog(data.restaurant_id, "review.feedback_recorded", data.id, { rating: input.rating, status });
  if (followUp) await createAuditLog(data.restaurant_id, "review.follow_up_required", data.id, {});
  return { ok: true };
}

export async function prepareGoogleReviewInvite(reviewId: string) {
  const { data: existing } = await supabase
    .from("review_requests")
    .select("id, restaurant_id, satisfaction, status")
    .eq("id", reviewId).maybeSingle();
  if (!existing) return { ok: false, error: "Reviewverzoek niet gevonden." };
  if (existing.satisfaction !== null && existing.satisfaction !== undefined && existing.satisfaction < 4) {
    return { ok: false, error: "Vraag eerst om persoonlijke opvolging voordat je een publieke review uitnodigt." };
  }
  const { error } = await supabase
    .from("review_requests")
    .update({ google_review_requested: true, status: "google_review_invited" })
    .eq("id", reviewId);
  if (error) return { ok: false, error: error.message };

  await createIntegrationEvent(existing.restaurant_id, "review.google_invite_requested", { review_request_id: reviewId });
  await createAuditLog(existing.restaurant_id, "review.google_invite_requested", reviewId, {});
  return { ok: true };
}

export async function markReviewFollowUpRequired(reviewId: string, ownerId?: string | null, dueAt?: string | null, note?: string) {
  const { data, error } = await supabase
    .from("review_requests")
    .update({
      manager_follow_up_required: true,
      follow_up_status: "open",
      follow_up_owner_id: ownerId ?? null,
      follow_up_due_at: dueAt ?? null,
      internal_note: note ?? null,
    })
    .eq("id", reviewId).select("restaurant_id").single();
  if (error) return { ok: false, error: error.message };
  await createIntegrationEvent(data.restaurant_id, "review.manager_task_requested", { review_request_id: reviewId });
  await createAuditLog(data.restaurant_id, "review.follow_up_required", reviewId, {});
  return { ok: true };
}

export async function markReviewFollowUpCompleted(reviewId: string, note?: string) {
  const { data, error } = await supabase
    .from("review_requests")
    .update({
      follow_up_status: "resolved",
      manager_follow_up_required: false,
      internal_note: note ?? undefined,
    })
    .eq("id", reviewId).select("restaurant_id").single();
  if (error) return { ok: false, error: error.message };
  await createAuditLog(data.restaurant_id, "review.follow_up_completed", reviewId, {});
  return { ok: true };
}

export async function skipReviewRequest(reviewId: string, reason?: string) {
  const { data, error } = await supabase
    .from("review_requests")
    .update({ status: "skipped", internal_note: reason ?? null })
    .eq("id", reviewId).select("restaurant_id").single();
  if (error) return { ok: false, error: error.message };
  await createIntegrationEvent(data.restaurant_id, "review.skipped", { review_request_id: reviewId });
  await createAuditLog(data.restaurant_id, "review.skipped", reviewId, { reason });
  return { ok: true };
}

export async function getGuestReviewHistory(guestId: string): Promise<ReviewRequest[]> {
  const { data, error } = await supabase
    .from("review_requests")
    .select("*")
    .eq("guest_id", guestId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as ReviewRequest[];
}

export async function getReviewByReservation(reservationId: string): Promise<ReviewRequest | null> {
  const { data } = await supabase
    .from("review_requests")
    .select("*")
    .eq("reservation_id", reservationId)
    .maybeSingle();
  return (data as unknown as ReviewRequest) ?? null;
}

// ---------- Templates ----------

export const aftercareTemplates = {
  thankYou: (restaurantName: string) =>
    `Bedankt voor je bezoek aan ${restaurantName}. We hopen dat je een fijne tijd hebt gehad.`,
  satisfaction: () => `Hoe heb je je bezoek ervaren?`,
  positive: () => `Wat fijn om te horen. Wil je ons helpen met een korte Google Review?`,
  neutral: () => `Bedankt voor je feedback. We nemen dit mee om onze gastbeleving verder te verbeteren.`,
  negative: () => `Wat vervelend dat je bezoek niet was zoals verwacht. We nemen graag persoonlijk contact met je op.`,
  returnOffer: () => `Leuk als we je binnenkort weer mogen ontvangen.`,
};
