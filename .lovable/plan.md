## Doel

Voeg duidelijke uitspraakregels toe aan alle Voice Agent prompts, met expliciete voorbeelden voor telefoonnummers, tijden, datums, aantallen en codes. Verbied het hardop oplezen van het beller-ID-nummer, maar sta nummer-voor-nummer terugleen wél toe wanneer de gast bewust een ander nummer doorgeeft. Alleen prompt/help-bestanden wijzigen, geen backend.

## Aanpassingen

### 1. `src/pages/app/help/VoiceAgentHelp.tsx` (volledige System Prompt)

Nieuwe sectie **"Uitspraakregels"** met expliciete voorbeelden:

**Telefoonnummer — twee scenario's:**

- **Default = beller-ID gebruiken (caller ID van het inkomende gesprek):**
  - NOOIT hardop oplezen.
  - NOOIT aan de gast vragen om het te herhalen of te bevestigen.
  - Bij bevestiging zeg je: *"Ik gebruik het nummer waarmee je nu belt, is dat goed?"* — zonder cijfers te noemen.
  - Intern wordt het in E.164 opgeslagen (bv. `+31653521166`).

- **Alternatief nummer (gast zegt expliciet: "neem een ander nummer" / "bel mijn vrouw op…"):**
  - Vraag de gast het nummer **nummer-voor-nummer te spellen**: *"Kun je het nummer cijfer voor cijfer doorgeven?"*
  - Lees het daarna ter bevestiging **nummer-voor-nummer terug** in spreektaal, voorbeeld:
    - `+31653521166` → *"plus eenendertig, nul zes, vijf drie, vijf twee, één één, zes zes — klopt dat?"*
  - Bij correctie: opnieuw nummer-voor-nummer terug.
  - Nooit als "zes-honderd-drieënvijftig-…" of "+31 6 53 52 11 66" als losse groepen — altijd cijfer voor cijfer.

**Tijden — uitspreken in spreektaal, niet als cijfers:**
- `18:15` → "kwart over zes"
- `18:30` → "half zeven"
- `18:45` → "kwart voor zeven"
- `19:00` → "zeven uur 's avonds"
- `20:10` → "tien over acht"
- Intern in tool-call altijd `HH:MM` (24u).

**Datums — uitspreken als dag + maand in woorden:**
- `2026-05-25` → "vijfentwintig mei"
- `2026-06-01` → "één juni"
- "morgen" / "vandaag" / "overmorgen" → letterlijk zo uitspreken.
- Intern in tool-call altijd `YYYY-MM-DD`.

**Aantal personen — voluit in woorden:**
- `2` → "twee personen", `10` → "tien personen", `17` → "zeventien personen".

**Reserveringscode — letter voor letter, cijfer voor cijfer, NAVO-alfabet bij verwarring:**
- `R7K2` → "R van Romeo, zeven, K van Kilo, twee".

**Algemene verboden:** geen "achttien uur vijftien", geen letterlijke YYYY-MM-DD, geen technische codes hardop, geen +31-prefix oplezen als beller-ID wordt gebruikt.

Bevestigingszin (default beller-ID-scenario) wordt:
> "Ik noteer: vijfentwintig mei, kwart over zes, voor vier personen, op naam van [voornaam]. Ik gebruik het nummer waarmee je nu belt — klopt dat?"

### 2. `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` (korte admin-prompt + setup-bundles)

- Compacte uitspraakregels toevoegen: *"Uitspraak: tijden in spreektaal · datum in woorden · personen in woorden · beller-ID-nummer NOOIT oplezen of laten herhalen · alleen alternatief nummer cijfer-voor-cijfer spellen én terugleen."*
- Alle bestaande bevestigingszinnen die "telefoon [nummer]" bevatten vervangen door de twee-scenario-variant.

### 3. `src/services/voiceFlow.ts` — `VOICE_FLOW_PROMPT_TEMPLATE`

- Stap 1 (VERZAMEL): default = beller-ID, alleen vragen om ander nummer als gast dat zelf aangeeft.
- Stap 2 (BEVESTIG): default-zin zonder nummer; alternatief-pad met cijfer-voor-cijfer terugleen.
- Stap 5 (BEVESTIG aan beller): uitspraakregels toepassen, code spellen.
- Nieuwe sectie **UITSPRAAK** met dezelfde voorbeelden (telefoon/tijd/datum/personen/code) en de twee telefoon-scenario's.

### 4. Verificatie

- `rg "telefoon|nummer" src/pages/app/help/VoiceAgentHelp.tsx src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx src/services/voiceFlow.ts` — geen plek meer waar het beller-ID-nummer wordt voorgelezen of door gast bevestigd moet worden.
- `rg "HH:MM|YYYY-MM-DD"` — alleen binnen tool-call voorbeelden toegestaan, niet in spreekzinnen.
- Visueel op `/app/help/voice-agent#voice-agent` controleren dat nieuwe sectie "Uitspraakregels" zichtbaar is met beide telefoonscenario's.

### 5. Handmatige stap voor gebruiker

Nadat dit live is: prompt opnieuw kopiëren naar ClickWise Eigeweis sub-account én master snapshot, anders blijft de live agent het beller-ID-nummer oplezen.

## Buiten scope

- Backend / edge functions blijven ongewijzigd.
- E.164-validatie en opslag van telefoonnummers blijft zoals nu.
