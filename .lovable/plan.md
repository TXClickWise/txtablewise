Ik heb opnieuw gecontroleerd in database, reserverings-events en codepaden. Conclusie: dit is inderdaad een systeem-/datamodelprobleem in hoe bestaande reserveringen worden getoond.

## Wat er gebeurt

- Er is één gastrecord met e-mail `demo@clickwise.app`.
- `book_reservation` zoekt bestaande gasten op via `(restaurant_id, email)`.
- Als dezelfde e-mail opnieuw wordt gebruikt, wordt dat gastrecord bijgewerkt naar de laatste naam/telefoon.
- Alle oude reserveringen blijven gekoppeld aan datzelfde gastrecord.
- De reserveringenpagina toont de huidige naam uit `guests`, niet de naam zoals die op dat moment bij de reservering is ingevoerd.

Daardoor lijken oudere testreserveringen nu ineens allemaal van “Demo4 Vier”, terwijl de aanmaak-events laten zien dat ze oorspronkelijk andere namen hadden, o.a. `Test`, `Pierre`, `Dennis`, `Demo`, `Demo2`, `Demo3`.

## Belangrijke bevinding

De reservering van 17 mei 17:00 is wel correct aangemaakt als nieuwe reservering via de widget:

- Datum/tijd lokaal: 17 mei 17:00
- Naam bij aanmaak: Demo4 Vier
- E-mail: demo@clickwise.app
- Bron: website_widget

Maar oude reserveringen worden onterecht onder de nieuwste gastnaam weergegeven. Dat verklaart waarom het “willekeurig veel Demo4 Vier” lijkt.

## Plan voor de fix

1. **Reserveringen krijgen een vaste gast-snapshot**
   - Voeg op `reservations` een veld toe voor de gastgegevens zoals ingevoerd bij het boeken.
   - Bijvoorbeeld: naam, e-mail, telefoon en taal op het moment van reserveren.
   - Dit voorkomt dat oude reserveringen van naam veranderen als hetzelfde e-mailadres later opnieuw boekt.

2. **Nieuwe reserveringen vullen die snapshot automatisch**
   - Update `book_reservation` zodat elke nieuwe reservering de ingevoerde gastgegevens vastlegt.
   - De centrale gastkaart mag nog steeds bijgewerkt worden voor CRM/herhaalbezoek, maar reserveringsregels blijven historisch correct.

3. **Bestaande reserveringen herstellen waar mogelijk**
   - Voor oude reserveringen gebruik ik de beschikbare `reservation.created` events om de oorspronkelijke naam/telefoon terug te vullen.
   - Waar geen event-payload beschikbaar is, blijft fallback naar het huidige gastrecord.

4. **Reserveringen UI toont snapshot eerst**
   - Update de reserveringenlijst, dag/week/floor/detail-weergaves zodat ze eerst de snapshot tonen.
   - Alleen als snapshot ontbreekt, gebruiken ze het gekoppelde gastrecord.

5. **Optioneel direct opschonen na de fix**
   - Daarna kunnen we de foutief ogende oude testreserveringen verwijderen of annuleren, maar pas nadat de weergave/data-oorzaak is opgelost.