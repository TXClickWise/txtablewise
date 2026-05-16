import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

type Props = { restaurantId: string };

export function WebhookHealthBadge({ restaurantId }: Props) {
  const { data } = useQuery({
    queryKey: ["webhook-health", restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const [{ data: logs }, { data: pending }] = await Promise.all([
        (supabase as any).from("integration_logs")
          .select("status, created_at")
          .eq("restaurant_id", restaurantId)
          .eq("action", "webhook_delivery")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("integration_events")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .eq("status", "pending"),
      ]);
      const rows = (logs ?? []) as Array<{ status: string; created_at: string }>;
      const total = rows.length;
      const success = rows.filter((r) => r.status === "success").length;
      const failed = rows.filter((r) => r.status === "failed").length;
      const lastSuccess = rows.find((r) => r.status === "success")?.created_at ?? null;
      const successRate = total ? Math.round((success / total) * 100) : null;
      return {
        total,
        success,
        failed,
        successRate,
        lastSuccess,
        pendingCount: (pending as any)?.count ?? 0,
      };
    },
  });

  if (!data) return null;

  const { successRate, success, failed, pendingCount, lastSuccess, total } = data;
  const tone: "ok" | "warn" | "bad" | "idle" =
    total === 0 ? "idle"
    : successRate !== null && successRate >= 95 ? "ok"
    : successRate !== null && successRate >= 70 ? "warn"
    : "bad";

  const toneClasses: Record<typeof tone, string> = {
    ok: "border-status-confirmed/40 bg-status-confirmed/5",
    warn: "border-status-pending/40 bg-status-pending/5",
    bad: "border-destructive/40 bg-destructive/5",
    idle: "border-border bg-muted/30",
  };
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : tone === "bad" ? XCircle : Activity;
  const iconColor = tone === "ok" ? "text-status-confirmed" : tone === "warn" ? "text-status-pending" : tone === "bad" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className={`p-4 ${toneClasses[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-medium text-sm">Webhook-status (24u)</h3>
            {successRate !== null && (
              <span className="text-xs font-mono">{successRate}% geslaagd</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 grid grid-cols-3 gap-2">
            <div>
              <div className="text-foreground font-medium">{success}</div>
              <div>geslaagd</div>
            </div>
            <div>
              <div className="text-foreground font-medium">{failed}</div>
              <div>mislukt</div>
            </div>
            <div>
              <div className="text-foreground font-medium">{pendingCount}</div>
              <div>in wachtrij</div>
            </div>
          </div>
          {lastSuccess ? (
            <p className="text-xs text-muted-foreground mt-2">
              Laatste succesvolle bezorging {formatDistanceToNow(new Date(lastSuccess), { addSuffix: true, locale: nl })}
            </p>
          ) : total === 0 ? (
            <p className="text-xs text-muted-foreground mt-2 italic">
              Nog geen webhook-activiteit in de laatste 24 uur.
            </p>
          ) : (
            <p className="text-xs text-destructive mt-2">
              Geen succesvolle bezorging in de laatste 24 uur.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
