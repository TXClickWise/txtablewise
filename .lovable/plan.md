## Doel

Pre-order drankjes van een gast automatisch als **open ticket** in Loyverse klaarzetten, **X minuten vóór aanvang** van de reservering. Personeel ziet de bon meteen op de POS staan zodra de gast arriveert en rekent af.

## Belangrijke eerlijkheid vooraf (Loyverse API-realiteit)

Loyverse's public Receipts API maakt **afgeronde** bonnen aan, niet expliciet "open tickets" zoals in de POS-app. Wat we wél betrouwbaar kunnen:

- Een receipt POST met `payments: []` en `note` → in veel Loyverse-setups verschijnt dit als een onafgeronde bon op de gekoppelde tafel (`dining_option_id`). Dit werkt mits dining options aanstaan in Loyverse.
- Alternatief plan B (als A onbetrouwbaar blijkt bij test): we maken een gedetailleerde "tafelnotitie" met de pre-order items, gekoppeld aan tafel + gastnaam, en het personeel scant items zelf in op de POS.

Daarom bouwen we dit met een **feature flag** + grondige test in admin voordat we het bij echte gasten activeren.

## 1. Datamodel — nieuwe velden

```sql
-- per-restaurant configuratie
ALTER TABLE public.clickwise_settings -- of beter: een aparte pos_push_settings
-- gebruik bestaande pos_connections.config jsonb:
-- config = { ..., push_preorders: { enabled: false, minutes_before: 30, dining_option_id: null } }

-- per-reservering tracking
ALTER TABLE public.reservations
  ADD COLUMN pos_preorder_pushed_at timestamptz,
  ADD COLUMN pos_preorder_receipt_id text,
  ADD COLUMN pos_preorder_status text;  -- pending | pushed | failed | skipped
```

Geen nieuwe tabel; alles via bestaande `pos_connections.config` (jsonb) en `reservations.*` velden. Past bij POS-agnostisch datamodel.

## 2. Edge function `loyverse_push_preorder`

Eén function met twee modi:

- **`mode = "scheduled"`** (cron-aanroep, zonder auth): vindt alle reserveringen waarvan
  - `start_time` ligt tussen `now()` en `now() + minutes_before`
  - `pos_preorder_pushed_at IS NULL`
  - status ∈ {confirmed, pending} (niet cancelled/no_show)
  - heeft minimaal 1 `pre_orders` rij
  - restaurant heeft Loyverse connected én `push_preorders.enabled = true`
- **`mode = "manual"`** (vanuit UI, met auth + manager-check): één specifieke `reservation_id` direct pushen of opnieuw proberen.

Per reservering:
1. Items ophalen uit `pre_orders` joined met `pre_order_items` (voor `external_product_id`).
2. Loyverse-tafel bepalen: eerst proberen via tafel-mapping (later), anders default `dining_option_id` uit config.
3. POST naar Loyverse `/receipts`:
   ```json
   {
     "store_id": "<from connection>",
     "dining_option_id": "<from config>",
     "note": "Pre-order — <gastnaam> · <party_size>p · <tijd>",
     "line_items": [
       { "variant_id": "<external_product_id>", "quantity": 2, "price": 950 }
     ],
     "payments": []
   }
   ```
4. Bij success: `pos_preorder_pushed_at = now()`, `pos_preorder_receipt_id = receipt.id`, `pos_preorder_status = 'pushed'`, audit-log + `integration_logs` regel.
5. Bij failure: `pos_preorder_status = 'failed'`, foutboodschap in `integration_logs`, geen retry in dezelfde run (volgende cron-tick pakt het op tot een limiet).

Annulering: als een reservering die al gepusht is wordt geannuleerd, wordt de bon **niet** automatisch verwijderd uit Loyverse — wel een waarschuwing in Floor Mode "Open bon in Loyverse — annuleer handmatig" (Loyverse DELETE /receipts/:id bestaat niet voor open receipts).

## 3. Cron-job

Identiek patroon als `reminder_scheduler`: elke 5 minuten via `pg_cron` + `pg_net`, aangemaakt via `supabase--insert` (niet migratie, want bevat anon-key per project).

## 4. UI — POS-pagina (`/app/integraties/pos`)

Nieuwe sectie **"Pre-orders naar Loyverse pushen"**:
- Toggle **Automatisch open ticket aanmaken** (off by default).
- Slider/select **Minuten voor aanvang** (15 / 30 / 45 / 60), default 30.
- Select **Dining option / tafelgroep in Loyverse** (handmatig in te vullen, met "Test verbinding" knop die dining_options ophaalt indien de API dat geeft).
- Status-card: "Vandaag X bons gepusht, Y mislukt", link naar `integration_logs`.

## 5. UI — Reservering / Floor Mode

In `ReservationDetailDialog` en op tafel-tile bij een reservering met pre-orders:
- Status-pill: **"Bon klaargezet in Loyverse"** ✓ / **"Bon staat gepland"** ⏱ / **"Pushen mislukt — opnieuw proberen"** ✕.
- Manager-knop **"Nu naar Loyverse sturen"** (handmatige modus van de function).
- Bij annulering van een al-gepushte reservering: rustige hospitality-copy "Vergeet niet de bon in Loyverse te annuleren" (geen valse claim dat we het automatisch doen).

## 6. Verificatie

1. Reservering aanmaken met 2 pre-order items, `start_time = now() + 25 min`, push-config 30 min, toggle aan.
2. Cron-run → reservering gevonden → POST naar Loyverse → `pos_preorder_pushed_at` gevuld → bon zichtbaar op Loyverse POS.
3. Reservering annuleren ná push → Floor Mode toont waarschuwing.
4. Toggle uit → cron slaat over, `pos_preorder_status` blijft leeg.
5. Loyverse-token kapot → `failed` met duidelijke melding in logs.
6. Handmatige knop in dialog: één klik → status binnen 3 sec naar "Bon klaargezet".

## 7. Beveiliging / kwaliteit

- Function valideert per restaurant: alleen pushen als connection `status = 'connected'` én `push_preorders.enabled = true`.
- Manager-only in handmatige modus (JWT check).
- `integration_logs` regel per poging, met `request_payload` (zonder token) en `response_payload`.
- Rate-limit: max 1 push per reservering per 60 sec (idempotency via `pos_preorder_pushed_at` check vlak voor POST).

## Niet in scope (later)

- Automatisch annuleren / corrigeren van bon in Loyverse bij wijziging pre-order.
- Tafel-mapping per zone (nu één default `dining_option_id`).
- Andere POS-systemen — model is wel provider-agnostisch (`pos_preorder_*` velden), pusher-implementatie is Loyverse-specifiek.
- Splits per gast / aparte bonnen per persoon.
