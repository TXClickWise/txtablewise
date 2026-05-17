# Probleem

Bij de testcall vroeg de agent de beller om het telefoonnummer cijfer-voor-cijfer te spellen — terwijl de caller-ID (`{{contact.phone}}`) gewoon beschikbaar was — en las het daarna onverstaanbaar terug ("aan elkaar geplakte" cijfers). De huidige prompt bevat al een DEFAULT-regel ("gebruik het nummer waarmee u nu belt, lees het nooit voor"), maar de agent past die niet betrouwbaar toe. Bovendien zegt de prompt voor het ALTERNATIEF-scenario alleen "cijfer voor cijfer", maar geeft de TTS-engine geen leestekens om écht pauze te maken — vandaar het onverstaanbare resultaat.

# Oplossing (alleen prompt- en help-tekst, geen edge-function code)

Twee bestanden updaten met scherpere telefoonnummer-regels:

- `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` — systeemprompt in `systemPrompt`
- `src/pages/app/help/VoiceAgentHelp.tsx` — `SYSTEM_PROMPT` + UITSPRAAKREGELS-sectie

## Wijzigingen aan de telefoonnummer-regels

### 1. Hard gate vóór elke vraag
Eerste regel in de TELEFOON-sectie:

> **STAP 0 — CHECK EERST `{{contact.phone}}`.** Als die waarde bestaat en niet leeg/anoniem/"unknown" is: gebruik scenario DEFAULT. Vraag dan NOOIT om spelling, herhaling, of bevestiging van cijfers. Eén zin: "Ik gebruik het nummer waarmee u nu belt — is dat goed?" en klaar. Alleen bij expliciet "noteer een ander nummer" of bij ontbrekend/anoniem caller-ID ga je naar scenario ALTERNATIEF.

### 2. Verbod versterken
Toevoegen aan VERBODEN-lijst:
- Het beller-ID-nummer cijfer-voor-cijfer laten spellen.
- Een telefoonnummer in één adem oplezen ("zesnulachtnegen...").
- Een nummer in paren/tientallen groeperen ("zes-nul, achtendertig, ...").

### 3. ALTERNATIEF-scenario: TTS-vriendelijke uitspraak
De huidige instructie "cijfer voor cijfer met korte pauze" is te abstract voor de TTS. Vervangen door een concreet formaat dat de stemengine dwingt te pauzeren:

> Lees terug met komma's tussen elk cijfer en het woord "spatie" / extra punt na elke 3 cijfers. Format: `"plus drie één , spatie , zes , vijf , drie , spatie , vijf , twee , één , spatie , één , zes , zes . Klopt dat?"`. Gebruik nooit "zesenvijftig", "drieënvijftig" enz. Elk cijfer is een los woord: nul, één, twee, drie, vier, vijf, zes, zeven, acht, negen.

Plus expliciet voorbeeld in alle drie de talen (NL/DE/EN) met dezelfde komma-structuur.

### 4. Bevestigingsritme
> Lees het hele nummer maar ÉÉN keer terug. Bij "ja/klopt" → direct boeken. Bij correctie van één cijfer → herhaal alleen dat blok van 3, niet het hele nummer opnieuw.

## Wat we NIET doen

- Geen edge-function wijzigingen — `agent_api` accepteert het caller-ID nummer al; het probleem zit volledig in agent-gedrag.
- Geen ClickWise/Vapi voice-settings aanpassen (geen toegang vanuit code).
- Geen "spell phonetic alphabet" voor cijfers — dat maakt het juist trager en is overkill voor cijfers.

# Manual follow-up voor de gebruiker

Na implementatie moet je de bijgewerkte system prompt opnieuw kopiëren vanuit `AdminClickWiseVoiceSetupPage` naar de ClickWise/Vapi agent-config, anders verandert er niets aan het belgedrag.
