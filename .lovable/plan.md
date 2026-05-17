## Wat er aan de hand is

Dit is een ClickWise/HighLevel-eigenaardigheid, niet iets in TableWise:

- **Find Contact → Match Field** ondersteunt alleen een beperkte set veldtypes (Email, Phone, Single line text, Number). **Date Picker-velden worden niet getoond** als match-optie. Daarom mis je *TW Reservation Date* in de Find Contact-zoeklijst.
- **Create / Update Contact** accepteert wél elk custom-field-type (inclusief Date Picker), want dat is een schrijfactie. Vandaar dat je het veld daar wél ziet.
- Hetzelfde probleem ga je krijgen in **If/Else-condities**: Date Picker-velden zijn vaak niet selecteerbaar of accepteren geen `{{inboundWebhookRequest.payload.reservation.date}}`-string omdat HighLevel intern op een Date-object verwacht.

## Aanbevolen oplossing — verander het veldtype

Verander in ClickWise (Settings → Custom Fields → Contact) **TW Reservation Date** van **Date Picker** naar **Single line**:

1. Open het veld → klik op het veldtype → kies **Single line**.
2. Bewaar. Bestaande waarden blijven staan (worden tekst, bv. `"2026-05-17"`).
3. Doe daarna een nieuwe **"Check for new requests"** in je Inbound Webhook trigger zodat ClickWise de mapping ververst (anders blijft het veld in de cache als Date).
4. In de **Find Contact** action verschijnt *TW Reservation Date* nu wel in de match-lijst, en in **If/Else** kun je er gewoon op vergelijken met `Is Equal To` / `Contains`.

TableWise stuurt de datum al in ISO-formaat (`YYYY-MM-DD`) als string, dus Single line is functioneel identiek aan Date Picker — alleen flexibeler binnen ClickWise.

## Tweede tip — je hoeft *TW Reservation Date* niet als match te gebruiken

In je workflow match je Find Contact al op **Phone**, en dat is precies goed: één contact per gast, ongeacht hoeveel reserveringen die heeft. *TW Reservation Date* hoort alleen op het contact opgeslagen te worden (zodat de SMS-template `{{contact.tw_reservation_date}}` kan gebruiken), niet om contacten op te zoeken.

Als je dus alleen het veld in de **SMS-tekst** wilt gebruiken: doe niets — Single line is enkel nodig zodra je er in een If/Else of Find Contact-filter op wil vergelijken.

## Geen code-wijziging in TableWise nodig

Dit los je volledig in ClickWise op. Wil je dat ik de help-pagina (`/app/voice-agent` → Stap 7: ClickWise-workflow) aanvul met deze waarschuwing — "kies Single line, geen Date Picker, voor TW Reservation Date" — zodat toekomstige klanten dit niet opnieuw tegenkomen?
