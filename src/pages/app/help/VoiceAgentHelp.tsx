// Knowledge-base / help-pagina voor het koppelen van de ClickWise Voice Agent aan TableWise.
// White-label: nooit "HighLevel" of "GoHighLevel" noemen — alleen "ClickWise".
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, BookOpen, Copy, Search, Phone, KeyRound, Database, Sparkles,
  Workflow, FlaskConical, ListChecks, AlertCircle, Printer, ChevronDown, Wrench, Rocket,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PROJECT_REF =
  ((import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string | undefined) ||
  "lbhtztbpxmqlzhyephew";
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

type ToolParam = {
  name: string;
  type: "String" | "Number" | "Boolean";
  required: boolean;
  description: string;
  example: string;
};

function ToolParamTable({ params }: { params: ToolParam[] }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className="bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground border-b">
        Data collection — Body params (vul deze rijen exact zo in bij <code>Data collection for query params and body params</code>)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/20 text-muted-foreground">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-medium">Field name</th>
              <th className="px-2 py-1.5 font-medium">Type</th>
              <th className="px-2 py-1.5 font-medium">In</th>
              <th className="px-2 py-1.5 font-medium">Required</th>
              <th className="px-2 py-1.5 font-medium">Description (copy)</th>
              <th className="px-2 py-1.5 font-medium">Example</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name} className="border-t align-top">
                <td className="px-2 py-1.5 font-mono whitespace-nowrap">{p.name}</td>
                <td className="px-2 py-1.5">{p.type}</td>
                <td className="px-2 py-1.5">Body</td>
                <td className="px-2 py-1.5">
                  {p.required ? (
                    <span className="text-emerald-600 font-medium">Ja</span>
                  ) : (
                    <span className="text-muted-foreground">Nee</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-start gap-1">
                    <span className="flex-1">{p.description}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 shrink-0"
                      onClick={() => copy(p.description)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
                <td className="px-2 py-1.5 font-mono text-[11px] whitespace-nowrap">{p.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

type SectionGroup = "quickstart" | "manual" | "golive";
type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  group: SectionGroup;
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
- Bevestig altijd hardop alle gegevens (naam, datum, tijd, aantal personen en het te noteren telefoonnummer) vóór je definitief boekt.
- Spreek datums uit als "vrijdag 12 mei", maar geef ze aan de tools in formaat YYYY-MM-DD.
- Spreek tijden uit als "half acht 's avonds", maar geef ze aan de tools in formaat HH:MM (24-uurs), dus "19:30".
- Gewenste tijd is VERPLICHT bij elke beschikbaarheidscheck. Vraag deze altijd uit, ook bij open vragen zoals "hebben jullie vanavond plek voor 4?" — antwoord dan: "Rond welk tijdstip zou u willen komen?" en gebruik dat als preferred_time.
- Aantal personen is een geheel getal tussen 1 en 8. Bij meer dan 8 personen: zeg dat een collega persoonlijk terugbelt en boek NIET.
- Vraag altijd of er allergieën of dieetwensen zijn.
- Telefoonnummer is VERPLICHT bij elke reservering. Het nummer waarmee de beller belt is automatisch beschikbaar als {{contact.phone}}. Vraag NIET opnieuw om het nummer als {{contact.phone}} gevuld is — vraag in plaats daarvan één keer kort: "Mag ik het nummer waarmee u nu belt noteren bij de reservering?" Bij ja → gebruik {{contact.phone}}. Bij nee of als de beller een ander nummer noemt → vraag dat nummer uit, herhaal het hardop cijfer-voor-cijfer ter controle, en gebruik dát nummer. Als {{contact.phone}} leeg is (anoniem/withheld) → vraag het nummer actief uit en herhaal cijfer-voor-cijfer. Boek NIET zonder geldig telefoonnummer.
- Bij twijfel of onduidelijkheid: vat samen en vraag bevestiging.
- Bij ruis of als je het niet verstaat: zeg "Sorry, ik versta u niet helemaal goed, kunt u dat herhalen?"

VERPLICHTE TOOL-VOLGORDE
1. Vraag altijd: datum, aantal personen ÉN gewenste tijd (HH:mm). Zodra alle drie binnen zijn → roep check_availability aan met date, party_size én preferred_time.
2. Als response.exact gevuld is → bevestig hardop: "[gewenste tijd] is beschikbaar, zal ik die reserveren?" Als response.exact = null → noem 2 à 3 alternatieven uit response.alternatives rond de gewenste tijd, in volgorde van nabijheid. Bijvoorbeeld: "19:30 lukt helaas niet, maar 19:00, 20:00 of 20:30 zijn wel beschikbaar — welke past?"
3. Zodra de beller een tijd kiest én je naam hebt + een geldig telefoonnummer (bevestigd {{contact.phone}} of door beller opgegeven nummer) → bevestig hardop alles → roep create_reservation aan met phone = dat nummer.
4. Bevestig hardop datum, tijd en aantal personen. Lees GEEN reservation_id of bevestigingscode voor — de gast krijgt deze automatisch per SMS/WhatsApp toegestuurd.
5. Aan het einde van élk gesprek: roep log_call aan met outcome ("booked", "cancelled", "updated", "info_only", "no_action", "callback_needed").

ANNULEREN
- Probeer eerst stilzwijgend te matchen op {{contact.phone}} via find_reservation. Lukt dat met precies 1 match → bevestig hardop welke reservering je gevonden hebt (datum + tijd + aantal personen).
- Lukt dat niet (geen match, anoniem nummer, of meerdere matches): vraag de gast om voor- + achternaam en de datum (en zo nodig de tijd) van de reservering. Roep find_reservation opnieuw aan met first_name/last_name + date (+ optioneel time).
- Bij meerdere matches → noem ze kort op ("Ik vind er twee: 19:00 voor 2 personen en 20:30 voor 4 personen — welke bedoelt u?") en laat de gast kiezen.
- Vraag NOOIT om een bevestigingsnummer of reservation_id — die kent de gast niet en is niet nodig.
- Zodra je 1 reservation_id uit find_reservation hebt → roep cancel_reservation aan met dat id en reason="Geannuleerd via telefoon".
- Bevestig de annulering hardop met datum + tijd. Lees geen id of code voor.

WIJZIGEN
- Probeer eerst stilzwijgend te matchen op {{contact.phone}} via find_reservation. Lukt dat met precies 1 match → bevestig hardop welke reservering je gevonden hebt.
- Lukt dat niet of bij meerdere matches: vraag voor- + achternaam en datum (+ optioneel tijd) en roep find_reservation opnieuw aan. Vraag NOOIT om een bevestigingsnummer of reservation_id.
- Vraag wat er moet veranderen: datum, tijd en/of aantal personen.
- Roep eerst check_availability aan voor de nieuwe combinatie (geef de nieuwe tijd mee als preferred_time). Als response.exact = null → bied 2 à 3 alternatieven uit response.alternatives aan en laat de beller kiezen.
- Pas als beschikbaar → roep update_reservation aan met de intern opgehaalde reservation_id + alleen de gewijzigde velden (new_date, new_time, new_party_size).
- Bevestig de wijziging hardop met de nieuwe datum/tijd. Lees geen id of code voor.

WAT JE NIET DOET
- Geen menukeuzes opnemen (alleen vermelden dat het via de website kan).
- Geen prijzen of beschikbaarheid raden — gebruik altijd de tool.
- E-mailadres is optioneel. Vraag het NIET standaard uit. Alleen noteren als de beller het uit zichzelf opgeeft of expliciet een digitale bevestiging vraagt.
- Boek nooit te ver vooruit. Als de engine een fout teruggeeft dat de datum buiten de boekingshorizon valt, leg dat vriendelijk uit en bied aan dat een collega de gast terugbelt.

AFSLUITING
Sluit altijd af met: "Hartelijk dank voor uw telefoontje, tot [datum en tijd hardop]. Een fijne dag verder!"`;

// ============================================================
// SECTIES
// ============================================================
const SECTIONS: Section[] = [
  {
    id: "fixed-values",
    group: "quickstart",
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
        <CopyRow label="Endpoint — wijzigen" value={`${AGENT_API_BASE}/update_reservation`} />
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
    group: "quickstart",
    title: "2. Stappen in TableWise (eenmalig, ~2 min)",
    icon: KeyRound,
    keywords: "api sleutel key voice agent pagina kopieer status configuratie",
    render: () => (
      <div className="space-y-3">
        <ol className="text-sm space-y-2 list-decimal list-inside">
          <li>Log in als <strong>owner</strong> of <strong>manager</strong>.</li>
          <li>
            Open in de zijbalk <strong>AI Voice Agent</strong>
            <span className="text-muted-foreground"> (<code>/app/voice-agent</code>)</span>.
          </li>
          <li>
            Tab <strong>Status &amp; test</strong> — controleer dat <em>API-sleutel</em> op
            <Badge variant="outline" className="mx-1">✅ Actief</Badge> staat.
            <div className="text-xs text-muted-foreground ml-5 mt-1">
              Staat er ⚠️ Ontbreekt? Vraag TableWise support of een system admin om een sleutel
              voor jouw restaurant aan te maken — die wordt 1× volledig getoond en daarna alleen
              als prefix bewaard.
            </div>
          </li>
          <li>
            Tab <strong>API-koppeling</strong> — klik <em>Kopieer</em> bij de
            <strong> Base URL</strong> en de <strong>API-sleutel</strong>. Plak ze tijdelijk in
            een kladblok; je hebt ze zo nodig in ClickWise.
          </li>
          <li>
            Tab <strong>Configuratie</strong> — Provider = <strong>ClickWise Voice AI</strong>,
            Modus = <strong>Sandbox</strong>, vul het telefoonnummer in en klik <strong>Opslaan</strong>.
          </li>
          <li>
            Klaar — de rest gebeurt in ClickWise (zie volgende secties).
          </li>
          <li className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/voice-agent">
                <ArrowLeft className="h-3 w-3 mr-1" /> Open Voice Agent pagina
              </Link>
            </Button>
          </li>
        </ol>
        <Callout tone="info" title="Heb je al een master snapshot in ClickWise?">
          Sla secties 3–9 over en gebruik de korte onboarding in sectie 2b — dan ben je in 6
          stappen klaar.
        </Callout>
      </div>
    ),
  },
  {
    id: "snapshot-onboarding",
    group: "quickstart",
    title: "2b. Snel onboarden vanuit master snapshot (6 stappen)",
    icon: Sparkles,
    keywords: "master snapshot sub-account custom values onboarding nieuwe klant",
    render: () => (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Heeft jullie ClickWise-account een <strong>TableWise master snapshot</strong>? Dan
          staat alles (Custom Fields, Custom Values, Voice Agent, Workflows) al klaar met
          placeholders. Je hoeft per klant alleen de waarden in te vullen.
        </p>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            Maak in ClickWise een <strong>nieuwe sub-account vanuit de TableWise master snapshot</strong>.
            <strong> Zet de sub-account naam exact gelijk aan de restaurantnaam in TableWise</strong> en kies
            de juiste <strong>tijdzone</strong> — beide worden automatisch in de prompt, SMS en tools gebruikt
            via <code>{`{{location.name}}`}</code> en <code>{`{{location.timezone}}`}</code>.
          </li>
          <li>
            Ga naar <strong>Instellingen → Custom Values → Account</strong> en plak in
            <code className="mx-1">tw_agent_api_key</code> de sleutel uit TableWise (sectie 2, stap 4).
          </li>
          <li>
            Controleer dat <code>tw_agent_api_url</code> gelijk is aan de Base URL uit sectie 1.
            Deze is voor alle klanten hetzelfde — alleen aanpassen als support dat zegt.
          </li>
          <li>
            Koppel een telefoonnummer aan de Voice Agent (zie sectie 6).
          </li>
          <li>
            Doe een test-call (zie sectie 10). Als die slaagt en in TableWise zichtbaar is, ben je
            klaar voor de live-stap (sectie 11).
          </li>
        </ol>
        <Callout tone="info" title="Géén snapshot? Lees eerst secties 3–9">
          Dan moet je Custom Fields, Custom Values, Voice Agent en Workflow eenmalig handmatig
          opzetten. Daarna kun je hier zelf een snapshot van maken voor volgende klanten.
        </Callout>
      </div>
    ),
  },
  {
    id: "custom-fields",
    group: "manual",
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
    group: "manual",
    title: "4. ClickWise — Custom Values",
    icon: Database,
    keywords: "clickwise custom values account url key restaurant location",
    render: () => (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ClickWise → <strong>Instellingen → Custom Values → Account</strong>. Je hebt nog maar
          twee waarden nodig per klant — alle restaurant-specifieke info (naam, tijdzone, max.
          groepsgrootte) wordt automatisch opgehaald.
        </p>
        <CopyRow label="TW Agent API URL" value={AGENT_API_BASE} />
        <div className="rounded border bg-muted/30 px-3 py-2 text-sm">
          <div className="text-xs text-muted-foreground">TW Agent API Key</div>
          <div className="font-mono">tw_voice_… (plak hier de sleutel uit stap 2)</div>
        </div>
        <Callout tone="success" title="Automatisch ingevuld — niet meer als custom value nodig">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Restaurantnaam</strong> → <code>{`{{location.name}}`}</code> (sub-account
              naam in ClickWise). Zet die bij het aanmaken gelijk aan de naam in TableWise.
            </li>
            <li>
              <strong>Tijdzone</strong> → <code>{`{{location.timezone}}`}</code> (sub-account
              tijdzone). Standaard <code>Europe/Amsterdam</code>.
            </li>
            <li>
              <strong>Max. groepsgrootte</strong> → komt rechtstreeks uit TableWise
              (<code>max_party_size_online</code>). De engine weigert te grote groepen
              automatisch met code <code>TW_409_PARTY_TOO_LARGE</code>; de agent leest die
              terug en biedt een grote-groep-callback aan.
            </li>
            <li>
              <strong>Booking horizon</strong> (max. dagen vooruit) → uit TableWise
              (<code>booking_horizon_days</code>). De engine weigert te ver vooruit boeken
              automatisch. Pas aan in TableWise → <strong>Instellingen → Reserveringsregels →
              Booking horizon (dagen)</strong>.
            </li>
          </ul>
        </Callout>
      </div>
    ),
  },
  {
    id: "voice-agent",
    group: "manual",
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
              value="Goedendag, u spreekt met de digitale gastvrouw van {{location.name}}. Waarmee kan ik u van dienst zijn?"
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
            Voeg de 5 Custom Webhook Actions toe uit sectie <a href="#tools" className="underline">9</a>.
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
    group: "manual",
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
    group: "manual",
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
{`Hallo {{contact.first_name}}, uw reservering bij {{location.name}} op {{contact.tw_reservation_date}} om {{contact.tw_reservation_time}} voor {{contact.tw_party_size}} personen is bevestigd. Wijzigen of annuleren? Bel ons of antwoord op deze sms.`}
          </CodeBlock>
        </div>
      </div>
    ),
  },
  {
    id: "system-prompt",
    group: "manual",
    title: "8. System Prompt (copy-paste)",
    icon: BookOpen,
    keywords: "prompt system instructie nederlands gastvrouw",
    render: () => (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Plak in de Voice Agent → Prompt-tab. Vervang <code>[RESTAURANTNAAM]</code> door
          <code>{` {{location.name}} `}</code> — ClickWise vult dan automatisch de sub-account
          naam in. Vervang ook <code>Europe/Amsterdam</code> door <code>{`{{location.timezone}}`}</code>
          als je meerdere tijdzones gebruikt.
        </p>
        <Callout tone="info" title="Max. groepsgrootte komt uit TableWise">
          De grens komt automatisch uit TableWise (<code>max_party_size_online</code>) — je
          hoeft hem niet als Custom Value te onderhouden. De engine weigert te grote groepen
          met <code>TW_409_PARTY_TOO_LARGE</code>; de telefoon-agent zegt dan dat een collega
          persoonlijk terugbelt en boekt zelf <strong>niet</strong>. Pas de grens aan in
          TableWise → <strong>Instellingen → Reserveringsregels</strong>.
        </Callout>
        <CodeBlock label="System prompt — Nederlands">{SYSTEM_PROMPT}</CodeBlock>
      </div>
    ),
  },
  {
    id: "tools",
    group: "manual",
    title: "9. Tool definities (5 stuks)",
    icon: ListChecks,
    keywords: "tool action webhook check_availability book_reservation create_reservation cancel_reservation update_reservation wijzigen log_call query parameters data collection",
    render: () => {
      const headers = `X-Agent-Api-Key: {{custom_values.tw_agent_api_key}}\nContent-Type: application/json`;

      const toolBlock = (args: {
        n: number;
        name: string;
        url: string;
        description: string;
        params: ToolParam[];
        body: string;
        responseHint: React.ReactNode;
        endNote?: React.ReactNode;
      }) => (
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <Badge variant="outline">Tool {args.n}</Badge> {args.name}
            {args.name === "log_call" && (
              <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">
                verplicht aan einde
              </Badge>
            )}
          </div>
          <CopyRow label="Description (voor de agent)" value={args.description} />
          <CopyRow label="URL" value={args.url} />
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded border bg-muted/30 px-3 py-2">
              <div className="text-muted-foreground">Method</div>
              <div className="font-mono">POST</div>
            </div>
            <div className="rounded border bg-muted/30 px-3 py-2">
              <div className="text-muted-foreground">Query parameters</div>
              <div className="font-medium">Leeg laten</div>
            </div>
            <div className="rounded border bg-muted/30 px-3 py-2">
              <div className="text-muted-foreground">Auth</div>
              <div className="font-mono">X-Agent-Api-Key</div>
            </div>
          </div>
          <CodeBlock label="Headers">{headers}</CodeBlock>
          <ToolParamTable params={args.params} />
          <CodeBlock label="Body (JSON) — voorbeeld">{args.body}</CodeBlock>
          <div className="text-xs text-muted-foreground">{args.responseHint}</div>
          {args.endNote && <div className="text-xs text-muted-foreground">{args.endNote}</div>}
        </div>
      );

      return (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            In ClickWise voeg je per tool een <strong>Custom Webhook Action</strong> toe aan de
            Voice Agent. Methode is altijd <code>POST</code>. Bij <em>Query parameters</em> hoef je
            <strong> niets</strong> in te vullen — alle velden gaan in de body. Vul bij
            <em> Data collection for query params and body params</em> precies de rijen in uit de
            tabel per tool.
          </p>

          {toolBlock({
            n: 1,
            name: "check_availability",
            url: `${AGENT_API_BASE}/check_availability`,
            description:
              "Controleer welke tijdsloten beschikbaar zijn op een bepaalde datum voor een aantal personen. Gebruik dit ALTIJD voordat je een tijd voorstelt of voordat je iets wijzigt.",
            params: [
              {
                name: "date",
                type: "String",
                required: true,
                description:
                  "Reserveringsdatum in formaat YYYY-MM-DD. Reken vanaf {{system__time_utc}} als de beller 'morgen', 'vrijdag' etc. zegt.",
                example: "2026-05-26",
              },
              {
                name: "party_size",
                type: "Number",
                required: true,
                description: "Aantal personen, geheel getal tussen 1 en 8.",
                example: "4",
              },
              {
                name: "preferred_time",
                type: "String",
                required: true,
                description:
                  "VERPLICHT. Gewenste tijd in HH:mm (24-uurs). Vraag altijd actief: 'Hoe laat zou u willen komen?' Boek niet zonder bevestigde gewenste tijd.",
                example: "19:30",
              },
            ],
            body: `{
  "date": "{{date}}",
  "party_size": {{party_size}},
  "preferred_time": "{{preferred_time}}"
}`,
            responseHint: (
              <>
                Response bevat <code>exact</code> (één slot of <code>null</code>) en{" "}
                <code>alternatives</code> (max 3 slots gesorteerd op nabijheid).{" "}
                <strong>Als <code>exact</code> gevuld is</strong> → bevestig die tijd
                direct hardop.{" "}
                <strong>Als <code>exact</code> = null</strong> → noem 2 à 3 alternatieven
                uit <code>alternatives[].time</code> rond de gewenste tijd.
              </>
            ),
          })}

          {toolBlock({
            n: 2,
            name: "book_reservation",
            url: `${AGENT_API_BASE}/book_reservation`,
            description:
              "Maak de reservering definitief aan. Gebruik dit pas nadat je alle gegevens hardop hebt bevestigd met de beller.",
            params: [
              { name: "date", type: "String", required: true, description: "Reserveringsdatum YYYY-MM-DD.", example: "2026-05-26" },
              { name: "time", type: "String", required: true, description: "Reserveringstijd HH:mm (24-uurs).", example: "19:30" },
              { name: "party_size", type: "Number", required: true, description: "Aantal personen, 1 t/m 8.", example: "4" },
              { name: "first_name", type: "String", required: true, description: "Voornaam van de gast.", example: "Jan" },
              { name: "last_name", type: "String", required: false, description: "Achternaam van de gast (optioneel).", example: "de Vries" },
              { name: "phone", type: "String", required: true, description: "VERPLICHT. Telefoonnummer in E.164. Default {{contact.phone}} (nummer waarmee beller belt). Alleen anders als beller expliciet ander nummer opgeeft.", example: "+31612345678" },
              { name: "email", type: "String", required: false, description: "Optioneel. Alleen invullen als de beller dit zelf opgeeft of digitale bevestiging vraagt.", example: "gast@voorbeeld.nl" },
              { name: "special_requests", type: "String", required: false, description: "Allergieën, gelegenheid of andere wensen.", example: "Kinderstoel graag" },
            ],
            body: `{
  "date": "{{date}}",
  "time": "{{time}}",
  "party_size": {{party_size}},
  "guest": {
    "first_name": "{{contact.first_name}}",
    "last_name": "{{contact.last_name}}",
    "phone": "{{contact.phone}}",
    "email": "{{contact.email}}"
  },
  "special_requests": "{{special_requests}}"
}`,
            responseHint: (
              <>
                Response bevat <code>reservation_id</code> en <code>manage_token</code>. Lees de
                laatste 6 tekens van <code>reservation_id</code> hardop voor als
                bevestigingscode.
              </>
            ),
            endNote: (
              <>
                <strong>Tip:</strong> de standaard contactvelden van ClickWise (
                <code>{`{{contact.first_name}}`}</code>, <code>{`{{contact.phone}}`}</code> etc.)
                kun je rechtstreeks in de body gebruiken — die hoef je niet als losse data-collection-rij
                aan te maken. Voeg <code>first_name</code> alleen toe als data-collection-veld
                wanneer je het door de agent wilt láten uitvragen.
              </>
            ),
          })}

          {toolBlock({
            n: 3,
            name: "cancel_reservation",
            url: `${AGENT_API_BASE}/cancel_reservation`,
            description:
              "Annuleer een bestaande reservering op basis van het reservation_id dat de beller doorgeeft (of dat je via find_reservation hebt opgehaald).",
            params: [
              { name: "reservation_id", type: "String", required: true, description: "UUID van de te annuleren reservering.", example: "00000000-0000-0000-0000-000000000000" },
              { name: "reason", type: "String", required: false, description: "Korte reden van annulering in het Nederlands.", example: "Geannuleerd via telefoon" },
            ],
            body: `{
  "reservation_id": "{{reservation_id}}",
  "reason": "{{reason}}"
}`,
            responseHint: (
              <>
                Response bevat <code>success: true</code>. Bevestig de annulering hardop aan de
                beller.
              </>
            ),
          })}

          {toolBlock({
            n: 4,
            name: "update_reservation",
            url: `${AGENT_API_BASE}/update_reservation`,
            description:
              "Wijzig datum, tijd en/of aantal personen van een bestaande reservering. Vul minimaal één van new_date, new_time of new_party_size. Controleer eerst met check_availability of de nieuwe combinatie kan.",
            params: [
              { name: "reservation_id", type: "String", required: true, description: "UUID van de bestaande reservering.", example: "00000000-0000-0000-0000-000000000000" },
              { name: "new_date", type: "String", required: false, description: "Nieuwe datum YYYY-MM-DD. Laat leeg als de datum niet wijzigt.", example: "2026-05-27" },
              { name: "new_time", type: "String", required: false, description: "Nieuwe tijd HH:mm (24-uurs). Laat leeg als de tijd niet wijzigt.", example: "20:00" },
              { name: "new_party_size", type: "Number", required: false, description: "Nieuw aantal personen, 1 t/m 8. Laat leeg als het aantal niet wijzigt.", example: "6" },
              { name: "special_requests", type: "String", required: false, description: "Bijgewerkte wensen (overschrijft bestaande wensen).", example: "Toch geen kinderstoel" },
            ],
            body: `{
  "reservation_id": "{{reservation_id}}",
  "new_date": "{{new_date}}",
  "new_time": "{{new_time}}",
  "new_party_size": {{new_party_size}},
  "special_requests": "{{special_requests}}"
}`,
            responseHint: (
              <>
                Response bevat de bijgewerkte reservering. Bevestig hardop met de nieuwe datum,
                tijd en aantal personen.
              </>
            ),
          })}

          {toolBlock({
            n: 5,
            name: "log_call",
            url: `${AGENT_API_BASE}/log_call`,
            description:
              "Log het resultaat van het gesprek in TableWise. ALTIJD aanroepen vlak voor je het gesprek afsluit, ook bij info-vragen of geen actie.",
            params: [
              { name: "external_call_id", type: "String", required: true, description: "Unieke call-ID van ClickWise (gebruik {{call.id}}).", example: "call_abc123" },
              { name: "caller_phone", type: "String", required: true, description: "Telefoonnummer van de beller in E.164-formaat.", example: "+31612345678" },
              { name: "callee_phone", type: "String", required: false, description: "Het nummer dat gebeld werd (restaurantnummer).", example: "+31201234567" },
              { name: "outcome", type: "String", required: true, description: "Resultaat — exact één van: booked, cancelled, updated, info_only, no_action, callback_needed.", example: "booked" },
              { name: "reservation_id", type: "String", required: false, description: "Alleen invullen bij outcome=booked, cancelled of updated.", example: "00000000-0000-0000-0000-000000000000" },
              { name: "duration_seconds", type: "Number", required: false, description: "Gespreksduur in seconden.", example: "92" },
              { name: "summary", type: "String", required: false, description: "Korte NL-samenvatting van het gesprek, maximaal 2 zinnen.", example: "Reservering gemaakt voor 4p op 26 mei 19:30." },
              { name: "agent_id", type: "String", required: false, description: "Vrij label om de agent te identificeren.", example: "tablewise-reservering-bot" },
            ],
            body: `{
  "external_call_id": "{{call.id}}",
  "caller_phone": "{{contact.phone}}",
  "callee_phone": "{{call.to_number}}",
  "outcome": "{{outcome}}",
  "reservation_id": "{{reservation_id}}",
  "duration_seconds": {{call.duration_seconds}},
  "summary": "{{summary}}",
  "agent_id": "tablewise-reservering-bot"
}`,
            responseHint: (
              <>
                Response bevat <code>success: true</code>. Niets hardop bevestigen — dit is een
                interne log-call.
              </>
            ),
          })}

          {/* Optionele extra tools */}
          <div className="space-y-2 pt-2 border-t">
            <div className="font-medium">Optionele extra tools (geavanceerd)</div>
            <p className="text-xs text-muted-foreground">
              Niet nodig voor een basis-koppeling. Voeg ze pas toe als je deze flows wilt
              ondersteunen via de telefoon. Methode = <code>POST</code>, headers gelijk aan
              hierboven. Parameter-details staan in <code>docs/PUBLIC_API.md</code> en de
              <code> agent_api</code> edge function.
            </p>
            <ul className="text-xs space-y-1.5 list-disc list-inside">
              <li>
                <strong>find_reservation</strong> — bestaande reservering opzoeken op telefoon of
                bevestigingscode (handig vóór cancel of update).{" "}
                <code className="break-all">{`${AGENT_API_BASE}/find_reservation`}</code>
              </li>
              <li>
                <strong>reconfirm_reservation</strong> — gast bevestigt of annuleert telefonisch
                een eerdere herbevestigings-vraag.{" "}
                <code className="break-all">{`${AGENT_API_BASE}/reconfirm_reservation`}</code>
              </li>
              <li>
                <strong>create_waitlist_entry</strong> — als alles vol zit, gast op de wachtlijst
                zetten.{" "}
                <code className="break-all">{`${AGENT_API_BASE}/create_waitlist_entry`}</code>
              </li>
              <li>
                <strong>get_opening_hours</strong> — agent kan info-vragen over openingstijden
                beantwoorden zonder te raden.{" "}
                <code className="break-all">{`${AGENT_API_BASE}/get_opening_hours`}</code>
              </li>
            </ul>
          </div>
        </div>
      );
    },
  },
  {
    id: "test",
    group: "golive",
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
              custom value <code>tw_agent_api_key</code> of in de tool-headers.
            </li>
            <li>
              <strong>403 Scope missing</strong> — sleutel mist een scope (default:{" "}
              <code>availability</code>, <code>book</code>, <code>cancel</code>). Vraag support
              om de scope toe te voegen of een nieuwe sleutel met de juiste scopes te maken.
            </li>
            <li>
              <strong>403 Channel action not allowed</strong> — dit kanaal mag deze action niet
              gebruiken. Vraag support om <code>allowed_actions</code> uit te breiden voor
              <code> phone_ai</code>.
            </li>
            <li>
              <strong>400 Missing field</strong> — een variabele in de body-template is leeg gebleven; controleer
              de Parameters van de tool.
            </li>
            <li>
              <strong>404 Reservation not found</strong> — de gast belt met een code uit een ander restaurant of
              een al verwijderde reservering, of de code/telefoonnummer matcht geen actieve reservering.
            </li>
          </ul>
        </Callout>

        <Callout tone="success" title="Klaar voor live?">
          Loop eerst de <strong>Pilot-readiness checklist</strong> door op{" "}
          <Link to="/app/instellingen/pilot-launch" className="underline">
            Instellingen → Pilot lancering
          </Link>
          . Pas als alle verplichte items groen zijn → ga door naar sectie 11 hieronder en zet de
          modus op <strong>Live</strong>. ClickWise pakt de boeking dan automatisch op in de
          bestaande bevestigings- en reminder-flow.
        </Callout>
      </div>
    ),
  },
  {
    id: "go-live",
    group: "golive",
    title: "11. Live zetten — stap voor stap",
    icon: ListChecks,
    keywords: "live productie pilot launch readiness gaan markeer",
    render: () => (
      <div className="space-y-3 text-sm">
        <ol className="list-decimal list-inside space-y-2">
          <li>
            Open <Link to="/app/instellingen/pilot-launch" className="underline">
              TableWise → Instellingen → Pilot lancering
            </Link>{" "}
            (alleen zichtbaar voor de eigenaar).
          </li>
          <li>
            Controleer dat alle <strong>verplichte</strong> items op de readiness-checklist groen
            staan. Niet groen? Klik <em>Naar instellingen</em> per item om dat eerst te regelen.
          </li>
          <li>
            Vink alle <strong>handmatige controles</strong> af (openingstijden, tafelplan,
            test-reservering, team geïnformeerd, ClickWise workflows getest).
          </li>
          <li>
            Ga naar <strong>AI Voice Agent → Configuratie</strong>, zet de schakelaar bij
            <strong> Modus</strong> op <strong>Live</strong> en klik <strong>Opslaan</strong>.
          </li>
          <li>
            Bel het ClickWise-nummer en boek een echte testreservering. Controleer dat:
            <ul className="list-disc list-inside ml-5 mt-1 text-xs text-muted-foreground space-y-0.5">
              <li>de boeking met kanaal <code>phone_ai</code> in TableWise verschijnt;</li>
              <li>de gast de bevestigings-SMS ontvangt vanuit ClickWise;</li>
              <li>het call-log een outcome <code>booked</code> heeft.</li>
            </ul>
          </li>
          <li>
            (Optioneel maar aanbevolen) Klik in <strong>Pilot lancering</strong> op
            <strong> Markeer als live</strong> — dat zet <code>is_live</code> op het restaurant
            zodat dashboards en rapportages weten dat dit géén testdata meer is.
          </li>
        </ol>
        <Callout tone="info" title="Iets niet in orde?">
          Zet de modus terug op <strong>Sandbox</strong> in <strong>Configuratie</strong>. Live
          calls stoppen direct. Geen impact op bestaande reserveringen.
        </Callout>
      </div>
    ),
  },
];

// ============================================================
// PAGE
// ============================================================
function SectionCard({ s }: { s: Section }) {
  const Icon = s.icon;
  return (
    <Card id={s.id} className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {s.title}
        </CardTitle>
      </CardHeader>
      <CardContent>{s.render()}</CardContent>
    </Card>
  );
}

// One-click "geef me alles wat ik in ClickWise nodig heb"
function buildBundle() {
  return JSON.stringify(
    {
      tablewise_voice_agent_setup: {
        agent_api_base_url: AGENT_API_BASE,
        auth_header_name: "X-Agent-Api-Key",
        auth_header_value: "PLAK_HIER_DE_TW_AGENT_API_KEY",
        content_type: "application/json",
        method: "POST",
        timezone: "Europe/Amsterdam",
        date_format: "YYYY-MM-DD",
        time_format: "HH:MM",
        endpoints: {
          check_availability: `${AGENT_API_BASE}/check_availability`,
          book_reservation:   `${AGENT_API_BASE}/book_reservation`,
          cancel_reservation: `${AGENT_API_BASE}/cancel_reservation`,
          update_reservation: `${AGENT_API_BASE}/update_reservation`,
          log_call:           `${AGENT_API_BASE}/log_call`,
        },
        tool_params: {
          check_availability: ["date (String, required)", "party_size (Number, required)", "preferred_time (String, required)"],
          book_reservation:   ["date (String, required)", "time (String, required)", "party_size (Number, required)", "first_name (String, required)", "last_name (String, optional)", "phone (String, required)", "email (String, optional)", "special_requests (String, optional)"],
          cancel_reservation: ["reservation_id (String, required)", "reason (String, optional)"],
          update_reservation: ["reservation_id (String, required)", "new_date (String, optional)", "new_time (String, optional)", "new_party_size (Number, optional)", "special_requests (String, optional)"],
          log_call:           ["external_call_id (String, required)", "caller_phone (String, required)", "callee_phone (String, optional)", "outcome (String, required: booked|cancelled|updated|info_only|no_action|callback_needed)", "reservation_id (String, optional)", "duration_seconds (Number, optional)", "summary (String, optional)", "agent_id (String, optional)"],
        },
        clickwise_custom_values: {
          tw_agent_api_url: AGENT_API_BASE,
          tw_agent_api_key: "PLAK_HIER_DE_TW_AGENT_API_KEY",
        },
        greeting: "Goedendag, u spreekt met de digitale gastvrouw van {{location.name}}. Waarmee kan ik u van dienst zijn?",
        system_prompt: SYSTEM_PROMPT,
      },
    },
    null,
    2,
  );
}

export default function VoiceAgentHelp() {
  const [q, setQ] = useState("");
  const [showManual, setShowManual] = useState(false);

  const needle = q.trim().toLowerCase();
  const matches = (s: Section) =>
    !needle ||
    s.title.toLowerCase().includes(needle) ||
    s.keywords.toLowerCase().includes(needle);

  const quickstart = SECTIONS.filter((s) => s.group === "quickstart" && matches(s));
  const manual     = SECTIONS.filter((s) => s.group === "manual"     && matches(s));
  const golive     = SECTIONS.filter((s) => s.group === "golive"     && matches(s));

  // If search has a hit in the manual block, auto-open it.
  const manualOpen = showManual || (!!needle && manual.length > 0);

  return (
    <div className="p-6 max-w-6xl mx-auto print:p-0">
      <div className="flex items-start justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl">Voice Agent — Koppelhandleiding</h1>
            <p className="text-sm text-muted-foreground">
              Snelle 6-staps onboarding bovenaan. Volledige handmatige setup achter de knop verderop.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(buildBundle())}>
            <Copy className="h-4 w-4 mr-1" /> Kopieer alles voor ClickWise
          </Button>
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
              Snel starten
            </div>
            {quickstart.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-sm px-2 py-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                {s.title}
              </a>
            ))}
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-3 mb-2 px-2">
              Live gaan
            </div>
            {golive.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-sm px-2 py-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                {s.title}
              </a>
            ))}
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-3 mb-2 px-2">
              Volledige setup
            </div>
            {manual.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-sm px-2 py-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                {s.title}
              </a>
            ))}
          </div>
        </aside>

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

          {/* Aanbevolen route (snapshot) */}
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 print:hidden">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Rocket className="h-4 w-4 text-primary" />
              Aanbevolen route — 6 stappen via master snapshot
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Heb je al een TableWise master snapshot in ClickWise? Volg secties 1, 2 en 2b hieronder en sla
              de handmatige setup (3–9) over. Werk je zonder snapshot? Open onderaan
              <strong> "Toon volledige handmatige setup"</strong>.
            </p>
          </div>

          {quickstart.map((s) => <SectionCard key={s.id} s={s} />)}

          {/* Manual setup behind a collapse */}
          {manual.length > 0 && (
            <Collapsible open={manualOpen} onOpenChange={setShowManual}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between print:hidden">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {manualOpen ? "Verberg" : "Toon"} volledige handmatige setup (secties 3–9)
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", manualOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4">
                {manual.map((s) => <SectionCard key={s.id} s={s} />)}
              </CollapsibleContent>
            </Collapsible>
          )}

          {golive.map((s) => <SectionCard key={s.id} s={s} />)}

          {needle && quickstart.length + manual.length + golive.length === 0 && (
            <p className="text-sm text-muted-foreground">Geen sectie gevonden voor "{q}".</p>
          )}
        </div>
      </div>
    </div>
  );
}
