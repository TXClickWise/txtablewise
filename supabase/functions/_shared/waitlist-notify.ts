// Shared waitlist-notify helper. Called when a reservation is cancelled (by operator
// or guest) to find matching waitlist entries and emit notification events to ClickWise.
// Matches first 3 entries by FIFO, party_size <= cancelled.party_size, and time window
// overlap with flexible_minutes buffer.

// deno-lint-ignore no-explicit-any
export async function notifyWaitlistOnCancel(admin: any, cancelled: {
  restaurant_id: string;
  id: string;
  start_time: string;            // ISO UTC
  party_size: number;
  reservation_date: string;      // YYYY-MM-DD (restaurant-local)
}) {
  // Resolve restaurant timezone so we can compare HH:MM correctly.
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("timezone")
    .eq("id", cancelled.restaurant_id)
    .maybeSingle();
  const tz = restaurant?.timezone ?? "Europe/Amsterdam";

  // Convert reservation start_time (UTC) to HH:MM in the restaurant's local timezone.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date(cancelled.start_time));
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const startLocalMin = hh * 60 + mm;

  const { data: entries } = await admin
    .from("waitlist_entries")
    .select("id, party_size, desired_time_from, desired_time_to, flexible_minutes, status, notified_at")
    .eq("restaurant_id", cancelled.restaurant_id)
    .eq("desired_date", cancelled.reservation_date)
    .eq("status", "waiting")
    .lte("party_size", cancelled.party_size)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!entries || entries.length === 0) return;

  const candidates: string[] = [];
  for (const e of entries) {
    if (e.notified_at) continue;
    const flex = e.flexible_minutes ?? 30;
    const [fh, fm] = String(e.desired_time_from).split(":").map(Number);
    const [th, tm] = String(e.desired_time_to).split(":").map(Number);
    const fromMin = (fh ?? 0) * 60 + (fm ?? 0);
    const toMin = (th ?? 23) * 60 + (tm ?? 59);
    if (startLocalMin >= fromMin - flex && startLocalMin <= toMin + flex) {
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
