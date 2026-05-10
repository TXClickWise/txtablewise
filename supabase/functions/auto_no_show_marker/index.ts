// auto_no_show_marker — scheduled job.
// Vindt reserveringen die te lang te laat zijn en markeert ze als no_show,
// maar alleen voor restaurants die deze functie expliciet hebben aangezet.
// Wordt periodiek (elke 5 min) aangeroepen via pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Fetch restaurants with auto-mark enabled.
    const { data: restaurants, error: rErr } = await supabase
      .from("restaurants")
      .select("id, noshow_auto_mark_grace_minutes")
      .eq("noshow_auto_mark_enabled", true);

    if (rErr) throw rErr;
    if (!restaurants || restaurants.length === 0) {
      return new Response(JSON.stringify({ ok: true, marked: 0, restaurants: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let totalMarked = 0;
    const details: Array<{ restaurant_id: string; marked: number }> = [];

    for (const r of restaurants) {
      const grace = Math.max(5, r.noshow_auto_mark_grace_minutes ?? 20);
      const cutoff = new Date(now.getTime() - grace * 60_000).toISOString();

      // Find candidate reservations: confirmed or pending, start_time < cutoff, not yet seated/completed/cancelled
      const { data: candidates, error: cErr } = await supabase
        .from("reservations")
        .select("id")
        .eq("restaurant_id", r.id)
        .in("status", ["pending", "confirmed"])
        .lt("start_time", cutoff)
        .limit(50);

      if (cErr) {
        console.error("[auto_no_show] fetch failed", r.id, cErr.message);
        continue;
      }

      let marked = 0;
      for (const res of candidates ?? []) {
        const { error: uErr } = await supabase
          .from("reservations")
          .update({
            status: "no_show",
            no_show_marked_at: now.toISOString(),
          })
          .eq("id", res.id)
          .in("status", ["pending", "confirmed"]); // double-check

        if (!uErr) {
          marked += 1;
          // Audit
          await supabase.from("audit_log").insert({
            restaurant_id: r.id,
            actor_label: "system:auto_no_show_marker",
            action: "reservation.auto_no_show",
            entity: "reservation",
            entity_id: res.id,
            after_data: { grace_minutes: grace },
          });
          // Integration event (ClickWise pickup)
          await supabase.from("integration_events").insert({
            restaurant_id: r.id,
            entity_type: "reservation",
            entity_id: res.id,
            event_type: "reservation.no_show",
            payload: { reservation_id: res.id, auto: true, grace_minutes: grace },
          });
        }
      }
      if (marked > 0) details.push({ restaurant_id: r.id, marked });
      totalMarked += marked;
    }

    return new Response(
      JSON.stringify({ ok: true, restaurants: restaurants.length, marked: totalMarked, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[auto_no_show] error", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
