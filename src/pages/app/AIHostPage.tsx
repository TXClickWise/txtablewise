import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/PageHeader";
import {
  Phone, MessageSquare, MessageCircle, Globe, UserCheck, ShieldCheck,
  Sparkles, AlertTriangle, CheckCircle2, Loader2, Hourglass,
} from "lucide-react";
import {
  AI_ACTION_CATALOG,
  AIActionContract,
  AIActionResponse,
  AICallerType,
  CALLER_LABELS,
  CATEGORY_LABEL,
  dispatchAIAction,
} from "@/services/aiHost";
import { useRestaurant } from "@/hooks/useRestaurant";

const CHANNELS = [
  { Icon: Phone, t: "Voice AI", d: "Neemt op wanneer je kookt" },
  { Icon: MessageCircle, t: "WhatsApp AI", d: "Antwoordt direct, dag en nacht" },
  { Icon: MessageSquare, t: "SMS AI", d: "Korte heldere antwoorden" },
  { Icon: Globe, t: "Webchat AI", d: "Op je eigen website" },
  { Icon: UserCheck, t: "Doorverbinden naar medewerker", d: "Bij twijfel of klacht" },
  { Icon: ShieldCheck, t: "Veilige reserveringsacties", d: "Altijd via beschikbaarheidscheck" },
];

const CALLERS: AICallerType[] = ["voice_ai", "whatsapp_ai", "sms_ai", "webchat_ai", "internal_ai", "staff_user"];

function ActionCard({ action, onTry }: { action: AIActionContract; onTry: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{action.title}</CardTitle>
            <code className="text-xs text-muted-foreground">{action.name}</code>
          </div>
          <Badge variant={action.mode === "internal" ? "secondary" : "default"}>
            {action.mode === "internal" ? "Intern" : "Extern"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{action.purpose}</p>
        {action.guardrails.length > 0 && (
          <div className="rounded-md bg-muted/40 p-2 space-y-1">
            {action.guardrails.map((g, i) => (
              <div key={i} className="flex gap-2 items-start">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <span className="text-xs">{g}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {action.allowedCallers.map((c) => (
            <Badge key={c} variant="outline" className="text-xs">{CALLER_LABELS[c]}</Badge>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={onTry} className="w-full">
          <Sparkles className="h-3.5 w-3.5 mr-1" /> Test deze actie
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ res }: { res: AIActionResponse }) {
  if (res.status === "ok") return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (res.status === "pending_human") return <Hourglass className="h-4 w-4 text-amber-500" />;
  return <AlertTriangle className="h-4 w-4 text-destructive" />;
}

function TestConsole({
  selected, restaurantId, onResult,
}: {
  selected: AIActionContract | null;
  restaurantId: string | null;
  onResult: (r: AIActionResponse) => void;
}) {
  const [caller, setCaller] = useState<AICallerType>("voice_ai");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<AIActionResponse | null>(null);

  if (!selected) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Kies een actie links om de testconsole te openen.
        </CardContent>
      </Card>
    );
  }

  const setField = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!restaurantId) return;
    setBusy(true);
    const payload: Record<string, unknown> = {};
    for (const f of selected.inputs) {
      const raw = values[f.name];
      if (raw === undefined || raw === "") continue;
      if (f.type === "number") payload[f.name] = Number(raw);
      else if (f.type === "boolean") payload[f.name] = raw === "true";
      else payload[f.name] = raw;
    }
    const res = await dispatchAIAction({
      restaurantId,
      caller,
      action: selected.name,
      payload,
    });
    setResponse(res);
    onResult(res);
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Testconsole</CardTitle>
            <CardDescription>{selected.title}</CardDescription>
          </div>
          <Badge variant="outline">{CATEGORY_LABEL[selected.category]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Caller type</Label>
          <Select value={caller} onValueChange={(v) => setCaller(v as AICallerType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CALLERS.map((c) => (
                <SelectItem key={c} value={c}>{CALLER_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected.inputs.length === 0 && (
          <p className="text-xs text-muted-foreground">Deze actie heeft geen invoer nodig.</p>
        )}
        {selected.inputs.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label className="text-xs">
              {f.label} {f.required && <span className="text-destructive">*</span>}
              <span className="ml-1 text-muted-foreground">({f.type})</span>
            </Label>
            {f.type === "enum" && f.enumValues ? (
              <Select value={values[f.name] ?? ""} onValueChange={(v) => setField(f.name, v)}>
                <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
                <SelectContent>
                  {f.enumValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : f.type === "text" && (f.name.includes("note") || f.name.includes("requests") || f.name.includes("summary") || f.name.includes("reason")) ? (
              <Textarea
                value={values[f.name] ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
                placeholder={f.description}
                rows={2}
              />
            ) : (
              <Input
                type={f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "number" ? "number" : "text"}
                value={values[f.name] ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
                placeholder={f.description}
              />
            )}
          </div>
        ))}

        <Button onClick={submit} disabled={busy || !restaurantId} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Actie uitvoeren
        </Button>

        {response && (
          <div className="space-y-3 pt-2">
            <Separator />
            <div className="flex items-center gap-2 text-sm font-medium">
              <StatusIcon res={response} />
              <span className="capitalize">{response.status.replace("_", " ")}</span>
              {response.requires_human && <Badge variant="secondary">Vereist medewerker</Badge>}
              {response.reason_code && response.reason_code !== "ok" && (
                <Badge variant="outline" className="text-xs">{response.reason_code}</Badge>
              )}
            </div>
            <div className="rounded-md bg-muted/40 p-3 space-y-2 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Bericht voor gast</div>
                <div>{response.message_for_guest}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Intern</div>
                <div className="text-muted-foreground text-xs">{response.internal_message}</div>
              </div>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Volledige response (JSON)</summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted/40 p-2">{JSON.stringify(response, null, 2)}</pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const AIHostPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id ?? null;
  const [selected, setSelected] = useState<AIActionContract | null>(null);
  const [history, setHistory] = useState<Array<{ at: number; action: string; res: AIActionResponse }>>([]);

  const grouped = useMemo(() => {
    const map = new Map<string, AIActionContract[]>();
    for (const a of AI_ACTION_CATALOG) {
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return map;
  }, []);

  const onResult = (res: AIActionResponse) =>
    setHistory((h) => [{ at: Date.now(), action: res.action, res }, ...h].slice(0, 25));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="AI Host"
        description="AI mag gesprekken voeren. De reserveringsengine beslist of er echt plek is. Geen dubbele boekingen — ooit. Hieronder zie je alle toegestane acties en kun je ze veilig testen in een sandbox."
        badge={
          <Badge variant="outline" className="gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" /> AI-native
          </Badge>
        }
      />

      <ChannelReadinessCards restaurantId={restaurantId} />

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Action catalog</TabsTrigger>
          <TabsTrigger value="console">Sandbox console</TabsTrigger>
          <TabsTrigger value="live-test">Live testconsole</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="highlevel">HighLevel setup</TabsTrigger>
          <TabsTrigger value="rules">Veiligheidsregels</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <ActionCard
                    key={a.name}
                    action={a}
                    onTry={() => setSelected(a)}
                  />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="console">
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Acties</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="px-3 pb-3 space-y-1">
                    {AI_ACTION_CATALOG.map((a) => (
                      <button
                        key={a.name}
                        onClick={() => setSelected(a)}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted ${selected?.name === a.name ? "bg-muted font-medium" : ""}`}
                      >
                        {a.title}
                        <div className="text-[10px] text-muted-foreground">{a.name}</div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <TestConsole selected={selected} restaurantId={restaurantId} onResult={onResult} />
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recente AI-acties (sessie)</CardTitle>
              <CardDescription>
                Acties tijdens deze sessie. Volledige logs worden opgeslagen in audit_log + integration_events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen acties uitgevoerd.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div key={i} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <StatusIcon res={h.res} />
                        <code className="text-xs">{h.action}</code>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(h.at).toLocaleTimeString("nl-NL")}
                        </span>
                      </div>
                      <div className="mt-1 text-muted-foreground text-xs">
                        {h.res.message_for_guest}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardContent className="p-6 space-y-4 text-sm">
              <div>
                <div className="font-medium mb-1">Veiligheidsregel</div>
                <p className="text-muted-foreground">
                  AI mag alleen reserveringen bevestigen ná een succesvolle <code>check_availability</code> én een
                  succesvolle <code>create_reservation</code> via de reserveringsengine.
                </p>
              </div>
              <div>
                <div className="font-medium mb-1">Vangnetregel</div>
                <p className="text-muted-foreground">
                  Bij twijfel, grote groepen, klachten of onduidelijke verzoeken schakelt de AI een medewerker in
                  via <code>escalate_to_staff</code> of <code>request_human_callback</code>.
                </p>
              </div>
              <div>
                <div className="font-medium mb-1">Privacy</div>
                <p className="text-muted-foreground">
                  Interne notities worden nooit aan de gast voorgelezen. Externe AI mag interne acties (zoals walk-ins)
                  niet uitvoeren.
                </p>
              </div>
              <div>
                <div className="font-medium mb-1">Logging</div>
                <p className="text-muted-foreground">
                  Elke actie wordt gelogd in <code>audit_log</code> én als <code>integration_events</code> entry
                  klaargezet voor ClickWise.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIHostPage;
