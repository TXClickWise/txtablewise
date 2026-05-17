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
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { Mail, CheckCircle2 } from "lucide-react";

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
const SYSTEM_PROMPT = `You are the digital host of {{custom_values.tablewise_restaurant_name}}, a restaurant located in {{custom_values.tablewise_timezone}} (timezone {{custom_values.tablewise_timezone}}). You take phone reservations in a friendly, natural and concise way.

TAALHERKENNING & TAALGEBRUIK (BELANGRIJK — geldt voor ALLES wat je zegt)
- Je spreekt drie talen: Nederlands (NL), Duits (DE) en Engels (EN).
- Open ALTIJD in het Nederlands met de korte tri-linguale begroeting (zie onderaan).
- Zodra de beller antwoordt, detecteer je de taal en LOCK je die taal voor de rest van het gesprek. Vanaf dat moment is élke uiting in de gelockte taal: vervolgvragen, bevestigingen, foutmeldingen, transfer-zinnen, callback-zinnen, en ook KORTE FILLER-ZINNEN die je tijdens een tool-call zegt ("een moment, ik controleer dat even" / "one moment, I'm checking that" / "einen Moment, ich prüfe das kurz").
- GEEN FALLBACK NAAR NEDERLANDS na de lock. Ook niet voor één losse mededeling. Als de beller na de lock duidelijk naar een andere taal switcht → switch jij volledig mee (nooit binnen één zin).
- In het Nederlands spreek je met "u" tenzij de beller duidelijk informeel is. In het Duits altijd "Sie". In het Engels gewoon "you".
- Stuur de gedetecteerde taal mee in elke tool-call als parameter "language" met waarde "nl", "de" of "en". Bij twijfel → "nl".

DOEL VAN HET GESPREK
1. De beller helpen met:
   a) een nieuwe reservering maken,
   b) een bestaande reservering annuleren of wijzigen,
   c) een algemene vraag (openingstijden, locatie, parkeren, allergie-info) — beantwoord kort en bied anders aan terug te bellen.

GESPREKSREGELS (alle talen)
- Stel altijd één vraag tegelijk. Wacht op antwoord.
- Bevestig altijd hardop naam, datum, tijd en aantal personen vóór je definitief boekt. Het telefoonnummer hoort hier alleen bij in het alternatief-nummer-scenario (zie UITSPRAAKREGELS).
- VRAAG ALTIJD EXPLICIET DE VOORNAAM (en zo mogelijk achternaam) voordat je reservation_request aanroept. Vul NOOIT zelf "Gast", "Klant", "Onbekend" of een andere placeholder in — de engine weigert dat met error_code "placeholder_name_blocked" en je moet dan alsnog vragen.
- Gewenste tijd is VERPLICHT bij elke beschikbaarheidscheck. Bij open vragen zoals "hebben jullie vanavond plek voor 4?" → vraag eerst rond welk tijdstip.
- Vraag altijd of er allergieën of dieetwensen zijn.
- Bij ruis: zeg "Sorry, ik versta u niet helemaal" / "Entschuldigung, ich habe Sie nicht ganz verstanden" / "Sorry, I didn't quite catch that".

UITSPRAAKREGELS (cruciaal — wijk hier NOOIT van af)

TELEFOONNUMMER — twee scenario's:
  1) DEFAULT: het nummer waarmee de gast nu belt (caller-ID, {{contact.phone}}).
     - Lees dit nummer NOOIT hardop voor. Noem NOOIT cijfers, landcode of prefix.
     - Vraag de gast NOOIT om het beller-ID-nummer te bevestigen of te herhalen.
     - Bevestig alleen kanaal-niveau:
       · NL: "Ik gebruik het nummer waarmee u nu belt — is dat goed?"
       · DE: "Ich verwende die Nummer, von der Sie gerade anrufen — ist das in Ordnung?"
       · EN: "I'll use the number you're calling from — is that okay?"
  2) ALTERNATIEF NUMMER: alleen als de gast zelf expliciet zegt dat er een ander nummer genoteerd moet worden ("noteer maar het nummer van mijn vrouw", "neem een ander nummer") OF als caller-ID anoniem/withheld is.
     - Vraag de gast om het nummer CIJFER VOOR CIJFER te spellen ("Kunt u het nummer cijfer voor cijfer doorgeven?").
     - Lees het daarna ter bevestiging CIJFER VOOR CIJFER terug, met korte pauze tussen elk cijfer. Groepeer NOOIT in paren of tientallen.
       · Voorbeeld +31653521166 → NL: "plus drie één, zes, vijf, drie, vijf, twee, één, één, zes, zes — klopt dat?" · DE: "plus drei eins, sechs, fünf, drei, fünf, zwei, eins, eins, sechs, sechs — stimmt das?" · EN: "plus three one, six, five, three, five, two, one, one, six, six — is that correct?"
     - Bij correctie: opnieuw cijfer-voor-cijfer terug. Boek NIET zonder geldig genoteerd alternatief nummer.

TIJDEN — spreek in spreektaal van de gelockte taal, NOOIT als "achttien uur vijftien":
  - NL: 18:15 → "kwart over zes" · 18:30 → "half zeven" · 18:45 → "kwart voor zeven" · 19:00 → "zeven uur 's avonds" · 20:10 → "tien over acht"
  - DE: 18:15 → "Viertel nach sechs" · 18:30 → "halb sieben" · 19:00 → "sieben Uhr abends"
  - EN: 18:15 → "quarter past six" · 18:30 → "half past six" · 19:00 → "seven in the evening"
  - Intern in tool-call ALTIJD "HH:MM" (24-uurs).

NEDERLANDSE "HALF X" — EERSTE KEER GOED INTERPRETEREN (zeer belangrijk; bellers gebruiken dit vaak):
  - "half zes" = 17:30  (NOOIT 18:00, NOOIT 17:00, NOOIT 18:30)
  - "half zeven" = 18:30
  - "half acht" = 19:30
  - "half negen" = 20:30
  - "half tien" = 21:30
  - "half elf" = 22:30
  - "half twaalf" = 23:30 (lunch context: 11:30)
  Bij twijfel stel je ÉÉN korte controlevraag in spreektaal: "Bedoelt u half zes, dus vijf uur dertig?" en daarna nooit meer hetzelfde vragen. Boek niet met een afwijkende tijd "voor de zekerheid".

DATUMS — spreek dag + maand in woorden, NOOIT als "twee-nul-twee-zes-nul-vijf-twee-vijf":
  - NL: 2026-05-25 → "vijfentwintig mei" · 2026-06-01 → "één juni"
  - DE: "fünfundzwanzigster Mai"
  - EN: "the twenty-fifth of May"
  - "vandaag" / "morgen" / "overmorgen" → letterlijk zo uitspreken.
  - Intern in tool-call ALTIJD "YYYY-MM-DD".

AANTAL PERSONEN — voluit in woorden, gevolgd door "personen":
  - 2 → "twee personen" · 4 → "vier personen" · 10 → "tien personen" · 17 → "zeventien personen".

RESERVERINGSCODE — letter-voor-letter, cijfer-voor-cijfer, NAVO-alfabet bij verwarring:
  - R7K2 → "R van Romeo, zeven, K van Kilo, twee".
  - Lees ALLEEN voor als de gast er expliciet om vraagt; standaard sluit je mondeling af zonder code.

ALGEMENE VERBODEN:
  - Geen "achttien uur vijftien", geen letterlijke "twee-nul-twee-zes-nul-vijf-twee-vijf", geen technische codes hardop.
  - Geen "+31" of "06"-prefix oplezen wanneer het beller-ID-nummer wordt gebruikt.

VERPLICHTE TOOL-VOLGORDE
1. Verzamel datum, aantal personen én gewenste tijd → roep check_availability aan met date, party_size, preferred_time én language.
2. Als response.exact gevuld is → bevestig hardop "[tijd] is beschikbaar, zal ik die reserveren?" (in de gespreks-taal). Bij null → noem 2-3 alternatieven uit response.alternatives.
3. Naam + geldig telefoonnummer + gekozen tijd → bevestig hardop alles → roep book_reservation aan met language meegestuurd.
4. Bevestig hardop datum, tijd en aantal personen. Lees GEEN reservation_id of bevestigingscode voor. Beloof GEEN SMS, WhatsApp of e-mailbevestiging — sluit gewoon mondeling af.
5. Aan het einde van élk gesprek: roep log_call aan met outcome én language.

ANNULEREN / WIJZIGEN
- Probeer eerst stil te matchen op {{contact.phone}} via find_reservation. Bij 1 match → bevestig hardop. Bij geen/meerdere matches → vraag voor- + achternaam en datum, roep find_reservation opnieuw aan. Vraag NOOIT om een bevestigingsnummer.
- Annuleren → cancel_reservation met dat id en reason="Geannuleerd via telefoon" / "Telefonisch storniert" / "Cancelled by phone".
- Wijzigen → eerst check_availability voor de nieuwe combinatie, dan update_reservation met alleen de gewijzigde velden.

WAT JE NIET DOET
- Geen menukeuzes opnemen.
- Geen prijzen of beschikbaarheid raden — gebruik altijd de tool.
- E-mailadres is optioneel. Alleen noteren als de beller het zelf opgeeft of digitale bevestiging vraagt.
- Boek nooit te ver vooruit. Bij engine-fout (boekingshorizon) → leg het uit en bied terugbel aan.

GROTE GROEPEN (2-drempel logica — engine beslist, alle antwoorden in de GELOCKTE taal)

REGEL 0 — ABSOLUUT VERBOD: roep NOOIT 'Call Transfer' aan vóór je 'book_reservation' hebt geprobeerd. Geen enkele uitzondering, ook niet bij 10, 12, 15 of 18 personen. De engine bepaalt zelf of doorverbinden überhaupt nodig is.

STAP 1 — Roep ALTIJD eerst 'reservation_request' aan met de verzamelde gegevens, ongeacht groepsgrootte. (De oudere tool 'book_reservation' is VEROUDERD — verwijder die uit je voice agent.)

STAP 2 — Bekijk de response en kies EXACT één van de drie paden:
  a) response.confirmed === true (ok: true, requires_manual_approval: false, status_label: "definitief") → bevestig mondeling als normale boeking. Beloof GEEN SMS/WhatsApp/e-mail.
  b) response.confirmed === false EN response.requires_manual_approval === true (status_label: "voorlopig") → de reservering staat IN TableWise en wacht op interne goedkeuring. Zeg LETTERLIJK response.message_for_guest. NOOIT de woorden "geboekt", "bevestigd", "gelukt", "rond", "definitief", "akkoord" of "goedgekeurd" gebruiken (zie response.forbidden_phrases). Beloof NOOIT een SMS, WhatsApp of e-mail. NIET doorverbinden:
     · gelockt op NL → "Let op — dit is nog geen definitieve reservering. Voor een groep van [aantal] personen leg ik uw aanvraag voor aan een collega. Het team beoordeelt dit zo snel mogelijk en neemt alleen contact met u op als er iets aangepast moet worden — anders is uw aanvraag voor [datum] om [tijd] genoteerd."
     · gelockt op DE → "Hinweis — dies ist noch keine endgültige Reservierung. Für eine Gruppe von [Anzahl] Personen lege ich Ihre Anfrage einem Kollegen vor. Das Team prüft das schnellstmöglich und meldet sich nur, falls etwas angepasst werden muss — andernfalls ist Ihre Anfrage für den [Datum] um [Uhrzeit] notiert."
     · gelockt op EN → "Please note — this is not yet a final reservation. For a group of [number] people I'll forward your request to a colleague. The team will review it as soon as possible and will only contact you if anything needs to be adjusted — otherwise your request is noted for [date] at [time]."
  c) Engine geeft error_code = "large_group_required_manual" (TW_409_PARTY_TOO_LARGE) terug. De response bevat dan een veld "transfer": { allowed, phone, hours_label, reason }. Bereken NOOIT zelf de tijd of het venster — kijk alléén naar transfer.allowed:
     · transfer.allowed === true → zeg in de gelockte taal "Een moment, ik verbind u direct door met een collega" en roep dan pas 'Call Transfer' aan naar transfer.phone. Roep GEEN log_call vóór de transfer.
     · transfer.allowed === false → roep log_call aan met outcome="callback_needed" en zeg "Een collega belt u tijdens onze openingstijden ([transfer.hours_label]) persoonlijk terug op dit nummer."

REGEL 3 — Boek NOOIT zelf door na een TW_409_PARTY_TOO_LARGE.
REGEL 4 — Beloof in GEEN ENKEL grote-groep-scenario een bevestiging per SMS, WhatsApp of e-mail.

OPENINGSBEGROETING (verplicht, exact deze tri-linguale zin)
"Goedendag, u spreekt met de digitale gastvrouw van {{custom_values.tablewise_restaurant_name}}. Guten Tag — how may I help you?"

AFSLUITING (in de gespreks-taal)
- NL: "Hartelijk dank voor uw telefoontje, tot [datum en tijd]. Een fijne dag verder!"
- DE: "Vielen Dank für Ihren Anruf, bis [Datum und Uhrzeit]. Einen schönen Tag noch!"
- EN: "Thank you for your call, see you on [date and time]. Have a great day!"`;

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
            Zet de sub-account naam en tijdzone correct — TableWise pusht ze automatisch óók als
            custom values (<code>{`{{custom_values.tablewise_restaurant_name}}`}</code> en
            <code>{` {{custom_values.tablewise_timezone}}`}</code>) via de sync-knop in
            <em> Koppelingen → ClickWise</em>. <strong>Let op:</strong> <code>{`{{location.*}}`}</code>
            rendert niet in Voice AI prompts; daarom werken alle prompts/SMS met de custom_values.
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
                ["TW Reservation Date", "contact.tw_reservation_date", "Single Line"],
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
        <Callout tone="warn" title="Belangrijk — kies geen Date Picker voor TW Reservation Date">
          <p>
            Gebruik <strong>Single Line</strong> (tekst), niet <em>Date Picker</em>. ClickWise toont
            Date Picker-velden niet in <strong>Find Contact → Match Field</strong> en vaak ook niet in
            If/Else-condities. TableWise stuurt de datum als ISO-string (<code>YYYY-MM-DD</code>),
            dus Single Line werkt overal — in SMS-templates, filters én contact-matching.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Heb je het veld al als Date Picker aangemaakt? Open het, wissel het type naar Single Line,
            sla op, en doe in je Inbound Webhook trigger opnieuw "Check for new requests" zodat de
            mapping ververst.
          </p>
        </Callout>
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
        <Callout tone="success" title="Automatisch gepusht door TableWise — niet handmatig invullen">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Restaurantnaam</strong> → <code>{`{{custom_values.tablewise_restaurant_name}}`}</code>
              (TableWise pusht <code>restaurants.name</code> automatisch via de sync-knop in
              <em> Koppelingen → ClickWise</em>).
            </li>
            <li>
              <strong>Tijdzone</strong> → <code>{`{{custom_values.tablewise_timezone}}`}</code>
              (gepusht uit <code>restaurants.timezone</code>, bv. <code>Europe/Amsterdam</code>).
              <em> Let op:</em> <code>{`{{location.timezone}}`}</code> werkt NIET in Voice AI prompts.
            </li>
            <li>
              <strong>Groepsgrootte (2-drempel)</strong> → komt rechtstreeks uit TableWise.
              De agent probeert altijd direct te boeken; de engine bepaalt het vervolg op basis
              van twee drempels (grote groep vanaf X, extra-grote groep vanaf Y):
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                <li><code>party_size &lt; large_group_threshold</code> → normale boeking, direct bevestigd.</li>
                <li><code>party_size ≥ large_group_manual_approval_from</code> → boeking met
                  <code>requires_manual_approval=true</code>; verschijnt in de app onder "Grote groepen — te beoordelen".</li>
                <li><code>party_size ≥ extra_large_group_threshold</code> → altijd
                  <code>requires_manual_approval=true</code>.</li>
                <li><code>party_size &gt; large_group_max_online_request</code> → engine geeft
                  <code>TW_409_PARTY_TOO_LARGE</code>; de agent verbindt door via Call Transfer
                  (binnen openingstijden) of belooft een callback. Zie sectie 7b.</li>
              </ul>
              Pas de drempels aan in TableWise → <strong>Instellingen → Reserveringen → Grote groepen</strong>.
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
            <li>Language: <code>Multi</code> (meertalig — NL / DE / EN automatisch herkend)</li>
            <li>Voice Model: <code>Eleven Turbo V2.5</code> ($0.015/min — 3× goedkoper dan Multilingual V2 en ruim voldoende voor reserveringen)</li>
            <li>Voice: kies een stem die in alle drie de talen natuurlijk klinkt (bv. <em>Dakota H</em> of vergelijkbaar — test even met een korte DE/EN-zin)</li>
          </ul>
          <div className="mt-2">
            <CopyRow
              label="Greeting (tri-linguaal — open altijd in NL, switch daarna naar de taal van de beller)"
              value="Goedendag, u spreekt met de digitale gastvrouw van {{custom_values.tablewise_restaurant_name}}. Guten Tag — how may I help you?"
            />
          </div>
          <Callout tone="info" title="Waarom één agent i.p.v. drie?">
            Eén Multi-agent = één prompt, één toolset, één telefoonnummer. Geen extra IVR-keuzemenu
            ("druk 1 voor Nederlands"), geen warm-transfer-latency, en alle ClickWise-workflow
            blijft ongewijzigd. De agent detecteert automatisch in welke taal de beller antwoordt
            en schakelt om binnen één gesprek.
          </Callout>
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
        <Callout tone="warn" title='Mapping Reference verplicht — stuur eerst een test-payload'>
          <p>
            ClickWise toont de melding <em>"A Mapping Reference is required for an Inbound Webhook Trigger"</em>
            omdat HighLevel pas weet welke velden je payload heeft nadat er één keer een echte request is binnengekomen.
            Eénmalige setup per workflow:
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Kopieer de <strong>Inbound Webhook URL</strong> uit het trigger-popup
              (bv. <code>https://services.leadconnectorhq.com/hooks/...</code>).</li>
            <li>Stuur eenmalig een voorbeeld-payload naar die URL. Snelste manier: onderstaande cURL in je terminal.
              Alternatief: in TableWise → <em>Instellingen → API &amp; Webhooks</em> tijdelijk een endpoint met die URL
              aanmaken, event <code>reservation.created</code> kiezen en op <strong>Test</strong> klikken.</li>
            <li>Ga terug naar de ClickWise trigger-popup → open de dropdown <strong>Mapping Reference</strong> →
              klik <strong>"Check for new requests"</strong>. De zojuist verzonden payload verschijnt — selecteer hem.</li>
            <li>Klik <strong>Save Trigger</strong>. Vanaf nu zijn alle velden beschikbaar als <code>{`{{inboundWebhookRequest.payload.<veld>}}`}</code> in Actions (bijv. <code>{`{{inboundWebhookRequest.payload.guest.phone}}`}</code>).</li>
          </ol>
          <CodeBlock label="cURL — vervang <WEBHOOK_URL>">
{`curl -X POST '<WEBHOOK_URL>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "id": "evt_demo",
    "event_type": "reservation.created",
    "payload": {
      "reservation_id": "00000000-0000-0000-0000-000000000000",
      "reservation_date": "2026-05-10",
      "reservation_time": "19:30",
      "party_size": 4,
      "manage_token": "demo-token",
      "manage_url": "https://www.txtablewise.nl/r/demo/manage/demo-token",
      "cancel_url": "https://www.txtablewise.nl/r/demo/manage/demo-token?action=cancel",
      "confirmation_code": "ABC12345",
      "guest": {
        "phone": "+31612345678",
        "first_name": "Test",
        "last_name": "Gast",
        "email": "test@voorbeeld.nl"
      }
    }
  }'`}
          </CodeBlock>
          <p className="text-xs mt-2">
            Tip: voeg je later extra velden toe aan de payload, stuur dan opnieuw een sample en ververs de Mapping
            Reference — anders blijven nieuwe velden onzichtbaar in de Actions.
          </p>
        </Callout>
        <div>
          <div className="font-medium">Action 1 — Find Contact (met Create Contact in de "Not Found"-tak)</div>
          <p className="text-xs text-muted-foreground mb-1">
            Gebruik eerst <strong>Find Contact</strong> (matcht op telefoon → voorkomt dubbele contacten).
            In de <em>Contact Not Found</em>-tak hang je daarna een <strong>Create Contact</strong> met exact dezelfde veldmappings.
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>Match op <code>phone</code></li>
            <li>Phone: <code>{`{{inboundWebhookRequest.payload.guest.phone}}`}</code></li>
            <li>First Name: <code>{`{{inboundWebhookRequest.payload.guest.first_name}}`}</code></li>
            <li>Email: <code>{`{{inboundWebhookRequest.payload.guest.email}}`}</code></li>
            <li>TW Reservation ID: <code>{`{{inboundWebhookRequest.payload.reservation_id}}`}</code></li>
            <li>TW Reservation Date: <code>{`{{inboundWebhookRequest.payload.reservation_date}}`}</code></li>
            <li>TW Reservation Time: <code>{`{{inboundWebhookRequest.payload.reservation_time}}`}</code></li>
            <li>TW Party Size: <code>{`{{inboundWebhookRequest.payload.party_size}}`}</code></li>
            <li>TW Manage Token: <code>{`{{inboundWebhookRequest.payload.manage_token}}`}</code></li>
            <li>TW Manage URL: <code>{`{{inboundWebhookRequest.payload.manage_url}}`}</code></li>
          </ul>
        </div>
        <div>
          <div className="font-medium">Action 2 — Send SMS</div>
          <CodeBlock label="SMS naar {{contact.phone}}">
{`Hallo {{contact.first_name}}, uw reservering bij {{custom_values.tablewise_restaurant_name}} op {{contact.tw_reservation_date}} om {{contact.tw_reservation_time}} voor {{contact.tw_party_size}} personen is bevestigd. Wijzigen of annuleren? Bel ons of antwoord op deze sms.`}
          </CodeBlock>
        </div>
        <Callout tone="warn" title="Filter test-events (anders gaan er echte SMSes uit bij elke 'Test'-klik)">
          <p>
            Elk test-event uit TableWise heeft <code>{`{{inboundWebhookRequest.payload.test}}`}</code> = <code>true</code>
            en de header <code>X-TableWise-Test: true</code>. Voeg vóór de eerste verzendactie (SMS/WhatsApp/E-mail) een
            <strong> If/Else</strong> toe met conditie <em>"Inbound Webhook Trigger → payload.test"</em>
            <strong> Is Equal To</strong> <code>true</code> → tak <strong>End Workflow</strong>. In de
            <em> Else</em>-tak hang je je gewone Send-acties.
          </p>
          <p className="mt-1 text-xs">
            Zonder dit filter triggert elke klik op <strong>Test</strong> in TableWise een echte SMS naar het testtelefoonnummer.
          </p>
        </Callout>
      </div>
    ),
  },
  {
    id: "call-transfer",
    group: "manual",
    title: "7b. Call Transfer voor zeer grote groepen (server-side venster)",
    icon: Phone,
    keywords: "call transfer doorverbinden grote groep party too large escalatie medewerker",
    render: () => (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Wanneer een beller een groep aanvraagt die <em>boven</em> <code>large_group_max_online_request</code> uit
          TableWise valt, geeft de engine <code>TW_409_PARTY_TOO_LARGE</code> terug, samen met een veld
          <code>transfer: {`{ allowed, phone, hours_label, reason }`}</code>. De agent leest dit veld en verbindt
          door of belooft een callback — <strong>zonder zelf de tijd te interpreteren</strong>.
        </p>

        <Callout tone="info" title="Waarom server-side?">
          De LLM kent de echte tijd niet betrouwbaar en kan vrije-tekst tijdvensters ("11:00–20:30")
          niet veilig parsen. TableWise rekent het venster nu zelf uit in jouw tijdzone, inclusief
          gesloten dagen uit Openingstijden.
        </Callout>

        <div className="space-y-1">
          <div className="font-medium">Stap 1 — Configureer in TableWise</div>
          <p className="text-xs text-muted-foreground">
            Ga naar <strong>Instellingen → Grote groepen → Call Transfer bij te grote groepen</strong> en vul in:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Doorverbind-nummer</strong> (E.164, bv. <code>+31612345678</code>)</li>
            <li><strong>Venster start</strong> en <strong>Venster eind</strong> (bv. 11:00 en 20:30)</li>
          </ul>
        </div>

        <div className="space-y-1">
          <div className="font-medium">Stap 2 — Call Transfer action in ClickWise/Vapi</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>Voeg een action toe van het type <strong>Call Transfer</strong> (of <em>Live Transfer</em>).</li>
            <li>Naam: <code>Call Transfer</code> (exact zoals in de prompt).</li>
            <li>Transfer Number: gebruik <strong>het veld <code>transfer.phone</code> uit de tool-response</strong>
              van book_reservation (de agent geeft het door bij het aanroepen van de action). Hardcoderen of
              via een custom value pushen is niet langer nodig.</li>
          </ol>
        </div>

        <div className="space-y-1">
          <div className="font-medium">Stap 3 — Test</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>Bel de Voice Agent en vraag een tafel voor bijv. 25 personen.</li>
            <li>Binnen het venster: response bevat <code>transfer.allowed=true</code> → agent zegt "ik verbind u
              direct door" en je telefoon op het transfer-nummer gaat over.</li>
            <li>Buiten het venster (of op een gesloten dag): response bevat <code>transfer.allowed=false</code> met
              <code>reason="outside_hours"</code> of <code>"closed_day"</code> → agent doet
              <code>log_call(outcome=callback_needed)</code> en belooft een terugbelafspraak.</li>
          </ol>
        </div>

        <Callout tone="warn" title="Niet voor normale grote groepen">
          Boekingen tussen <code>large_group_threshold</code> en
          <code>large_group_max_online_request</code> worden gewoon geboekt (met
          <code>requires_manual_approval=true</code> vanaf
          <code>large_group_manual_approval_from</code>, en altijd vanaf
          <code>extra_large_group_threshold</code>) en verschijnen in de app onder
          <strong>"Grote groepen — te beoordelen"</strong>. Daar wordt <em>niet</em>
          doorverbonden en de agent belooft de gast <em>geen</em> SMS, WhatsApp of e-mail —
          het team beoordeelt intern en neemt alleen contact op als er iets aangepast moet worden.
        </Callout>
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
          Plak in de Voice Agent → Prompt-tab. <code>{`{{custom_values.tablewise_restaurant_name}}`}</code> en
          <code>{`{{custom_values.tablewise_timezone}}`}</code> zijn al ingevuld — die worden automatisch
          gepusht door TableWise (sync-knop in Koppelingen → ClickWise).
          <strong> Let op:</strong> <code>{`{{location.*}}`}</code> rendert niet in Voice AI prompts —
          gebruik altijd <code>{`{{custom_values.*}}`}</code>.
        </p>
        <Callout tone="info" title="Groepsgrootte — 2-drempel logica (engine bepaalt)">
          De agent probeert ALTIJD eerst te boeken. De TableWise-engine bepaalt het vervolg
          op basis van twee drempels (grote groep vanaf X, extra-grote groep vanaf Y):
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li><code>party_size &lt; large_group_threshold</code> → direct bevestigd.</li>
            <li><code>party_size ≥ large_group_manual_approval_from</code> → boeking met
              <code>requires_manual_approval=true</code> (verschijnt in app onder "Grote groepen — te beoordelen").</li>
            <li><code>party_size ≥ extra_large_group_threshold</code> → altijd
              <code>requires_manual_approval=true</code>.</li>
            <li><code>party_size &gt; large_group_max_online_request</code> →
              <code>TW_409_PARTY_TOO_LARGE</code>; de agent doet Call Transfer (binnen openingstijden) of belooft een callback.
              Setup → zie sectie <strong>7b. Call Transfer instellen</strong>.</li>
          </ul>
          Pas de drempels aan in TableWise → <strong>Instellingen → Reserveringen → Grote groepen</strong>.
        </Callout>
        <Callout tone="info" title="Meertalig — language-parameter">
          De prompt stuurt bij elke tool-call <code>language</code> mee (<code>nl</code> /
          <code>de</code> / <code>en</code>). TableWise gebruikt deze voor de juiste taal in
          SMS-/e-mailbevestigingen. Voor ClickWise SMS-templates per taal: voeg in je workflow
          een <strong>If/Else</strong> toe op <code>{` {{contact.tw_language}} `}</code> met
          drie takken (NL/DE/EN), elk met een eigen SMS-tekst.
        </Callout>
        <CodeBlock label="System prompt — meertalig (NL / DE / EN)">{SYSTEM_PROMPT}</CodeBlock>
      </div>
    ),
  },
  {
    id: "tools",
    group: "manual",
    title: "9. Tool definities (9 stuks)",
    icon: ListChecks,
    keywords: "tool action webhook check_availability book_reservation create_reservation cancel_reservation update_reservation wijzigen log_call find_reservation reconfirm_reservation create_waitlist_entry get_opening_hours query parameters data collection what to say before",
    render: () => {
      const headers = `Authorization: Bearer {{custom_values.tablewise_anon_key}}\nX-Agent-Api-Key: {{custom_values.tablewise_api_key}}\nContent-Type: application/json`;

      const toolBlock = (args: {
        n: number;
        name: string;
        url: string;
        description: string;
        params: ToolParam[];
        body: string;
        responseHint: React.ReactNode;
        endNote?: React.ReactNode;
        sayBefore?: string;
        sayBeforeNote?: React.ReactNode;
        optional?: boolean;
      }) => (
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <Badge variant="outline">Tool {args.n}</Badge> {args.name}
            {args.name === "log_call" && (
              <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">
                verplicht aan einde
              </Badge>
            )}
            {args.optional && (
              <Badge variant="secondary">optioneel</Badge>
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
              <div className="font-mono text-[11px]">Authorization +<br/>X-Agent-Api-Key</div>
            </div>
          </div>
          <CodeBlock label="Headers">{headers}</CodeBlock>
          {args.sayBefore !== undefined && (
            <div className="space-y-1">
              <CopyRow
                label='ClickWise-veld: "What to say before performing the action"'
                value={args.sayBefore}
              />
              {args.sayBeforeNote && (
                <div className="text-xs text-muted-foreground pl-1">{args.sayBeforeNote}</div>
              )}
            </div>
          )}
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
                description: "Aantal personen, geheel getal ≥ 1. De engine valideert zelf tegen large_group_max_online_request; bij overschrijding volgt TW_409_PARTY_TOO_LARGE (zie GROTE GROEPEN in de prompt).",
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
            sayBefore: "Eén moment, ik kijk even of dat lukt.",
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
              { name: "party_size", type: "Number", required: true, description: "Aantal personen, geheel getal ≥ 1. De engine valideert zelf tegen large_group_max_online_request.", example: "4" },
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
                Response bevat <code>reservation_id</code>, <code>requires_manual_approval</code>{" "}
                en <code>message_for_guest</code>. <strong>Reservation_id niet hardop voorlezen</strong>.
                Bevestig hardop met de tekst uit <code>message_for_guest</code> (of bevestig zelf
                datum, tijd en aantal personen). Beloof <strong>NOOIT</strong> een SMS, WhatsApp of
                e-mail.
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
            sayBefore: "Helder, ik leg de reservering nu voor u vast.",
          })}

          {toolBlock({
            n: 3,
            name: "cancel_reservation",
            url: `${AGENT_API_BASE}/cancel_reservation`,
            description:
              "Annuleer een bestaande reservering. Het reservation_id wordt ALTIJD intern opgehaald via find_reservation (op telefoon of naam + datum) — vraag dit NOOIT aan de beller.",
            params: [
              { name: "reservation_id", type: "String", required: true, description: "UUID van de te annuleren reservering. Intern verkregen via find_reservation — nooit aan de beller vragen.", example: "00000000-0000-0000-0000-000000000000" },
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
            sayBefore: "Geen probleem, ik annuleer de reservering nu voor u.",
          })}

          {toolBlock({
            n: 4,
            name: "update_reservation",
            url: `${AGENT_API_BASE}/update_reservation`,
            description:
              "Wijzig datum, tijd en/of aantal personen van een bestaande reservering. Vul minimaal één van new_date, new_time of new_party_size. Controleer eerst met check_availability of de nieuwe combinatie kan. Het reservation_id wordt ALTIJD intern opgehaald via find_reservation — nooit aan de beller vragen. VERPLICHT: stuur confirmed_by_guest=true pas NADAT de beller hardop heeft bevestigd dat de wijziging mag worden doorgevoerd; zonder dit veld wordt er NIETS gewijzigd.",
            params: [
              { name: "reservation_id", type: "String", required: true, description: "UUID van de bestaande reservering. Intern verkregen via find_reservation — nooit aan de beller vragen.", example: "00000000-0000-0000-0000-000000000000" },
              { name: "confirmed_by_guest", type: "Boolean", required: true, description: "VERPLICHT op true zetten ZODRA de beller hardop heeft bevestigd. Zonder true blijft de reservering ongewijzigd en krijg je 'Wil je bevestigen dat je deze wijziging wilt doorvoeren?' terug.", example: "true" },
              { name: "new_date", type: "String", required: false, description: "Nieuwe datum YYYY-MM-DD. Laat leeg als de datum niet wijzigt.", example: "2026-05-27" },
              { name: "new_time", type: "String", required: false, description: "Nieuwe tijd HH:mm (24-uurs). Laat leeg als de tijd niet wijzigt.", example: "20:00" },
              { name: "new_party_size", type: "Number", required: false, description: "Nieuw aantal personen, geheel getal ≥ 1. Laat leeg als het aantal niet wijzigt. Engine valideert zelf tegen large_group_max_online_request.", example: "6" },
              { name: "special_requests", type: "String", required: false, description: "Bijgewerkte wensen (overschrijft bestaande wensen).", example: "Toch geen kinderstoel" },
            ],
            body: `{
  "reservation_id": "{{reservation_id}}",
  "confirmed_by_guest": true,
  "new_date": "{{new_date}}",
  "new_time": "{{new_time}}",
  "new_party_size": {{new_party_size}},
  "special_requests": "{{special_requests}}"
}`,
            responseHint: (
              <>
                Response bevat de bijgewerkte reservering. Bevestig hardop met de nieuwe datum,
                tijd en aantal personen. <strong>Let op:</strong> krijg je{" "}
                <code>success: false</code> met <code>reason_code: confirmation_required</code> →
                dan stond <code>confirmed_by_guest</code> niet op <code>true</code>; vraag de
                beller om bevestiging en roep de tool opnieuw aan met{" "}
                <code>confirmed_by_guest: true</code>.
              </>
            ),
            sayBefore: "Goed, ik werk de reservering nu bij.",
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
            sayBefore: "",
            sayBeforeNote: (
              <>
                <strong>Leeg laten.</strong> log_call draait pas <em>nadat</em> je het gesprek hebt
                afgesloten — er is niemand meer aan de lijn om een wachtzin tegen te zeggen.
              </>
            ),
          })}

          {/* Optionele extra tools — volledig uitgewerkt zoals tool 1 t/m 5 */}
          <div className="space-y-3 pt-4 border-t">
            <div className="font-medium">Optionele extra tools (geavanceerd)</div>
            <p className="text-xs text-muted-foreground">
              Niet nodig voor een basis-koppeling. Voeg ze toe in dezelfde stijl als tool 1 t/m 5 —
              methode <code>POST</code>, headers gelijk aan hierboven, en bij ClickWise weer de
              <strong> "What to say before performing the action"</strong>-tekst plakken.
            </p>
          </div>

          {toolBlock({
            n: 6,
            name: "find_reservation",
            optional: true,
            url: `${AGENT_API_BASE}/find_reservation`,
            description:
              "Zoek een bestaande reservering op telefoon, of op voor-/achternaam + datum (+ optioneel tijd). Gebruik dit ALTIJD intern vóór cancel_reservation of update_reservation om het juiste reservation_id op te halen. Vraag NOOIT om een UUID of bevestigingsnummer aan de beller. Minimaal één van phone, last_name of first_name+date moet meekomen.",
            params: [
              { name: "phone", type: "String", required: false, description: "Telefoonnummer in E.164. Default {{contact.phone}} (nummer waarmee beller belt). Bij anonieme nummers leeg laten en op naam zoeken.", example: "+31612345678" },
              { name: "first_name", type: "String", required: false, description: "Voornaam van de gast (alleen i.c.m. date verplicht).", example: "Jan" },
              { name: "last_name", type: "String", required: false, description: "Achternaam van de gast. Vaak voldoende zonder voornaam.", example: "de Vries" },
              { name: "date", type: "String", required: false, description: "Datum van de reservering YYYY-MM-DD.", example: "2026-05-20" },
              { name: "time", type: "String", required: false, description: "Tijd HH:mm (24-uurs) voor extra filtering binnen ±15 min, alleen gebruiken als gast meerdere reserveringen op dezelfde dag heeft.", example: "19:30" },
            ],
            body: `{
  "phone": "{{contact.phone}}",
  "first_name": "{{first_name}}",
  "last_name": "{{last_name}}",
  "date": "{{date}}",
  "time": "{{time}}"
}`,
            responseHint: (
              <>
                Response bevat <code>matches[]</code> met o.a. <code>reservation_id</code>,{" "}
                <code>date</code>, <code>time</code> en <code>party_size</code>. Bij <strong>1
                match</strong> → bevestig hardop datum/tijd/personen. Bij <strong>meerdere</strong>{" "}
                → som ze kort op ("19:00 voor 2 of 20:30 voor 4 — welke bedoelt u?") en laat de
                gast kiezen. Bij <strong>0 matches</strong> → vraag om achternaam + datum en
                probeer opnieuw.
              </>
            ),
            sayBefore: "Eén moment, ik zoek uw reservering even op.",
          })}

          {toolBlock({
            n: 7,
            name: "reconfirm_reservation",
            optional: true,
            url: `${AGENT_API_BASE}/reconfirm_reservation`,
            description:
              "Verwerk een telefonische herbevestiging van een eerder verstuurde herbevestigings-vraag (SMS/WhatsApp). Roep eerst find_reservation aan om het juiste id te krijgen.",
            params: [
              { name: "reservation_id", type: "String", required: true, description: "UUID, intern verkregen via find_reservation. Nooit aan de beller vragen.", example: "00000000-0000-0000-0000-000000000000" },
              { name: "response", type: "String", required: true, description: "Exact 'confirmed' (gast komt) of 'cannot_come' (gast annuleert). Geen andere waardes.", example: "confirmed" },
            ],
            body: `{
  "reservation_id": "{{reservation_id}}",
  "response": "{{response}}"
}`,
            responseHint: (
              <>
                Bij <code>response=confirmed</code> → bevestig hardop dat de reservering staat. Bij{" "}
                <code>response=cannot_come</code> → de reservering wordt geannuleerd; bedank de
                gast voor het laten weten.
              </>
            ),
            sayBefore: "Bedankt voor het laten weten, ik werk het nu bij.",
          })}

          {toolBlock({
            n: 8,
            name: "create_waitlist_entry",
            optional: true,
            url: `${AGENT_API_BASE}/create_waitlist_entry`,
            description:
              "Zet de gast op de wachtlijst als er geen tafel beschikbaar is. Gebruik dit alleen nadat check_availability heeft bevestigd dat de gewenste tijd vol zit én de gast expliciet op de wachtlijst wil.",
            params: [
              { name: "guest_name", type: "String", required: true, description: "Volledige naam (voor + achter). Combineer {{contact.first_name}} {{contact.last_name}}.", example: "Jan de Vries" },
              { name: "guest_phone", type: "String", required: true, description: "Telefoonnummer in E.164. Default {{contact.phone}}.", example: "+31612345678" },
              { name: "guest_email", type: "String", required: false, description: "Alleen invullen als de beller dit zelf opgeeft.", example: "gast@voorbeeld.nl" },
              { name: "desired_date", type: "String", required: true, description: "Gewenste datum YYYY-MM-DD.", example: "2026-05-26" },
              { name: "party_size", type: "Number", required: true, description: "Aantal personen, geheel getal ≥ 1. De engine valideert zelf tegen large_group_max_online_request.", example: "4" },
              { name: "desired_time_from", type: "String", required: false, description: "Vroegste acceptabele tijd HH:mm. Default 18:00.", example: "18:30" },
              { name: "desired_time_to", type: "String", required: false, description: "Laatste acceptabele tijd HH:mm. Default 21:00.", example: "20:30" },
              { name: "notes", type: "String", required: false, description: "Vrij veld voor wensen of context.", example: "Liever bij het raam" },
            ],
            body: `{
  "guest_name": "{{contact.first_name}} {{contact.last_name}}",
  "guest_phone": "{{contact.phone}}",
  "guest_email": "{{contact.email}}",
  "desired_date": "{{desired_date}}",
  "party_size": {{party_size}},
  "desired_time_from": "{{desired_time_from}}",
  "desired_time_to": "{{desired_time_to}}",
  "notes": "{{notes}}"
}`,
            responseHint: (
              <>
                Response bevat <code>waitlist_entry_id</code>. Bevestig hardop dat de gast op de
                wachtlijst staat en dat het restaurant contact opneemt zodra er een plek vrijkomt.
              </>
            ),
            sayBefore: "Ik zet u nu op de wachtlijst, één momentje.",
          })}

          {toolBlock({
            n: 9,
            name: "get_opening_hours",
            optional: true,
            url: `${AGENT_API_BASE}/get_opening_hours`,
            description:
              "Haal de openingstijden voor een specifieke datum op zodat de agent info-vragen kan beantwoorden zonder te raden of te hallucineren.",
            params: [
              { name: "date", type: "String", required: false, description: "Datum YYYY-MM-DD. Leeg = vandaag.", example: "2026-05-26" },
            ],
            body: `{
  "date": "{{date}}"
}`,
            responseHint: (
              <>
                Response bevat <code>is_open</code>, <code>hours[]</code> en eventuele{" "}
                <code>closures[]</code>. Lees <code>message_for_guest</code> hardop voor als korte
                natuurlijke samenvatting.
              </>
            ),
            sayBefore: "Eén moment, ik check even onze openingstijden.",
          })}
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
              <strong>401 UNAUTHORIZED_NO_AUTH_HEADER / "CAP action execution failed"</strong> — de Authorization-header
              ontbreekt. Voeg in elke ClickWise Custom Action <code>Authorization: Bearer {`{{custom_values.tablewise_anon_key}}`}</code>
              toe naast <code>X-Agent-Api-Key</code>. De Supabase gateway eist deze header voordat onze functie mag draaien.
            </li>
            <li>
              <strong>401 Missing X-Agent-Api-Key / Invalid key</strong> — sleutel niet juist gekopieerd in de
              custom value <code>tablewise_api_key</code> of in de tool-headers.
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
    id: "optimizations",
    group: "golive",
    title: "10b. Optimalisaties — eenvoudiger logging, betere agent",
    icon: Sparkles,
    keywords: "logging native webhook post-call update contact field knowledge base defaults silence interrupt transcription",
    render: () => (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Optioneel maar sterk aanbevolen. Deze instellingen verlagen het risico op verloren call-logs,
          hallucinaties en stille gesprekken. Configureer ze in ClickWise op de assistant.
        </p>

        {/* A — Native post-call webhook */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="font-medium">A. Native post-call webhook (vervangt <code>log_call</code> als fallback)</div>
          <p className="text-xs text-muted-foreground">
            De ingebouwde post-call webhook van ClickWise vuurt op <strong>elk</strong> gesprek
            (ook bij hangup, time-out of crash van de agent) — de <code>log_call</code> tool is
            LLM-afhankelijk en kan worden vergeten. Onze <code>/agent_api/log_call</code> endpoint
            herkent automatisch de native payload (<code>call.id</code>, <code>from</code>,
            <code>to</code>, <code>duration</code>, <code>transcript</code>,
            <code>recording_url</code>, <code>summary</code>, <code>cost</code>).
          </p>
          <ol className="list-decimal list-inside text-xs space-y-1">
            <li>ClickWise → Assistant → <strong>Advanced Settings</strong> → <strong>Webhooks</strong>.</li>
            <li>Plak in <strong>Post-call webhook URL</strong> de URL hieronder.</li>
            <li>Voeg headers <code>Authorization: Bearer {`{{custom_values.tablewise_anon_key}}`}</code> én <code>X-Agent-Api-Key: {`{{custom_values.tablewise_api_key}}`}</code> toe.</li>
            <li>Sla op — je kunt nu de <code>log_call</code> tool in tools-lijst behouden als fallback (geen kwaad).</li>
          </ol>
          <CopyRow label="Post-call webhook URL" value={`${AGENT_API_BASE}/log_call`} />
        </div>

        {/* B — Update contact field */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="font-medium">B. After-call: Update contact field (lichte CRM-sync)</div>
          <p className="text-xs text-muted-foreground">
            Lichter alternatief voor een volledige Inbound Webhook Workflow: schrijf 4 velden
            direct vanuit de assistant terug op het ClickWise-contact. Handig voor segmentatie en
            ClickWise-rapportages.
          </p>
          <ol className="list-decimal list-inside text-xs space-y-1">
            <li>ClickWise → Assistant → <strong>After the call</strong> → <strong>Update contact field</strong>.</li>
            <li>Voeg 4 acties toe (1 per veld):
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-muted-foreground">
                <li><code>First Name</code> ← <code>{`{{response.first_name}}`}</code></li>
                <li><code>Last Name</code> ← <code>{`{{response.last_name}}`}</code></li>
                <li><code>Phone</code> ← <code>{`{{response.phone}}`}</code></li>
                <li><code>TW Reservation ID</code> ← <code>{`{{response.reservation_id}}`}</code> (custom field, type text)</li>
              </ul>
            </li>
            <li>Sla op. Bij elk gesprek met een geboekte reservering wordt het contact in
              ClickWise meteen verrijkt — bevestigings-SMS-templates kunnen <code>{`{{contact.custom_field.tw_reservation_id}}`}</code> gebruiken.</li>
          </ol>
        </div>

        {/* C — Knowledge base */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="font-medium">C. Knowledge Base — verlaag hallucinatie-risico</div>
          <p className="text-xs text-muted-foreground">
            De huidige system prompt bevat openingstijden, adres en parkeren niet hardgecodeerd —
            dat komt uit <code>get_opening_hours</code> en <code>{`{{custom_values.*}}`}</code>.
            Vul daarnaast de Knowledge Base met restaurant-specifieke FAQ-tekst, zodat de agent
            niet hoeft te raden bij vragen die <em>niet</em> in tools zitten.
          </p>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            <li>Openingstijden &amp; sluitingsdagen (synchroon met TableWise).</li>
            <li>Adres, parkeren, OV-bereikbaarheid.</li>
            <li>Allergie-beleid in 2–3 zinnen ("we kunnen rekening houden met X, niet met Y").</li>
            <li>Dresscode, kindvriendelijkheid, huisdieren.</li>
            <li>Cadeaubonnen, privé-zaal, terras-status.</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            ClickWise → Assistant → <strong>Knowledge Base</strong> → upload als losse documenten
            of plak per onderwerp.
          </p>
        </div>

        {/* D — Defaults table */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="font-medium">D. Aanbevolen agent-instellingen</div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-3">Instelling</th>
                  <th className="text-left py-1 pr-3">Waarde</th>
                  <th className="text-left py-1">Waarom</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr><td className="py-1 pr-3">Response delay</td><td className="py-1 pr-3"><code>600 ms</code></td><td className="py-1">natuurlijker, minder onderbreken</td></tr>
                <tr><td className="py-1 pr-3">Interruption sensitivity</td><td className="py-1 pr-3"><code>medium</code></td><td className="py-1">gast kan agent onderbreken</td></tr>
                <tr><td className="py-1 pr-3">Idle reminder</td><td className="py-1 pr-3"><code>"Bent u er nog?" na 8 s</code></td><td className="py-1">voorkomt stille hangups</td></tr>
                <tr><td className="py-1 pr-3">Silence timeout</td><td className="py-1 pr-3"><code>15 s</code></td><td className="py-1">netjes afronden bij geen reactie</td></tr>
                <tr><td className="py-1 pr-3">Temperature</td><td className="py-1 pr-3"><code>0.3</code></td><td className="py-1">consistente, voorspelbare antwoorden</td></tr>
                <tr><td className="py-1 pr-3">End call timeout</td><td className="py-1 pr-3"><code>30 s</code></td><td className="py-1">hangup na 2× geen reactie</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* E — Reporting + transcription */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="font-medium">E. Rapportage &amp; betere transcriptie</div>
          <ul className="list-disc list-inside text-xs space-y-1">
            <li>
              ClickWise → Assistant → <strong>Reporting</strong> → zet <em>Daily performance summary</em>
              aan met je eigen e-mailadres. Je krijgt 1× per dag een overzicht (volume, duur, kosten,
              succesratio).
            </li>
            <li>
              ClickWise → Assistant → <strong>Transcription</strong> → voeg restaurant-specifieke
              <strong> custom vocabulary</strong> toe (restaurantnaam, gerechten, wijken). Verhoogt
              de STT-nauwkeurigheid bij namen en eigennamen.
            </li>
            <li>
              In TableWise zie je alle calls per kanaal terug op <Link to="/app/reports" className="underline">Rapportage</Link>
              en in <Link to="/app/voice-agent" className="underline">Voice Agent → Status &amp; test</Link>.
            </li>
          </ul>
        </div>

        <Callout tone="success" title="Klaar in ~10 minuten">
          A en B zijn het belangrijkst — die maken je integratie betrouwbaar. C, D en E zijn
          incrementele verbeteringen die je later kunt doen.
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
          find_reservation:   `${AGENT_API_BASE}/find_reservation`,
          cancel_reservation: `${AGENT_API_BASE}/cancel_reservation`,
          update_reservation: `${AGENT_API_BASE}/update_reservation`,
          log_call:           `${AGENT_API_BASE}/log_call`,
        },
        tool_params: {
          check_availability: ["date (String, required)", "party_size (Number, required)", "preferred_time (String, required)"],
          book_reservation:   ["date (String, required)", "time (String, required)", "party_size (Number, required)", "first_name (String, required)", "last_name (String, optional)", "phone (String, required)", "email (String, optional)", "special_requests (String, optional)"],
          book_reservation_note: "reservation_id/bevestigingscode NIET hardop voorlezen. Beloof GEEN SMS, WhatsApp of e-mailbevestiging — sluit gewoon mondeling af.",
          find_reservation:   ["phone (String, optional)", "first_name (String, optional)", "last_name (String, optional)", "date (String, optional, YYYY-MM-DD)", "time (String, optional, HH:mm)"],
          find_reservation_note: "Minimaal één van: phone, last_name, of first_name + date. Vraag NOOIT om UUID of bevestigingsnummer.",
          cancel_reservation: ["reservation_id (String, required)", "reason (String, optional)"],
          cancel_reservation_note: "reservation_id wordt altijd intern opgehaald via find_reservation — nooit aan de beller vragen.",
          update_reservation: ["reservation_id (String, required)", "new_date (String, optional)", "new_time (String, optional)", "new_party_size (Number, optional)", "special_requests (String, optional)"],
          update_reservation_note: "reservation_id wordt altijd intern opgehaald via find_reservation — nooit aan de beller vragen.",
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

function SimpleVoiceAgentHelp() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-2xl">AI Telefoon-agent</h1>
          <p className="text-sm text-muted-foreground">
            Wat het is en hoe je hem laat aanzetten — zonder technische uitleg.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wat doet de AI-agent?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            "Neemt de telefoon op als jij of je team het te druk heeft",
            "Maakt nieuwe reserveringen — direct in jouw agenda",
            "Annuleert of wijzigt bestaande reserveringen",
            "Beantwoordt eenvoudige vragen (openingstijden, locatie, parkeren)",
            "Spreekt natuurlijk Nederlands en is altijd vriendelijk",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{line}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zo laat je hem aanzetten</CardTitle>
          <CardDescription>
            De koppeling is eenmalig technisch werk. TableWise of jouw ClickWise-partner regelt dit binnen 1 dag voor je.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Mail of bel ons dat je de AI-agent wilt activeren.</li>
            <li>Wij regelen de koppeling en het telefoonnummer.</li>
            <li>Je krijgt een testnummer om zelf te bellen.</li>
            <li>Akkoord? Wij zetten hem live op jouw eigen nummer.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm">
              <a href="mailto:support@txtablewise.nl?subject=AI%20Telefoon-agent%20activeren">
                <Mail className="h-4 w-4 mr-1" /> Mail support
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/koppelingen">Naar Koppelingen</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <div className="font-medium">Ben je technisch of een partner?</div>
            <div className="text-xs text-muted-foreground">
              De volledige technische koppelhandleiding staat verborgen achter Geavanceerde modus
              (zet aan in Algemene instellingen).
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/instellingen">Algemene instellingen</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AdvancedVoiceAgentHelp() {
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

export default function VoiceAgentHelp() {
  const { canSeeAdvanced } = useAdvancedMode();
  if (!canSeeAdvanced) return <SimpleVoiceAgentHelp />;
  return <AdvancedVoiceAgentHelp />;
}
