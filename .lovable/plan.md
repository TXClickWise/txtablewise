## 1. Beheerlocatie bevestigen (geen code-wijziging)

De juiste plek in de sidebar is:

**Gastcommunicatie → tab "Drankjes vooraf"**
- Sidebar-item: `Gastcommunicatie` (icon: MessageSquare), zichtbaar voor `owner` en `manager`
- Route: `/app/gastcommunicatie?tab=drankjes` (oude `/app/drankjes` redirect bestaat al)
- Daar staan álle item-instellingen: naam, beschrijving, categorie, prijs, `is_active`, `show_in_widget`, sorteervolgorde
- Toegang: `RequireRole owner|manager`

Eventueel later: een directe shortcut "Drankjes vooraf" als sub-item onder Gastcommunicatie in de sidebar. Niet nodig nu — laat ik buiten scope.

## 2. Master aan/uit-schakelaar voor de hele sectie per restaurant

Eén switch die de complete "drankjes vooraf"-functionaliteit voor een restaurant aan- of uitzet. Als uit:
- Widget toont stap "Drankjes vooraf" niet meer (gast ziet 'm gewoon niet).
- Reservering-detail toont geen pre-order sectie meer (alleen historische pre-orders blijven leesbaar als ze er al zijn).
- Beheerpagina blijft bereikbaar maar toont een duidelijke "Module staat uit"-banner met de toggle bovenaan.

### Opslag

Gebruik de bestaande `restaurant_modules` tabel met `module_key = 'pre_orders'`.
- Default = aan (geen rij of `is_enabled = true` → aan), zodat bestaande restaurants niks merken.
- RLS: members read, manager write (consistent met andere module-achtige tabellen). Migratie voegt RLS toe als die nog ontbreekt.

### Frontend

- Nieuwe hook `useModuleEnabled(restaurantId, "pre_orders")` met React Query.
- Bovenaan `PreOrderDrinksPage`: een `Card` met label "Drankjes vooraf inschakelen voor dit restaurant" + `Switch` + korte uitleg. Alleen schakelbaar door `owner|manager` (anders disabled).
- Als uit: rest van de pagina dimt/disabled met een uitleg-strook ("Schakel de module in om drankjes te beheren"). Bestaande items blijven leesbaar zodat niks per ongeluk verloren voelt.
- Widget (`PreOrderSelectionStep` / `ReserveWidget` flow): sla de pre-order stap over als module uit. Voor publieke widget halen we de flag op via een publiek-leesbare bron — eenvoudigste: leesbaar maken voor `anon` voor `module_key = 'pre_orders'` only, of laten meedraaien in de bestaande publieke restaurant-fetch.
- Reservering-detail (`ReservationPreOrderSection`): verberg de "voeg toe"-UI als module uit (lees-only voor bestaande items).

### Technische details

```text
restaurant_modules
  └─ module_key = 'pre_orders'
     └─ is_enabled boolean  (default true via afwezigheid van rij)
```

- Migratie: alleen RLS toevoegen indien nog niet aanwezig. Geen seed nodig (afwezigheid = aan).
- Publieke read voor anon: policy `SELECT` waar `module_key = 'pre_orders'` (smal scoped, geen lekken).
- Helper `services/modules.ts` met `getModuleEnabled / setModuleEnabled` (upsert op `restaurant_id + module_key`).
- Gating-punten:
  - `src/pages/app/PreOrderDrinksPage.tsx` (toggle UI + dim)
  - `src/components/pre-orders/ReservationPreOrderSection.tsx` (verberg add-UI)
  - `src/pages/ReserveWidget.tsx` / `PreOrderSelectionStep` (skip stap)
  - `src/services/publicBooking.ts::getActivePreOrderItems` (return `[]` als module uit, zodat oudere callers ook safe zijn)

### Buiten scope

- Geen verandering aan bestaande items of `show_in_widget` per item.
- Geen migratie van `restaurants`-tabel; bewust geen nieuwe kolom.
- Geen sidebar-herstructurering.
