## Doel

Loyverse-items mogen automatisch gesynct worden naar `pre_order_items` voor matching/rapportage, maar de gast in het reserveringswidget krijgt **alleen** een kleine, door jou gekozen selectie te zien. Plus duidelijkheid over wat er met demo-items gebeurt bij go-live.

## 1. Datamodel — `show_in_widget` kolom

Migratie:

```sql
ALTER TABLE public.pre_order_items
  ADD COLUMN show_in_widget boolean NOT NULL DEFAULT false;

-- backfill: bestaande, handmatig aangemaakte items (geen POS-provider) blijven
-- zichtbaar voor de gast zodat de huidige widget-ervaring niet verandert
UPDATE public.pre_order_items
   SET show_in_widget = true
 WHERE pos_provider IS NULL
   AND is_active = true
   AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pre_order_items_widget_idx
  ON public.pre_order_items (restaurant_id, show_in_widget)
  WHERE deleted_at IS NULL;
```

Loyverse-sync raakt `show_in_widget` nooit aan → nieuwe Loyverse-items komen default **niet** in het widget.

## 2. Widget-query

`src/services/publicBooking.ts` → `getActivePreOrderItems()` krijgt extra filter `.eq("show_in_widget", true)`. Niets anders aan de gast-flow verandert.

## 3. Operator UI — `PreOrderDrinksPage`

- Per item een tweede schakelaar **"Tonen in gast-widget"** naast "Actief", inclusief in het edit-dialog.
- Een extra filter-tab bovenaan: **Gast-selectie** (default, `show_in_widget = true`) / **Uit Loyverse** (`pos_provider = 'loyverse'`) / **Alles**.
- Op een Loyverse-rij een snelactie **"Toon in widget"** die in één klik `show_in_widget = true` zet.
- Subtiele teller bovenaan: "X items zichtbaar voor gasten · Y uit Loyverse".

## 4. POS-pagina

Op `/app/integraties/pos` in de "Pre-order mapping"-tab een infoblok + link **"Beheer gast-selectie →"** naar `/app/instellingen/pre-orders` met de teller "X van Y Loyverse-items zichtbaar in widget". Maakt de relatie tussen sync en gast-selectie duidelijk.

## 5. Service / types

- `src/services/preOrders.ts`: `show_in_widget: boolean` toevoegen aan `PreOrderItem` type, default `true` in `createItem` (handmatige items blijven zichtbaar), meenemen in `updateItem`. Helper `setShowInWidget(id, value)`.
- `src/services/pos.ts`: in de Loyverse-card-teller `countLoyverseItems` uitbreiden met `visibleInWidget` count.

## 6. Demo-items bij go-live — beleidskeuze

Aanvulling op de bestaande "Demo-data wissen"-flow. De huidige `purge_restaurant_operational_data` RPC raakt `pre_order_items` bewust niet aan; jouw 8 starter-drankjes blijven dus staan. Voorstel:

- Géén automatische verwijdering bij go-live (de starter-set is bruikbaar als basis).
- Wél een **aparte, expliciete knop** op de demo-reset card: **"Demo-drankjes ook archiveren"** (checkbox), die de 8 originele standaard-items (te herkennen aan `metadata.demo_seed = true`) op `is_active = false` zet. Dat is omkeerbaar en niet destructief.
- Daarvoor markeren we in een tweede migratie alle nu-bestaande seed-items met `metadata = metadata || jsonb_build_object('demo_seed', true)` zodat we ze later veilig kunnen onderscheiden van items die jij zelf hebt aangemaakt.

Als je dit te ver vindt gaan voor nu, kunnen we punt 6 ook overslaan en uitsluitend punt 1–5 doen.

## Verificatie

1. Migratie draait, bestaande 8 items hebben `show_in_widget = true`, Loyverse-items uit eerdere sync krijgen `show_in_widget = false` (alleen handmatige rijen zonder `pos_provider` worden ge-backfilled).
2. Loyverse opnieuw syncen → nieuwe items komen binnen met `show_in_widget = false`.
3. Public widget `/r/<slug>` toont nog steeds dezelfde 8 items.
4. In `/app/instellingen/pre-orders` → tab "Uit Loyverse" laat alle gesynchroniseerde items zien; toggle "Tonen in widget" werkt; widget toont het item na refresh.
5. POS-pagina toont teller "X van Y Loyverse-items zichtbaar".

## Niet in scope

- Drank/gerechten splitsen in twee aparte widget-secties.
- Loyverse-categorieën als bulk-selectie ("alle items uit categorie X zichtbaar").
