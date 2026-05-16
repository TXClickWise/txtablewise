## Doel

De voice agent moet een gast nooit om een UUID-`reservation_id` vragen én ook geen bevestigingscode (laatste 6 tekens van het id) hardop voorlezen — de gast krijgt die toch via SMS/WhatsApp toegestuurd. Voor annuleren/wijzigen zoekt de agent de reservering altijd zelf op via `find_reservation` op basis van **telefoonnummer**, **voor- + achternaam**, **datum** en/of **tijd**, en gebruikt vervolgens intern de teruggegeven `reservation_id`.

## Wijzigingen

### 1. `supabase/functions/agent_api/index.ts` — `find_reservation` uitbreiden

Huidige implementatie matcht alléén op `phone` (verplicht) + optioneel `date`. Uitbreiden zodat de agent ook op naam/datum/tijd kan zoeken:

- `phone` wordt **optioneel**, maar minimaal één van `phone`, `last_name`, of (`first_name` + `date`) moet aanwezig zijn. Anders `400 missing_field` met sprekende error: `"Geef telefoon, of achternaam + datum"`.
- Nieuwe optionele velden in payload: `first_name`, `last_name`, `time` (HH:mm).
- Matchstrategie:
  1. Als `phone` → huidige flow (laatste 8 cijfers ilike).
  2. Anders zoek `guests` binnen `restaurant_id` met `ilike` op `last_name` (en optioneel `first_name`).
  3. Filter reserveringen op `guest_id IN (...)`, status `confirmed|pending|seated`, toekomstig.
  4. Als `date` meegegeven → `.eq("reservation_date", date)`.
  5. Als `time` meegegeven → filter resultaten waar `start_time` begint met `HH:mm` (±15 min tolerantie).
- Response shape blijft gelijk; `message_for_guest` aanpassen aan het aantal matches.
- Bij meerdere matches: geef ze allemaal terug zodat de agent kan disambigueren.

### 2. `src/services/aiHost/contracts.ts`

In `find_reservation_by_phone`:
- Label/description generieker maken ("reservering opzoeken").
- Parameters: `phone` (optional), `first_name` (optional), `last_name` (optional), `date` (optional), `time` (optional).

### 3. `src/services/aiHost/dispatcher.ts`

- Schema uitbreiden met optionele `first_name`, `last_name`, `time`; `phone` van required → optional.
- `refine` die minimaal één van (`phone`, `last_name`, `first_name`+`date`) eist.
- Zoekquery spiegelt agent_api.

### 4. `src/pages/app/help/VoiceAgentHelp.tsx` — system prompt & tool-docs

**A. VERPLICHTE TOOL-VOLGORDE — stap 4 (regel 183) vervangen door:**

```
4. Na succesvolle create_reservation: bevestig hardop datum, tijd en aantal personen. Lees GEEN reservation_id of bevestigingscode voor — de gast krijgt die automatisch per SMS/WhatsApp toegestuurd.
```

**B. ANNULEREN-sectie (regels 186–190) vervangen door:**

```
ANNULEREN
- Probeer eerst stilzwijgend te matchen op {{contact.phone}} via find_reservation. Lukt dat met precies 1 match → bevestig hardop welke reservering je gevonden hebt (datum + tijd + aantal personen).
- Lukt dat niet (geen match, anoniem nummer, of meerdere matches): vraag de gast om naam (voor- + achternaam) en de datum (en zo nodig de tijd) van de reservering. Roep find_reservation opnieuw aan met first_name/last_name + date (+ optioneel time).
- Bij meerdere matches → noem ze kort op ("Ik vind er twee: 19:00 voor 2 personen en 20:30 voor 4 personen — welke bedoelt u?") en laat de gast kiezen.
- Vraag NOOIT om een bevestigingsnummer of reservation_id — die kent de gast niet en is niet nodig.
- Zodra je 1 reservation_id uit find_reservation hebt → roep cancel_reservation aan met dat id en reason="Geannuleerd via telefoon".
- Bevestig de annulering hardop met datum + tijd. Lees geen id of code voor.
```

**C. WIJZIGEN-sectie (regels 192–198) analoog aanpassen:**
- Zelfde matching-aanpak (telefoon → anders naam + datum/tijd).
- Geen bevestigingsnummer-vraag.
- Daarna `check_availability` + `update_reservation` met intern opgehaalde `reservation_id`.
- Bevestig wijziging hardop met de nieuwe datum/tijd; lees geen id voor.

**D. `cancel_reservation` tool-rij (regels 720–730):**
- In description en parameter-rij `reservation_id`: *"Wordt altijd intern verkregen via find_reservation — vraag dit nooit aan de beller."*

**E. `update_reservation` tool-rij (regel 747)** — zelfde aanvulling.

**F. `create_reservation` / `book_reservation` tool-docs (rond regels 700–705):**
- Verwijder de instructie "Lees de laatste 6 tekens van reservation_id hardop voor".
- Vervang door: "Bevestig hardop datum, tijd en aantal personen. Het id/bevestigingscode niet voorlezen — wordt automatisch per SMS/WhatsApp gestuurd."

**G. `find_reservation` in tool-lijst (rond regel 813):**
- Beschrijving updaten: "opzoeken op telefoon, of op naam + datum (+ optioneel tijd). Geen UUID nodig."

**H. `buildBundle()` JSON-export (rond regels 991–992):**
- `find_reservation` parameters uitbreiden met `first_name`, `last_name`, `time` (optional).
- Bij `cancel_reservation` / `update_reservation` een `_note`: `"reservation_id wordt door agent intern opgehaald via find_reservation"`.
- Bij `create_reservation` een `_note`: `"reservation_id/bevestigingscode niet hardop voorlezen — gast krijgt deze per SMS/WhatsApp"`.

### 5. Geen aanpassing nodig

- `manage_reservation` edge function en `reservations.cancel(id, reason)` service — werken al puur op `reservation_id`.
- Widget / publieke UI — gebruikt eigen `manage_token`-flow.
- SMS/WhatsApp-flow zelf — verzendt de bevestiging al via ClickWise-events na `create_reservation`.

## Verificatie

- `POST /agent_api/find_reservation` met `{ "last_name": "Jansen", "date": "2026-05-20" }` (zonder phone) → 200 met matches.
- Body zonder phone én zonder last_name → 400 `missing_field`.
- `/app/help/voice-agent`: ANNULEREN/WIJZIGEN tonen geen vraag naar UUID of bevestigingsnummer; stap 4 noemt geen voorlezen van id.
- `create_reservation`-tooldoc en `buildBundle()` bevatten de "niet voorlezen, komt via SMS/WhatsApp"-instructie.
- `find_reservation`-tool noemt naam + datum + tijd als matchopties.
