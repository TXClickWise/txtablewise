## Korte status: zit er al een AI voice-agent keuze in TableWise?

**Nee, nog niet.** Wat er nu wél is:
- `AIHostPage` kent een **caller-type** `voice_ai` (alleen labels — geen echte voice provider gekoppeld).
- `ClickWiseIntegrationPage` noemt "AI-agents" als use-case in de uitleg, maar er is geen UI om een specifieke voice-agent (bv. een Vapi/Retell/ElevenLabs/HighLevel-agent) te kiezen of te koppelen.
- De edge function `clickwise_process_event` stuurt events naar ClickWise/HighLevel-workflows, maar bevat **geen voice-provider configuratie**, geen agent-id, geen telefoonnummer-routing.
- De `book_reservation` / `guest_reservation` edge functions zijn klaar om door **een externe agent** aangeroepen te worden, maar er is nog geen publiek "agent API"-endpoint met API-key auth.

Kortom: **TableWise is voorbereid, maar je moet de voice-agent zelf bouwen in ClickWise/HighLevel (of een voice-platform), en TableWise nog uitbreiden met een veilig agent-endpoint en een UI om je gekozen agent te koppelen.**

---

## Hoe de integratie werkt — stap voor stap

### Architectuur

```text
Gast belt restaurant
       │
       ▼
Twilio nummer  ──►  Voice Agent (Vapi / Retell / HighLevel Voice AI)
                          │
                          │  function calls: check_availability, book, cancel
                          ▼
                  TableWise Agent API  (nieuwe edge function, API-key auth)
                          │
                          ▼
                  book_reservation / availability  (bestaand)
                          │
                          ▼
                  Reservering in DB  ──►  webhook event  ──►  ClickWise workflow
                                                                 (bevestiging SMS/WhatsApp, reminder, review)
```

ClickWise/HighLevel doet dus de **opvolging** (CRM, WhatsApp, reminders). De **voice-agent** doet het gesprek + de boeking via TableWise's API. Dit zijn twee aparte rollen.

---

### Stap 1 — Kies een voice-platform
Drie realistische opties (kies één):
1. **HighLevel Voice AI** (zit in ClickWise/HighLevel zelf) — minste setup, werkt native met je workflows.
2. **Vapi** — meest flexibel, beste latency, gemakkelijk function calling. Aanbevolen voor reservering-use-case.
3. **Retell AI** — vergelijkbaar met Vapi, sterk in NL.

ElevenLabs Agents kan ook, maar telefonie eromheen vraagt extra setup (Twilio).

### Stap 2 — Bouw in TableWise een "Agent API" endpoint (nieuwe code)
Eén nieuwe edge function `agent_api` met API-key auth, die de voice-agent kan aanroepen. Drie functies:
- `POST /agent_api/check_availability` → wrapt bestaande `availability` functie
- `POST /agent_api/book_reservation` → wrapt bestaande `book_reservation`
- `POST /agent_api/cancel_reservation` → wrapt `manage_reservation`

Beveiliging: `X-Agent-Api-Key` header, key per restaurant in nieuwe tabel `agent_api_keys`. Rate limiting + audit log in `integration_events`.

### Stap 3 — Voeg UI toe in TableWise om de agent te koppelen
Nieuwe sectie op `ClickWiseIntegrationPage` (of nieuwe `AI Voice Agent`-pagina):
- **Provider kiezen**: HighLevel / Vapi / Retell / Anders.
- **Agent-ID** invullen (bv. Vapi assistant ID).
- **Telefoonnummer** dat doorschakelt naar de agent.
- **API-key** (genereren-knop) die de voice-agent moet gebruiken om TableWise te bereiken.
- **Webhook URL** + **System prompt template** (NL, restaurant-specifiek: openingstijden, max party-size, beleid).
- **Test-knop**: stuurt een test-call event en toont resultaat.

### Stap 4 — Configureer de voice-agent (buiten TableWise)
In Vapi (voorbeeld):
1. Maak een assistant aan, taal NL, voice naar keuze (ElevenLabs voice via Vapi).
2. System prompt: rol = "host van {restaurant}", taken = reserveringen aannemen, vragen om naam/datum/tijd/aantal/telefoon, allergieën, bevestigen.
3. Functions definiëren die naar jouw `agent_api` endpoints wijzen (URL + API-key header).
4. Koppel een Twilio-nummer aan de assistant.

In HighLevel: gebruik Voice AI-employee, voeg "Custom Webhook"-actions toe naar dezelfde TableWise endpoints.

### Stap 5 — Koppel ClickWise voor opvolging
Dit gebruikt de **bestaande** ClickWise-integratie:
- Webhook van TableWise vuurt `reservation.created`.
- ClickWise workflow: stuur WhatsApp-bevestiging → 24u-reminder → no-show preventie → na bezoek aftercare/review.
- Niets nieuws nodig hier — werkt al.

### Stap 6 — Test- en pilot-modus
- **Sandbox-mode**: agent-API draait in test, schrijft naar DB met `source_channel = 'voice_ai_test'`, geen ClickWise-events.
- **Live-mode**: alleen na pilot-readiness checks en als alle secrets staan.
- Toon op `PilotReadinessPage` of voice-agent verbonden + getest is.

---

## Wat moet er concreet gebouwd worden in TableWise

1. **Migratie**: tabel `agent_api_keys` (restaurant_id, key_hash, label, last_used_at, revoked_at) + tabel `agent_call_logs` (call_id, restaurant_id, transcript_url, outcome, reservation_id).
2. **Edge function `agent_api`**: 3 endpoints met API-key auth, rate limit, validatie, audit log.
3. **UI**: nieuwe pagina `/app/voice-agent` of sectie binnen ClickWise-pagina:
   - Provider-keuze, agent-id, telefoonnummer, API-key beheer (rotate/revoke), test-knop, log van laatste calls.
4. **Source channel uitbreiden**: `voice_ai` als first-class kanaal in rapportage (waarschijnlijk al deels aanwezig).
5. **Documentatie-snippet** in UI: copy-paste system prompt + function specs voor Vapi/HighLevel/Retell.

---

## Wat je zelf moet regelen (buiten TableWise)
- Account bij gekozen voice-provider (Vapi/Retell/HighLevel Voice AI).
- Twilio-nummer (of via provider).
- Eventueel ElevenLabs voice-id voor stem.
- Doorschakeling van restaurant-vastnummer naar het Twilio-nummer.

---

## Wat ik nodig heb om verder te gaan
Beantwoord deze 3 dingen, dan kan ik de bouw starten:
1. **Welke voice-provider** wil je primair ondersteunen? (HighLevel Voice AI / Vapi / Retell / alle drie generiek)
2. **Bouw ik nu alleen het TableWise-deel** (agent API + UI + koppeling-flow), of moet ik ook een **kant-en-klare Vapi-config** genereren die je in Vapi importeert?
3. **MVP-scope**: alleen *nieuwe reservering aannemen*, of ook *wijzigen/annuleren* en *wachtlijst*?
