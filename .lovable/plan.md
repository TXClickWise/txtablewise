## Wat ik vond

1. **De goedkeuring zelf werkt nu** — ik heb de reservering van Ferry Twaalfmaat (12p, 17-05 15:00) net via een directe test goedgekeurd. Status is nu `confirmed`, `large_group_status = approved`, tafelcombinatie toegewezen. Hetzelfde geldt voor een tweede pending groep (15p Jacco Rood, agent-flow).

2. **Echte fout in dispatch_webhooks**: in `supabase/functions/dispatch_webhooks/index.ts` worden integration-events bijgewerkt met `status: "delivered"`, maar de enum `integration_event_status` kent alleen `pending | sent | failed | processing | skipped`. Postgres-logs staan vol met `invalid input value for enum integration_event_status: "delivered"` (tientallen per minuut). Gevolg: ClickWise-events blijven oneindig in `pending` hangen en webhooks worden steeds opnieuw geprobeerd. Dit is waarschijnlijk waarom je grote-groep-events (reservation.large_group_approved, reservation_request) niet bij ClickWise aankomen.

3. **manage_reservation `approve_large_group`** zelf is OK — geen wijziging nodig in de logica. Wel slik ik nu fouten in audit/event-inserts stil in (try/catch met alleen console.error), waardoor we als gebruiker geen idee hebben waarom iets misging. Daarom voeg ik betere foutdiagnose toe (zonder gedrag te veranderen voor de gelukkige flow).

4. **Pending state in UI**: de toast "Edge Function returned a non-2xx status code" komt rechtstreeks uit `supabase-js`. Met de extra logging kunnen we voortaan zien welke specifieke 4xx/5xx terugkwam, mocht het opnieuw gebeuren.

## Wijzigingen

### 1. `supabase/functions/dispatch_webhooks/index.ts`
Vervang beide `status: "delivered"` door `status: "sent"`:
- regel ~228 (geen matching endpoint → markeer als sent/skipped)
- regel ~303 (succesvolle delivery → markeer als sent)

Liever nog: gebruik `"skipped"` als er geen endpoint matched, en `"sent"` bij echte HTTP 2xx. Dat is consistent met de bestaande enum.

### 2. `supabase/functions/manage_reservation/index.ts` — defensievere goedkeuring
In `doLargeGroupDecision`:
- voeg expliciet `updated_at: new Date().toISOString()` toe (niet strikt nodig door trigger, maar maakt logging eenduidiger).
- log de failing case met meer context (`console.error("approve_large_group failed", { reservation_id, error })`) zodat we in edge-logs zien wat de DB teruggaf.
- behoud de `try/catch` om audit/event los te koppelen van de respons; functioneel niets veranderd.

### 3. Eenmalige opruiming (geen migratie nodig)
De huidige bug heeft een groeiende lijst integration_events vastgezet op `status='pending'` met steeds hogere `attempts`. Na de fix gaan deze automatisch opnieuw lopen via `dispatch_webhooks`. Geen aparte cleanup nodig — eventueel later een `failed`-stop bij `attempts > 10`.

### 4. Verificatie
- Roep `dispatch_webhooks` één keer aan en check dat eerder mislukte events nu naar `sent` of `skipped` gaan.
- Check `integration_events` voor `restaurant_id = b56f3a25-…` (Eigeweis): geen rijen meer met `attempts > 0` en `status = pending` na een paar minuten.
- Test in de UI opnieuw een 12p widget-reservering goedkeuren — toast moet "Groepsreservering goedgekeurd" tonen en de ClickWise-workflow moet daadwerkelijk aankomen.

## Wat ik **niet** wijzig

- Geen schemaveranderingen aan `integration_event_status` (de enum is correct, de code was fout).
- Geen wijziging aan de UI-flow van `LargeGroupRequestDialog` / `ReservationDetailDialog`.
- Geen aanpassing aan de constraint op `reservations.large_group_status` — die staat al correct.
