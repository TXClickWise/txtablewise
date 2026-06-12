## Probleem

Een gast die via de bevestigingsmail z'n reservering wil verplaatsen, krijgt altijd "Wijziging niet mogelijk — geen tafel beschikbaar", zelfs als het hele restaurant leeg is. Oorzaak: de edge function `guest_reservation` zoekt alleen in `table_combinations` (meertafel-combinaties). Voor kleine groepen (1–4) bestaan die combinaties meestal niet, want een losse 2-persoonstafel is geen "combinatie". `book_reservation` doet dit wél goed: eerst losse passende tafel, daarna pas combinaties.

## Fix

Eén nieuwe gedeelde helper `findAvailableSeating` in `supabase/functions/_shared/reservation-utils.ts` die:

1. Eerst een vrije losse tafel zoekt waar `capacity_min ≤ party ≤ capacity_max`, `is_active = true`, niet in `excludedTableIds`, en geen overlappende actieve reservering heeft.
2. Pas als geen losse tafel past, terugvalt op de bestaande combinatie-lookup (huidige `findAvailableCombination` logica).
3. Een uniform resultaat retourneert: `{ tableIds: string[], combinationId: string | null, name: string | null }`.

De huidige `findAvailableCombination` blijft bestaan voor backward compat, maar de drie call-sites die hem voor gast-flows gebruiken schakelen om naar `findAvailableSeating`:

- `supabase/functions/guest_reservation/index.ts` — `evaluate()` regel 502 en de tweede call rond regel 264.
- `supabase/functions/review_guest_change/index.ts` — call rond regel 84.
- `supabase/functions/public_api/index.ts` — calls rond regels 776 / 792 / 806 (de manage-reservation paden).

`book_reservation` raken we niet aan — dat heeft al z'n eigen losse-tafel + zone-fill logica.

## Verificatie

1. Bestaande reservering #RSYBNY5B in Eigeweis (zaterdag 13:00, 2 gasten) handmatig terugzetten via UI of laten staan zoals nu.
2. Via de gastlink "Wijziging aanvragen" naar 14:00 verzoeken → moet `applied` retourneren en de reservering verplaatsen.
3. Smoke-check: een wijziging die echt vol zit (bijv. zelfde tijd terwijl alle tafels bezet zijn — kan ik niet makkelijk reproduceren met lege agenda) moet nog steeds `no_table_available` geven.

## Niet in scope

- Zone-fill strategie voor gastwijzigingen — gastflow blijft "eerste passende tafel". Operator-flow (`book_reservation`) houdt z'n rijkere logica.
- UI-tekst van de afwijzingskaart blijft ongewijzigd.
