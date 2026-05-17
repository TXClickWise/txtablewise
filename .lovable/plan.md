## Wat er gebeurde

In `integration_logs` zie ik 2 mislukte voice-agent reserveringen (12p om 18:00, 8p om 14:00). Beiden gaven dezelfde 401 terug, met `message_for_guest = "Sorry, er ging iets mis aan onze kant…"`.

```
18:25:04  create_reservation  http_status=401  party_size=12
18:27:48  create_reservation  http_status=401  party_size=8
18:27:50  create_reservation  http_status=401  (retry)
```

In de Supabase edge-gateway-logs zie ik dat die 401's bij `book_reservation` op **gateway-niveau** vallen — de function boot zelfs niet. De `check_availability`-stap ervoor werkte wel (200) en gebruikt exact dezelfde interne aanroep. Dus de auth-flow naar `book_reservation` is stuk, niet de logica zelf.

## Root cause

`agent_api/index.ts → callInternalFn()` stuurt `SUPABASE_SERVICE_ROLE_KEY` mee als zowel `Authorization: Bearer …` als `apikey: …`. Sinds de overstap naar het nieuwe signing-keys-systeem accepteert de edge-gateway de legacy service-role JWT niet meer betrouwbaar in de `apikey`-header. Voor `availability` werkt het toevallig nog, voor `book_reservation` niet — wat per definitie fragiel is.

## Fix

1. **`supabase/functions/agent_api/index.ts` → `callInternalFn`**  
   `apikey`-header zetten op `SUPABASE_ANON_KEY` (publieke key die door de gateway altijd wordt geaccepteerd) en `Authorization: Bearer ${SERVICE_ROLE}` behouden voor function-side logica. Dit is het door Supabase aanbevolen patroon voor interne function-to-function calls met `verify_jwt = false`.

2. **`supabase/config.toml`**  
   Bevestig dat alle interne targets (`book_reservation`, `availability`, `manage_reservation`) `verify_jwt = false` hebben — `manage_reservation` ontbreekt nu in de config en valt daardoor op de Supabase default terug; expliciet toevoegen.

3. **Verificatie**  
   - `curl_edge_functions` op `/agent_api/reservation_request` met test-payload (party_size 8) → verwacht 200/202 of een nette `large_group_required_manual`.  
   - Daarna nieuwe rij in `integration_logs` controleren: `http_status` ≠ 401.

## Wat NIET verandert

- Logica van `book_reservation`, large-group flow, ClickWise-prompt, `message_for_guest`-templates — allemaal ongewijzigd.  
- Geen DB-migratie nodig.  
- Voice-agent prompt in ClickWise hoeft niet opnieuw geplakt te worden.
