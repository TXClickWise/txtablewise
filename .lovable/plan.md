
# Loyverse koppeling — overstappen op Personal Access Token

## Doel
De huidige OAuth-flow (eigen developer-app + redirects + 500/401 errors) vervangen door één eenvoudig pad: het restaurant plakt zijn Loyverse **Personal Access Token** uit het Loyverse-dashboard → opslaan → sync werkt direct. Geen client ID/secret, geen callback, geen refresh.

## Wat de gebruiker straks doet
1. In Loyverse → Instellingen → Access tokens → **+ Nieuwe token** → kopieer de waarde (zie screenshot 2 van de gebruiker).
2. In TableWise → /app/integraties/pos → "Koppel met Loyverse" → veld plakken → Opslaan.
3. Token wordt direct getest tegen `GET https://api.loyverse.com/v1.0/merchant`. Bij 200 → status `active`, naam getoond. Bij 401 → vriendelijke foutmelding ("token niet geldig").

## Wijzigingen

### Datamodel
- Tabel `pos_connections` blijft, maar:
  - Nieuwe kolom `access_token` (text, encrypted-at-rest is al via Supabase secret manager niet nodig — gewoon kolom, alleen leesbaar voor service role).
  - Veld `auth_method` toevoegen met default `'personal_token'`. OAuth-velden (`refresh_token`, `token_expires_at`, `oauth_state`) blijven staan voor backwards compat maar worden niet meer gebruikt.
- RLS: restaurant-managers kunnen status zien (geconnecteerd ja/nee, display_name, last_synced_at), maar **niet** het token zelf lezen. Token enkel server-side via service role in edge functions.

### Edge functions
- **Nieuw: `loyverse_connect`** — vervangt `loyverse_oauth`:
  - `POST { restaurant_id, access_token }` → valideert token tegen Loyverse `/merchant` → slaat op in `pos_connections` met `status='active'`, `display_name`, `auth_method='personal_token'`.
  - `POST { restaurant_id, action: 'disconnect' }` → markeert connectie als revoked, wist token.
  - `POST { restaurant_id, action: 'status' }` → leest status (zonder token uit te lekken).
  - JWT-validatie via `getClaims` (volgens huidige patroon) + check `is_restaurant_manager`.
- **`loyverse_sync_scheduled`** + on-demand sync blijven werken, maar lezen voortaan token uit `pos_connections.access_token` in plaats van OAuth-refresh-flow.
- **Verwijderen / archiveren**: huidige OAuth `authorize_url` / `callback` paden in `loyverse_oauth/index.ts`. Hele functie kan weg (of behouden als no-op die 410 Gone teruggeeft, om oude callbacks netjes af te handelen).

### Frontend
- `src/services/pos.ts`:
  - Verwijder `getLoyverseAuthorizeUrl`.
  - Voeg toe: `connectLoyverseWithToken(restaurantId, token)`, gebruikt `supabase.functions.invoke("loyverse_connect", { body: { restaurant_id, access_token } })`.
  - `disconnectLoyverse` en `getLoyverseStatus` aanpassen naar nieuwe function.
- `src/pages/app/POSIntegrationPage.tsx`:
  - "Koppel met Loyverse"-knop opent een **dialog** met:
    - Korte uitleg + link "Hoe vind ik mijn Loyverse access token?" (collapsible met stappen + verwijzing naar Loyverse → Settings → Access tokens).
    - Inputveld (`type="password"`, toggle "Toon").
    - Knop "Verbinden" → toont loading → bij succes toast + status-card update; bij 401 vriendelijke foutmelding.
  - Verwijder de `useEffect` die `?loyverse=connected` query-param afhandelt (niet meer nodig).
- Gastvrije microcopy, Nederlands, geen technische termen.

### Secrets
- `LOYVERSE_CLIENT_ID` en `LOYVERSE_CLIENT_SECRET` worden niet meer gebruikt. We laten ze voor nu staan (niet schadelijk) en kunnen ze later opruimen.

## Voordelen t.o.v. OAuth
- Geen redirect-/callback-bugs meer (oorzaak van huidige fout).
- Geen token-refresh-logic; Loyverse personal tokens verlopen niet tenzij ingetrokken.
- Restaurant heeft volledige controle — kan token op elk moment intrekken in Loyverse.
- Werkt identiek voor 1 of 100 restaurants zonder developer-app onderhoud.

## Niet in scope
- Loyverse webhooks (kan later, vereist publieke endpoint + signature check).
- Andere POS-providers — datamodel `auth_method` is alvast voorbereid voor `oauth` / `api_key` per provider.
