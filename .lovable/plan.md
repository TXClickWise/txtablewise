# Status van eerdere wijzigingen

Korte eerlijke check:

| Wijziging | Status |
|---|---|
| Sidebar: terug naar Vandaag/Agenda vanuit submenu | Klaar |
| Verwijder "Instellingen" knoppen uit Grote Groepen + No-show pagina | Klaar |
| Min–max personen + zone-snelkeuze in tafelgrid | **Alleen toegepast op `TableGridView` (gebruikt in /app/reserveringen). NIET op /app/agenda — die pagina gebruikt eigen code in `AgendaPage.tsx`.** |
| Gast kan reservering zelf wijzigen (volautomatisch + 3 emails) | **Nog niets van gebouwd.** Plan was goedgekeurd, maar er is daarna doorgesprongen naar auth-email templates. Geen `evaluate_reservation_change` edge function, geen change email templates, geen UI-velden in `GuestManageReservation`. |
| Auth email templates restylen (TableWise huisstijl) | Klaar |

Dus terecht dat je in de Agenda nog niets ziet — die wijziging is op de verkeerde view geland, en de gast-wijziging is nooit gestart.

# Plan om dit recht te zetten

## Deel A — Agenda view (/app/agenda) afmaken

Bestand: `src/pages/app/AgendaPage.tsx`

1. Tafels-query uitbreiden met `capacity_min, capacity_max` (nu alleen `id, label, zone_id, zones(name)`).
2. In de sticky linker tafelkolom (rond regel 411 + de map die de rijen rendert): naast het tafel-label een klein `tabular-nums` getal `min–max p` (of `Np` als min=max) tonen, identiek aan TableGridView.
3. Boven de scroll-container een rij "Spring naar:" buttons toevoegen, één per zone, die `scrollIntoView` doet op de eerste tafel-row van die zone. `rowRefs` map met `useRef`. Alleen tonen als er >1 zone is. Buttons zijn touch-vriendelijk (h-10).
4. Geen wijziging aan de bestaande zoom/pinch/now-line/walk-in logica.

## Deel B — Gast-wijziging volautomatisch

Onveranderd t.o.v. eerder goedgekeurd plan. Korte herhaling:

1. Nieuwe edge function `supabase/functions/evaluate_reservation_change/index.ts` — server-side check op openingstijden, min-notice, large-group threshold, tafel-capaciteit (`findAvailableCombination`) en pacing (`evaluatePacing`). Returnt `auto_apply` | `auto_reject` | `needs_staff` met `reason_code`.
2. `guest_reservation/index.ts`: action `request_change` roept evaluator aan en handelt 3 uitkomsten af (DB-update + events + email).
3. 3 nieuwe templates in `supabase/functions/_shared/transactional-email-templates/`:
   - `reservation-change-received.tsx`
   - `reservation-change-approved.tsx`
   - `reservation-change-rejected.tsx`
   Registreren in `registry.ts` + i18n keys in `i18n.ts`.
4. `send_reservation_email/index.ts`: 3 nieuwe event-mappings.
5. `src/pages/GuestManageReservation.tsx`: contactgegevens toevoegen aan formulier; UI-states `applied` / `pending_review` / `rejected` met juiste copy uit `manage.json` (NL/EN/DE/FR).
6. DB migratie — 3 kolommen op `restaurants`:
   - `guest_changes_auto_apply boolean default true`
   - `guest_changes_min_notice_minutes int default 240`
   - `guest_changes_auto_reject_party_size int null` (fallback `large_group_threshold`)
7. Settings-paneel: toggle + 2 inputs in `ReservationRulesSettings.tsx`.
8. Audit-log + `reservation.change_*` events in `integration_events` voor ClickWise.

## Volgorde

1. Eerst Deel A (5 min, puur frontend, direct zichtbaar voor jou).
2. Daarna Deel B (groter, edge function + DB + emails + UI).

Akkoord om beide te bouwen in één doorloop, of liever eerst alleen Deel A live zien en dan Deel B?
