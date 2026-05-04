# FIX-001 — Reservation Status Enum Mismatch

## Probleem

De PostgreSQL enum `reservation_status` bevat `finished`, maar de hele codebase (edge functions, services, UI) gebruikt `completed`. Zodra een operator "Afgerond" markeert, faalt de DB-update omdat `completed` geen geldige enum-waarde is.

## Aanpak

1. Eén Supabase-migratie: voeg `completed` toe aan de enum en normaliseer bestaande `finished` records.
2. Frontend opschonen: alle defensieve `["finished", "completed"]`-checks vereenvoudigen naar `["completed"]`.
3. Geen wijzigingen aan edge functions, routing, navigatie of andere modules.

## Stap 1 — Database migratie

```sql
-- FIX-001: Add 'completed' to reservation_status enum
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'completed';

-- Normaliseer bestaande records (apart statement, draait na ALTER TYPE commit)
UPDATE public.reservations SET status = 'completed' WHERE status::text = 'finished';
UPDATE public.reservation_status_history SET new_status = 'completed' WHERE new_status = 'finished';
UPDATE public.reservation_status_history SET old_status = 'completed' WHERE old_status = 'finished';
```

Let op: `reservation_status_history.old_status` / `new_status` zijn `text`, niet de enum — daar gewoon de string vervangen.

## Stap 2 — Frontend opschoning

| Bestand | Wijziging |
|---|---|
| `src/components/reviews/ReservationAftercareSection.tsx` | `COMPLETED = ["completed", "finished"]` → `["completed"]` |
| `src/services/reporting.ts` | `["finished", "completed", "seated"]` → `["completed", "seated"]` |
| `src/services/reviews.ts` | `completedStatuses = ["finished", "completed"]` → `["completed"]` |
| `src/pages/app/ReservationsPage.tsx` | Verwijder `r.status === "finished" ? "completed" : r.status` normalisatie; vereenvoudig `["cancelled", "no_show", "completed", "finished"]` → zonder `finished` |
| `src/pages/app/TodayPage.tsx` | `["confirmed", "seated", "completed", "finished", "pending"]` → zonder `finished` |
| `src/components/StatusBadge.tsx` | Verwijder `finished` entries uit `statusBadgeVariants`, `STATUS_LABELS`, `STATUS_DOTS` |
| `src/pages/app/FloorPlanPage.tsx` | Controleer rond regel 484; verwijder dubbele "Afgerond"-knop indien aanwezig |

Daarnaast doe ik een `rg "finished"` sweep om eventuele extra plekken (bv. ReservationCard, QuickActionsMenu, ReservationDetailDialog, FloorModePage) mee te nemen — alleen als ze écht naar deze status verwijzen, niet naar "afgerekend" tekst.

## Stap 3 — Type-regeneratie

Na de migratie wordt `src/integrations/supabase/types.ts` automatisch bijgewerkt met de nieuwe enum-waarde. Geen handmatige actie nodig.

## Verificatie

- Markeer een reservering als "Aan tafel" → "Afgerond": status wordt opgeslagen zonder DB-error.
- Reserveringenlijst filtert correct op "Afgerond".
- Rapportages tellen "Afgerond" reserveringen mee.
- Aftercare-sectie verschijnt alleen na afronding.

## Buiten scope

- Edge functions (gebruiken al `completed` — niet aanraken).
- `ALLOWED_TRANSITIONS` in `manage_reservation`.
- Routing, navigatie, layout.
- Andere enums of statusvelden.

## Risico's

- `ALTER TYPE ... ADD VALUE` kan in oudere PG-versies niet in dezelfde transactie als DML gebruikt worden. Supabase voert migratie-statements los uit, dus dit werkt. Mocht het toch falen, splits ik in twee migratiebestanden.
- `finished` blijft als enum-waarde bestaan (kan niet veilig verwijderd worden zonder enum-rebuild). Dat is OK: na de UPDATE worden er geen records meer mee aangemaakt en de frontend gebruikt het niet meer.
