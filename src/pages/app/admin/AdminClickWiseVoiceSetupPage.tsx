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

  const systemPrompt = useMemo(() => `Je bent de AI telefoonhost van {{custom_values.tablewise_restaurant_name}}, een restaurant in tijdzone {{custom_values.tablewise_timezone}}.
Je spreekt Nederlands, bent gastvrij, kort en duidelijk. Geen lange uitweidingen.

# Wat je doet
Je helpt bellers met drie dingen:
1. Een nieuwe reservering maken
2. Een bestaande reservering wijzigen (datum, tijd, aantal personen)
3. Een bestaande reservering annuleren

# Hoe je een reservering maakt (NIEUWE FLOW — ALTIJD volgen)
1. Vraag: aantal personen, gewenste datum, gewenste tijd.
2. (Optioneel) Wil de gast eerst alleen weten of een tijdstip nog kan? Gebruik dan \`check_availability\`. Voor een echte boeking is dit NIET nodig — sla over.
3. Naam, telefoon en e-mail komen waar mogelijk uit het ClickWise-contact (\`{{contact.first_name}} {{contact.last_name}}\`, \`{{contact.phone}}\`, \`{{contact.email}}\`). Vraag alleen wat ontbreekt — vrijwel altijd minstens voornaam + achternaam.
4. Bevestig samengevat ZONDER het beller-ID-nummer terug te lezen: "Dus ik noteer: {voornaam} {achternaam}, {personen-in-woorden} personen op {datum-in-woorden} om {tijd-in-spreektaal}. Ik gebruik het nummer waarmee u nu belt — klopt dat?"
5. NA mondelinge bevestiging roep je in ÉÉN call \`reservation_request\` aan — voor ELKE groepsgrootte (1, 5, 8, 11, 14, 18). De engine valideert, controleert, boekt en geeft je de juiste mondelinge reactie terug.
6. Gebruik LETTERLIJK het veld \`response.message_for_guest\` als je antwoord aan de beller. Beloof GEEN SMS, WhatsApp of e-mail.

# Uitspraak (cruciaal — altijd toepassen)
- TELEFOONNUMMER, twee scenario's:
  · DEFAULT (beller-ID / \`{{contact.phone}}\`): lees dit nummer NOOIT hardop voor, vraag NOOIT om bevestiging of herhaling. Zeg alleen: "Ik gebruik het nummer waarmee u nu belt — is dat goed?"
  · ALTERNATIEF nummer (gast wil ander nummer of caller-ID is anoniem): vraag de gast CIJFER VOOR CIJFER te spellen en lees het CIJFER VOOR CIJFER terug ("plus drie één, zes, vijf, drie, vijf, twee, één, één, zes, zes — klopt dat?"). Groepeer NOOIT in paren of tientallen.
- TIJD altijd in spreektaal: 18:15 → "kwart over zes", 18:30 → "half zeven", 19:00 → "zeven uur 's avonds", 20:10 → "tien over acht". Intern in tool-call altijd HH:MM (24u).
- NEDERLANDSE "HALF X" (eerste keer goed interpreteren — NOOIT vragen wat de gast bedoelt zonder eerst de juiste vertaling te proberen): "half zes" = 17:30, "half zeven" = 18:30, "half acht" = 19:30, "half negen" = 20:30, "half tien" = 21:30, "half elf" = 22:30. Bij twijfel ÉÉN korte controlevraag in spreektaal: "Bedoelt u half zes, dus vijf uur dertig?" — daarna niet meer herhalen.
- DATUM altijd in woorden: 2026-05-25 → "vijfentwintig mei", 2026-06-01 → "één juni". "vandaag" / "morgen" / "overmorgen" letterlijk. Intern altijd YYYY-MM-DD.
- AANTAL PERSONEN voluit: 2 → "twee personen", 10 → "tien personen", 17 → "zeventien personen".
- RESERVERINGSCODE alleen op verzoek, letter-voor-letter / cijfer-voor-cijfer (NAVO bij verwarring): R7K2 → "R van Romeo, zeven, K van Kilo, twee".
- VERBODEN: "achttien uur vijftien", letterlijke YYYY-MM-DD voorlezen, "+31"/"06"-prefix oplezen voor het beller-ID-nummer.

# Als het tijdstip vol is
- Krijg je van \`reservation_request\` het veld \`next_action: "offer_alternatives_or_waitlist"\` → bied 2 alternatieven of de wachtlijst aan, en roep daarna opnieuw \`reservation_request\` aan met de nieuwe tijd.
- Boek nooit zonder bevestiging van de gast.

# Wijzigen
- Vraag om naam + originele datum/tijd of reserveringscode.
- Gebruik \`update_reservation\` voor datum/tijd/aantal-wijzigingen.
- Bevestig altijd mondeling vóór je iets uitvoert.

# Annuleren
- Vraag naam + datum/tijd of code.
- Bevestig: "Ik annuleer dan jullie reservering van {datum} {tijd}, akkoord?"
- Pas dan \`cancel_reservation\` aanroepen.
- Sluit gastvrij af: "Geen probleem, fijn dat je het doorgaf. Tot een volgende keer."

# Grote groepen — DE ENGINE BESLIST, JIJ NOOIT
ABSOLUTE REGEL: roep NOOIT de action \`Call Transfer\` aan uit eigen initiatief. Ook niet bij 10, 12, 15 of 18 personen. Call Transfer mag ALLEEN als de engine je expliciet \`next_action: "transfer_call"\` teruggeeft.

Roep ALTIJD \`reservation_request\` aan, ongeacht groepsgrootte. De engine geeft één van vier mogelijkheden:
- a) \`ok: true\`, \`requires_manual_approval: false\` → boeking is rond. Bevestig met \`message_for_guest\`.
- b) \`ok: true\`, \`requires_manual_approval: true\` → reservering staat IN TableWise en wacht op interne goedkeuring. Bevestig LETTERLIJK met \`message_for_guest\`. NIET doorverbinden. Beloof GEEN SMS/WhatsApp/e-mail.
- c) \`next_action: "transfer_call"\` (alleen bij groepen groter dan de online limiet, binnen openingstijden) → zeg \`message_for_guest\` en roep de action **Call Transfer** aan naar \`transfer.phone\`.
- d) \`next_action: "promise_callback"\` of \`"offer_alternatives_or_waitlist"\` of \`"apologize_and_callback"\` → zeg \`message_for_guest\` en roep \`log_call\` aan met de juiste outcome.

# Toon
- Warm, kort, hospitality-first. NOOIT bestraffend.
- Bij no-show, late annulering of klacht: empathisch blijven, geen verwijten.
- Spreek bedragen uit als "vijfendertig euro", niet "35,00".

# Wat je NIET doet
- Geen menu-uitleg langer dan 1 zin (verwijs naar de website).
- Geen prijsonderhandelingen.
- Niet boeken zonder telefoonnummer.
- Niet boeken zonder mondelinge bevestiging.
- Boek nooit te ver vooruit; als de engine TW_409_BEYOND_HORIZON (of vergelijkbaar) teruggeeft, leg dat uit en bied terugbel-optie aan.
- Beloof NOOIT een bevestiging per SMS, WhatsApp of e-mail — ook niet bij grote groepen of wijzigingen.

# Foutafhandeling
- Bij API-fout: zeg "Eén momentje, ik probeer het opnieuw" en retry 1x.
- Lukt het 2x niet: "Ik krijg de agenda nu niet open, ik laat een collega je terugbellen, mag ik je nummer noteren?" en gebruik \`log_call\` met outcome=fallback_to_human.
- Spreekt de gast onduidelijk: vraag vriendelijk om herhaling.

# Aan het einde van ELK gesprek
Roep ALTIJD \`log_call\` aan met de samenvatting, outcome (booked/changed/cancelled/no_action/fallback_to_human/callback_needed) en eventuele reservation_id.`, []);

  const checkAvailJson = `{
  "name": "check_availability",
  "description": "Optioneel — alleen als de beller eerst wil weten of een tijdstip nog kan zonder direct te boeken. Voor een echte boeking gebruik je reservation_request.",
  "url": "${FN_BASE_VAR}/check_availability",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "X-Agent-Api-Key": "{{custom_values.tablewise_api_key}}"
  },
  "body": {
    "date": "{{date}}",
    "party_size": {{party_size}},
    "preferred_time": "{{time}}"
  }
}`;

  const reservationRequestJson = `{
  "name": "reservation_request",
  "description": "DE PRIMAIRE TOOL VOOR ELKE NIEUWE BOEKING (1 tot 18 personen). Eén call: valideren + boeken. Roep dit aan NA mondelinge bevestiging. De engine geeft je 'message_for_guest' en 'next_action' — zeg LETTERLIJK message_for_guest en volg next_action.",
  "url": "${FN_BASE_VAR}/reservation_request",
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
    "special_requests": "{{special_requests}}",
    "source_metadata": {
      "agent_provider": "clickwise",
      "external_call_id": "{{call.id}}"
    }
  }
}`;

  const bookJson = `{
  "name": "book_reservation",
  "description": "LET OP: gebruik bij voorkeur reservation_request. Deze tool is alleen voor edge cases waarin je 100% zeker weet dat availability al klopt en je het book-only contract wil.",
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
  // Restaurantnaam + tijdzone worden door TableWise automatisch gepusht (sync-knop),
  // omdat {{location.*}} niet rendert in Voice AI prompts.
  const customValues = `tablewise_api_key = ${apiKey}
tablewise_restaurant_id = ${restaurantId}
tablewise_base_url = ${FN_BASE}
tablewise_restaurant_name = <auto, gepusht door TableWise>
tablewise_timezone = <auto, gepusht door TableWise>
restaurant_phone = +31 20 000 0000
restaurant_address = <adres>
opening_hours_short = di t/m za 17:00–22:00, zondag 17:00–21:00`;

  // Snapshot-template — gebruik DEZE waarden in de master sub-account waaruit je de
  // snapshot exporteert. Zo lekt er nooit een echte klant-API-key in de snapshot.
  const customValuesSnapshot = `tablewise_api_key = REPLACE_PER_CLIENT_tw_live_xxx
tablewise_restaurant_id = REPLACE_PER_CLIENT_uuid
tablewise_base_url = ${FN_BASE}
tablewise_restaurant_name = REPLACE_PER_CLIENT
tablewise_timezone = REPLACE_PER_CLIENT_Europe/Amsterdam
restaurant_phone = REPLACE_PER_CLIENT
restaurant_address = REPLACE_PER_CLIENT
opening_hours_short = REPLACE_PER_CLIENT`;

  const standardFields = `// Deze velden zijn STANDAARD in ClickWise — NIET aanmaken.
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
      - reservation_request   # PRIMAIRE boekingstool — gebruik voor ELKE groepsgrootte
      - check_availability    # optioneel — alleen voor "kan ik om X uur komen?"
      - cancel_reservation
      - log_call
      # LET OP: GEEN 'Call Transfer' als autonome tool aan de agent koppelen.
      # Transfer gebeurt alleen via workflow-conditie hieronder op response.next_action.
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
          body: "Bedankt voor je reservering bij {{custom_values.tablewise_restaurant_name}} op {{reservation_date}} om {{reservation_time}}. Tot dan!"
      - add_tag: "tw_reservation_booked_via_voice"
    else: goto: 9_handoff

  3_cancel_done:
    type: send_sms
    to: "{{contact.phone}}"
    body: "Je reservering bij {{custom_values.tablewise_restaurant_name}} is geannuleerd. Welkom terug wanneer het uitkomt."

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


  // ===== Inbound webhooks (TableWise → ClickWise) =====
  const inboundEnvelope = `{
  "id": "<event-uuid>",
  "event_type": "reservation.reminder_24h_scheduled",
  "restaurant_id": "<restaurant-uuid>",
  "created_at": "2026-05-15T10:00:00Z",
  "payload": {
    "reservation": {
      "id": "...",
      "date": "2026-05-15",
      "time": "19:30",
      "party_size": 2,
      "manage_token": "..."
    },
    "guest": {
      "first_name": "Anna",
      "last_name": "de Vries",
      "phone": "+31600000000",
      "email": "anna@example.com"
    },
    "manage_url": "https://app.tablewise.nl/r/<manage_token>"
  }
}`;

  const inboundEvents: Array<{
    key: string;
    label: string;
    purpose: string;
    suggestedAction: string;
    samplePayload: string;
  }> = [
    {
      key: "reservation.created",
      label: "Reservering aangemaakt",
      purpose: "Optioneel: trigger een interne CRM-tag of teamnotificatie. TableWise stuurt zelf GEEN gastbevestiging via dit event — alleen aanzetten als jouw workflow dat bewust doet.",
      suggestedAction: "Workflow → contact taggen 'tw_reservation'. Verstuur alleen automatisch bericht naar {{inboundWebhookRequest.payload.guest.phone}} als jouw setup dat expliciet vereist.",
      samplePayload: `"payload": {
  "reservation": { "id": "...", "date": "2026-05-15", "time": "19:30", "party_size": 2, "manage_token": "..." },
  "guest": { "first_name": "Anna", "phone": "+31600000000", "email": "anna@example.com" },
  "manage_url": "https://app.tablewise.nl/r/<manage_token>"
}`,
    },
    {
      key: "reservation.updated",
      label: "Reservering gewijzigd",
      purpose: "Stuur een update-bevestiging met de nieuwe datum/tijd.",
      suggestedAction: "Workflow → SMS met nieuwe details, vermeld dat de oude is vervallen.",
      samplePayload: `"payload": {
  "reservation": { "id": "...", "date": "2026-05-16", "time": "20:00", "party_size": 3 },
  "previous": { "date": "2026-05-15", "time": "19:30", "party_size": 2 },
  "guest": { "first_name": "Anna", "phone": "+31600000000" }
}`,
    },
    {
      key: "reservation.cancelled",
      label: "Reservering geannuleerd",
      purpose: "Bevestig de annulering gastvrij en trigger waitlist-flow.",
      suggestedAction: "Workflow → korte SMS 'tot een volgende keer' + remove tag 'tw_reservation'.",
      samplePayload: `"payload": {
  "reservation": { "id": "...", "date": "2026-05-15", "time": "19:30" },
  "guest": { "first_name": "Anna", "phone": "+31600000000" },
  "cancellation_reason": "ziek"
}`,
    },
    {
      key: "reservation.reminder_24h_scheduled",
      label: "24u-reminder",
      purpose: "Stuur ~24u vooraf een herinnering met manage-link (wijzig/annuleer).",
      suggestedAction: "Workflow → SMS met {{inboundWebhookRequest.payload.manage_url}}.",
      samplePayload: `"payload": {
  "reservation": { "date": "2026-05-15", "time": "19:30", "party_size": 2 },
  "guest": { "first_name": "Anna", "phone": "+31600000000" },
  "manage_url": "https://app.tablewise.nl/r/<manage_token>"
}`,
    },
    {
      key: "reservation.reminder_2h_scheduled",
      label: "2u-reminder",
      purpose: "Last-mile herinnering ~2u vooraf — kort en warm.",
      suggestedAction: "Workflow → korte SMS 'tot zo!' (geen knoppen nodig).",
      samplePayload: `"payload": {
  "reservation": { "time": "19:30", "party_size": 2 },
  "guest": { "first_name": "Anna", "phone": "+31600000000" }
}`,
    },
    {
      key: "reservation.reconfirmation_requested",
      label: "Herbevestiging gevraagd",
      purpose: "Vraag de gast actief te bevestigen om no-show te voorkomen.",
      suggestedAction: "Workflow → SMS met confirm- en cancel-link uit payload.",
      samplePayload: `"payload": {
  "reservation": { "date": "2026-05-15", "time": "19:30" },
  "guest": { "first_name": "Anna", "phone": "+31600000000" },
  "confirm_url": "https://app.tablewise.nl/r/<manage_token>?action=confirm",
  "cancel_url": "https://app.tablewise.nl/r/<manage_token>?action=cancel"
}`,
    },
    {
      key: "reservation.reconfirmed",
      label: "Gast heeft herbevestigd",
      purpose: "Bedank de gast en zet tag 'tw_reconfirmed' op het contact.",
      suggestedAction: "Workflow → korte SMS bedankje + tag-update.",
      samplePayload: `"payload": {
  "reservation": { "date": "2026-05-15", "time": "19:30" },
  "guest": { "first_name": "Anna", "phone": "+31600000000" }
}`,
    },
    {
      key: "review.requested",
      label: "Reviewverzoek na bezoek",
      purpose: "Vraag ~2u na bezoek om feedback. TableWise splitst zelf positief/negatief.",
      suggestedAction: "Workflow → SMS met {{inboundWebhookRequest.payload.feedback_url}}.",
      samplePayload: `"payload": {
  "reservation": { "date": "2026-05-15" },
  "guest": { "first_name": "Anna", "phone": "+31600000000" },
  "feedback_url": "https://app.tablewise.nl/feedback/<token>"
}`,
    },
    {
      key: "waitlist.notification_requested",
      label: "Wachtlijst-match",
      purpose: "Tafel komt vrij — bied het slot direct aan de wachtlijst-gast.",
      suggestedAction: "Workflow → SMS met accept-link, response window in payload.",
      samplePayload: `"payload": {
  "waitlist_entry": { "id": "...", "date": "2026-05-15", "time": "19:30", "party_size": 2 },
  "guest": { "first_name": "Anna", "phone": "+31600000000" },
  "accept_url": "https://app.tablewise.nl/w/<token>",
  "response_window_minutes": 15
}`,
    },
    {
      key: "guest.created",
      label: "Nieuwe gast aangemaakt",
      purpose: "Auto-create contact in ClickWise + welkomstflow voor first-timers.",
      suggestedAction: "Workflow → upsert contact via {{inboundWebhookRequest.payload.guest.*}}.",
      samplePayload: `"payload": {
  "guest": { "id": "...", "first_name": "Anna", "last_name": "de Vries", "phone": "+31600000000", "email": "anna@example.com", "marketing_consent": true }
}`,
    },
    {
      key: "guest.updated",
      label: "Gast bijgewerkt",
      purpose: "Houd ClickWise contact in sync (allergieën, voorkeuren, opt-ins).",
      suggestedAction: "Workflow → update contact custom fields.",
      samplePayload: `"payload": {
  "guest": { "id": "...", "phone": "+31600000000", "allergies": "noten", "dietary_preferences": "vegetarisch" }
}`,
    },
  ];

  const hmacSnippet = `// ClickWise Custom Code step — valideer X-TableWise-Signature
// (Voeg dit toe als 1e step in elke inbound-workflow)
const secret = "{{custom_values.tablewise_webhook_secret}}";
const received = inboundWebhookRequest.headers["x-tablewise-signature"];
const body = JSON.stringify(inboundWebhookRequest.body);

const enc = new TextEncoder();
const key = await crypto.subtle.importKey(
  "raw", enc.encode(secret),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
);
const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
const expected = Array.from(new Uint8Array(sig))
  .map(b => b.toString(16).padStart(2, "0")).join("");

if (received !== expected) {
  throw new Error("Invalid TableWise signature — workflow stopped");
}
return { valid: true };`;

  const hoppscotchUrl = `${FN_BASE}/check_availability`;
  const hoppscotchHeaders = `Content-Type: application/json
X-Agent-Api-Key: ${apiKey}`;
  const hoppscotchBody = `{"date":"2026-05-15","party_size":2}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ClickWise Voice Agent — Setup gids"
        description="Stap-voor-stap instructies voor system admins om in ClickWise een voice agent op te zetten die boekt, wijzigt en annuleert via TableWise."
        badge={<Badge variant="outline" className="border-primary/40 text-primary">SYSTEM ADMIN</Badge>}
      />

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-sm">Wat ga je opzetten?</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>Eén Agent API key in TableWise per vestiging.</li>
              <li>Vijf tools (actions) in ClickWise: <strong><code>reservation_request</code></strong> (primair), <code>check_availability</code> (optioneel), <code>book_reservation</code> (legacy), <code>cancel_reservation</code>, <code>log_call</code>.</li>
              <li><strong>GEEN</strong> autonome <code>Call Transfer</code> action — alleen via workflow-conditie op <code>response.next_action == "transfer_call"</code>.</li>
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
              Bouw deze hele setup één keer in een 'master' sub-account met dummy-waarden, exporteer als ClickWise snapshot,
              en gebruik die snapshot voor élke nieuwe klant. Per klant blijven er dan ~7 handmatige stappen over.
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
          <TabsTrigger value="inbound"><Webhook className="h-3.5 w-3.5 mr-1.5" />Inbound webhooks</TabsTrigger>
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
              Werkt deze sub-account end-to-end? Exporteer 'm dan als <strong>ClickWise snapshot</strong>.
              Bij elke nieuwe klant importeer je de snapshot en heb je nog ~7 handmatige stappen.
              Volledige checklist + placeholder-template staat in tab <em>Snapshot</em>.
            </p>
          </StepCard>

          <StepCard n={8} title="Inbound webhooks koppelen — TableWise laten praten naar ClickWise" icon={Webhook}>
            <p>
              De voice agent stuurt gespreksdata <em>naar</em> TableWise. Voor bevestigingen, reminders, reviews en wachtlijst-meldingen
              moet ClickWise juist <em>luisteren</em> naar de 11 events die TableWise zelf uitstuurt.
              Bouw per event-type een Inbound-webhook workflow en plak de unieke URL in TableWise. Volledige lijst + sample payloads in tab <em>Inbound webhooks</em>.
            </p>
          </StepCard>

        </TabsContent>

        {/* PROMPT */}
        <TabsContent value="prompt" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-display text-lg mb-2">System prompt</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Plak deze in het <em>System Prompt</em> veld van je ClickWise voice agent. De
              prompt gebruikt <code>{`{{custom_values.tablewise_restaurant_name}}`}</code> en
              <code>{` {{custom_values.tablewise_timezone}}`}</code> — die worden automatisch
              gepusht door TableWise (sync-knop). <strong>Let op:</strong> <code>{`{{location.*}}`}</code>
              rendert niet in Voice AI prompts; gebruik altijd <code>{`{{custom_values.*}}`}</code>.
            </p>
            <CopyBlock value={systemPrompt} lang="prompt" />
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-display text-base">Begroeting (first message)</h3>
            <CopyBlock
              value={`Goedendag, je spreekt met de virtuele gastvrouw van {{custom_values.tablewise_restaurant_name}}. Waar kan ik je mee helpen — een tafel reserveren, of een bestaande reservering wijzigen?`}
              lang="text"
            />
          </Card>
        </TabsContent>

        {/* ACTIONS */}
        <TabsContent value="actions" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vijf tools om aan de agent te koppelen. <strong><code>reservation_request</code> is de primaire boekingstool</strong> — die doet validatie + boeking in één call en levert <code>message_for_guest</code> + <code>next_action</code>. Alle 5 gebruiken dezelfde header <code>X-Agent-Api-Key</code> via <code>{`{{custom_values.tablewise_api_key}}`}</code>.
          </p>
          <Accordion type="multiple" defaultValue={["reqres"]}>
            <AccordionItem value="reqres">
              <AccordionTrigger>1. reservation_request <span className="ml-2 text-xs text-primary">aanbevolen voor boeken</span></AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={reservationRequestJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="check">
              <AccordionTrigger>2. check_availability <span className="ml-2 text-xs text-muted-foreground">optioneel</span></AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={checkAvailJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="book">
              <AccordionTrigger>3. book_reservation <span className="ml-2 text-xs text-muted-foreground">legacy</span></AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={bookJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cancel">
              <AccordionTrigger>4. cancel_reservation</AccordionTrigger>
              <AccordionContent>
                <CopyBlock label="Action JSON" value={cancelJson} lang="json" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="log">
              <AccordionTrigger>5. log_call</AccordionTrigger>
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
              <h3 className="font-display text-base">Standaard ClickWise velden — NIET aanmaken</h3>
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
        {/* INBOUND WEBHOOKS */}
        <TabsContent value="inbound" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base">ClickWise luistert naar TableWise</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              De voice agent stuurt een gesprek <em>naar</em> TableWise. Maar voor bevestigingen, reminders, reviews en wachtlijst-meldingen
              moet ClickWise juist <em>luisteren</em> naar events die TableWise zelf uitstuurt — bijvoorbeeld 24u voor de reservering.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
                <p className="font-medium flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-primary" /> Voice agent (al gedaan)</p>
                <p className="text-xs text-muted-foreground">ClickWise → TableWise. Custom Actions roepen <code>agent_api</code> aan tijdens een belgesprek.</p>
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-1">
                <p className="font-medium flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5 text-primary" /> Inbound webhooks (deze tab)</p>
                <p className="text-xs text-muted-foreground">TableWise → ClickWise. 11 event-typen via <code>dispatch_webhooks</code> naar één Inbound Webhook trigger per event.</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Universele payload-envelope</h3>
            <p className="text-sm text-muted-foreground">
              Elke POST van TableWise heeft dezelfde top-level structuur. <code>payload</code> verschilt per event-type.
              Headers die je in ClickWise kunt uitlezen:
              <code className="mx-1">X-TableWise-Event</code>,
              <code className="mx-1">X-TableWise-Event-Id</code>,
              <code className="mx-1">X-TableWise-Endpoint</code> en (bij gebruik van een secret) <code>X-TableWise-Signature</code>.
            </p>
            <CopyBlock label="Body" value={inboundEnvelope} lang="json" />
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Stap-voor-stap: één event opzetten in ClickWise</h3>
            <ol className="text-sm space-y-2 list-decimal pl-4">
              <li>ClickWise → <em>Automation</em> → <em>Workflow</em> → <em>New</em> → trigger: <strong>Inbound Webhook</strong>.</li>
              <li>Workflow-naam consistent maken: <code>TW — &lt;event_label&gt;</code> (bv. <code>TW — 24u-reminder</code>). Maakt snapshot-herkenning makkelijker.</li>
              <li>Kopieer de unieke <strong>webhook URL</strong> die ClickWise toont na opslaan.</li>
              <li>
                <strong>Mapping Reference</strong>: stuur eerst eenmalig een sample-payload naar die URL (via cURL of TableWise test-knop), kies dan in de trigger-popup <em>"Check for new requests"</em> en selecteer de binnengekomen payload. Pas dán kun je <strong>Save Trigger</strong> klikken. Volledige uitleg in helptekst stap 7.
              </li>
              <li>
                In TableWise: ga naar <em>Settings → API & Webhooks</em> → <em>Endpoint toevoegen</em>.
                <ul className="list-disc pl-5 mt-1 text-muted-foreground space-y-0.5">
                  <li><strong>Label</strong>: zelfde als workflow-naam.</li>
                  <li><strong>URL</strong>: de webhook URL uit ClickWise.</li>
                  <li><strong>Events</strong>: alleen het matchende event-type (of <code>*</code> voor alles).</li>
                </ul>
              </li>
              <li>(Optioneel) Generate webhook secret in TableWise → vul als custom value <code>tablewise_webhook_secret</code> in ClickWise. Voeg dan de HMAC-step toe (zie verderop).</li>
              <li>Test in TableWise → <em>Stuur testevent</em> → controleer in ClickWise <em>Workflow → Execution log</em> of de trigger is afgegaan.</li>
            </ol>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">11 aanbevolen workflows</h3>
            <p className="text-sm text-muted-foreground">
              Dit zijn alle event-typen die TableWise vandaag uitstuurt. Bouw bij voorkeur voor élk type een aparte workflow — dat houdt SMS-templates beheersbaar en logs leesbaar.
            </p>
            <Accordion type="single" collapsible className="w-full">
              {inboundEvents.map((ev) => (
                <AccordionItem key={ev.key} value={ev.key}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2 text-left">
                      <span className="font-medium">{ev.label}</span>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ev.key}</code>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 text-sm">
                    <p><strong>Doel:</strong> {ev.purpose}</p>
                    <p><strong>Suggestie:</strong> {ev.suggestedAction}</p>
                    <CopyBlock label="Sample payload" value={ev.samplePayload} lang="json" />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>

          <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
            <h3 className="font-display text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              HMAC-validatie (optioneel maar aanbevolen)
            </h3>
            <p className="text-sm text-muted-foreground">
              ClickWise valideert <code>X-TableWise-Signature</code> niet automatisch. Voeg deze Custom Code-step als 1<sup>e</sup> stap in elke inbound-workflow toe — dan weiger je gespoofte requests.
              Vereist custom value <code>tablewise_webhook_secret</code> (per sub-account; matcht het secret in TableWise endpoint).
            </p>
            <CopyBlock label="Custom Code (JS)" value={hmacSnippet} lang="javascript" />
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
            <h3 className="font-display text-base">Test 1 — Valideer de API key buiten ClickWise</h3>
            <p className="text-sm text-muted-foreground">
              Doe deze test <strong>vóórdat</strong> je in ClickWise gaat klikken. Hiermee bewijs je dat je sleutel werkt en dat de TableWise-endpoint bereikbaar is.
              Verwacht een <code>200</code> met <code>availableSlots</code>. Lukt dit niet? Dan ligt het aan TableWise/sleutel — niet aan ClickWise.
            </p>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Let op:</strong> ClickWise heeft géén losse "curl-knop". De Custom Actions die je later in ClickWise bouwt
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
              Bouw deze hele setup éénmalig in een 'master' sub-account in ClickWise. Exporteer dan een snapshot
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
                  <li>11 Inbound-webhook workflows (TW — reservation.created etc.) — logica blijft, URLs niet</li>
                  <li>SMS-templates en tags</li>
                </ul>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                <p className="font-medium text-amber-700 dark:text-amber-500 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Niet in de snapshot</p>
                <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                  <li>De AI Voice Agent zelf (handmatig opnieuw)</li>
                  <li>Twilio telefoonnummer-koppeling</li>
                  <li>Response-mapping per Custom Action ("Trainen")</li>
                  <li>Inbound webhook URLs — uniek per sub-account, per klant in TableWise plakken</li>
                  <li>Echte API key-waarde + webhook secret (gebruik placeholder!)</li>
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
              Per nieuwe klant — exact 7 handmatige stappen
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
                  <li><code>tablewise_webhook_secret</code> — uit TableWise → Settings → API & Webhooks (per endpoint)</li>
                  <li><code>restaurant_phone</code>, <code>restaurant_address</code>, <code>opening_hours_short</code></li>
                  <li><code>tablewise_base_url</code> — laat staan, is globaal</li>
                  <li className="text-success"><code>tablewise_restaurant_name</code> + <code>tablewise_timezone</code> hoef je <strong>niet</strong> handmatig te zetten — TableWise pusht die automatisch via de sync-knop in <em>Koppelingen → ClickWise</em>. (<code>{`{{location.*}}`}</code> rendert namelijk niet in Voice AI prompts.)</li>
                </ul>
              </li>
              <li>
                <strong>Voice AI Agent opnieuw aanmaken</strong> (Voice AI → Agents → New Agent). Plak de system prompt en first message uit tab <em>Prompt</em>.
                Die teksten gebruiken <code>{`{{custom_values.tablewise_restaurant_name}}`}</code>, dus werken meteen voor élke klant zodra de sync is gedraaid.
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
              <li>
                <strong>Inbound webhook URLs koppelen</strong>: open elk van de 11 <code>TW — *</code> workflows in ClickWise,
                kopieer de unieke webhook URL en plak in TableWise → <em>Settings → API & Webhooks</em> als endpoint
                (één per event-type, of één endpoint met <code>*</code> filter voor alles). Zie tab <em>Inbound webhooks</em>.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Stappen 1, 2 en 5 kosten ~5 minuten. Stappen 3, 4, 6 en 7 samen ~20 minuten. Reken op ~25-30 min per nieuwe klant.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-display text-base">Wat je in deze pagina al hebt gedaan om snapshot-ready te zijn</h3>
            <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
              <li>Tool URLs gebruiken <code>{`{{custom_values.tablewise_base_url}}`}</code> i.p.v. een hardcoded URL — staging/prod-split mogelijk.</li>
              <li>Tool headers gebruiken <code>{`{{custom_values.tablewise_api_key}}`}</code> — geen sleutel in de Custom Action body.</li>
              <li>System prompt + first message gebruiken <code>{`{{custom_values.tablewise_restaurant_name}}`}</code> en <code>{`{{custom_values.tablewise_timezone}}`}</code> — automatisch gepusht door TableWise (sync-knop). <code>{`{{location.*}}`}</code> rendert niet in Voice AI prompts.</li>
              <li>SMS-bodies in workflow gebruiken <code>{`{{custom_values.tablewise_restaurant_name}}`}</code> — consistent met de prompt.</li>
              <li>Identity-velden komen uit standaard ClickWise <code>{`{{contact.*}}`}</code> — bestaan automatisch in elke sub-account.</li>
              <li>Custom Fields zijn generiek (geen restaurantnaam in de field-naam) — herbruikbaar zonder rename.</li>
              <li>Inbound-webhook workflows hebben een vaste naam-conventie (<code>TW — &lt;event_label&gt;</code>) zodat ze in elke snapshot herkenbaar zijn.</li>
              <li>HMAC-validatie snippet gebruikt <code>{`{{custom_values.tablewise_webhook_secret}}`}</code> — geen secret in de workflow-code.</li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
