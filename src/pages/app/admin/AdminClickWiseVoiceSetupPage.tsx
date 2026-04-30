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
import { Check, Copy, Phone, Workflow, Variable, Wrench, BookOpen, ListChecks } from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";

const FN_BASE = "https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/agent_api";

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

  const systemPrompt = useMemo(() => `Je bent de AI telefoonhost van {{restaurant.name}}, een restaurant in Nederland.
Je spreekt Nederlands, bent gastvrij, kort en duidelijk. Geen lange uitweidingen.

# Wat je doet
Je helpt bellers met drie dingen:
1. Een nieuwe reservering maken
2. Een bestaande reservering wijzigen (datum, tijd, aantal personen)
3. Een bestaande reservering annuleren

# Hoe je een reservering maakt
1. Vraag: aantal personen, gewenste datum, gewenste tijd.
2. Roep ALTIJD eerst de tool \`check_availability\` aan.
3. Als beschikbaar: vraag voornaam, achternaam, telefoonnummer (mailadres alleen als gast die zelf noemt).
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
  "url": "${FN_BASE}/check_availability",
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
  "url": "${FN_BASE}/book_reservation",
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
      "first_name": "{{guest_first_name}}",
      "last_name": "{{guest_last_name}}",
      "phone": "{{caller_phone}}",
      "email": "{{guest_email}}"
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
  "url": "${FN_BASE}/cancel_reservation",
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
  "url": "${FN_BASE}/log_call",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "X-Agent-Api-Key": "{{custom_values.tablewise_api_key}}"
  },
  "body": {
    "external_call_id": "{{call.id}}",
    "caller_phone": "{{caller_phone}}",
    "outcome": "{{outcome}}",
    "reservation_id": "{{reservation_id}}",
    "duration_seconds": {{call.duration_seconds}},
    "summary": "{{summary}}"
  }
}`;

  const customValues = `tablewise_api_key = ${apiKey}
tablewise_restaurant_id = ${restaurantId}
tablewise_base_url = ${FN_BASE}
restaurant_name = ${current?.restaurants?.name ?? "<NAAM_RESTAURANT>"}
restaurant_phone = +31 20 000 0000
restaurant_address = <adres>
opening_hours_short = di t/m za 17:00–22:00, zondag 17:00–21:00`;

  const customFields = `// Contact (custom fields op contact-niveau)
- guest_first_name        | Text
- guest_last_name         | Text
- guest_email             | Text
- caller_phone            | Phone
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
          to: "{{caller_phone}}"
          body: "Bedankt voor je reservering bij {{custom_values.restaurant_name}} op {{reservation_date}} om {{reservation_time}}. Tot dan!"
      - add_tag: "tw_reservation_booked_via_voice"
    else: goto: 9_handoff

  3_cancel_done:
    type: send_sms
    to: "{{caller_phone}}"
    body: "Je reservering bij {{custom_values.restaurant_name}} is geannuleerd. Welkom terug wanneer het uitkomt."

  4_change_done:
    type: send_sms
    to: "{{caller_phone}}"
    body: "Je reservering is gewijzigd naar {{reservation_date}} {{reservation_time}}. Tot dan!"

  9_handoff:
    type: notify_team
    channel: internal
    message: "Voice agent kon gast {{caller_phone}} niet helpen. Bel terug. Samenvatting: {{summary}}"
`;

  const testCurl = `curl -X POST ${FN_BASE}/check_availability \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Api-Key: ${apiKey}" \\
  -d '{"date":"2026-05-15","party_size":2}'`;

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

          <StepCard n={6} title="Testen" icon={Phone}>
            <p>Bel het nummer, doe een testreservering, controleer in TableWise → <code>/app/reserveringen</code> én in <code>/app/admin/logs</code> dat de events binnenkomen. Zie tab <em>Test</em>.</p>
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
              value={`Goedendag, je spreekt met de virtuele gastvrouw van ${current?.restaurants?.name ?? "<restaurant>"}. Waar kan ik je mee helpen — een tafel reserveren, of een bestaande reservering wijzigen?`}
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
        </TabsContent>

        {/* VALUES */}
        <TabsContent value="values" className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Custom Values (Settings → Custom Values)</h3>
            <CopyBlock value={customValues} lang="env" />
          </Card>
          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Custom Fields (Settings → Custom Fields)</h3>
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
          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Test 1 — API key direct (curl)</h3>
            <p className="text-sm text-muted-foreground">Verwacht een 200 met <code>availableSlots</code>.</p>
            <CopyBlock value={testCurl} lang="bash" />
          </Card>
          <Card className="p-4 space-y-2">
            <h3 className="font-display text-base">Test 2 — End-to-end belscript</h3>
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
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Local Bot icon import shim (lucide already imported elsewhere)
import { Bot } from "lucide-react";
