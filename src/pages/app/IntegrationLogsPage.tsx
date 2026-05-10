import { useEffect, useMemo, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Filter, ScrollText, Loader2 } from "lucide-react";
import { listIntegrationLogs, retryIntegrationLog, type IntegrationLog, type LogFilters } from "@/services/integrationLogs";
import { SimpleEventLog } from "@/components/integrations/SimpleEventLog";
import { AdvancedOnly } from "@/components/AdvancedOnly";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";

const SOURCES: IntegrationLog["source"][] = ["api", "voice_agent", "webhook", "clickwise", "widget", "dashboard"];
const STATUSES: IntegrationLog["status"][] = ["success", "warning", "failed"];

function statusColor(s: IntegrationLog["status"]) {
  if (s === "success") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (s === "warning") return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}
function statusIcon(s: IntegrationLog["status"]) {
  if (s === "success") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (s === "warning") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <XCircle className="h-3.5 w-3.5" />;
}

export default function IntegrationLogsPage() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const { canSeeAdvanced } = useAdvancedMode();
  const [showRaw, setShowRaw] = useState(false);
  const defaultFrom = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 16);
  }, []);

  const [filters, setFilters] = useState<LogFilters & { fromLocal: string; toLocal: string; statusOne: string; sourceOne: string }>({
    fromLocal: defaultFrom, toLocal: "", statusOne: "all", sourceOne: "all", errorCode: "", search: "",
  });
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IntegrationLog | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const f: LogFilters = {
        from: filters.fromLocal ? new Date(filters.fromLocal).toISOString() : undefined,
        to: filters.toLocal ? new Date(filters.toLocal).toISOString() : undefined,
        status: filters.statusOne !== "all" ? [filters.statusOne as IntegrationLog["status"]] : undefined,
        source: filters.sourceOne !== "all" ? [filters.sourceOne as IntegrationLog["source"]] : undefined,
        errorCode: filters.errorCode || undefined,
        search: filters.search || undefined,
      };
      const rows = await listIntegrationLogs(rid, f, 200);
      setLogs(rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Logs konden niet worden geladen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  const onRetry = async (log: IntegrationLog) => {
    setRetrying(log.id);
    try {
      const res = await retryIntegrationLog(log.id);
      if (res.ok) toast.success("Retry geslaagd");
      else toast.error(`Retry gefaald: ${res.error ?? "onbekend"}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Retry mislukt");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <ScrollText className="h-7 w-7 text-primary" />
        <div className="flex-1">
          <h1 className="font-display text-2xl">Integratie-logs</h1>
          <p className="text-sm text-muted-foreground">
            Live overzicht van wat er via ClickWise, AI Voice, de widget en de API gebeurt.
          </p>
        </div>
        <AdvancedOnly>
          <Button variant="outline" size="sm" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? "Toon eenvoudige weergave" : "Toon technische details"}
          </Button>
        </AdvancedOnly>
      </div>

      {!showRaw || !canSeeAdvanced ? (
        <SimpleEventLog limit={50} />
      ) : (
        <>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
          <CardDescription>Standaard wordt het laatste etmaal getoond. API-sleutels en gevoelige velden zijn altijd gemaskeerd.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Vanaf</Label>
              <Input type="datetime-local" value={filters.fromLocal} onChange={(e) => setFilters({ ...filters, fromLocal: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tot</Label>
              <Input type="datetime-local" value={filters.toLocal} onChange={(e) => setFilters({ ...filters, toLocal: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filters.statusOne} onValueChange={(v) => setFilters({ ...filters, statusOne: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bron</Label>
              <Select value={filters.sourceOne} onValueChange={(v) => setFilters({ ...filters, sourceOne: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Foutcode</Label>
              <Input placeholder="bv. TW_409" value={filters.errorCode ?? ""} onChange={(e) => setFilters({ ...filters, errorCode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gast/reservering ID</Label>
              <Input placeholder="UUID" value={filters.search ?? ""} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
            <div className="lg:col-span-6 flex justify-end">
              <Button onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Filter className="h-4 w-4 mr-1" />}
                Toepassen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Laden…</p>
          ) : logs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Geen logs binnen deze filters.</p>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-start gap-3"
                >
                  <div className={`mt-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${statusColor(log.status)}`}>
                    {statusIcon(log.status)} {log.status}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "d MMM HH:mm:ss", { locale: nl })}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">{log.source}</Badge>
                      <span className="font-medium">{log.action}</span>
                      {log.http_status != null && <span className="text-xs text-muted-foreground">HTTP {log.http_status}</span>}
                      {log.latency_ms != null && <span className="text-xs text-muted-foreground">{log.latency_ms}ms</span>}
                      {log.error_code && (
                        <code className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{log.error_code}</code>
                      )}
                    </div>
                    {log.possible_cause && (
                      <div className="text-xs text-muted-foreground mt-0.5">→ {log.possible_cause}</div>
                    )}
                  </div>
                  {log.retry_safe && log.status !== "success" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); onRetry(log); }}
                      disabled={retrying === log.id}
                    >
                      {retrying === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${statusColor(selected.status)}`}>
                    {statusIcon(selected.status)} {selected.status}
                  </span>
                  {selected.action}
                </SheetTitle>
                <SheetDescription>
                  {format(new Date(selected.created_at), "d MMM yyyy HH:mm:ss", { locale: nl })} · bron <strong>{selected.source}</strong>
                  {selected.api_key_prefix && <> · sleutel <code className="text-xs">{selected.api_key_prefix}…</code></>}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                {selected.possible_cause && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Mogelijke oorzaak</div>
                    <div>{selected.possible_cause}</div>
                  </div>
                )}
                {selected.error_code && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="text-xs font-medium text-destructive mb-1">Foutcode</div>
                    <code className="text-xs">{selected.error_code}</code>
                    {selected.error_message && <div className="mt-1 text-xs">{selected.error_message}</div>}
                  </div>
                )}
                {(selected.reservation_id || selected.guest_id || selected.external_reference) && (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                    {selected.reservation_id && <div>Reservering: <code>{selected.reservation_id}</code></div>}
                    {selected.guest_id && <div>Gast: <code>{selected.guest_id}</code></div>}
                    {selected.external_reference && <div>Externe ref: <code>{selected.external_reference}</code></div>}
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium mb-1">Request payload (gemaskeerd)</div>
                  <pre className="text-[10px] font-mono rounded-md border bg-muted/30 p-2 max-h-64 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.request_payload, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1">Response payload</div>
                  <pre className="text-[10px] font-mono rounded-md border bg-muted/30 p-2 max-h-64 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.response_payload, null, 2)}
                  </pre>
                </div>
                {selected.retry_safe && selected.status !== "success" && (
                  <Button onClick={() => onRetry(selected)} disabled={retrying === selected.id}>
                    {retrying === selected.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Retry deze actie
                  </Button>
                )}
                {!selected.retry_safe && selected.status !== "success" && (
                  <p className="text-xs text-muted-foreground">
                    Deze actie kan niet veilig automatisch worden herhaald (kans op dubbele reservering). Maak hem handmatig aan in <code>/app/reservations</code>.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
        </>
      )}
    </div>

  );
}
