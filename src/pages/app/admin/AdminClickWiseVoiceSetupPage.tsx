import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "@/hooks/use-toast";
import { Check, Copy, Phone, Workflow, Variable, Wrench, BookOpen, ListChecks, Bot, Package, AlertTriangle, Webhook, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";

const FN_BASE = "https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/agent_api";
// Snapshot-veilige URL via custom value — wordt in elke nieuwe sub-account
// automatisch gevuld vanuit de geïmporteerde custom values.
const FN_BASE_VAR = "{{custom_values.tablewise_base_url}}";

function CopyBlock({ label, value, lang = "text" }: { label?: string; value: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Badge variant="outline" className="text-[10px]">{lang}</Badge>
        </div>
      )}
      <div className="relative">
        <pre className="p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono text-foreground/90">{value}</pre>
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-1.5 right-1.5 h-7 px-2"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            toast({ title: "Gekopieerd" });
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function StepCard({ n, title, children, icon: Icon }: { n: number; title: string; children: React.ReactNode; icon?: any }) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
          {n}
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {title}
          </h3>
        </div>
      </div>
      <div className="pl-11 space-y-3 text-sm">{children}</div>
    </Card>
  );
}

export default function AdminClickWiseVoiceSetupPage() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurants?.id ?? "<RESTAURANT_ID>";
  const [apiKey, setApiKey] = useState("tw_live_PLAK_HIER_DE_AGENT_API_KEY");

  const systemPrompt = useMemo(() => `Je bent de AI telefoonhost van {{custom_values.restaurant_name}}, een restaurant in Nederland.
Je spreekt Nederlands, bent gastvrij, kort en duidelijk. Geen lange uitweidingen.

# Wat je doet
Je helpt bellers met drie dingen:
1. Een nieuwe reservering maken
2. Een bestaande reservering wijzigen (datum, tijd, aantal personen)
3. Een bestaande reservering annuleren

# Hoe je een reservering maakt
1. Vraag: aantal personen, gewenste datum, gewenste tijd.
2. Roep ALTIJD eerst de tool \`check_availability\` aan.
3. Naam, telefoon en e-mail komen waar mogelijk uit het ClickWise-contact (\`{{contact.first_name}} {{contact.last_name}}\`, \`{{contact.phone}}\`, \`{{contact.email}}\`). Vraag alleen wat ontbreekt — vrijwel altijd minstens voornaam + achternaam, e-mail alleen als de gast die zelf noemt.
4. Bevestig samengevat: "Dus ik noteer: {voornaam} {achternaam}, {personen} personen op {datum} om {tijd}, klopt dat?"
5. Pas NA mondelinge bevestiging roep je \`book_reservation\` aan.
6. Geef de gast de bevestiging: "Top, jullie tafel staat genoteerd. Je krijgt een bevestiging per sms/whatsapp."

# Als het tijdstip vol is
- Noem maximaal 2 alternatieven uit \`suggestedAlternatives\` ("Om 19:00 of 20:00 zou wel kunnen, wat past?").
- Boek niet zonder bevestiging van de gast.

# Wijzigen
- Vraag om naam + originele datum/tijd of reserveringscode.
- Roep \`cancel_reservation\` + \`book_reservation\` als wijziging niet via update lukt, of gebruik \`book_reservation\` met external_reference.
- Bevestig altijd mondeling vóór je iets uitvoert.

# Annuleren
- Vraag naam + datum/tijd of code.
- Bevestig: "Ik annuleer dan jullie reservering van {datum} {tijd}, akkoord?"
- Pas dan \`cancel_reservation\` aanroepen.
- Sluit gastvrij af: "Geen probleem, fijn dat je het doorgaf. Tot een volgende keer."

# Toon
- Warm, kort, hospitality-first. NOOIT bestraffend.
- Bij no-show, late annulering of klacht: empathisch blijven, geen verwijten.
- Spreek bedragen uit als "vijfendertig euro", niet "35,00".

# Wat je NIET doet
- Geen menu-uitleg langer dan 1 zin (verwijs naar de website).
- Geen prijsonderhandelingen.
- Niet boeken zonder telefoonnummer.
- Niet boeken zonder mondelinge bevestiging.
- Geen reserveringen langer dan 90 dagen vooruit.

# Foutafhandeling
- Bij API-fout: zeg "Eén momentje, ik probeer het opnieuw" en retry 1x.
- Lukt het 2x niet: "Ik krijg de agenda nu niet open, ik laat een collega je terugbellen, mag ik je nummer noteren?" en gebruik \`log_call\` met outcome=fallback_to_human.
- Spreekt de gast onduidelijk: vraag vriendelijk om herhaling.

# Aan het einde van ELK gesprek
Roep ALTIJD \`log_call\` aan met de samenvatting, outcome (booked/changed/cancelled/no_action/fallback_to_human) en eventuele reservation_id.`, []);

  const checkAvailJson = `{
  "name": "check_availability",
  "description": "Controleer of een tafel beschikbaar is op een datum/tijd voor een aantal personen. Roep dit aan VOORDAT je gaat boeken.",
  "url": "${FN_BASE_VAR}/check_availability",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "X-Agent-Api-Key": "{{custom_values.tablewise_api_key}}"
  },
  "body": {
    "date": "{{date}}",
    "party_size": {{party_size}}
  }
}`;

  const bookJson = `{
  "name": "book_reservation",
  "description": "Boek een reservering. Roep dit pas aan NA mondelinge bevestiging door de gast.",
  "url": "${FN_BASE_VAR}/book_reservation",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "X-Agent-Api-Key": "{{custom_values.tablewise_api_key}}"
  },
  "body": {
    "date": "{{date}}",
    "time": "{{time}}",
    "party_size": {{party_size}},
    "guest": {
      "first_name": "{{contact.first_name}}",
      "last_name": "{{contact.last_name}}",
      "phone": "{{contact.phone}}",
      "email": "{{contact.email}}"
    },
    "notes": "{{notes}}",
    "source_metadata": {
      "agent_provider": "clickwise",
      "external_call_id": "{{call.id}}"
    }
  }
}`;

  const cancelJson = `{
  "name": "cancel_reservation",
  "description": "Annuleer een bestaande reservering op basis van reservation_id of manage_token.",
  "url": "${FN_BASE_VAR}/cancel_reservation",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "X-Agent-Api-Key": "{{custom_values.tablewise_api_key}}"
  },
  "body": {
    "reservation_id": "{{reservation_id}}",
    "reason": "{{cancel_reason}}"
  }
}`;

  const logCallJson = `{
  "name": "log_call",
  "description": "Log de afronding van het gesprek (samenvatting, outcome). Roep dit ALTIJD aan aan het einde.",
  "url": "${FN_BASE_VAR}/log_call",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "X-Agent-Api-Key": "{{custom_values.tablewise_api_key}}"
  },
  "body": {
    "external_call_id": "{{call.id}}",
    "caller_phone": "{{contact.phone}}",
    "outcome": "{{outcome}}",
    "reservation_id": "{{reservation_id}}",
    "duration_seconds": {{call.duration_seconds}},
    "summary": "{{summary}}"
  }
}`;

  // Custom values voor de HUIDIGE klant — handig om direct in zijn sub-account te plakken.
  const customValues = `tablewise_api_key = ${apiKey}
tablewise_restaurant_id = ${restaurantId}
tablewise_base_url = ${FN_BASE}
restaurant_name = ${current?.restaurants?.name ?? "<NAAM_RESTAURANT>"}
restaurant_phone = +31 20 000 0000
restaurant_address = <adres>
opening_hours_short = di t/m za 17:00–22:00, zondag 17:00–21:00`;

  // Snapshot-template — gebruik DEZE waarden in de master sub-account waaruit je de
  // snapshot exporteert. Zo lekt er nooit een echte klant-API-key in de snapshot.
  const customValuesSnapshot = `tablewise_api_key = REPLACE_PER_CLIENT_tw_live_xxx
tablewise_restaurant_id = REPLACE_PER_CLIENT_uuid
tablewise_base_url = ${FN_BASE}
restaurant_name = REPLACE_PER_CLIENT
restaurant_phone = REPLACE_PER_CLIENT
restaurant_address = REPLACE_PER_CLIENT
opening_hours_short = REPLACE_PER_CLIENT`;

  const standardFields = `// Deze velden zijn STANDAARD in ClickWise/HighLevel — NIET aanmaken.
// Gebruik ze direct via {{contact.<veld>}} in tools, prompts en workflows.
- voornaam            → {{contact.first_name}}
- achternaam          → {{contact.last_name}}
- telefoon (beller)   → {{contact.phone}}     // wordt bij inbound call automatisch gevuld
- e-mailadres         → {{contact.email}}`;

  const customFields = `// Contact (alleen TableWise-specifiek)
- preferred_language      | Text (nl/en)

// Reservering (custom fields op opportunity/conversation)
- reservation_id          | Text
- reservation_code        | Text
- reservation_date        | Date (YYYY-MM-DD)
- reservation_time        | Text (HH:MM)
- party_size              | Number
- notes                   | Text
- cancel_reason           | Text
- outcome                 | Text (booked/changed/cancelled/no_action/fallback_to_human)
- summary                 | Text (long)`;

  const workflowYaml = `# Workflow: "Voice Agent — Inbound call → TableWise"
trigger:
  type: inbound_call
  channel: voice_agent
  agent: TableWise Voice Host

steps:
  1_answer:
    type: ai_voice_agent
    prompt_ref: "TableWise Voice Host (system prompt)"
    tools:
      - check_availability
      - book_reservation
      - cancel_reservation
      - log_call
    on_intent_book:        goto: 2_book_done
    on_intent_cancel:      goto: 3_cancel_done
    on_intent_change:      goto: 4_change_done
    on_fallback:           goto: 9_handoff

  2_book_done:
    type: condition
    if: "{{outcome}} == 'booked' && {{reservation_id}} != ''"
    then:
      - send_sms:
          to: "{{contact.phone}}"
          body: "Bedankt voor je reservering bij {{custom_values.restaurant_name}} op {{reservation_date}} om {{reservation_time}}. Tot dan!"
      - add_tag: "tw_reservation_booked_via_voice"
    else: goto: 9_handoff

  3_cancel_done:
    type: send_sms
    to: "{{contact.phone}}"
    body: "Je reservering bij {{custom_values.restaurant_name}} is geannuleerd. Welkom terug wanneer het uitkomt."

  4_change_done:
    type: send_sms
    to: "{{contact.phone}}"
    body: "Je reservering is gewijzigd naar {{reservation_date}} {{reservation_time}}. Tot dan!"

  9_handoff:
    type: notify_team
    channel: internal
    message: "Voice agent kon gast {{contact.phone}} niet helpen. Bel terug. Samenvatting: {{summary}}"
`;

  const testCurl = `curl -X POST ${FN_BASE}/check_availability \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Api-Key: ${apiKey}" \\
  -d '{"date":"2026-05-15","party_size":2}'`;

  // Realistische test-payloads — gebruikt in tab "Trainen" zodat ClickWise een
  // echte response ziet en daar custom-field-mappings op kan baseren.
  const trainCheck = `{
  "date": "2026-05-15",
  "party_size": 2
}`;

  const trainBook = `{
  "date": "2026-05-15",
  "time": "19:30",
  "party_size": 2,
  "guest": {
    "first_name": "Test",
    "last_name": "Tester",
    "phone": "+31600000000",
    "email": "test@example.com"
  },
  "notes": "Trainingsboeking — mag verwijderd worden",
  "source_metadata": {
    "agent_provider": "clickwise",
    "external_call_id": "train_001"
  }
}`;

  const trainCancel = `{
  "reservation_id": "<plak-reservation_id-uit-book-test-response>",
  "reason": "training"
}`;

  const trainLog = `{
  "external_call_id": "train_001",
  "caller_phone": "+31600000000",
  "outcome": "booked",
  "reservation_id": "<plak-reservation_id-uit-book-test-response>",
  "duration_seconds": 42,
  "summary": "Trainingsgesprek voor response-mapping"
}`;

  const hoppscotchUrl = `${FN_BASE}/check_availability`;
  const hoppscotchHeaders = `Content-Type: application/json
X-Agent-Api-Key: ${apiKey}`;
  const hoppscotchBody = `{"date":"2026-05-15","party_size":2}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ClickWise Voice Agent — Setup gids"
        description="Stap-voor-stap instructies voor system admins om in ClickWise (HighLevel) een voice agent op te zetten die boekt, wijzigt en annuleert via TableWise."
        badge={<Badge variant="outline" className="border-primary/40 text-primary">SYSTEM ADMIN</Badge>}
      />

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-sm">Wat ga je opzetten?</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>Eén Agent API key in TableWise per vestiging.</li>
              <li>Vier tools (actions) in ClickWise: <code>check_availability</code>, <code>book_reservation</code>, <code>cancel_reservation</code>, <code>log_call</code>.</li>
              <li>Een set custom values + custom fields om gegevens vast te houden tijdens het gesprek.</li>
              <li>Eén AI voice agent met de TableWise system prompt.</li>
              <li>Eén workflow die het inkomende telefoongesprek routeert en SMS-bevestigingen stuurt.</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-amber-500/5 border-amber-500/30">
        <div className="flex items-start gap-3">
          <Package className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm">Bouw dit eenmalig — distribueer via snapshot</p>
            <p className="text-sm text-muted-foreground">
              Bouw deze hele setup één keer in een 'master' sub-account met dummy-waarden, exporteer als HighLevel snapshot,
              en gebruik die snapshot voor élke nieuwe klant. Per klant blijven er dan ~6 handmatige stappen over.
              Zie tab <strong>Snapshot</strong> voor de volledige checklist en placeholder-template.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3 border border-border rounded-lg p-4 bg-card">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plak hier je Agent API key (uit TableWise → Voice Agent → Sleutel aanmaken)</Label>
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono text-sm" />
        <p className="text-xs text-muted-foreground">Alle copy-blokken hieronder worden automatisch met deze sleutel gevuld.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview"><ListChecks className="h-3.5 w-3.5 mr-1.5" />Stappenplan</TabsTrigger>
          <TabsTrigger value="prompt"><Bot className="h-3.5 w-3.5 mr-1.5" />Prompt</TabsTrigger>
          <TabsTrigger value="actions"><Wrench className="h-3.5 w-3.5 mr-1.5" />Actions</TabsTrigger>
          <TabsTrigger value="values"><Variable className="h-3.5 w-3.5 mr-1.5" />Values & Fields</TabsTrigger>
          <TabsTrigger value="workflow"><Workflow className="h-3.5 w-3.5 mr-1.5" />Workflow</TabsTrigger>
          <TabsTrigger value="test"><Phone className="h-3.5 w-3.5 mr-1.5" />Test</TabsTrigger>
          <TabsTrigger value="snapshot"><Package className="h-3.5 w-3.5 mr-1.5" />Snapshot</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <StepCard n={1} title="Maak in TableWise een Agent API key" icon={Wrench}>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>Ga naar <code>/app/voice-agent</code> → tab <strong>Configuratie</strong> (Advanced Mode aanzetten als je hem niet ziet).</li>
              <li>Provider = <strong>ClickWise</strong>. Klik <em>Sleutel genereren</em>.</li>
              <li>Kopieer de getoonde sleutel (begint met <code>tw_live_...</code>) — je ziet hem maar 1 keer.</li>
              <li>Plak hem bovenaan deze pagina zodat alle codeblokken zich vullen.</li>
            </ol>
          </StepCard>

          <StepCard n={2} title="In ClickWise: maak Custom Values + Custom Fields" icon={Variable}>
            <p>Ga naar <strong>Settings → Custom Values</strong> en <strong>Settings → Custom Fields</strong> in de sub-account van het restaurant. Zie tab <em>Values & Fields</em>.</p>
          </StepCard>

          <StepCard n={3} title="Maak 4 Custom Actions (tools) aan" icon={Wrench}>
            <p>Ga naar <strong>Automation → Workflow Actions → Custom Actions</strong> (of bij voice agent: <em>Tools / Functions</em>). Voor elk van de 4 tools: kopieer de JSON uit tab <em>Actions</em>.</p>
          </StepCard>

          <StepCard n={4} title="Maak de AI Voice Agent" icon={Phone}>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>Ga naar <strong>Voice AI → Agents → New Agent</strong>.</li>
              <li>Naam: <em>TableWise Voice Host — {current?.restaurants?.name ?? "<restaurant>"}</em>.</li>
              <li>Taal: Nederlands. Stem: warme vrouwelijke of mannelijke stem (test beide).</li>
              <li>Plak de system prompt uit tab <em>Prompt</em>.</li>
              <li>Koppel de 4 tools die je net hebt aangemaakt.</li>
              <li>Koppel een telefoonnummer (Twilio) of forward het bestaande restaurantnummer.</li>
            </ol>
          </StepCard>

          <StepCard n={5} title="Bouw de workflow" icon={Workflow}>
            <p>Maak een workflow met trigger <em>Inbound Call</em> die de agent activeert en na afloop SMS verstuurt. Zie tab <em>Workflow</em> voor de YAML-structuur.</p>
          </StepCard>

          <StepCard n={5.5 as unknown as number} title="Trainen — laat ClickWise de response herkennen" icon={Wrench}>
            <p>
              ClickWise weet pas welke velden uit de TableWise-response (zoals <code>reservation_id</code>, <code>availableSlots</code>) bestaan
              <strong> nadat het één keer een echte response heeft gezien</strong>. Dat doe je per Custom Action met een testaanroep met écht ingevulde waarden.
            </p>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>Open een Custom Action (bv. <code>book_reservation</code>) in ClickWise.</li>
              <li>Vervang het body-veld tijdelijk door de <strong>test-payload</strong> uit tab <em>Actions → Trainen</em>.</li>
              <li>Klik <em>Test</em> / <em>Run test</em>. Je ziet de echte JSON-response.</li>
              <li>Klik <em>Save response sample</em> (of <em>Map fields</em>) en koppel velden zoals <code>response.reservation_id</code> → custom field <code>reservation_id</code>.</li>
              <li><strong>Belangrijk:</strong> zet de body daarna terug naar de versie met <code>{`{{...}}`}</code> placeholders, anders boekt elke beller "Test Tester".</li>
            </ol>
          </StepCard>

          <StepCard n={6} title="Testen" icon={Phone}>
            <p>Heb je in stap 5.5 alle 4 de tools getraind? Dan vult de end-to-end belproef de custom fields automatisch. Bel het nummer, doe een testreservering en controleer in TableWise → <code>/app/reserveringen</code> én <code>/app/admin/logs</code>. Zie tab <em>Test</em>.</p>
          </StepCard>

          <StepCard n={7} title="Snapshot maken & hergebruiken voor volgende klanten" icon={Package}>
            <p>
              Werkt deze sub-account end-to-end? Exporteer 'm dan als <strong>HighLevel snapshot</strong>.
              Bij elke nieuwe klant importeer je de snapshot en heb je nog ~6 handmatige stappen.
              Volledige checklist + placeholder-template staat in tab <em>Snapshot</em>.
            </p>
          </StepCard>

        </TabsContent>

        {/* PROMPT */}
        <TabsContent value="prompt" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-display text-lg mb-2">System prompt</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Plak deze in het <em>System Prompt</em> veld van je ClickWise voice agent. Vervang <code>{`{{restaurant.name}}`}</code> als ClickWise dat niet automatisch doet.
            </p>
            <CopyBlock value={systemPrompt} lang="prompt" />
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-display text-base">Begroeting (first message)</h3>
            <CopyBlock
              value={`Goedendag, je spreekt met de virtuele gastvrouw van {{custom_values.restaurant_name}}. Waar kan ik je mee helpen — een tafel reserveren, of een bestaande reservering wijzigen?`}
              lang="text"
            />
          </Card>
        </TabsContent>

        {/* ACTIONS */}
        <TabsContent value="actions" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vier tools om aan de agent te koppelen. Alle 4 gebruiken dezelfde header <code>X-Agent-Api-Key</code> via <code>{`{{custom_values.tablewise_api_key}}`}</code>.
          </p>
          <Accordion type="multiple" defaultValue={["check"]}>
            <AccordionItem value="check">
              <AccordionTrigger>1. check_availability</AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={checkAvailJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="book">
              <AccordionTrigger>2. book_reservation</AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={bookJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cancel">
              <AccordionTrigger>3. cancel_reservation</AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={cancelJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="log">
              <AccordionTrigger>4. log_call</AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={logCallJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Card className="p-4 space-y-3 border-amber-500/30 bg-amber-500/5">
            <h3 className="font-display text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              Trainen — eenmalige test-payloads voor response-mapping
            </h3>
            <p className="text-sm text-muted-foreground">
              Plak per Custom Action <strong>tijdelijk</strong> de payload hieronder in het body-veld en klik <em>Test</em> in ClickWise.
              Zo ziet ClickWise een echte response en kun je velden zoals <code>response.reservation_id</code> mappen naar custom fields.
              <strong> Zet de body daarna terug naar de versie met <code>{`{{...}}`}</code> placeholders</strong> uit het accordion hierboven.
            </p>
            <div className="grid gap-3">
              <CopyBlock label="check_availability — test body" value={trainCheck} lang="json" />
              <CopyBlock label="book_reservation — test body" value={trainBook} lang="json" />
              <CopyBlock label="cancel_reservation — test body" value={trainCancel} lang="json" />
              <CopyBlock label="log_call — test body" value={trainLog} lang="json" />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: voer ze in deze volgorde uit. De <code>reservation_id</code> uit de book-test plak je in de cancel- en log-test.
              Verwijder de testreservering daarna in <code>/app/reserveringen</code>.
            </p>
          </Card>
        </TabsContent>

        {/* VALUES */}
        <TabsContent value="values" className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Custom Values (Settings → Custom Values)</h3>
            <CopyBlock value={customValues} lang="env" />
          </Card>
          <Card className="p-4 space-y-3 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <h3 className="font-display text-base">Standaard ClickWise/HighLevel velden — NIET aanmaken</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Voor naam, telefoon en e-mail gebruiken we de standaard contactvelden van ClickWise.
              Voordeel: automatische deduplicatie op telefoon/e-mail, contact wordt bij inbound call automatisch herkend of aangemaakt,
              en alle native SMS/e-mail-acties werken zonder extra mapping.
            </p>
            <CopyBlock value={standardFields} lang="text" />
          </Card>
          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Custom Fields die je WEL aanmaakt (Settings → Custom Fields)</h3>
            <p className="text-sm text-muted-foreground">
              Alleen TableWise-specifieke velden — de standaardvelden hierboven niet dupliceren.
            </p>
            <CopyBlock value={customFields} lang="text" />
          </Card>
        </TabsContent>

        {/* WORKFLOW */}
        <TabsContent value="workflow" className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Workflow structuur</h3>
            <p className="text-sm text-muted-foreground">
              ClickWise heeft geen YAML-import; gebruik dit als blueprint en bouw 'm na in de visuele editor.
            </p>
            <CopyBlock value={workflowYaml} lang="yaml" />
          </Card>
        </TabsContent>

        {/* TEST */}
        <TabsContent value="test" className="space-y-4">
          <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
            <h3 className="font-display text-base">Test 1 — Valideer de API key buiten ClickWise</h3>
            <p className="text-sm text-muted-foreground">
              Doe deze test <strong>vóórdat</strong> je in ClickWise gaat klikken. Hiermee bewijs je dat je sleutel werkt en dat de TableWise-endpoint bereikbaar is.
              Verwacht een <code>200</code> met <code>availableSlots</code>. Lukt dit niet? Dan ligt het aan TableWise/sleutel — niet aan ClickWise.
            </p>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Let op:</strong> ClickWise/HighLevel heeft géén losse "curl-knop". De Custom Actions die je later in ClickWise bouwt
              dóén feitelijk hetzelfde als deze curl onder de motorkap. Deze test is dus alleen voor jouw eigen zekerheid vooraf, op je eigen machine of in een browsertool.
            </div>

            <Accordion type="single" collapsible defaultValue="curl">
              <AccordionItem value="curl">
                <AccordionTrigger>Optie A — Terminal (curl)</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">Mac/Linux: open <em>Terminal</em>. Windows: open <em>PowerShell</em> of <em>WSL</em>. Plak en run:</p>
                  <CopyBlock value={testCurl} lang="bash" />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="hopp">
                <AccordionTrigger>Optie B — Browser (hoppscotch.io, gratis)</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <ol className="text-sm space-y-1 list-decimal pl-4">
                    <li>Ga naar <a href="https://hoppscotch.io" target="_blank" rel="noreferrer" className="text-primary underline">hoppscotch.io</a>.</li>
                    <li>Methode = <strong>POST</strong>. Plak de URL hieronder.</li>
                    <li>Tab <em>Headers</em>: voeg de twee headers hieronder toe.</li>
                    <li>Tab <em>Body</em> → <em>Raw input</em> → <em>application/json</em>: plak de body.</li>
                    <li>Klik <em>Send</em>. Verwacht <code>200</code>.</li>
                  </ol>
                  <CopyBlock label="URL" value={hoppscotchUrl} lang="text" />
                  <CopyBlock label="Headers" value={hoppscotchHeaders} lang="text" />
                  <CopyBlock label="Body (JSON)" value={hoppscotchBody} lang="json" />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="postman">
                <AccordionTrigger>Optie C — Postman / Insomnia</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <ol className="text-sm space-y-1 list-decimal pl-4">
                    <li>Nieuwe request → methode <strong>POST</strong> → URL plakken.</li>
                    <li>Headers tab: beide headers plakken.</li>
                    <li>Body → raw → JSON: body plakken.</li>
                    <li>Send. Verwacht <code>200</code>.</li>
                  </ol>
                  <CopyBlock label="URL" value={hoppscotchUrl} lang="text" />
                  <CopyBlock label="Headers" value={hoppscotchHeaders} lang="text" />
                  <CopyBlock label="Body (JSON)" value={hoppscotchBody} lang="json" />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-display text-base">Test 2 — End-to-end belscript</h3>
            <p className="text-sm text-muted-foreground">
              Pas uitvoeren als je tools getraind hebt (zie tab <em>Actions → Trainen</em>). Anders blijven de custom fields leeg na de call.
            </p>
            <ol className="text-sm space-y-1.5 list-decimal pl-4">
              <li>Bel het gekoppelde nummer.</li>
              <li>"Ik wil graag reserveren voor 2 personen, vrijdag om 19:30."</li>
              <li>Geef een naam en telefoonnummer wanneer gevraagd.</li>
              <li>Bevestig mondeling.</li>
              <li>Open <code>/app/reserveringen</code> → check de nieuwe reservering met channel <em>ai_host</em>.</li>
              <li>Open <code>/app/admin/logs</code> → controleer success-events voor <code>check_availability</code>, <code>book_reservation</code>, <code>log_call</code>.</li>
            </ol>
          </Card>
          <Card className="p-4 space-y-2">
            <h3 className="font-display text-base">Veelvoorkomende fouten</h3>
            <ul className="text-sm space-y-2">
              <li><strong>401 auth_invalid</strong> — sleutel staat verkeerd in custom value, of niet via <code>X-Agent-Api-Key</code> header verstuurd.</li>
              <li><strong>403 auth_scope_missing</strong> — sleutel mist scope. Maak nieuwe sleutel met scopes <code>availability, book, cancel</code>.</li>
              <li><strong>409 timeslot_unavailable</strong> — verwacht gedrag bij vol; agent moet dan alternatieven voorstellen.</li>
              <li><strong>Agent boekt zonder bevestiging</strong> — versterk in prompt: "Pas NA mondelinge bevestiging".</li>
              <li><strong>Custom fields blijven leeg na call</strong> — tools zijn nog niet getraind. Zie tab <em>Actions → Trainen</em>.</li>
            </ul>
          </Card>

        </TabsContent>

        {/* SNAPSHOT */}
        <TabsContent value="snapshot" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base">Hoe werkt de snapshot-strategie?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Bouw deze hele setup éénmalig in een 'master' sub-account in ClickWise (HighLevel). Exporteer dan een snapshot
              en koppel die aan elke nieuwe of bestaande klant-sub-account. Snapshots nemen
              <strong> Custom Actions, Custom Values, Custom Fields én Workflows </strong>
              mee — maar <strong>niet</strong> de Voice AI Agent zelf, het Twilio-nummer of de response-mapping per Custom Action.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                <p className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Wel in de snapshot</p>
                <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                  <li>4 Custom Actions (tool definities + bodies)</li>
                  <li>Custom Values (sleutels, mét waarden)</li>
                  <li>Custom Fields (definities)</li>
                  <li>Workflow "Voice Agent — Inbound call → TableWise"</li>
                  <li>SMS-templates en tags</li>
                </ul>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                <p className="font-medium text-amber-700 dark:text-amber-500 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Niet in de snapshot</p>
                <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                  <li>De AI Voice Agent zelf (handmatig opnieuw)</li>
                  <li>Twilio telefoonnummer-koppeling</li>
                  <li>Response-mapping per Custom Action ("Trainen")</li>
                  <li>Echte API key-waarde (gebruik placeholder!)</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Master sub-account — placeholder Custom Values</h3>
            <p className="text-sm text-muted-foreground">
              Vul in de master sub-account de Custom Values met deze <strong>dummy-waarden</strong>. Zo lekt er nooit een echte klant-API-key
              of restaurant-ID in je snapshot. <code>tablewise_base_url</code> blijft wel echt — die is voor alle klanten gelijk.
            </p>
            <CopyBlock value={customValuesSnapshot} lang="env" />
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
              <strong className="text-destructive">Belangrijk:</strong> bouw de snapshot NOOIT in een sub-account die een echte klant bedient.
              De Custom Values worden mét waarden meegenomen. Alleen via deze placeholders blijft de snapshot veilig deelbaar.
            </div>
          </Card>

          <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
            <h3 className="font-display text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Per nieuwe klant — exact 6 handmatige stappen
            </h3>
            <ol className="text-sm space-y-2 list-decimal pl-4">
              <li>
                <strong>Snapshot importeren</strong> in de nieuwe (of bestaande) sub-account van de klant.
                Agency-account → Sub-Accounts → klant → <em>Load Snapshot</em>.
              </li>
              <li>
                <strong>Custom Values vervangen</strong>: open Settings → Custom Values en zet alle <code>REPLACE_PER_CLIENT_*</code>
                waarden om naar de echte data van deze klant.
                <ul className="list-disc pl-5 mt-1 text-muted-foreground space-y-0.5">
                  <li><code>tablewise_api_key</code> — uit TableWise → Voice Agent → Sleutel genereren (per restaurant uniek)</li>
                  <li><code>tablewise_restaurant_id</code> — uit TableWise (<code>/app/instellingen</code> of admin)</li>
                  <li><code>restaurant_name</code>, <code>restaurant_phone</code>, <code>restaurant_address</code>, <code>opening_hours_short</code></li>
                  <li><code>tablewise_base_url</code> — laat staan, is globaal</li>
                </ul>
              </li>
              <li>
                <strong>Voice AI Agent opnieuw aanmaken</strong> (Voice AI → Agents → New Agent). Plak de system prompt en first message uit tab <em>Prompt</em>.
                Die teksten gebruiken al <code>{`{{custom_values.restaurant_name}}`}</code>, dus werken meteen voor élke klant.
              </li>
              <li>
                <strong>Tools koppelen</strong> aan de nieuwe agent: selecteer de 4 Custom Actions die uit de snapshot komen
                (<code>check_availability</code>, <code>book_reservation</code>, <code>cancel_reservation</code>, <code>log_call</code>).
              </li>
              <li>
                <strong>Telefoonnummer (Twilio) koppelen</strong> aan de agent of doorschakelen vanaf het bestaande restaurantnummer.
              </li>
              <li>
                <strong>"Trainen" per Custom Action</strong>: open elke action, plak tijdelijk de test-payload uit tab <em>Actions → Trainen</em>,
                klik <em>Test</em>, sla de response sample op en map de velden. Daarna body terugzetten naar de versie met <code>{`{{...}}`}</code>.
                Zonder deze stap blijven custom fields leeg na een echte call.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Stappen 1, 2 en 5 kosten ~5 minuten. Stappen 3, 4 en 6 samen ~15 minuten. Reken op ~20-25 min per nieuwe klant.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Wat je in deze pagina al hebt gedaan om snapshot-ready te zijn</h3>
            <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
              <li>Tool URLs gebruiken <code>{`{{custom_values.tablewise_base_url}}`}</code> i.p.v. een hardcoded URL — staging/prod-split mogelijk.</li>
              <li>Tool headers gebruiken <code>{`{{custom_values.tablewise_api_key}}`}</code> — geen sleutel in de Custom Action body.</li>
              <li>System prompt + first message gebruiken <code>{`{{custom_values.restaurant_name}}`}</code> — zelfde tekst werkt in elke sub-account.</li>
              <li>SMS-bodies in workflow gebruiken <code>{`{{custom_values.restaurant_name}}`}</code>.</li>
              <li>Identity-velden komen uit native HighLevel <code>{`{{contact.*}}`}</code> — bestaan automatisch in elke sub-account.</li>
              <li>Custom Fields zijn generiek (geen restaurantnaam in de field-naam) — herbruikbaar zonder rename.</li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
