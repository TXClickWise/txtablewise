import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StepStatus } from "./StepStatusBadge";

export type WizardStepKey =
  | "restaurant"
  | "hours"
  | "tables_zones"
  | "rules"
  | "online_widget"
  | "walkins_waitlist"
  | "noshow"
  | "messages"
  | "ai_voice"
  | "clickwise"
  | "api_webhooks"
  | "test_reservation";

export type StepStatusMap = Record<WizardStepKey, StepStatus>;

export function useStepStatuses(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["onboarding-step-statuses", restaurantId],
    enabled: !!restaurantId,
    queryFn: async (): Promise<StepStatusMap> => {
      const rid = restaurantId!;

      const [
        { data: restaurant },
        { count: hoursCount },
        { count: tablesCount },
        { count: agentKeyCount },
        { count: apiTokenCount },
        { data: lastTestRes },
        { data: lastWebhookLog },
      ] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", rid).maybeSingle(),
        supabase
          .from("opening_hours")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", rid),
        supabase
          .from("tables")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", rid)
          .eq("is_active", true),
        supabase
          .from("agent_api_keys")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", rid)
          .is("revoked_at", null),
        supabase
          .from("api_tokens")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", rid)
          .is("revoked_at", null),
        supabase
          .from("reservations")
          .select("id, source_metadata, created_at")
          .eq("restaurant_id", rid)
          .contains("source_metadata", { test: true })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("integration_logs")
          .select("status, created_at")
          .eq("restaurant_id", rid)
          .eq("source", "webhook")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const r: any = restaurant ?? {};

      const restaurantDone = !!(r.name && r.phone && r.email && r.address_line1 && r.city);
      const hoursDone = (hoursCount ?? 0) > 0;
      const tablesDone = (tablesCount ?? 0) > 0;
      const rulesDone = !!(r.default_reservation_minutes && r.slot_duration_minutes);
      const widgetDone = !!r.slug;
      const walkinsDone = !!r.walkins_enabled || !!r.waitlist_enabled;
      const noshowDone =
        !!r.noshow_confirmation_enabled ||
        !!r.noshow_reminder_24h_enabled ||
        !!r.noshow_reminder_2h_enabled;
      const messagesDone =
        !!r.noshow_confirmation_enabled && !!r.noshow_reminder_24h_enabled;
      const aiVoiceDone = (agentKeyCount ?? 0) > 0;
      const clickwiseConfigured = !!r.metadata?.clickwise_connected;
      const webhookConfigured = !!r.webhook_url;
      const webhookFailing =
        webhookConfigured && lastWebhookLog?.status === "failed";
      const apiDone = (apiTokenCount ?? 0) > 0 || webhookConfigured;
      const testDone = !!lastTestRes;

      const skipped: Record<string, boolean> =
        (r.metadata?.onboarding_skipped as Record<string, boolean>) ?? {};
      const withSkip = (key: WizardStepKey, status: StepStatus): StepStatus =>
        status === "done" ? "done" : skipped[key] ? "skipped" : status;

      return {
        restaurant: withSkip("restaurant", restaurantDone ? "done" : r.name ? "in_progress" : "not_started"),
        hours: withSkip("hours", hoursDone ? "done" : "not_started"),
        tables_zones: withSkip("tables_zones", tablesDone ? "done" : "not_started"),
        rules: withSkip("rules", rulesDone ? "done" : "not_started"),
        online_widget: withSkip("online_widget", widgetDone ? "done" : "not_started"),
        walkins_waitlist: withSkip("walkins_waitlist", walkinsDone ? "done" : "not_started"),
        noshow: withSkip("noshow", noshowDone ? "done" : "not_started"),
        messages: withSkip("messages", messagesDone ? "done" : noshowDone ? "in_progress" : "not_started"),
        ai_voice: withSkip("ai_voice", aiVoiceDone ? "done" : "not_started"),
        clickwise: withSkip("clickwise", clickwiseConfigured ? "done" : "not_started"),
        api_webhooks: withSkip(
          "api_webhooks",
          webhookFailing ? "attention" : apiDone ? "done" : "not_started",
        ),
        test_reservation: withSkip("test_reservation", testDone ? "done" : "not_started"),
      };
    },
  });
}
