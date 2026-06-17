# Testplan: Reserveringen Eigeweis — Widget + Handmatig

Doelrestaurant: **Texels Restaurant Eigeweis** (`slug: eigeweis`, `is_live: false`, plan Pro, TZ Europe/Amsterdam).  
Test-e-mail voor gast-records waar een echt adres handig is: **jeroen@eigeweis.com**.  
Voor andere testgasten gebruik ik herkenbare adressen zoals `tw-test+01@eigeweis.com` zodat je ze later makkelijk terugvindt en opruimt.

## Bevestigings- en follow-up e-mails: ja, intern controleerbaar

Ik hoef geen mailbox te openen. Per e-mail check ik:

1. **`integration_events`** — is het juiste event gegenereerd? (`reservation.confirmed`, `reservation.cancelled`, `reservation.reminder_24h`, `reservation.reminder_2h`, `reservation.reconfirmation_requested`, `reservation.completed`)
2. **`email_send_log`** — is de e-mail daadwerkelijk in de queue gezet en met status `sent` / `pending` / `dlq` / `suppressed` afgerond? (gedupliceerd op `message_id`, laatste status wint)
3. **`reservation_reminders` / `review_requests`** — zijn de geplande follow-ups (24h/2h reminder, review) gepland met de juiste verstuur-tijd?
4. **`email_send_state`** + edge function logs van `process-email-queue` en `send_reservation_email` — als iets blijft hangen, kijk ik hier wat er mis gaat.

Aan het eind van het rapport krijg je een tabel: per testreservering welke events + e-mails gestuurd zijn, met tijdstempel en status.

## Werkwijze (samengevat)

1. `browser--view_preview` op `/app/today` — sessie check (ingelogd als member van Eigeweis?).
2. Snapshot vooraf: tafels, zones, openingstijden/shifts, openstaande reserveringen vandaag/morgen.
3. Scenario's doorlopen (zie hieronder). Test-namen `TW Test …`, herkenbare e-mails.
4. Na elke actie: DB-verificatie (reservation, status_history, integration_events, email_send_log) + UI-verificatie (Agenda / Today / Guests).
5. Eindrapport met ✅ / ⚠️ / ❌ per scenario + e-mail-overzichtstabel. Geen fixes in deze ronde — alleen vaststellen, behalve voor evident kleine zaken waarvoor ik je apart om toestemming vraag.
6. Opruimen op jouw seintje: óf gerichte verwijdering van test-records, óf `purge_restaurant_operational_data` (verwijdert álle operationele data van Eigeweis — alleen als je dat bewust wilt).

## Scenario's

### A. Widget (publieke booking, `source_channel = website_widget`)
1. Normale boeking 2p morgen, populaire tijd → bevestigingsscherm + bevestigingsmail (in `email_send_log`)
2. Boeking buiten openingstijden → "gesloten" / geen slots
3. Grote groep boven `large_group_threshold` → large-group-flow i.p.v. directe boeking
4. Volle tijd → alternatieve slots getoond én boekbaar
5. Volle dag → wachtlijst-fallback
6. Terras-voorkeur aanvinken → `prefers_terrace=true`
7. Pre-orders (indien module aan) koppelen
8. Gast manage-link uit bevestigingsmail-payload → annuleren via `/manage` flow → cancel-mail in log

### B. Handmatig (operator UI)
9. Nieuwe reservering via Agenda
10. Walk-in via `WalkInQuickSheet` → direct `seated`
11. Reservering verplaatsen naar andere tafel (desktop drag) — **vraag uit eerder bericht:** check of er bij staf-verplaatsing een herbevestigingsmail wordt verstuurd (verwacht: nee, alleen update zonder gast-mail)
12. Reservering verplaatsen naar andere tijd
13. Long-press drag op mobiele viewport 360×619 — touch-flow uit vorige iteratie
14. Statuspad `pending → confirmed → seated → completed`
15. Achterwaartse statuswissel met reden (audit-trail)
16. Annuleren met reden → cancel-mail in log
17. Handmatig no-show markeren
18. Grote-groep aanvraag goed-/afkeuren via `LargeGroupsPage` → bijbehorende mails
19. Herbevestiging triggeren (`request_reconfirmation`) → reconfirm-mail + gast-flow

### C. Edge cases
20. Dubbele boeking voorkomen — twee bijna-gelijktijdige widget-boekingen op laatste tafel
21. Conflict bij verplaatsen — drop op een al bezette tafel
22. Hold-flow — onafgemaakte widget-boeking start als `hold` en vervalt

### D. Reminders & aftercare (steekproef, geen wachten)
23. Voor één testreservering check ik dat `reservation_reminders` rijen heeft voor 24h en 2h (zonder echt te wachten tot verzending)
24. Voor één afgeronde testreservering check ik dat `review_requests` netjes gepland staat

## Wat ik nodig heb

Eén bevestiging om te starten. Zeg **"ga"** en eventueel:
- Wel/niet automatisch opruimen na afloop (`gericht` / `purge` / `laat staan`)
- Mag ik ook scenario 20 (race condition) draaien? Dat maakt 2 reserveringen kort na elkaar — niets destructiefs, maar wil het even expliciet noemen.
