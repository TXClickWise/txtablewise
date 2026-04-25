// Knowledge-base / help-pagina voor het koppelen van de ClickWise Voice Agent aan TableWise.
// White-label: nooit "HighLevel" of "GoHighLevel" noemen — alleen "ClickWise".
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, BookOpen, Copy, Search, Phone, KeyRound, Database, Sparkles,
  Workflow, FlaskConical, ListChecks, AlertCircle, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PROJECT_REF = "lbhtztbpxmqlzhyephew";
const AGENT_API_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1/agent_api`;

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Gekopieerd"),
    () => toast.error("Kopiëren mislukt"),
  );
}

function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="rounded-md border bg-muted/40">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{label ?? "code"}</span>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => copy(children)}>
          <Copy className="h-3 w-3 mr-1" /> Kopieer
        </Button>
      </div>
      <pre className="text-xs whitespace-pre-wrap break-all font-mono p-3 leading-relaxed">{children}</pre>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-mono break-all">{value}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => copy(value)}>
        <Copy className="h-3 w-3 mr-1" /> Kopieer
      </Button>
    </div>
  );
}

function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-primary/40 bg-primary/5";
  return (
    <div className={cn("rounded-md border p-3 text-sm space-y-1", cls)}>
      <div className="font-medium flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {title}
      </div>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** searchable haystack — extra trefwoorden bovenop de titel */
  keywords: string;
  render: () => React.ReactNode;
};

// ============================================================
// PROMPT TEMPLATE
// ============================================================
const SYSTEM_PROMPT = `Je bent de digitale gastvrouw van [RESTAURANTNAAM], een restaurant in Nederland (tijdzone Europe/Amsterdam). Je neemt telefonische reserveringen aan in vriendelijk, natuurlijk en beknopt Nederlands. Je spreekt de beller met "u" aan tenzij hij/zij zelf duidelijk informeel is.

DOEL VAN HET GESPREK
1. De beller helpen met:
   a) een nieuwe reservering maken,
   b) een bestaande reservering annuleren,
   c) een algemene vraag (openingstijden, locatie, parkeren, allergie-info) — beantwoord kort en bied anders aan terug te bellen.

GESPREKSREGELS
- Stel altijd één vraag tegelijk. Wacht op antwoord.
- Bevestig altijd hardop alle gegevens (naam, datum, tijd, aantal personen, telefoonnummer) vóór je definitief boekt.
- Spreek datums uit als "vrijdag 12 mei", maar geef ze aan de tools in formaat YYYY-MM-DD.
- Spreek tijden uit als "half acht 's avonds", maar geef ze aan de tools in formaat HH:MM (24-uurs), dus "19:30".
- Aantal personen is een geheel getal tussen 1 en 8. Bij meer dan 8 personen: zeg dat een collega persoonlijk terugbelt en boek NIET.
- Vraag altijd of er allergieën of dieetwensen zijn.
- Vraag het mobiele nummer ter bevestiging, ook als nummerherkenning aanwezig is.
- Bij twijfel of onduidelijkheid: vat samen en vraag bevestiging.
- Bij ruis of als je het niet verstaat: zeg "Sorry, ik versta u niet helemaal goed, kunt u dat herhalen?"

VERPLICHTE TOOL-VOLGORDE
1. Zodra je datum en aantal personen hebt → roep check_availability aan.
2. Bied de beller maximaal 3 tijden aan uit de response.
3. Zodra de beller een tijd kiest én je naam + telefoon hebt → bevestig hardop alles → roep book_reservation aan.
4. Lees het bevestigingsnummer (laatste 6 tekens van reservation_id) hardop voor.
5. Aan het einde van élk gesprek: roep log_call aan met outcome ("booked", "cancelled", "info_only", "no_action", "callback_needed").

ANNULEREN
- Vraag het bevestigingsnummer of het telefoonnummer van de reservering.
- Als de beller een reservation_id geeft → roep cancel_reservation met dat id en reason="Geannuleerd via telefoon".
- Bevestig de annulering hardop.

WAT JE NIET DOET
- Geen menukeuzes opnemen (alleen vermelden dat het via de website kan).
- Geen prijzen of beschikbaarheid raden — gebruik altijd de tool.
- Geen e-mailadres uitvragen tenzij de beller het uit zichzelf wil geven.
- Geen reserveringen maken voor groepen >8 of langer dan 90 dagen vooruit.

AFSLUITING
Sluit altijd af met: "Hartelijk dank voor uw telefoontje, tot [datum en tijd hardop]. Een fijne dag verder!"`;

// ============================================================
// SECTIES
// ============================================================
const SECTIONS: Section[] = [
  {
    id: "fixed-values",
    title: "1. Vaste TableWise-waarden",
    icon: Database,
    keywords: "url endpoint header datum tijd formaat tijdzone",
    render: () => (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Gebruik onderstaande waarden exact zoals ze hier staan. Ze gelden voor de testomgeving en voor live.
        </p>
        <CopyRow label="Agent API base URL" value={AGENT_API_BASE} />
        <CopyRow label="Endpoint — beschikbaarheid" value={`${AGENT_API_BASE}/check_availability`} />
        <CopyRow label="Endpoint — reserveren" value={`${AGENT_API_BASE}/book_reservation`} />
        <CopyRow label="Endpoint — annuleren" value={`${AGENT_API_BASE}/cancel_reservation`} />
        <CopyRow label="Endpoint — call-log" value={`${AGENT_API_BASE}/log_call`} />
        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <CopyRow label="Auth-header naam" value="X-Agent-Api-Key" />
          <CopyRow label="Content-Type" value="application/json" />
          <CopyRow label="Methode" value="POST" />
          <CopyRow label="Tijdzone" value="Europe/Amsterdam" />
          <CopyRow label="Datumformaat" value="YYYY-MM-DD" />
          <CopyRow label="Tijdformaat" value="HH:MM (24-uurs)" />
        </div>
      </div>
    ),
  },
  {
    id: "tablewise-key",
    title: "2. Stappen in TableWise (eenmalig, ~2 min)",
    icon: KeyRound,
    keywords: "api sleutel key genereer voice agent pagina",
    render: () => (
      <ol className="text-sm space-y-2 list-decimal list-inside">
        <li>Log in als owner of manager.</li>
        <li>Ga naar <strong>AI Voice Agent</strong> in de zijbalk (<code>/app/voice-agent</code>).</li>
        <li>
          Tab <strong>Configuratie</strong> → Provider = <strong>ClickWise Voice Agent</strong> →
          Modus = <strong>Sandbox</strong> → klik <strong>Opslaan</strong>.
        </li>
        <li>
          Tab <strong>API-sleutels</strong> → naam: <code>ClickWise Voice Test</code> → klik <strong>Genereer</strong>.
        </li>
        <li>
          <strong>Kopieer de sleutel meteen</strong> (begint met <code>tw_voice_…</code>). Deze zie je maar één keer.
          Bewaar hem in een kladblok — je plakt hem zo in ClickWise.
        </li>
        <li className="pt-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/voice-agent">
              <ArrowLeft className="h-3 w-3 mr-1" /> Open Voice Agent pagina
            </Link>
          </Button>
        </li>
      </ol>
    ),
  },
  {
    id: "custom-fields",
    title: "3. ClickWise — Custom Fields",
    icon: Database,
    keywords: "clickwise contact custom field reservation",
    render: () => (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ClickWise → <strong>Instellingen → Custom Fields → Contact</strong>. Maak deze 8 velden aan.
          De field-key moet exact zo zijn (wordt automatisch gegenereerd op basis van de naam).
        </p>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left p-2">Field Name</th>
                <th className="text-left p-2">Field Key</th>
                <th className="text-left p-2">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["TW Reservation ID", "contact.tw_reservation_id", "Single Line"],
                ["TW Manage Token", "contact.tw_manage_token", "Single Line"],
                ["TW Reservation Date", "contact.tw_reservation_date", "Date"],
                ["TW Reservation Time", "contact.tw_reservation_time", "Single Line"],
                ["TW Party Size", "contact.tw_party_size", "Numeric"],
                ["TW Special Requests", "contact.tw_special_requests", "Multi Line"],
                ["TW Allergies", "contact.tw_allergies", "Multi Line"],
                ["TW Last Call Outcome", "contact.tw_last_call_outcome", "Single Line"],
              ].map(([n, k, t]) => (
                <tr key={k}>
                  <td className="p-2">{n}</td>
                  <td className="p-2 font-mono text-xs">{k}</td>
                  <td className="p-2">{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "custom-values",
    title: "4. ClickWise — Custom Values",
    icon: Database,
    keywords: "clickwise custom values account url key restaurant",
    render: () => (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ClickWise → <strong>Instellingen → Custom Values → Account</strong>. Maak deze 6 waarden aan.
          De waarden van <code>TW Restaurant Name</code> en <code>TW Agent API Key</code> vul je zelf in.
        </p>
        <CopyRow label="TW Agent API URL" value={AGENT_API_BASE} />
        <div className="rounded border bg-muted/30 px-3 py-2 text-sm">
          <div className="text-xs text-muted-foreground">TW Agent API Key</div>
          <div className="font-mono">tw_voice_… (plak hier de sleutel uit stap 2)</div>
        </div>
        <div className="rounded border bg-muted/30 px-3 py-2 text-sm">
          <div className="text-xs text-muted-foreground">TW Restaurant Name</div>
          <div className="font-mono">(naam van je test-restaurant zoals in TableWise)</div>
        </div>
        <CopyRow label="TW Timezone" value="Europe/Amsterdam" />
        <CopyRow label="TW Booking Horizon Days" value="90" />
        <CopyRow label="TW Max Party Online" value="8" />
      </div>
    ),
  },
  {
    id: "voice-agent",
    title: "5. ClickWise — Voice Agent aanmaken",
    icon: Sparkles,
    keywords: "clickwise voice agent assistant prompt tools settings",
    render: () => (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          ClickWise → <strong>Voice Agent → Create Agent</strong>.
        </p>

        <div>
          <div className="font-medium mb-2">Tab: General</div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Agent Name: <code>TableWise Reservering Bot</code></li>
            <li>Language: <code>Dutch (Netherlands)</code></li>
            <li>Voice: kies een NL-vrouwenstem</li>
          </ul>
          <div className="mt-2">
            <CopyRow
              label="Greeting (eerste zin)"
              value="Goedendag, u spreekt met de digitale gastvrouw van {{custom_values.tw_restaurant_name}}. Waarmee kan ik u van dienst zijn?"
            />
          </div>
        </div>

        <div>
          <div className="font-medium mb-2">Tab: Prompt</div>
          <p className="text-muted-foreground mb-2">
            Plak de system-prompt uit sectie <a href="#system-prompt" className="underline">8</a>.
          </p>
        </div>

        <div>
          <div className="font-medium mb-2">Tab: Tools / Actions</div>
          <p className="text-muted-foreground mb-2">
            Voeg de 4 Custom Webhook Actions toe uit sectie <a href="#tools" className="underline">9</a>.
          </p>
        </div>

        <div>
          <div className="font-medium mb-2">Tab: Settings</div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>End call when silent for: <code>15s</code></li>
            <li>Max call duration: <code>8 min</code></li>
            <li>Allow interruptions: <code>On</code></li>
            <li>Background sound: <code>Restaurant ambience</code> (optioneel)</li>
            <li>Post-call webhook: leeg laten — wij loggen via tool <code>log_call</code></li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "phone",
    title: "6. ClickWise — Telefoonnummer koppelen",
    icon: Phone,
    keywords: "telefoon nummer phone inbound",
    render: () => (
      <ol className="text-sm space-y-2 list-decimal list-inside">
        <li>ClickWise → <strong>Instellingen → Phone Numbers</strong>.</li>
        <li>Koop of importeer een NL-nummer.</li>
        <li>
          Bij <strong>Inbound Call Settings</strong> kies <strong>Voice Agent</strong> →
          selecteer <code>TableWise Reservering Bot</code>.
        </li>
        <li>Test door zelf naar het nummer te bellen.</li>
      </ol>
    ),
  },
  {
    id: "workflow",
    title: "7. ClickWise — Inbound Webhook Workflow",
    icon: Workflow,
    keywords: "workflow inbound webhook contact sms bevestiging",
    render: () => (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          ClickWise → <strong>Automation → Workflows → Create Workflow</strong>. Naam:
          <code className="mx-1">TableWise — Voice Booking Confirmation</code>.
        </p>
        <div>
          <div className="font-medium">Trigger</div>
          <p className="text-muted-foreground">
            <code>Inbound Webhook</code>. Kopieer de webhook-URL die ClickWise je toont — die wordt straks door
            de Voice Agent (tool 4 / log_call of een aparte action) aangeroepen om het contact bij te werken.
          </p>
        </div>
        <div>
          <div className="font-medium">Action 1 — Find or Create Contact</div>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>Match op <code>phone</code></li>
            <li>Phone: <code>{`{{trigger.phone}}`}</code></li>
            <li>First Name: <code>{`{{trigger.first_name}}`}</code></li>
            <li>Email: <code>{`{{trigger.email}}`}</code></li>
            <li>TW Reservation ID: <code>{`{{trigger.reservation_id}}`}</code></li>
            <li>TW Reservation Date: <code>{`{{trigger.reservation_date}}`}</code></li>
            <li>TW Reservation Time: <code>{`{{trigger.reservation_time}}`}</code></li>
            <li>TW Party Size: <code>{`{{trigger.party_size}}`}</code></li>
            <li>TW Manage Token: <code>{`{{trigger.manage_token}}`}</code></li>
          </ul>
        </div>
        <div>
          <div className="font-medium">Action 2 — Send SMS</div>
          <CodeBlock label="SMS naar {{contact.phone}}">
{`Hallo {{contact.first_name}}, uw reservering bij {{custom_values.tw_restaurant_name}} op {{contact.tw_reservation_date}} om {{contact.tw_reservation_time}} voor {{contact.tw_party_size}} personen is bevestigd. Wijzigen of annuleren? Bel ons of antwoord op deze sms.`}
          </CodeBlock>
        </div>
      </div>
    ),
  },
  {
    id: "system-prompt",
    title: "8. System Prompt (copy-paste)",
    icon: BookOpen,
    keywords: "prompt system instructie nederlands gastvrouw",
    render: () => (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Plak in de Voice Agent → Prompt-tab. Vervang <code>[RESTAURANTNAAM]</code> door je restaurantnaam,
          óf gebruik <code>{`{{custom_values.tw_restaurant_name}}`}</code> als ClickWise dat in de prompt rendert.
        </p>
        <CodeBlock label="System prompt — Nederlands">{SYSTEM_PROMPT}</CodeBlock>
      </div>
    ),
  },
  {
    id: "tools",
    title: "9. Tool definities (4 stuks)",
    icon: ListChecks,
    keywords: "tool action webhook check_availability book_reservation cancel_reservation log_call",
    render: () => {
      const headers = `X-Agent-Api-Key: {{custom_values.tw_agent_api_key}}\nContent-Type: application/json`;
      return (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            In ClickWise voeg je per tool een <strong>Custom Webhook Action</strong> toe aan de Voice Agent.
            Methode is altijd <code>POST</code>. Plak de URL, headers en body exact zoals hieronder.
          </p>

          {/* Tool 1 */}
          <div className="space-y-2">
            <div className="font-medium flex items-center gap-2">
              <Badge variant="outline">Tool 1</Badge> check_availability
            </div>
            <CopyRow
              label="Description (voor de agent)"
              value="Controleer welke tijdsloten beschikbaar zijn op een bepaalde datum voor een aantal personen. Gebruik dit ALTIJD voordat je een tijd voorstelt."
            />
            <CopyRow label="URL" value={`${AGENT_API_BASE}/check_availability`} />
            <CodeBlock label="Headers">{headers}</CodeBlock>
            <CodeBlock label="Body (JSON)">{`{
  "date": "{{date}}",
  "party_size": {{party_size}}
}`}</CodeBlock>
            <div className="text-xs text-muted-foreground">
              Parameters: <code>date</code> (string, verplicht, YYYY-MM-DD) ·
              <code> party_size</code> (number, verplicht, 1–8).
              Response bevat <code>slots</code> (array van <code>{`{ time, available }`}</code>).
            </div>
          </div>

          {/* Tool 2 */}
          <div className="space-y-2">
            <div className="font-medium flex items-center gap-2">
              <Badge variant="outline">Tool 2</Badge> book_reservation
            </div>
            <CopyRow
              label="Description"
              value="Maak de reservering definitief aan. Gebruik dit pas nadat je alle gegevens hardop hebt bevestigd met de beller."
            />
            <CopyRow label="URL" value={`${AGENT_API_BASE}/book_reservation`} />
            <CodeBlock label="Headers">{headers}</CodeBlock>
            <CodeBlock label="Body (JSON)">{`{
  "date": "{{date}}",
  "time": "{{time}}",
  "party_size": {{party_size}},
  "guest": {
    "first_name": "{{first_name}}",
    "last_name": "{{last_name}}",
    "phone": "{{phone}}"
  },
  "special_requests": "{{special_requests}}"
}`}</CodeBlock>
            <div className="text-xs text-muted-foreground">
              Parameters: <code>date</code> (YYYY-MM-DD), <code>time</code> (HH:MM 24h),
              <code> party_size</code> (1–8), <code>first_name</code> (verplicht),
              <code> last_name</code> (optioneel), <code>phone</code> (verplicht, internationaal +31...),
              <code> special_requests</code> (optioneel — allergieën / gelegenheid).
              Response bevat <code>reservation_id</code> en <code>manage_token</code>.
              Lees de laatste 6 tekens van <code>reservation_id</code> hardop voor als bevestigingscode.
            </div>
          </div>

          {/* Tool 3 */}
          <div className="space-y-2">
            <div className="font-medium flex items-center gap-2">
              <Badge variant="outline">Tool 3</Badge> cancel_reservation
            </div>
            <CopyRow
              label="Description"
              value="Annuleer een bestaande reservering op basis van het reservation_id dat de beller doorgeeft."
            />
            <CopyRow label="URL" value={`${AGENT_API_BASE}/cancel_reservation`} />
            <CodeBlock label="Headers">{headers}</CodeBlock>
            <CodeBlock label="Body (JSON)">{`{
  "reservation_id": "{{reservation_id}}",
  "reason": "{{reason}}"
}`}</CodeBlock>
            <div className="text-xs text-muted-foreground">
              Parameters: <code>reservation_id</code> (UUID, verplicht) ·
              <code> reason</code> (optioneel).
            </div>
          </div>

          {/* Tool 4 */}
          <div className="space-y-2">
            <div className="font-medium flex items-center gap-2">
              <Badge variant="outline">Tool 4</Badge> log_call
              <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">verplicht aan einde</Badge>
            </div>
            <CopyRow
              label="Description"
              value="Log het resultaat van het gesprek in TableWise. ALTIJD aanroepen vlak voor je het gesprek afsluit."
            />
            <CopyRow label="URL" value={`${AGENT_API_BASE}/log_call`} />
            <CodeBlock label="Headers">{headers}</CodeBlock>
            <CodeBlock label="Body (JSON)">{`{
  "external_call_id": "{{call.id}}",
  "caller_phone": "{{contact.phone}}",
  "callee_phone": "{{call.to_number}}",
  "outcome": "{{outcome}}",
  "reservation_id": "{{reservation_id}}",
  "duration_seconds": {{call.duration_seconds}},
  "summary": "{{summary}}",
  "agent_id": "tablewise-reservering-bot"
}`}</CodeBlock>
            <div className="text-xs text-muted-foreground">
              <code>outcome</code> (verplicht) — een van:{" "}
              <code>booked</code>, <code>cancelled</code>, <code>info_only</code>,{" "}
              <code>no_action</code>, <code>callback_needed</code>. <br />
              <code>reservation_id</code> alleen als er geboekt of geannuleerd is.{" "}
              <code>summary</code> — korte NL-samenvatting (max 2 zinnen).
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "test",
    title: "10. Eerste test (5 min) & foutmeldingen",
    icon: FlaskConical,
    keywords: "test sandbox bellen 401 403 400 troubleshoot",
    render: () => (
      <div className="space-y-3 text-sm">
        <ol className="list-decimal list-inside space-y-2">
          <li>Bel het ClickWise-nummer met je eigen mobiel.</li>
          <li>Vraag een tafel voor 2 personen, 3 dagen vooruit, om 19:30.</li>
          <li>Verwacht: agent bevestigt en leest een 6-cijferige code voor.</li>
          <li>
            Open in TableWise <Link to="/app" className="underline">Vandaag</Link> of{" "}
            <Link to="/app/reserveringen" className="underline">Reserveringen</Link> — de boeking staat er met
            kanaal <code>ai_host</code>.
          </li>
          <li>
            Open <Link to="/app/voice-agent" className="underline">Voice Agent</Link> → tab <strong>Calls</strong> —
            je gesprek staat in de log met outcome <code>booked</code>.
          </li>
        </ol>

        <Callout tone="warn" title="Foutmeldingen oplossen">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>401 Missing X-Agent-Api-Key / Invalid key</strong> — sleutel niet juist gekopieerd in de
              custom value <code>TW Agent API Key</code> of in de tool-headers.
            </li>
            <li>
              <strong>403 Scope missing</strong> — sleutel opnieuw genereren in TableWise (default scopes:
              <code> availability</code>, <code>book</code>, <code>cancel</code>).
            </li>
            <li>
              <strong>400 Missing field</strong> — een variabele in de body-template is leeg gebleven; controleer
              de Parameters van de tool.
            </li>
            <li>
              <strong>404 Reservation not found</strong> — de gast belt met een code uit een ander restaurant of
              een al verwijderde reservering.
            </li>
          </ul>
        </Callout>

        <Callout tone="success" title="Klaar voor live?">
          Pas als alle 5 teststappen kloppen: zet in TableWise → Voice Agent de modus van <strong>Sandbox</strong>{" "}
          op <strong>Live</strong>. De bestaande ClickWise bevestigings- en reminder-flow pakt de boeking dan
          automatisch op.
        </Callout>
      </div>
    ),
  },
];

// ============================================================
// PAGE
// ============================================================
export default function VoiceAgentHelp() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SECTIONS;
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.keywords.toLowerCase().includes(needle),
    );
  }, [q]);

  return (
    <div className="p-6 max-w-6xl mx-auto print:p-0">
      <div className="flex items-start justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl">Voice Agent — Koppelhandleiding</h1>
            <p className="text-sm text-muted-foreground">
              Stap-voor-stap koppelen van de ClickWise Voice Agent aan TableWise. Alle waarden zijn copy-paste klaar.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/voice-agent">
              <ArrowLeft className="h-4 w-4 mr-1" /> Terug naar Voice Agent
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* Inhoudsopgave */}
        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-4 space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-2">
              Inhoudsopgave
            </div>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-sm px-2 py-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </div>
        </aside>

        {/* Inhoud */}
        <div className="space-y-4">
          <div className="relative print:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek in de handleiding (bv. 'webhook', 'sleutel', 'prompt')…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Geen sectie gevonden voor "{q}".</p>
          )}

          {filtered.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.id} id={s.id} className="scroll-mt-4">
                <CardHeader>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>{s.render()}</CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
