// Shared waitlist-notify helper. Called when a reservation is cancelled (by operator
// or guest) to find matching waitlist entries and emit notification events to ClickWise.
// Matches first 3 entries by FIFO, party_size <= cancelled.party_size, and time window
// overlap with flexible_minutes buffer.

// deno-lint-ignore no-explicit-any
export async function notifyWaitlistOnCancel(admin: any, cancelled: {
  restaurant_id: string;
  id: string;
  start_time: string;
  party_size: number;
  reservation_date: string;
}) {
  const startMs = new Date(cancelled.start_time).getTime();
  const date = cancelled.reservation_date;

  const { data: entries } = await admin
    .from("waitlist_entries")
    .select("id, party_size, desired_time_from, desired_time_to, flexible_minutes, status, notified_at")
    .eq("restaurant_id", cancelled.restaurant_id)
    .eq("desired_date", date)
    .eq("status", "waiting")
    .lte("party_size", cancelled.party_size)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!entries || entries.length === 0) return;

  const candidates: string[] = [];
  for (const e of entries) {
    if (e.notified_at) continue;
    const flex = (e.flexible_minutes ?? 30) * 60_000;
    const [fh, fm] = String(e.desired_time_from).split(":").map(Number);
    const [th, tm] = String(e.desired_time_to).split(":").map(Number);
    const fromMs = new Date(date).setHours(fh ?? 0, fm ?? 0, 0, 0);
    const toMs = new Date(date).setHours(th ?? 23, tm ?? 59, 0, 0);
    if (startMs >= fromMs - flex && startMs <= toMs + flex) {
      candidates.push(e.id);
      if (candidates.length >= 3) break;
    }
  }

  for (const id of candidates) {
    await admin.from("waitlist_entries")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", id);
    await admin.from("integration_events").insert({
      restaurant_id: cancelled.restaurant_id,
      event_type: "waitlist.notification_requested",
      target: "clickwise",
      payload: {
        waitlist_entry_id: id,
        trigger: "reservation.cancelled",
        cancelled_reservation_id: cancelled.id,
        start_time: cancelled.start_time,
        party_size: cancelled.party_size,
      },
    });
  }
}
