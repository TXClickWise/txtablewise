import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AI_ACTION_CATALOG } from "@/services/aiHost";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const CHANNELS = ["voice", "whatsapp", "sms", "webchat"] as const;

// Maps catalog action names to agent_api endpoints.
const ENDPOINT_MAP: Record<string, string> = {
  check_availability: "check_availability",
  create_reservation: "book_reservation",
  cancel_reservation: "cancel_reservation",
  find_reservation: "find_reservation",
  update_reservation: "update_reservation",
  create_waitlist_entry: "create_waitlist_entry",
  get_opening_hours: "get_opening_hours",
  reconfirm_reservation: "reconfirm_reservation",
};

export function AIActionTestConsole({ restaurantId }: { restaurantId: string | null }) {
  const [actionName, setActionName] = useState<string>("check_availability");
  const [channel, setChannel] = useState<string>("voice");
  const [values, setValues] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: any } | null>(null);
  const [keys, setKeys] = useState<{ id: string; label: string; key_prefix: string }[]>([]);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      const { data } = await supabase.from("agent_api_keys")
        .select("id, label, key_prefix")
        .eq("restaurant_id", restaurantId)
        .is("revoked_at", null);
      setKeys(data ?? []);
    })();
  }, [restaurantId]);

  const action = AI_ACTION_CATALOG.find((a) => a.name === actionName);
  const endpoint = action ? (ENDPOINT_MAP[action.name] ?? action.name) : actionName;
  const supported = !!ENDPOINT_MAP[actionName];

  const setField = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!restaurantId || !apiKey) {
      toast.error("Selecteer een agent API-sleutel of vul er een in");
      return;
    }
    setBusy(true);
    setResponse(null);
    const payload: Record<string, unknown> = { channel };
    if (action) {
      for (const f of action.inputs) {
        const raw = values[f.name];
        if (raw === undefined || raw === "") continue;
        if (f.type === "number") payload[f.name] = Number(raw);
        else if (f.type === "boolean") payload[f.name] = raw === "true";
        else payload[f.name] = raw;
      }
    }
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent_api/${endpoint}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      setResponse({ status: res.status, body });
    } catch (e) {
      setResponse({ status: 0, body: { error: String(e) } });
    } finally {
      setBusy(false);
    }
  };

  const guestMessage = response?.body?.message_for_guest ?? null;
  const internal = response?.body ? Object.fromEntries(
    Object.entries(response.body).filter(([k]) => k !== "message_for_guest")
  ) : null;
  const isTest = response && response.body?.test_mode !== false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Live testconsole</CardTitle>
        <CardDescription>
          Roept de echte agent_api aan met je API-sleutel. Resultaten worden niet opgeslagen in deze view —
          gebruik het tabblad Logs voor de geschiedenis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Action</Label>
            <Select value={actionName} onValueChange={setActionName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_ACTION_CATALOG.map((a) => (
                  <SelectItem key={a.name} value={a.name} disabled={!ENDPOINT_MAP[a.name]}>
                    {a.title} {!ENDPOINT_MAP[a.name] && "(geen endpoint)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Agent API-sleutel</Label>
          {keys.length > 0 && (
            <Select onValueChange={(v) => setApiKey(v)}>
              <SelectTrigger><SelectValue placeholder="Bestaande sleutel kiezen…" /></SelectTrigger>
              <SelectContent>
                {keys.map((k) => (
                  <SelectItem key={k.id} value={k.key_prefix}>
                    {k.label} ({k.key_prefix}…)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            type="password"
            placeholder="Plak hier je sleutel (vereist voor live test)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {action && supported && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Velden
              </div>
              {action.inputs.length === 0 && (
                <p className="text-xs text-muted-foreground">Geen velden vereist.</p>
              )}
              {action.inputs.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label className="text-xs">
                    {f.label}{" "}
                    {f.required && <span className="text-destructive">*</span>}
                    <span className="ml-1 text-muted-foreground">({f.type})</span>
                  </Label>
                  <Input
                    type={f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "number" ? "number" : "text"}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setField(f.name, e.target.value)}
                    placeholder={f.description}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <Button onClick={submit} disabled={busy || !supported} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Test uitvoeren
        </Button>

        {response && (
          <div className="space-y-3">
            <Separator />
            <div className="flex items-center gap-2">
              <Badge variant={response.status < 300 ? "default" : "destructive"}>
                HTTP {response.status}
              </Badge>
              <Badge variant={isTest ? "secondary" : "default"}>
                {isTest ? "Testmodus" : "Live"}
              </Badge>
            </div>
            {guestMessage && (
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Gastbericht
                </div>
                <div className="text-sm">{guestMessage}</div>
              </div>
            )}
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Intern (volledige response)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">
                {JSON.stringify(internal, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
