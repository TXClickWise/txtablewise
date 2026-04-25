import { useEffect, useMemo, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, Trash2, Plus, Phone, Bot } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type VoiceSettings = {
  id?: string;
  restaurant_id: string;
  provider: string;
  agent_id: string | null;
  phone_number: string | null;
  mode: "sandbox" | "live";
  system_prompt_notes: string | null;
};

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

const PROVIDERS = [
  { value: "vapi", label: "Vapi (aanbevolen)" },
  { value: "retell", label: "Retell AI" },
  { value: "highlevel", label: "HighLevel Voice AI (ClickWise)" },
  { value: "elevenlabs", label: "ElevenLabs Agents" },
  { value: "other", label: "Anders" },
];

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

export default function VoiceAgentPage() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;

  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const agentApiUrl = useMemo(() => {
    const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/agent_api`;
  }, []);

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    const [s, k, l] = await Promise.all([
      supabase.from("voice_agent_settings").select("*").eq("restaurant_id", rid).maybeSingle(),
      supabase.from("agent_api_keys").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }),
      supabase.from("agent_call_logs").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(20),
    ]);
    setSettings(
      (s.data as VoiceSettings | null) ?? {
        restaurant_id: rid,
        provider: "vapi",
        agent_id: "",
        phone_number: "",
        mode: "sandbox",
        system_prompt_notes: "",
      },
    );
    setKeys((k.data as ApiKeyRow[]) ?? []);
    setLogs((l.data as CallLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [rid]);

  const saveSettings = async () => {
    if (!rid || !settings) return;
    setSaving(true);
    const payload = {
      restaurant_id: rid,
      provider: settings.provider,
      agent_id: settings.agent_id?.trim() || null,
      phone_number: settings.phone_number?.trim() || null,
      mode: settings.mode,
      system_prompt_notes: settings.system_prompt_notes?.trim() || null,
    };
    const { error } = await supabase.from("voice_agent_settings").upsert(payload, { onConflict: "restaurant_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Voice-agent instellingen opgeslagen");
    load();
  };

  const createKey = async () => {
    if (!rid) return;
    if (!newKeyLabel.trim()) return toast.error("Geef de sleutel een naam");
    const key = generateKey();
    const hash = await sha256Hex(key);
    const prefix = key.slice(0, 12);
    const { error } = await supabase.from("agent_api_keys").insert({
      restaurant_id: rid,
      label: newKeyLabel.trim(),
      provider: settings?.provider ?? null,
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

  if (loading || !settings) {
    return <p className="text-muted-foreground p-6">Laden…</p>;
  }

  const promptTemplate = `Je bent de gastvrouw van ${current?.restaurants?.name ?? "[restaurant]"}.
Je neemt telefonisch reserveringen aan in vriendelijke, natuurlijke Nederlandse taal.
- Vraag naam, datum, tijd, aantal personen, telefoonnummer, en eventuele allergieën.
- Gebruik de tool check_availability voor je een tijd bevestigt.
- Gebruik book_reservation om de reservering vast te leggen zodra alles klopt.
- Bevestig altijd de gegevens hardop voor je boekt.
- Bij twijfel of grote groep (>8 personen): geef aan dat het restaurant terugbelt.`;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Bot className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-2xl">AI Voice Agent</h1>
          <p className="text-sm text-muted-foreground">
            Koppel een externe AI voice-agent (Vapi, Retell, HighLevel) aan TableWise voor telefonische reserveringen.
          </p>
        </div>
      </div>

      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup">Configuratie</TabsTrigger>
          <TabsTrigger value="keys">API-sleutels</TabsTrigger>
          <TabsTrigger value="howto">Hoe koppelen</TabsTrigger>
          <TabsTrigger value="logs">Calls</TabsTrigger>
        </TabsList>

        {/* Setup */}
        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Voice-agent instellingen</CardTitle>
              <CardDescription>
                Kies welk voice-platform je gebruikt en zet de modus op <strong>sandbox</strong> tot je klaar bent voor live calls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Select value={settings.provider} onValueChange={(v) => setSettings({ ...settings, provider: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Modus</Label>
                  <div className="flex items-center gap-3 h-10">
                    <Switch
                      checked={settings.mode === "live"}
                      onCheckedChange={(v) => setSettings({ ...settings, mode: v ? "live" : "sandbox" })}
                    />
                    <span className="text-sm">{settings.mode === "live" ? "Live (echte calls)" : "Sandbox (test)"}</span>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Agent / Assistant ID</Label>
                  <Input
                    placeholder="bv. asst_abc123 (Vapi)"
                    value={settings.agent_id ?? ""}
                    onChange={(e) => setSettings({ ...settings, agent_id: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Telefoonnummer</Label>
                  <Input
                    placeholder="+31 20 ... (Twilio of provider-nummer)"
                    value={settings.phone_number ?? ""}
                    onChange={(e) => setSettings({ ...settings, phone_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>System-prompt notities (optioneel — voor je eigen referentie)</Label>
                <Textarea
                  rows={4}
                  placeholder="Bijzonderheden voor de agent (bv. menu, parkeren, sluitingsdagen)..."
                  value={settings.system_prompt_notes ?? ""}
                  onChange={(e) => setSettings({ ...settings, system_prompt_notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? "Opslaan…" : "Opslaan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keys */}
        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">API-sleutels</CardTitle>
              <CardDescription>
                De voice-agent gebruikt deze sleutel als <code className="text-xs">X-Agent-Api-Key</code> header.
                De sleutel zie je <strong>één keer</strong> bij aanmaken — bewaar hem direct.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Naam, bv. 'Vapi productie'" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} />
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

        {/* How-to */}
        <TabsContent value="howto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Stap-voor-stap koppelen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="list-decimal list-inside space-y-2">
                <li>Maak hierboven een API-sleutel aan en kopieer hem.</li>
                <li>Maak in je voice-platform (Vapi/Retell/HighLevel) een nieuwe assistant aan, taal NL, stem naar keuze.</li>
                <li>
                  Stel onderstaande system-prompt in als basis:
                </li>
              </ol>

              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">System prompt template</span>
                  <Button size="sm" variant="ghost" onClick={() => copy(promptTemplate)}>
                    <Copy className="h-3 w-3 mr-1" /> Kopieer
                  </Button>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-mono">{promptTemplate}</pre>
              </div>

              <ol className="list-decimal list-inside space-y-2" start={4}>
                <li>
                  Voeg drie tools / functions toe die HTTP POST doen naar:
                </li>
              </ol>

              <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span>Base URL</span>
                  <Button size="sm" variant="ghost" onClick={() => copy(agentApiUrl)}>
                    <Copy className="h-3 w-3 mr-1" /> Kopieer
                  </Button>
                </div>
                <div className="break-all">{agentApiUrl}</div>
                <ul className="list-disc list-inside pt-2 space-y-1">
                  <li>POST <code>{agentApiUrl}/check_availability</code> — body: <code>{`{ date, party_size }`}</code></li>
                  <li>POST <code>{agentApiUrl}/book_reservation</code> — body: <code>{`{ date, time, party_size, guest: { first_name, phone, email? }, special_requests? }`}</code></li>
                  <li>POST <code>{agentApiUrl}/cancel_reservation</code> — body: <code>{`{ reservation_id, reason? }`}</code></li>
                </ul>
                <div className="pt-2">
                  Headers (verplicht): <br />
                  <code>X-Agent-Api-Key: &lt;jouw sleutel&gt;</code><br />
                  <code>Content-Type: application/json</code>
                </div>
              </div>

              <ol className="list-decimal list-inside space-y-2" start={5}>
                <li>Koppel een telefoonnummer (Twilio of provider-nummer) aan de assistant.</li>
                <li>Test in <strong>sandbox-modus</strong>: bel zelf en boek een testreservering.</li>
                <li>Schakel in TableWise pas naar <strong>live</strong> als je tevreden bent. ClickWise/HighLevel pakt dan automatisch de bevestigings- en reminder-flow op via de bestaande webhook-integratie.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Recente calls</CardTitle>
              <CardDescription>De laatste 20 gesprekken die de voice-agent heeft gelogd.</CardDescription>
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
                        {c.outcome && (
                          <span className="text-xs px-2 py-0.5 rounded border bg-muted">{c.outcome}</span>
                        )}
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
