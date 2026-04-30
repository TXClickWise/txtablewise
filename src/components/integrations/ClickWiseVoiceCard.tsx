import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Phone, Send, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";

type Props = { restaurantId: string };

const RECOMMENDED_PROMPT = `Je bent een gastvrije telefonist voor het restaurant.
Verzamel deze gegevens van de beller:
- Naam (volledig)
- Telefoonnummer OF e-mailadres
- Datum (formaat YYYY-MM-DD)
- Tijd (24-uurs, formaat HH:MM)
- Aantal personen
- Eventueel: dieetwensen of opmerking

Stuur dan ÉÉN call naar TableWise: POST /public_api/reservation-request
met header X-TableWise-Api-Key.

Bij succes: bevestig de reservering met de reservationCode.
Bij fout TW_409_TIMESLOT_UNAVAILABLE: lees suggestedAlternatives voor en vraag de gast te kiezen.
Bij andere fouten: lees het 'message' voor en volg 'suggestedFix'.

Verzin NOOIT zelf beschikbaarheid — TableWise beslist.`;

const samplePayload = {
  localDate: "YYYY-MM-DD",
  localTime: "19:30",
  partySize: 4,
  notes: "Liefst raamtafel",
  source: "clickwise_voice",
  contact: {
    fullName: "Jan de Vries",
    phone: "+31612345678",
    email: "jan@example.com",
    language: "nl",
  },
};

export function ClickWiseVoiceCard({ restaurantId }: Props) {
  const projectId = (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_PROJECT_ID;
  const endpointUrl = useMemo(
    () => `https://${projectId}.supabase.co/functions/v1/public_api/reservation-request`,
    [projectId]
  );

  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    at: string;
    code?: string;
    message?: string;
    reservationCode?: string;
    raw?: unknown;
  } | null>(null);

  // Load last test from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(`tw:cw-voice-test:${restaurantId}`);
      if (v) setLastResult(JSON.parse(v));
    } catch { /* ignore */ }
  }, [restaurantId]);

  const persist = (r: typeof lastResult) => {
    setLastResult(r);
    try { localStorage.setItem(`tw:cw-voice-test:${restaurantId}`, JSON.stringify(r)); } catch { /* ignore */ }
  };

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} gekopieerd`); }
    catch { toast.error("Kopiëren mislukt"); }
  };

  const runTest = async () => {
    if (!apiKey) { toast.error("Vul eerst een API-sleutel in"); return; }
    setBusy(true);
    // Bouw een test-payload: morgen 19:30, 2 personen
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const payload = {
      localDate: tomorrow,
      localTime: "19:30",
      partySize: 2,
      notes: "Testaanvraag vanuit Integratiehub",
      source: "clickwise_voice",
      contact: {
        fullName: "TableWise Testgast",
        phone: "+31600000000",
        language: "nl",
      },
    };
    try {
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TableWise-Api-Key": apiKey },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      const ok = res.ok && body?.success === true;
      const result = {
        ok,
        at: new Date().toISOString(),
        code: ok ? "OK" : body?.error?.code,
        message: ok ? "Reservering aangemaakt" : (body?.error?.message || `HTTP ${res.status}`),
        reservationCode: body?.reservationCode,
        raw: body,
      };
      persist(result);
      if (ok) toast.success(`Test gelukt — code ${body.reservationCode}`);
      else toast.error(`Test mislukt: ${result.message}`);
    } catch (e) {
      const result = {
        ok: false,
        at: new Date().toISOString(),
        code: "NETWORK",
        message: e instanceof Error ? e.message : "Netwerkfout",
      };
      persist(result);
      toast.error("Test mislukt: " + result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" /> ClickWise AI Voice
            </CardTitle>
            <CardDescription>
              Eén ultra-simpel endpoint voor je AI-telefonist. ClickWise verzamelt gegevens,
              TableWise beslist en boekt.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1"><Bot className="h-3 w-3" /> Aanbevolen</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Endpoint */}
        <div>
          <Label className="text-xs text-muted-foreground">Endpoint URL</Label>
          <div className="flex gap-2 mt-1">
            <code className="flex-1 text-xs bg-muted/40 p-2 rounded font-mono break-all">{endpointUrl}</code>
            <Button size="sm" variant="outline" onClick={() => copy(endpointUrl, "URL")}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Verplichte velden */}
        <div className="rounded-md border p-3 text-sm">
          <div className="font-semibold mb-2">Verplichte velden</div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li><code>localDate</code> — formaat YYYY-MM-DD</li>
            <li><code>localTime</code> — formaat HH:MM (24-uurs)</li>
            <li><code>partySize</code> — geheel getal ≥ 1</li>
            <li><code>contact.fullName</code> — naam van de gast</li>
            <li><code>contact.phone</code> <strong>óf</strong> <code>contact.email</code> — minstens één</li>
          </ul>
          <div className="mt-2 text-xs text-muted-foreground">
            Optioneel: <code>notes</code>, <code>source</code>, <code>contact.language</code>.
          </div>
        </div>

        {/* Voorbeeld payload */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-muted-foreground">Voorbeeld payload</Label>
            <Button size="sm" variant="ghost" onClick={() => copy(JSON.stringify(samplePayload, null, 2), "Payload")}>
              <Copy className="h-3 w-3 mr-1" /> Kopieer
            </Button>
          </div>
          <pre className="text-xs bg-muted/40 p-3 rounded overflow-x-auto">{JSON.stringify(samplePayload, null, 2)}</pre>
        </div>

        {/* Test */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="font-semibold text-sm">Test verbinding</div>
          <p className="text-xs text-muted-foreground">
            Doet een echte testboeking voor morgen 19:30, 2 personen, gast "TableWise Testgast".
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="X-TableWise-Api-Key…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-xs"
            />
            <Button onClick={runTest} disabled={busy || !apiKey}>
              <Send className="h-3 w-3 mr-1" /> {busy ? "Bezig…" : "Test"}
            </Button>
          </div>

          {lastResult && (
            <div className={`mt-2 rounded p-2 text-xs ${lastResult.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {lastResult.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {lastResult.ok
                  ? `Laatste succesvolle test: ${new Date(lastResult.at).toLocaleString("nl-NL")} — code ${lastResult.reservationCode}`
                  : `Laatste fout: ${new Date(lastResult.at).toLocaleString("nl-NL")} — ${lastResult.code}`}
              </div>
              {!lastResult.ok && <div className="mt-1">{lastResult.message}</div>}
            </div>
          )}
        </div>

        {/* Aanbevolen prompt */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-muted-foreground">Aanbevolen AI Voice Agent prompt</Label>
            <Button size="sm" variant="ghost" onClick={() => copy(RECOMMENDED_PROMPT, "Prompt")}>
              <Copy className="h-3 w-3 mr-1" /> Kopieer
            </Button>
          </div>
          <Textarea readOnly value={RECOMMENDED_PROMPT} rows={10} className="text-xs font-mono" />
        </div>
      </CardContent>
    </Card>
  );
}
