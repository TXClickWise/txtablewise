## Doel
Twee verduidelijkingen toevoegen aan `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` zodat het voor system admins glashelder is:
1. **Waar/hoe** de curl-test uitgevoerd hoort te worden (en dat dit *niet* in ClickWise gebeurt).
2. **Hoe** je in ClickWise de response van de TableWise API "vastlegt" door een eenmalige test met **echte waarden** uit te voeren, zodat custom fields automatisch gevuld kunnen worden.

## Wijzigingen in `AdminClickWiseVoiceSetupPage.tsx`

### A. Tab "Test" — herschrijf "Test 1" sectie
- Hernoem naar **"Test 1 — Valideer de API key buiten ClickWise"**.
- Korte uitleg: dit doe je vóórdat je in ClickWise gaat klikken, om te bewijzen dat de sleutel + endpoint werken.
- Drie copy-paste-opties bieden:
  1. **Terminal (curl)** — bestaande copy-block, met note "Mac/Linux Terminal of Windows PowerShell/WSL".
  2. **Browser (hoppscotch.io)** — copy-blokken voor URL, headers, body.
  3. **Postman / Insomnia** — copy-blokken voor URL, headers, body, plus stappen.
- Expliciet kader: "ClickWise/HighLevel heeft geen losse curl-knop. De Custom Action die je later bouwt dóét feitelijk hetzelfde als deze curl. Deze test is alleen voor jouw eigen zekerheid vooraf."

### B. Nieuwe StepCard #5b in tab "Stappenplan" + nieuwe sub-sectie in tab "Actions"
**Titel:** "Trainen: laat ClickWise de response leren herkennen"

Inhoud:
- Uitleg waarom dit moet: zonder echte response weet ClickWise niet welke velden er bestaan om naar custom fields te mappen.
- Per tool één copy-block met **realistische testwaarden** (vervangen van `{{...}}` placeholders), bv:
  - `check_availability`: `{"date":"2026-05-15","party_size":2}`
  - `book_reservation`: volledig object met test-naam "Test Tester", telefoon "+31600000000", etc.
  - `cancel_reservation`: `{"reservation_id":"<plak-id-uit-vorige-test>","reason":"test"}`
  - `log_call`: idem met test external_call_id.
- Stappen: 
  1. Open de Custom Action in ClickWise.
  2. Klik "Test" / "Run test".
  3. Plak het test-body, klik run.
  4. ClickWise toont de response — klik "Save response sample" / "Map fields".
  5. Map de gewenste responsevelden naar de custom fields uit tab "Values & Fields" (bv. `response.reservation_id` → custom field `reservation_id`).
- Waarschuwing: **na het trainen, zet de body terug** naar de versie met `{{...}}` variabelen, anders boekt elke beller "Test Tester".

### C. Kleine update tab "Stappenplan"
- Step 6 (Testen) krijgt verwijzing: "Heb je in stap 5b al de tools getraind? Dan zou de end-to-end belproef nu de custom fields automatisch moeten vullen."

## Resultaat
System admin weet:
- De curl-test hoort thuis op zijn eigen machine, niet in ClickWise.
- Voor elke tool moet er één keer een testaanroep met échte waarden gebeuren in ClickWise om response-mapping mogelijk te maken — en hij heeft de exacte test-payloads kant-en-klaar om te kopiëren.
- Hij moet daarna terug-switchen naar de variabele-versie van de body.
