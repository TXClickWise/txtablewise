import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const SENSITIVE_KEYS = ["magic_token", "manage_token", "cancel_token", "api_key", "x-agent-api-key", "key_hash"];
function maskValue(v: any): any {
  if (v == null) return v;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(maskValue);
  if (typeof v !== "object") return v;
  const out: any = {};
  for (const [k, val] of Object.entries(v)) {
    if (SENSITIVE_KEYS.includes(k.toLowerCase())) out[k] = "***";
    else out[k] = maskValue(val);
  }
  return out;
}

type Log = {
  id: string;
  created_at: string;
  action: string;
  status: string;
  http_status: number | null;
  latency_ms: number | null;
  error_message: string | null;
  reservation_id: string | null;
  request_payload: any;
  response_payload: any;
  metadata: any;
};

export function AIActionLogs({ restaurantId }: { restaurantId: string | null }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      const { data } = await supabase.from("integration_logs")
        .select("id, created_at, action, status, http_status, latency_ms, error_message, reservation_id, request_payload, response_payload, metadata")
        .eq("restaurant_id", restaurantId)
        .eq("source", "voice_agent")
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data ?? []) as Log[]);
    })();
  }, [restaurantId]);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs]);
  const filtered = logs.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search && !JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI-actie logs (laatste 100)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="success">Succes</SelectItem>
              <SelectItem value="failed">Gefaald</SelectItem>
              <SelectItem value="warning">Waarschuwing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue placeholder="Actie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle acties</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Zoek (reservation id, telefoon, etc.)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen logs gevonden.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((l) => (
              <div key={l.id} className="rounded-md border">
                <button
                  onClick={() => setOpenId(openId === l.id ? null : l.id)}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/40"
                >
                  <Badge variant={l.status === "success" ? "default" : "destructive"}>
                    {l.status}
                  </Badge>
                  <code className="text-xs">{l.action}</code>
                  {l.metadata?.channel && (
                    <Badge variant="outline" className="text-xs">{l.metadata.channel}</Badge>
                  )}
                  {l.metadata?.provider && (
                    <Badge variant="outline" className="text-xs">{l.metadata.provider}</Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {l.latency_ms != null && `${l.latency_ms}ms · `}
                    {new Date(l.created_at).toLocaleString("nl-NL")}
                  </span>
                </button>
                {openId === l.id && (
                  <div className="border-t p-3 space-y-3 bg-muted/20">
                    {l.error_message && (
                      <div className="text-xs text-destructive">{l.error_message}</div>
                    )}
                    <details open>
                      <summary className="text-xs font-medium cursor-pointer">Request</summary>
                      <pre className="mt-1 text-xs overflow-auto max-h-48 rounded bg-background p-2">
                        {JSON.stringify(maskValue(l.request_payload), null, 2)}
                      </pre>
                    </details>
                    <details open>
                      <summary className="text-xs font-medium cursor-pointer">Response</summary>
                      <pre className="mt-1 text-xs overflow-auto max-h-48 rounded bg-background p-2">
                        {JSON.stringify(maskValue(l.response_payload), null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
