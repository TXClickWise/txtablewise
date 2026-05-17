## Probleem

Bij 20 personen probeerde de voice agent direct `reservation_request` (of `book_reservation`) aan te roepen zonder eerst de naam te vragen → server gaf `placeholder_name_blocked` (400) → agent zei "dat lukt niet, ik verbind je door".

De prompt zegt nu wel "VRAAG ALTIJD EXPLICIET DE VOORNAAM", maar bij grote groepen schakelt het model mentaal naar "doorverbind/large-group flow" en slaat de naamvraag over. We moeten de regel **expliciet ook voor grote groepen** maken en de "geen naam = geen call" regel tot harde stop-conditie verheffen.

## Wat ik aanpas

Eén bestand: `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx`, alleen de `systemPrompt` string.

### Wijziging 1 — Nieuwe harde stop-regel bovenaan "Hoe je een reservering maakt"
Nieuwe **regel 0** vóór de huidige stap 1:

> **0. STOP-conditie — geldt voor ELKE groepsgrootte (1 t/m 18+):** je mag `reservation_request` (of welke booking-tool dan ook) NOOIT aanroepen zonder een echte voornaam van de gast. "Gast", "Klant", "Onbekend", lege string of een ID-achtige waarde is verboden — de engine blokkeert dat met `placeholder_name_blocked` en de gast hoort dan een foutmelding. Als je geen naam hebt: vraag de naam, ook bij 12, 15, 20 personen. Doorverbinden mag pas NA een geldige `reservation_request`-call (de engine bepaalt of doorverbinden nodig is).

### Wijziging 2 — Extra zin in "Grote groepen" sectie
Toevoegen na ABSOLUTE REGEL 3:

> ABSOLUTE REGEL 4: ook bij grote groepen vraag je EERST de voornaam van de gast vóór je `reservation_request` aanroept. Geen voornaam → geen tool-call → geen doorverbinden. De volgorde is altijd: aantal + datum + tijd → **voornaam** → mondelinge bevestiging → `reservation_request` → engine bepaalt of doorverbinden mag.

### Wijziging 3 — Foutafhandeling uitbreiden
Toevoegen onder "# Foutafhandeling":

> - Krijg je `error_code: "placeholder_name_blocked"` terug: dat is jouw fout, niet die van de gast. Zeg: "Sorry, mag ik nog even uw voornaam noteren voor de reservering?" en roep `reservation_request` opnieuw aan met de echte naam. NOOIT doorverbinden om deze fout heen.

## Wat NIET verandert

- Geen backend-wijzigingen — `book_reservation`/`reservation_request` blijven zoals ze zijn (de 400 `placeholder_name_blocked` is correct gedrag).
- Geen wijzigingen aan tool-JSON's, custom values, of provisioning-flow.
- De ondernemer hoeft alleen de nieuwe prompt opnieuw in ClickWise → Voice Agent te plakken (kopieerknop staat al op de pagina).

## Verificatie

Na implementatie:
1. Pagina openen op `/app/admin/clickwise-voice-setup`, prompt kopiëren, in ClickWise plakken.
2. Testgesprek 12p en 20p — verwacht: agent vraagt voornaam, doet `reservation_request`, engine geeft `requires_manual_approval: true` (12p) of `next_action: "transfer_call"` (20p afhankelijk van limiet).
3. `integration_logs` checken op afwezigheid van `placeholder_name_blocked`.
