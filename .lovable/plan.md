# Gastlinks & selfservice wijzigen

## 1. URL slug — geen technisch probleem, wel een branding-verbetering

**Belangrijk om te weten:** `manage_token` is een willekeurig uuid dat globaal uniek is in `reservations`. De edge function `guest_reservation` zoekt puur op token — dus er is **geen risico op tenant-vervuiling** met de huidige `/r/manage/{token}`-route. Reserveringen van verschillende restaurants kunnen nooit door elkaar lopen.

Wél nuttig om de slug toe te voegen:
- Gast ziet meteen in de URL bij welk restaurant het hoort (vertrouwen, herkenbaarheid).
- Toekomstige white-label / custom domains zijn makkelijker te scopen.
- Logs en support-vragen worden leesbaarder.

**Voorgestelde aanpak:**
- Nieuw routepatroon: `/r/:slug/manage/:token` (bijv. `/r/eigeweis/manage/abc-123`).
- Oude route `/r/manage/:token` blijft werken als fallback (alle al verstuurde e-mails en bestaande links blijven geldig) → in `App.tsx` beide routes naar `GuestManageReservation` mappen.
- De edge function blijft op token zoeken; `slug` in de URL wordt alleen voor weergave gebruikt en (optioneel) gevalideerd tegen de gevonden reservering — bij mismatch redirecten naar de juiste slug i.p.v. fout tonen.
- E-mail-templates en linkgeneratie aanpassen in:
  - `supabase/functions/send_reservation_email/index.ts`
  - `supabase/functions/book_reservation/index.ts`
  - `supabase/functions/guest_reservation/index.ts`
  - `supabase/functions/public_api/index.ts` (`guestManage`)
  - Preview-tokens in de template-bestanden (`reservation-confirmation.tsx`, `reservation-reminder.tsx`, `reservation-change-approved.tsx`).
- Restaurant `slug` ophalen bij linkgeneratie (komt al uit `restaurants`-tabel in dezelfde queries).

## 2. Wijzigingsformulier voorinvullen met huidige reservering

Nu staan in `GuestManageReservation.tsx` alle velden van `changeForm` leeg. Aanpassingen:

- **Reservering ophalen** (`guest_reservation` action `view`): payload uitbreiden met `guest_first_name`, `guest_last_name`, `guest_email`, `guest_phone`, `dietary_notes` en `reservation_date` + lokale `start_time` (HH:mm) op basis van `restaurant.timezone`.
- **`Reservation` type** in `GuestManageReservation.tsx` uitbreiden met die velden.
- **Prefill bij openen van de dialog**: in de "Wijzig"-knop (of via `useEffect` op `showChange`) `setChangeForm({...})` aanroepen met:
  - `desired_date` = `reservation.reservation_date`
  - `desired_time` = lokale HH:mm afgeleid uit `start_time` in `restaurant.timezone` (Intl.DateTimeFormat met `hourCycle: "h23"`).
  - `desired_party_size` = `String(reservation.party_size)`
  - `desired_first_name/last_name/email/phone/dietary_notes` = huidige waarden
  - `message` blijft leeg (dat is de extra opmerking van de gast).
- Submit-logica blijft hetzelfde: edge function vergelijkt al met huidige waarden en doet niks als er niets gewijzigd is.

## Technische details

**Bestanden die wijzigen:**
- `src/App.tsx` — extra route `/r/:slug/manage/:token` naast bestaande fallback.
- `src/pages/GuestManageReservation.tsx` — type uitbreiden + prefill bij open + slug uit `useParams` accepteren (geen functionele rol).
- `supabase/functions/guest_reservation/index.ts` — `view`-response uitbreiden met guest-velden + `reservation_date` + restaurant `slug`.
- `supabase/functions/send_reservation_email/index.ts`, `book_reservation/index.ts`, `guest_reservation/index.ts`, `public_api/index.ts` — `manageUrl`/`cancelUrl` met slug bouwen wanneer beschikbaar.
- Preview-tokens in 3 template-bestanden updaten naar `/r/{slug}/manage/...`-vorm.

**Geen DB-migratie nodig.** Tokens en slug bestaan al.

**Backwards compat:** oude `/r/manage/{token}`-links blijven werken (fallback-route + tokenzoeker is ongewijzigd).
