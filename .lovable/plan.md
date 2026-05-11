## Wat er nu misgaat

Symptoom 1: status blijft "In afwachting"
- In `pos_connections` staat 1 rij voor jouw restaurant met `status='pending'`, geen `display_name`, geen `external_account_id`.
- Het laatste connect-moment (00:02 UTC) heeft die rij niet bijgewerkt — `updated_at` blijft op 23:04. Er is ook geen `pos.loyverse.connected` event in `integration_events`.
- Conclusie: de toast "Loyverse gekoppeld" verschijnt voorbarig. De edge function `loyverse_connect` lijkt een 200 terug te geven zonder dat de upsert effectief op de bestaande rij landt, óf hij faalt stil verderop. We gaan de function harden (foutdetectie + logging) zodat:
  - de upsert echte fouten signaleert (nu wordt het result van `.update()` / `.insert()` niet gecheckt);
  - `pos.loyverse.connected` daadwerkelijk schrijft (huidige `logEvent` gebruikt `status: "processed"` wat geen geldige enum-waarde is — alleen `pending|sent|failed|processing|skipped`);
  - na succes nogmaals via service-role wordt gelezen om te bevestigen dat status echt `active` is voor we OK terugsturen.

Symptoom 2: "Ik zie de artikelen die ik in Loyverse heb aangemaakt niet"
- De huidige function synct alléén `receipts` (bonnen) naar `pos_orders`. Producten/items uit Loyverse worden nergens opgehaald of opgeslagen. De tabel `pre_order_items` heeft al een `external_product_id` veld voor dit doel maar wordt niet gevuld.
- We voegen item-sync toe (`GET /items` van Loyverse) die per restaurant items upsert in `pre_order_items` met `pos_provider='loyverse'` + `external_product_id`. Bestaande handmatige items blijven onaangeroerd.

## Wijzigingen

1) `supabase/functions/loyverse_connect/index.ts`
   - `logEvent`: gebruik enum-waarde `sent` i.p.v. `processed`, en controleer de insert-error (alleen loggen, niet hard falen).
   - `connect`-actie: check error van update/insert en gooi een nette fout met details als upsert mislukt.
   - Na succesvolle connect: roep nieuwe `syncItems()` aan (best-effort, foutmelding via `last_error` maar koppeling blijft `active`). Daarna `syncReceipts()` met 30-dagen-venster (i.p.v. 24u) zodat eerste sync zichtbaar materiaal toont.
   - Nieuwe actie `sync_items` (voor de "Synchroniseer nu"-knop kunnen we items én bonnen meenemen).
   - `syncItems(restaurantId, conn)`: pagineert `/items` (limit 250) en upsert naar `pre_order_items` op `(restaurant_id, external_product_id)`:
     - naam: `item.item_name`
     - prijs: eerste `variants[].default_price` × 100 → `price_cents`
     - categorie: `item.category_id` opgelost via `/categories`
     - `pos_provider='loyverse'`, `is_active=true`, `metadata={ loyverse_item_id, variant_id }`
     - bestaande rijen worden geüpdatet (naam/prijs); rijen die in Loyverse verdwenen → `is_active=false` (niet hard-deleten).
   - `sync_now`: voert nu items + receipts uit, geeft `{ imported_items, imported_receipts, skipped }` terug.

2) Database — kleine migratie
   - Unieke index `pos_connections_restaurant_provider_uniq` op `(restaurant_id, provider)` zodat upsert-logica betrouwbaar is en je nooit per ongeluk dubbele connecties krijgt.
   - Unieke index `pre_order_items_restaurant_external_uniq` op `(restaurant_id, pos_provider, external_product_id) WHERE external_product_id IS NOT NULL` voor idempotente item-sync.

3) `src/services/pos.ts` + `src/pages/app/POSIntegrationPage.tsx`
   - `syncLoyverseNow` retour bijwerken: `{ imported_receipts, imported_items, skipped }` + toast tekst aanpassen: "X items, Y bonnen geïmporteerd".
   - Na succesvolle `connectLoyverseWithToken`: meteen `getLoyverseStatus` ophalen en de UI in `active`-state tonen voordat we de toast tonen (voorkomt verwarrende "In afwachting" na succes).
   - Op de Loyverse-kaart een nieuwe regel "Producten gesynchroniseerd: N" tonen, gebaseerd op count uit `pre_order_items` waar `pos_provider='loyverse'`.

4) Tab "Pre-order mapping" op POS-pagina
   - Een sectie toevoegen met de gesynchroniseerde Loyverse-items (read-only lijst van eerste 50, met badge "Loyverse"). Bewerken blijft via bestaande Pre-order pagina.

## Niet in scope (apart laten)

- Webhook-flow van Loyverse (Loyverse biedt geen klant-webhooks op gratis tier; we blijven pollen via cron).
- Aanbetalingen aan Loyverse-betalingen koppelen.

## Verificatie

- Functie deployen, opnieuw koppelen vanuit UI met je access token.
- Verwacht: toast bevat "X items, Y bonnen geïmporteerd"; kaart toont "Gekoppeld" + accountnaam; "Laatste sync" gevuld.
- DB-checks: `pos_connections` rij status=`active`, `display_name` gevuld; `pre_order_items` bevat rijen met `pos_provider='loyverse'`; `integration_events` heeft een `pos.loyverse.connected` event met `status='sent'`.
