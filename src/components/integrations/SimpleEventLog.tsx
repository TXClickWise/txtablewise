import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { listIntegrationLogs, type IntegrationLog } from "@/services/integrationLogs";
import { toast } from "sonner";

/**
 * Mensentaal-mapping voor technische action codes.
 * Onbekende acties worden netjes weergegeven (underscores → spaties).
 */
const ACTION_LABEL: Record<string, string> = {
  check_availability: "Beschikbaarheid gecheckt",
  create_reservation: "Reservering aangemaakt",
  cancel_reservation: "Reservering geannuleerd",
  update_reservation: "Reservering gewijzigd",
  webhook_delivery: "Bericht verstuurd naar ClickWise",
  reservation_request: "AI Voice reserveringsverzoek",
};

const SOURCE_LABEL: Record<string, string> = {
  api: "API",
  voice_agent: "AI Voice",
  webhook: "Webhook",
  clickwise: "ClickWise",
  widget: "Widget",
  dashboard: "Dashboard",
  other: "Overig",
};

function prettyAction(a: string) {
  return ACTION_LABEL[a] ?? a.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function StatusIcon({ status }: { status: IntegrationLog["status"] }) {
  if (status === "success")
    return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (status === "warning")
    return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />;
  return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
}

export function SimpleEventLog({ limit = 30 }: { limit?: number }) {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const rows = await listIntegrationLogs(rid, {}, limit);
      setLogs(rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Kon events niet laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Wat is er gebeurd</CardTitle>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} aria-label="Vernieuwen">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading && logs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Laden…</p>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nog geen events. Hier zie je live wat er via ClickWise, AI Voice en de widget binnenkomt.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((log) => (
              <li key={log.id} className="p-4 flex items-start gap-3">
                <StatusIcon status={log.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {prettyAction(log.action)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      via {SOURCE_LABEL[log.source] ?? log.source}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: nl })}
                  </div>
                  {log.status !== "success" && log.possible_cause && (
                    <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                      <div className="font-medium text-amber-700 dark:text-amber-400 mb-0.5">
                        Wat te doen
                      </div>
                      <div className="text-foreground/80">{log.possible_cause}</div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
