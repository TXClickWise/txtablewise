## Wat ik zie in de logs (restaurant Eigeweis)

Instellingen: `max_party_size_online=10`, `large_group_manual_approval_from=11`, `large_group_max_online_request=18`, `extra_large_group_threshold=19`.

**17 personen** — alleen `check_availability` aangeroepen (200 OK), géén `create_reservation`. TableWise heeft de boeking dus nooit afgewezen: de engine had die met `requires_manual_approval=true` + `large_group_status='awaiting_approval'` keurig opgeslagen (17 ≤ 18 = `large_group_max_online_request`). De agent zelf besloot niet door te boeken en koos voor SMS/terugbel.

**10 personen** — `check_availability` OK, daarna `create_reservation` faalde met HTTP 500:
```
new row for relation "reservations" violates check constraint "reservations_large_group_status_check"
```

## Twee oorzaken, twee fixes

### 1. Engine-bug bij grote groepen 8–10p (10-personen testcall)
`supabase/functions/book_reservation/index.ts` regel 234 schrijft `large_group_status = "auto_booked"`. De DB-constraint laat alleen `request_received | awaiting_approval | awaiting_deposit | approved | declined | NULL` toe. Elke auto-booked grote groep tussen `large_group_threshold` (8) en `large_group_manual_approval_from`-1 (10) crasht hierop met een 500. De agent meldt dan "technisch probleem".

**Fix:** één regel wijzigen — `largeGroupStatus = "approved"` in plaats van `"auto_booked"`. `approved` past in de constraint én wordt al door `services/reporting.ts` en de UI geteld als "auto-goedgekeurde grote groep". Geen migratie nodig (er kunnen onmogelijk bestaande `auto_booked` rijen zijn).

### 2. Live agent-prompt in ClickWise is verouderd (17-personen testcall)
De engine zou 17p prima boeken (17 ≤ 18). De fout zit in de **prompt die live draait in ClickWise/HighLevel voor Eigeweis**: die routeert nog steeds alles boven `max_party_size_online` (10) naar SMS/terugbel, in plaats van de nieuwe 2-drempel logica te volgen waarin de agent altijd eerst `book_reservation` aanroept en alleen bij `TW_409_PARTY_TOO_LARGE` (party > 18) doorverbindt.

De huidige aanbevolen prompt in TableWise (`VoiceAgentHelp.tsx` sectie "8. System Prompt" en `AdminClickWiseVoiceSetupPage.tsx`) is al correct — die moet alleen opnieuw in het ClickWise master sub-account én in de live sub-account van Eigeweis worden geplakt.

**Fix:** geen code-wijziging in TableWise nodig voor punt 2. Wel een handmatige stap (door jou of via re-export van de snapshot):

```text
ClickWise → Eigeweis sub-account → Voice Agent → System Prompt
  → vervangen door de huidige System Prompt uit
    TableWise → Voice Agent (admin) → ClickWise Voice Setup
```

Daarna boekt de agent 17p direct via `book_reservation` (status `pending`, `large_group_status='awaiting_approval'`, `requires_manual_approval=true`), wat in TableWise verschijnt onder **"Grote groepen — te beoordelen"**.

## Wat ik in deze loop implementeer

1. `supabase/functions/book_reservation/index.ts` regel 234 — wijzig `"auto_booked"` → `"approved"`.
2. Deploy `book_reservation`.
3. Verificatie via `supabase--curl_edge_functions`: simuleer een 10p en een 17p boeking voor Eigeweis (ai_host channel) en bevestig dat beide reserveringen worden aangemaakt met de juiste `status` + `large_group_status` (10p: `confirmed`/`approved`; 17p: `pending`/`awaiting_approval`).
4. Korte tekstnotitie aan jou met de handmatige stap voor de live ClickWise-prompt.
