import { useEffect, useMemo, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Phone, Bot, BookOpen, KeyRound, Link2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { AdvancedOnly } from "@/components/AdvancedOnly";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { SimpleEventLog } from "@/components/integrations/SimpleEventLog";

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

const PROVIDERS = [
  { value: "highlevel", label: "ClickWise Voice AI" },
  { value: "elevenlabs", label: "ElevenLabs Conversational AI" },
  { value: "vapi", label: "Vapi" },
  { value: "retell", label: "Retell" },
];

export default function VoiceAgentPage() {
  const { current } = useRestaurant();
  const { isSystemAdmin } = useIsSystemAdmin();
  const { canSeeAdvanced } = useAdvancedMode();
  const rid = current?.restaurant_id;

  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFullPrefix, setShowFullPrefix] = useState(false);

  const agentApiUrl = useMemo(() => {
    const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/agent_api`;
  }, []);

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    const [s, k] = await Promise.all([
      supabase.from("voice_agent_settings").select("*").eq("restaurant_id", rid).maybeSingle(),
      supabase
        .from("agent_api_keys")
        .select("*")
        .eq("restaurant_id", rid)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setSettings(
      (s.data as VoiceSettings | null) ?? {
        restaurant_id: rid,
        provider: "highlevel",
        agent_id: "",
        phone_number: "",
        mode: "sandbox",
        system_prompt_notes: "",
      },
    );
    setKeys((k.data as ApiKeyRow[]) ?? []);
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

  const copy = (text: string, label = "Gekopieerd") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  if (loading || !settings) {
    return <p className="text-muted-foreground p-6">Laden…</p>;
  }

  const activeKey = keys[0] ?? null;
  const maskedKey = activeKey
    ? showFullPrefix
      ? `${activeKey.key_prefix}••••••••••••••••••••`
      : `${activeKey.key_prefix.slice(0, 8)}••••••••••••••••••••••••`
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="AI Voice Agent"
        description="Koppel de ClickWise Voice AI aan TX TableWise voor telefonische reserveringen."
        badge={
          <Badge variant="outline" className="gap-1.5">
            <Bot className="h-3 w-3 text-primary" /> Voice
          </Badge>
        }
        actions={
          <Button asChild variant="outline" className="h-11">
            <Link to="/app/help/voice-agent">
              <BookOpen className="h-4 w-4 mr-2" /> Help & koppeling
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">Status & test</TabsTrigger>
          <TabsTrigger value="api">
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            API-koppeling
          </TabsTrigger>
          {canSeeAdvanced && <TabsTrigger value="setup">Configuratie</TabsTrigger>}
          {canSeeAdvanced && <TabsTrigger value="howto">Hoe koppelen</TabsTrigger>}
        </TabsList>

        {/* Status & test — standaard zichtbaar voor eindgebruiker */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> Status van je voice-agent
              </CardTitle>
              <CardDescription>
                In één oogopslag of de koppeling werkt en wat er recent via de telefoon binnenkwam.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Modus</div>
                  <div className="text-sm font-medium mt-1">
                    {settings.mode === "live" ? "🟢 Live" : "🟡 Sandbox (test)"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Provider</div>
                  <div className="text-sm font-medium mt-1">
                    {PROVIDERS.find((p) => p.value === settings.provider)?.label ?? settings.provider}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">API-sleutel</div>
                  <div className="text-sm font-medium mt-1">
                    {activeKey ? "✅ Actief" : "⚠️ Ontbreekt"}
                  </div>
                </div>
              </div>
              {settings.phone_number && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Telefoonnummer: <strong>{settings.phone_number}</strong>
                </div>
              )}
              <VoiceTestButton restaurantId={rid!} disabled={!activeKey} />
            </CardContent>
          </Card>

          <SimpleEventLog limit={20} />
        </TabsContent>

        {/* API koppeling — voor eindgebruiker */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Jouw koppelgegevens
              </CardTitle>
              <CardDescription>
                Plak deze gegevens in ClickWise. De voice-agent
                gebruikt ze om beschikbaarheid te checken en reserveringen te boeken in TableWise.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* API endpoint */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  API-endpoint (Base URL)
                </Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5">
                  <code className="flex-1 text-xs font-mono break-all">{agentApiUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(agentApiUrl, "Endpoint gekopieerd")}>
                    <Copy className="h-3 w-3 mr-1" /> Kopieer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hier stuurt de voice-agent zijn aanvragen heen. Werkt voor alle providers.
                </p>
              </div>

              {/* API sleutel */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  API-sleutel
                </Label>
                {activeKey ? (
                  <>
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5">
                      <code className="flex-1 text-xs font-mono break-all">{maskedKey}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowFullPrefix((v) => !v)}
                        title="Toon prefix"
                      >
                        {showFullPrefix ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We tonen om veiligheidsredenen alleen het begin. De volledige sleutel is{" "}
                      <strong>één keer</strong> getoond bij aanmaken. Heb je hem niet meer? Vraag je
                      contactpersoon om een nieuwe te genereren.
                    </p>
                    {activeKey.last_used_at && (
                      <p className="text-xs text-muted-foreground">
                        Laatst gebruikt:{" "}
                        {format(new Date(activeKey.last_used_at), "d MMM yyyy HH:mm", { locale: nl })}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      Nog geen API-sleutel beschikbaar
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Neem contact op met TableWise support om een sleutel voor jouw restaurant te
                      laten aanmaken.
                    </p>
                  </div>
                )}
              </div>

              {/* Header */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Header-naam
                </Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5">
                  <code className="flex-1 text-xs font-mono">X-Agent-Api-Key</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy("X-Agent-Api-Key", "Header gekopieerd")}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Kopieer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stuur de API-sleutel mee in deze header bij elke aanvraag.
                </p>
              </div>

              {/* Korte uitleg */}
              <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Hoe gebruik je deze gegevens in ClickWise?
                </div>
                <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
                  <li>Open in ClickWise je voice-flow en ga naar <strong>HTTP Request</strong>.</li>
                  <li>Plak de <strong>Base URL</strong> hierboven in het URL-veld.</li>
                  <li>
                    Voeg een header toe met naam <code>X-Agent-Api-Key</code> en waarde je{" "}
                    <strong>API-sleutel</strong>.
                  </li>
                  <li>Test eerst in sandbox-modus voordat je live gaat.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuratie */}
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
                    placeholder="bv. asst_abc123"
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

          {isSystemAdmin && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Admin-tools beschikbaar</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Flow-tester, payload-mapping, sleutelbeheer en call-logs vind je in de admin-sectie.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/admin/voice-agent">Open admin</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* How-to */}
        <TabsContent value="howto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Stap-voor-stap koppelen</CardTitle>
              <CardDescription>
                Een korte handleiding om je voice-agent aan TableWise te koppelen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="list-decimal list-inside space-y-2.5">
                <li>
                  Ga naar het tabblad <strong>API-koppeling</strong> en kopieer de Base URL en je
                  API-sleutel.
                </li>
                <li>
                  Maak in ClickWise een nieuwe Voice AI assistant aan met
                  Nederlands als taal.
                </li>
                <li>
                  Voeg in dat platform een <strong>HTTP Request</strong> stap toe met:
                  <ul className="list-disc list-inside ml-4 mt-1 text-xs text-muted-foreground space-y-0.5">
                    <li>URL: de gekopieerde Base URL</li>
                    <li>Header: <code>X-Agent-Api-Key</code> met je sleutel als waarde</li>
                    <li>Header: <code>Content-Type: application/json</code></li>
                  </ul>
                </li>
                <li>Koppel een telefoonnummer aan de assistant (via Twilio of je provider).</li>
                <li>
                  Test eerst in <strong>sandbox-modus</strong>: bel zelf en boek een
                  test-reservering.
                </li>
                <li>
                  Schakel pas naar <strong>live</strong> als je tevreden bent. ClickWise pakt dan
                  automatisch de bevestigings- en reminder-flow op.
                </li>
              </ol>

              <div className="rounded-md border bg-muted/40 p-3 text-xs">
                <p className="font-medium mb-1">Hulp nodig?</p>
                <p className="text-muted-foreground">
                  Bekijk de uitgebreide handleiding via de <Link to="/app/help/voice-agent" className="text-primary underline">Help & koppeling</Link> knop bovenaan, of neem contact op met TableWise support.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VoiceTestButton({ restaurantId, disabled }: { restaurantId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const today = new Date();
      const date = today.toISOString().slice(0, 10);
      const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
      const sess = await supabase.auth.getSession();
      const accessToken = sess.data.session?.access_token;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/integration_test/availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ restaurant_id: restaurantId, date, party_size: 2 }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out?.error) {
        toast.error(`Test mislukt: ${out?.error ?? `HTTP ${res.status}`}`);
      } else {
        const slots = Array.isArray(out?.slots) ? out.slots.length : (Array.isArray(out?.available_slots) ? out.available_slots.length : "?");
        toast.success(`Voice-flow test OK — ${slots} slots voor vandaag`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test mislukt");
    } finally { setBusy(false); }
  };
  return (
    <Button onClick={run} disabled={busy || disabled} className="h-11">
      {busy ? "Testen…" : "Test verbinding (beschikbaarheid)"}
    </Button>
  );
}
