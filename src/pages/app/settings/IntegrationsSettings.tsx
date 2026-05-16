import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Send, RefreshCw } from "lucide-react";

type Event = {
  id: string;
  event_type: string;
  status: string;
  target: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  payload: any;
};

export default function IntegrationsSettings() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const load = async () => {
    if (!rid) return;
    const [{ data: r }, { data: ev }] = await Promise.all([
      supabase.from("restaurants").select("webhook_url, webhook_secret").eq("id", rid).maybeSingle(),
      supabase.from("integration_events").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(20),
    ]);
    setWebhookUrl((r as any)?.webhook_url ?? "");
    setWebhookSecret((r as any)?.webhook_secret ?? "");
    setEvents((ev ?? []) as Event[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [rid]);

  const save = async () => {
    if (!rid) return;
    setSaving(true);
    const { error } = await supabase.from("restaurants")
      .update({ webhook_url: webhookUrl || null, webhook_secret: webhookSecret || null } as any)
      .eq("id", rid);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Webhook opgeslagen");
  };

  const dispatch = async () => {
    if (!rid) return;
    setDispatching(true);
    const { data, error } = await supabase.functions.invoke("dispatch_webhooks", {
      body: {},
      headers: {},
    });
    setDispatching(false);
    if (error) return toast.error(error.message);
    toast.success(`Verstuurd: ${data?.dispatched ?? 0}, gefaald: ${data?.failed ?? 0}, overgeslagen: ${data?.skipped ?? 0}`);
    load();
  };

  if (loading) return <p className="text-muted-foreground text-sm">Laden…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-dashed p-3 text-sm flex flex-wrap items-center justify-between gap-2 bg-muted/30">
        <div>
          <span className="font-medium">Geavanceerde weergave.</span>{" "}
          <span className="text-muted-foreground">
            Liever zonder technische velden? Ga naar{" "}
            <a href="/app/koppelingen" className="underline text-primary">Koppelingen</a>.
          </span>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">ClickWise / Webhook (geavanceerd)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reserveringen en statuswijzigingen worden als events verstuurd naar deze URL.
            De optionele secret wordt gebruikt om een <code className="text-xs">X-TableWise-Signature</code> header
            (HMAC-SHA256) te genereren ter verificatie.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Webhook URL</Label>
            <Input type="url" placeholder="https://api.clickwise.nl/hooks/tablewise" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Signing secret (optioneel)</Label>
            <Input type="password" placeholder="••••••••" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={dispatch} disabled={dispatching}>
              <Send className="h-4 w-4 mr-2" /> {dispatching ? "Versturen…" : "Wachtrij versturen"}
            </Button>
            <Button onClick={save} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg">Recente events</CardTitle>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen events.</p>
          ) : (
            <div className="divide-y divide-border text-sm">
              {events.map((e) => (
                <div key={e.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs">{e.event_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "d MMM HH:mm:ss", { locale: nl })}
                      {e.target && ` · ${e.target}`}
                      {e.attempts > 0 && ` · ${e.attempts} poging(en)`}
                    </div>
                    {e.last_error && <div className="text-xs text-destructive truncate">{e.last_error}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    e.status === "delivered" ? "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30"
                    : e.status === "failed" ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-status-pending/10 text-status-pending border-status-pending/30"
                  }`}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
