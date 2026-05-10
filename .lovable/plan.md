## Probleem

`/app/integraties/pos` is afgeschermd met `RequireSystemAdmin`, dus jij als eigenaar krijgt "Geen toegang". Dit is ook de URL waar de Loyverse OAuth-callback naar terug-redirect — dus na inloggen bij Loyverse landt elke eigenaar nu op dit blokscherm.

De POS-tab werkt al wel via `/app/koppelingen?tab=pos` omdat die `POSIntegrationPage` als tab embed zonder system-admin guard.

## Oplossing

In `src/App.tsx` de guard van de eigenaar-facing POS/koppelingen-routes verlagen van `RequireSystemAdmin` naar `RequireRole allow={["owner","manager"]}`. De admin-varianten (`admin/...`) blijven system-admin-only.

### Wijzigingen in `src/App.tsx`

Regels 124–127 (legacy/owner routes) → `RequireRole`:
- `integraties/clickwise`
- `integraties/pos`
- `integraties/hub`
- `integraties/logs`

Regels 111–120 blijven ongewijzigd (`admin/*` paden = system admin).

### Loyverse OAuth callback

`FRONTEND_FALLBACK` in `supabase/functions/loyverse_oauth/index.ts` wijst al naar `/app/integraties/pos`. Na de guard-fix werkt de redirect na koppelen vanzelf voor eigenaars.

## Niet aanraken

- `RequireSystemAdmin` blijft staan voor de echte admin-pagina's (`admin/restaurants`, `admin/voice-agent`, `admin/plan-requests`, etc.).
- Sidebar/menu-structuur blijft hetzelfde.
- Geen wijzigingen aan `POSIntegrationPage` zelf nodig — die checkt al via `isManager` in de edge function.
