## Diagnose

De edge function `loyverse_connect` gebruikt status-waardes die niet in de DB-enum staan.

| Wat de code schrijft | Wat de enum toestaat |
|----------------------|----------------------|
| `"active"` | `pending`, `connected`, `error`, `disconnected` |
| `"revoked"` | idem |

Gevolg: elke `INSERT`/`UPDATE` op `pos_connections` met `status: "active"` faalt met een Postgres enum-error, de function valt in de outer catch en geeft HTTP 500 terug → toast "Edge Function returned a non-2xx status code". `pos_connections` is daarom nu leeg en er staat geen `pos.loyverse.connected` event in `integration_events`.

Daarnaast leest het frontend overal `status === "active"` — zelfs als de insert wel zou werken, zou de UI "Niet gekoppeld" blijven tonen.

## Oplossing — alignen op de bestaande DB-enum

We laten de DB-enum ongemoeid en passen code aan op `connected` / `disconnected`. Geen migratie nodig.

### 1. `supabase/functions/loyverse_connect/index.ts`

- In de `connect` payload: `status: "connected"` (i.p.v. `"active"`).
- In `disconnect`: `status: "disconnected"` (i.p.v. `"revoked"`).
- In `sync_now` / `sync_items` de filter `.eq("status","active")` → `.eq("status","connected")`.

### 2. `src/services/pos.ts` + `src/pages/app/POSIntegrationPage.tsx`

Vervang alle `loyverse?.status === "active"` checks door `loyverse?.status === "connected"`. Dit betreft:
- KPI-kaartje "Verbonden POS"
- "Gekoppeld" badge
- Toon/verberg van "Ontkoppel"-knop en sync-button
- "Live" vs "Demo-ready" badge

### 3. Verifiëren

Na deploy:
1. Koppelknop met geldig Loyverse access token → 200, toast met "X producten en Y bonnen geïmporteerd".
2. `SELECT status, display_name FROM pos_connections WHERE provider='loyverse'` → `status='connected'`, naam gevuld.
3. UI toont "Gekoppeld" + bedrijfsnaam, knoppen "Sync nu" en "Ontkoppel" verschijnen.
4. `integration_events` bevat `pos.loyverse.connected` event.

## Niet in scope

- DB-enum uitbreiden met `active` — onnodig en zou andere code kunnen verwarren.
- Het eerder besproken `show_in_widget`-werk voor de gast-selectie. Dat doen we als losse vervolgstap zodra koppelen weer werkt.
