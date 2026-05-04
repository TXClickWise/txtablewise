import { useEffect, useMemo, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Copy, Trash2, Plus, Bot, CheckCircle2, XCircle, Loader2, PlayCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  runVoiceFlow,
  VOICE_FLOW_FIELDS,
  VOICE_FLOW_PROMPT_TEMPLATE,
  type VoiceFlowInput,
  type VoiceFlowResult,
} from "@/services/voiceFlow";
import { Badge } from "@/components/ui/badge";

type ApiKeyRow = {
  id: string;
  label: string;
  provider: string | null;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type CallLog = {
  id: string;
  created_at: string;
  caller_phone: string | null;
  outcome: string | null;
  summary: string | null;
  reservation_id: string | null;
  duration_seconds: number | null;
};

function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `tw_voice_${b64}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function AdminVoiceAgentPage() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const tomorrowIso = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [flowInput, setFlowInput] = useState<VoiceFlowInput>({
    spokenDate: tomorrowIso,
    spokenTime: "19:30",
    spokenParty: "4",
    firstName: "Test",
    lastName: "Gast",
    phone: "0612345678",
    notes: "Voice-flow test reservering — kan worden geannuleerd",
  });
  const [flowRunning, setFlowRunning] = useState(false);
  const [flowResult, setFlowResult] = useState<VoiceFlowResult | null>(null);

  useEffect(() => {
    if (!rid) return;
    const raw = localStorage.getItem(`voiceFlow:lastResult:${rid}`);
    if (raw) {
      try { setFlowResult(JSON.parse(raw) as VoiceFlowResult); } catch { /* noop */ }
    }
  }, [rid]);

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    const [k, l] = await Promise.all([
      supabase.from("agent_api_keys").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }),
      supabase.from("agent_call_logs").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(50),
    ]);
    setKeys((k.data as ApiKeyRow[]) ?? []);
    setLogs((l.data as CallLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [rid]);

  const createKey = async () => {
    if (!rid) return;
    if (!newKeyLabel.trim()) return toast.error("Geef de sleutel een naam");
    const key = generateKey();
    const hash = await sha256Hex(key);
    const prefix = key.slice(0, 12);
    const { error } = await supabase.from("agent_api_keys").insert({
      restaurant_id: rid,
      label: newKeyLabel.trim(),
      key_hash: hash,
      key_prefix: prefix,
    });
    if (error) return toast.error(error.message);
    setNewKeyValue(key);
    setNewKeyLabel("");
    load();
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Sleutel intrekken? De voice-agent kan dan niet meer boeken.")) return;
    const { error } = await supabase
      .from("agent_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sleutel ingetrokken");
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Gekopieerd");
  };

  if (loading) return <p className="text-muted-foreground p-6">Laden…</p>;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="Voice Agent — Admin"
        description="Sleutelbeheer, flow-tester, payload-mapping en call-logs."
        badge={
          <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
            <ShieldCheck className="h-3 w-3" /> System Admin
          </Badge>
        }
      />

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API-sleutels</TabsTrigger>
          <TabsTrigger value="flow">Flow & mapping</TabsTrigger>
          <TabsTrigger value="test">Flow tester</TabsTrigger>
          <TabsTrigger value="logs">Calls</TabsTrigger>
        </TabsList>

        {/* Keys */}
        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">API-sleutels beheren</CardTitle>
              <CardDescription>
                De voice-agent gebruikt deze sleutel als <code className="text-xs">X-Agent-Api-Key</code> header.
                De sleutel zie je <strong>één keer</strong> bij aanmaken — bewaar hem direct.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Naam, bv. 'ClickWise Voice'" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} />
                <Button onClick={createKey}><Plus className="h-4 w-4 mr-1" /> Genereer</Button>
              </div>

              {newKeyValue && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Nieuwe sleutel — kopieer nu, hij wordt niet opnieuw getoond.
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono break-all">{newKeyValue}</code>
                    <Button size="sm" variant="outline" onClick={() => copy(newKeyValue)}>
                      <Copy className="h-3 w-3 mr-1" /> Kopieer
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setNewKeyValue(null)}>Sluiten</Button>
                </div>
              )}

              <div className="divide-y divide-border text-sm">
                {keys.length === 0 && <p className="text-muted-foreground py-4">Nog geen sleutels.</p>}
                {keys.map((k) => (
                  <div key={k.id} className="py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{k.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {k.key_prefix}…{k.revoked_at ? " · ingetrokken" : k.last_used_at ? ` · laatst: ${format(new Date(k.last_used_at), "d MMM HH:mm", { locale: nl })}` : " · nog niet gebruikt"}
                      </div>
                    </div>
                    {!k.revoked_at && (
                      <Button size="icon" variant="ghost" onClick={() => revokeKey(k.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flow mapping */}
        <TabsContent value="flow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Vaste 6-staps flow</CardTitle>
              <CardDescription>De voice-agent moet altijd deze stappen doorlopen.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {[
                  ["Gegevens verzamelen", "Datum, tijd, aantal personen, voornaam, telefoonnummer."],
                  ["Normaliseren", "Datum → YYYY-MM-DD · Tijd → HH:MM · Telefoon → +31… · Aantal → integer."],
                  ["Beschikbaarheid checken", "Altijd vóór boeken. Bij geen plek: alternatieven aanbieden."],
                  ["Reservering maken", "Alleen als alle verplichte velden geldig zijn."],
                  ["Bevestiging teruggeven", "Datum, tijd, aantal, naam en code hardop herhalen."],
                  ["Fallback", "Ontbrekend veld → opnieuw vragen. API-fout → terugbel-belofte."],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3 rounded-md border bg-card p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">{i + 1}</div>
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="text-muted-foreground text-xs mt-0.5">{body}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Velden & payload-mapping</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3">Veld</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2 pr-3">Spreekvoorbeeld</th>
                    <th className="text-left py-2 pr-3">Payload-veld</th>
                    <th className="text-left py-2">Notitie</th>
                  </tr>
                </thead>
                <tbody>
                  {VOICE_FLOW_FIELDS.map((f) => (
                    <tr key={f.key} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{f.label}</td>
                      <td className="py-2 pr-3">
                        {f.required ? (
                          <Badge variant="destructive" className="text-[10px]">verplicht</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">optioneel</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{f.spokenExample}</td>
                      <td className="py-2 pr-3"><code className="text-xs">{f.payloadField}</code></td>
                      <td className="py-2 text-xs text-muted-foreground">{f.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-display">Prompt template</CardTitle>
                  <CardDescription>Kopieer naar ClickWise. Dwingt 6-staps flow af.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => copy(VOICE_FLOW_PROMPT_TEMPLATE)}>
                  <Copy className="h-3 w-3 mr-1" /> Kopieer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap font-mono rounded-md border bg-muted/40 p-3 max-h-72 overflow-auto">{VOICE_FLOW_PROMPT_TEMPLATE}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flow tester */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-primary" /> Test complete voice flow
              </CardTitle>
              <CardDescription>
                Voert exact dezelfde flow uit als de voice-agent.
                <span className="block mt-1 flex items-start gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Dit maakt een echte reservering. Annuleer hem na de test.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Datum</Label>
                  <Input value={flowInput.spokenDate} onChange={(e) => setFlowInput({ ...flowInput, spokenDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tijd</Label>
                  <Input value={flowInput.spokenTime} onChange={(e) => setFlowInput({ ...flowInput, spokenTime: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Aantal personen</Label>
                  <Input value={flowInput.spokenParty} onChange={(e) => setFlowInput({ ...flowInput, spokenParty: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Voornaam</Label>
                  <Input value={flowInput.firstName} onChange={(e) => setFlowInput({ ...flowInput, firstName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Achternaam</Label>
                  <Input value={flowInput.lastName ?? ""} onChange={(e) => setFlowInput({ ...flowInput, lastName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefoon</Label>
                  <Input value={flowInput.phone} onChange={(e) => setFlowInput({ ...flowInput, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label className="text-xs">Opmerkingen</Label>
                  <Input value={flowInput.notes ?? ""} onChange={(e) => setFlowInput({ ...flowInput, notes: e.target.value })} />
                </div>
              </div>

              <Button
                onClick={async () => {
                  if (!rid) return;
                  setFlowRunning(true);
                  try {
                    const res = await runVoiceFlow(rid, flowInput);
                    setFlowResult(res);
                    localStorage.setItem(`voiceFlow:lastResult:${rid}`, JSON.stringify(res));
                    if (res.success) toast.success(`Flow OK · code ${res.reservationCode}`);
                    else toast.error("Flow gefaald");
                  } catch (err: any) {
                    toast.error(err?.message ?? "Onbekende fout");
                  } finally {
                    setFlowRunning(false);
                  }
                }}
                disabled={flowRunning}
              >
                {flowRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
                {flowRunning ? "Bezig…" : "Run flow"}
              </Button>

              {flowResult && (
                <div className={`rounded-md border p-3 space-y-2 ${flowResult.success ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {flowResult.success ? (
                      <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Geslaagd · code {flowResult.reservationCode}</>
                    ) : (
                      <><XCircle className="h-4 w-4 text-destructive" /> Gefaald</>
                    )}
                  </div>
                  <ol className="space-y-1.5 text-xs">
                    {flowResult.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {s.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
                        <div className="flex-1">
                          <span className="font-medium capitalize">{s.step}</span>
                          <span className="text-muted-foreground"> — {s.message}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Recente calls</CardTitle>
              <CardDescription>Laatste 50 gesprekken die de voice-agent heeft gelogd.</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen calls gelogd.</p>
              ) : (
                <div className="divide-y divide-border text-sm">
                  {logs.map((c) => (
                    <div key={c.id} className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{c.caller_phone ?? "onbekend"}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), "d MMM HH:mm", { locale: nl })}
                        </span>
                        {c.outcome && <span className="text-xs px-2 py-0.5 rounded border bg-muted">{c.outcome}</span>}
                        {c.duration_seconds != null && (
                          <span className="text-xs text-muted-foreground">{c.duration_seconds}s</span>
                        )}
                      </div>
                      {c.summary && <p className="text-xs text-muted-foreground mt-1">{c.summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
