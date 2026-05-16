## Doel

`preferred_time` wordt verplicht bij `check_availability`. De agent vraagt altijd actief om de gewenste tijd, en het backend-antwoord bevat ofwel een exacte beschikbare match, ofwel 2–3 alternatieven dicht bij de gewenste tijd. Help-files en system-prompt aanpassen zodat dit gedrag overal hetzelfde is.

## Wijzigingen

### 1. `supabase/functions/agent_api/index.ts` — `check_availability` server-side
- `preferred_time` (`HH:mm`) wordt **required**. Ontbreekt het → `400 missing_field` met `field: "preferred_time"`.
- Validatie: regex `^\d{2}:\d{2}$`, anders `invalid_field`.
- Roep `availability` aan zoals nu (full day slots).
- Post-processing op de response (gespiegeld aan `dispatcher.ts` zodat gedrag identiek is):
  - `availableSlots = slots.filter(s => s.available)`
  - `exact = availableSlots.find(s => s.time.startsWith(preferred_time))`
  - `nearby = availableSlots` gesorteerd op absolute afstand (in minuten) tot `preferred_time`, top 3.
  - Output JSON:
    ```json
    {
      "preferred_time": "19:30",
      "available": true|false,
      "exact": { "time": "19:30", "available_table_count": 2 } | null,
      "alternatives": [ { "time": "19:00", ... }, { "time": "20:00", ... }, { "time": "20:30", ... } ],
      "closed": false,
      "large_group": false,
      "slots": [ ...full day, ongewijzigd ]
    }
    ```
  - Bij `closed` of `large_group`: zelfde gedrag als nu, plus lege `exact`/`alternatives`.

### 2. `src/services/aiHost/dispatcher.ts`
- Schema: `preferred_time: timeSchema` (zonder `.optional()`).
- Bij ontbrekende `preferred_time` → `validation_error` "Gewenste tijd ontbreekt".
- Response uitbreiden met `exact` + `alternatives[0..2]` analoog aan agent_api, zodat in-app simulator en agent_api dezelfde shape teruggeven.

### 3. `src/services/aiHost/contracts.ts`
- `preferred_time` parameter `required: false` → **`true`** in de catalog-definitie van `check_availability`.

### 4. `src/pages/app/help/VoiceAgentHelp.tsx`

**A. `ToolParamTable` voor `check_availability`:**
- `preferred_time`: Required **ja** (was nee).
- Description: "VERPLICHT. Gewenste tijd in HH:mm (24-uurs). Vraag altijd actief: *'Hoe laat zou u willen komen?'* Boek niet zonder bevestigde gewenste tijd."

**B. Body-voorbeeld voor `check_availability`:**
- Verwijder *"Alleen meesturen als beller specifiek tijdstip noemt"*-tekst.
- Body wordt: `{ "date": "...", "party_size": ..., "preferred_time": "{{preferred_time}}" }`.

**C. Response-mapping uitleg:**
- Toelichten dat de response nu `exact` (één slot of `null`) + `alternatives` (max 3 slots) bevat.
- Voorbeeld: `result.exact.time` → bevestig die tijd direct. `result.alternatives[0..2].time` → bied 2–3 alternatieven aan als `exact` `null` is.

**D. `SYSTEM_PROMPT` — VERPLICHTE TOOL-VOLGORDE:**
- Stap 1 vervangen:
  - Oud: "Zodra je datum en aantal personen hebt → roep check_availability aan."
  - Nieuw: "Vraag altijd: datum, aantal personen ÉN gewenste tijd (HH:mm). Zodra alle drie binnen zijn → roep `check_availability` aan met `date`, `party_size` en `preferred_time`."
- Stap 2 vervangen:
  - Oud: "Bied de beller maximaal 3 tijden aan uit de response."
  - Nieuw: "Als `result.exact` gevuld is → bevestig hardop: *'[gewenste tijd] is beschikbaar, zal ik die reserveren?'* Als `result.exact` `null` is → noem maximaal 2 (bij voorkeur 3) alternatieven uit `result.alternatives` rond de gewenste tijd, in volgorde van nabijheid. Bijvoorbeeld: *'19:30 lukt helaas niet, maar 19:00, 20:00 of 20:30 zijn wel beschikbaar — welke past?'*"

**E. `SYSTEM_PROMPT` — GESPREKSREGELS:**
- Toevoegen na de tijd-regel: "Vraag de gewenste tijd altijd uit, ook bij open vragen zoals *'hebben jullie vanavond plek voor 4?'* — antwoord dan: *'Rond welk tijdstip zou u willen komen?'* en gebruik dat als `preferred_time`."

**F. `SYSTEM_PROMPT` — WIJZIGEN:**
- In de stap "Roep eerst `check_availability` aan voor de nieuwe datum/tijd/aantal" expliciet maken dat de nieuwe tijd óók als `preferred_time` meegaat, en dat bij mismatch alternatieven worden voorgesteld.

**G. `buildBundle()` JSON:**
- `tool_params.check_availability`: `"preferred_time (String, optional)"` → `"preferred_time (String, required)"`.

### 5. Geen aanpassing nodig

- `src/components/ai-host/ClickWiseToolSetupPanel.tsx` — leest uit `AI_ACTION_CATALOG`, krijgt automatisch de nieuwe required-flag mee.
- `availability` edge function — blijft onveranderd, agent_api/dispatcher doen de filtering.
- `voiceFlow.ts` simulator — gebruikt `/public_api/availability` direct met `localTime` en is niet betrokken bij `preferred_time` semantiek.

## Verificatie

- `check_availability` zonder `preferred_time` → 400 met `field: "preferred_time"`.
- `check_availability` met `preferred_time: "19:30"` waar exact beschikbaar → `exact.time = "19:30:00"`, `alternatives` gevuld.
- `check_availability` met `preferred_time: "19:30"` waar niet beschikbaar maar 19:00/20:00/20:30 wel → `exact: null`, `alternatives` toont die 3 op nabijheid.
- Help-pagina `/app/help/voice-agent#tools`: `preferred_time`-rij in `check_availability`-tabel toont Required = ja.
- `buildBundle()` JSON-export bevat `"preferred_time (String, required)"`.
