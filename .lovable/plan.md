# Fase 1 — Verkoopbare MVP afronden

Volgorde exact zoals gevraagd. Elke stap is een afzonderlijke, veilige wijziging met regressiecheck. Bestaande werkende functionaliteit (agenda, plattegrond, gasten, reserveringspagina, widget, settings, webhooks) blijft intact.

---

## Stap 1 — Capaciteits-pacing in `availability`

**Doel:** beschikbaarheid bepaalt niet alleen "is er een tafel vrij" maar ook "is het operationeel verantwoord om dit slot nog te boeken".

**Schema-uitbreiding (kleine migratie):**
- `restaurants`: `max_covers_per_slot int`, `max_new_reservations_per_15min int`, `peak_warning_threshold_pct int default 85`
- `shifts`: `max_covers_override int null` (optioneel per shift)
- Per party-size duurregels later — nu één globale `default_reservation_minutes` + override `large_group_minutes int default 150` op `restaurants` voor groepen ≥ `large_group_threshold`

**Edge function `availability`:**
- Voor elk slot extra checks:
  - Tel actieve covers (sum party_size) in overlappende reserveringen → vergelijk met `max_covers_per_slot`
  - Tel nieuwe reserveringen die starten binnen hetzelfde 15-min venster → vergelijk met `max_new_reservations_per_15min`
  - Bepaal duur: groot gezelschap krijgt `large_group_minutes`
- Slot wordt `available: false` met `reason: 'capacity'` of `'pacing'` wanneer limieten overschreden
- Response geeft `peak_warning: true` als bezetting > drempel (UI kan dit tonen)

**`book_reservation`:** dezelfde checks server-side toepassen (geen race conditions). Foutmelding NL: "Dit tijdslot is operationeel vol. Kies een ander tijdstip of plaats de gast op de wachtlijst."

**UI:** instellingenpagina "Capaciteit & pacing" onder Settings (nieuwe route `/app/instellingen/capaciteit`).

---

## Stap 2 — Guest self-service magic link

`reservations.cancel_token` en `manage_token` bestaan al (uuid, default gen_random_uuid). We gebruiken ze.

**Nieuwe publieke route:** `/r/manage/:token`
- Pagina laadt reservering via nieuwe edge function `guest_reservation` (publiek, accepteert token, geeft minimale veilige data terug: datum/tijd, party_size, restaurantnaam, status)
- Acties:
  - **Bekijken** (default)
  - **Annuleren** → bevestigingsdialoog → edge function zet status op `cancelled` + dispatcht webhook
  - **Bevestigen aanwezigheid** ("Ik kom") → zet `reminder_confirmed_at`
  - **Ik kan niet komen** → annuleren met reden
  - **Wijziging aanvragen** → eenvoudig formulier (datum/tijd/party_size) → maakt nieuw `integration_event` van type `guest_change_request` voor staff (geen directe aanpassing in MVP, te risicovol qua pacing)
- Verlopen/ongeldige token → vriendelijke NL-foutpagina

**Security:**
- Tokens zijn UUID v4 (niet voorspelbaar) ✓
- Edge function valideert token strict, geeft nooit `id` of andere reservering-data terug
- Rate-limiting per IP via simpele in-memory throttle in edge function
- Destructieve acties altijd via POST + bevestiging client-side

**Microcopy:** warm, NL, hospitality-stijl ("Fijn dat u komt", "Jammer dat u niet kunt komen — bedankt voor het laten weten").

---

## Stap 3 — E-mail templates + reminder triggers (voorbereid)

**Geen daadwerkelijk versturen in deze stap** — we bouwen de structuur klaar zodat aansluiting op Lovable Email later 1 stap is.

**Schema:**
- Nieuwe tabel `reservation_emails`:
  - `id`, `reservation_id`, `email_type` enum (`confirmation`, `reminder_24h`, `reminder_2h`, `cancellation`, `modification`)
  - `status` enum (`pending`, `sent`, `failed`, `skipped`)
  - `scheduled_for timestamptz`, `sent_at timestamptz null`, `error text null`
  - RLS: members read, manager write
- Index op `(status, scheduled_for)` voor scheduler

**Edge functions:**
- `schedule_reservation_emails` — wordt aangeroepen vanuit `book_reservation` na succes, plant alle relevante e-mails (confirmation = nu, reminder_24h = start - 24u, reminder_2h = start - 2u)
- `dispatch_reservation_emails` — placeholder die `pending` rijen pakt waarvan `scheduled_for <= now()`. In deze stap markeert hij ze als `skipped` met note "email infra not configured" zodat we de loop al kunnen testen. Later vervangen we de body door echte send.
- Bij `cancellation`/`modificatie` via app of guest link: nieuwe rij toevoegen.

**Templates:** als losse `.tsx`-strings voorbereid in `supabase/functions/_shared/email-templates/` met NL hospitality-copy + dynamische data (gastnaam, datum/tijd, manage-link). Deze zijn straks 1-op-1 te gebruiken wanneer de email-infra wordt geactiveerd.

**Cron (later):** notitie in code dat dispatcher elke 5 min moet draaien zodra email-infra live is.

---

## Stap 4 — Waitlist UI

Tabel `waitlist_entries` bestaat al ✓. We bouwen de UI.

**Nieuwe pagina:** `/app/wachtlijst` (sidebar-item toevoegen)
- Lijst met filters: vandaag / deze week / alles
- Per rij: naam, telefoon, party_size, gewenste datum + tijdsrange, status, "binnen/terras" voorkeur, notitie
- Acties per rij:
  - "Converteren naar reservering" → opent `WalkInDialog`-achtige flow met velden vóóringevuld, na succes: `waitlist_entries.status = 'converted'` + `converted_reservation_id` zetten
  - "Gast gebeld / genotificeerd" → `notified_at = now()`, `status = 'notified'`
  - "Annuleren" → `status = 'cancelled'`
- "Toevoegen aan wachtlijst"-knop → dialoog met formulier
- Tablet-vriendelijk: grote knoppen, ruime hit-targets, geen hover-only acties

**Voorkeur binnen/terras:** opslaan in `notes` of nieuwe kolom `seating_preference text`? Kleine schema-uitbreiding: `seating_preference text null`.

**Integratie met annulering:** wanneer een reservering wordt geannuleerd, zoekt een nieuwe edge function `match_waitlist` of er passende wachtlijst-entries zijn voor die datum/party_size en markeert ze als `match_available` (alleen flag, geen auto-notificatie in MVP).

---

## Stap 5 — Basis Floor Mode

**Nieuwe pagina:** `/app/floor` (sidebar-item, prominente positie)

**Layout (tablet-first, 1024+ px primair):**
- Bovenbalk: huidige datum + shift, totaal verwacht/geseated/no-show counters
- Linkerkolom: "Aankomend" (volgende 2 uur, gesorteerd op tijd) — grote kaarten met naam, party_size, tijd, tafel(s)
- Middenkolom: "Aan tafel" — actieve reserveringen met seated-tijd + verstreken duur
- Rechterkolom: "Walk-ins / Wachtlijst" — snelknop "Walk-in" + waitlist-snippet

**Tafelstatussen:** nieuwe enum `table_state` (`free`, `reserved_soon`, `seated`, `needs_clear`) — afgeleid uit reserveringen, opgeslagen lokaal in component (geen extra tabel nodig in MVP). Voor `needs_clear` voegen we `cleared_at timestamptz` aan `reservations` toe (zet bij actie "tafel vrijmaken").

**Snelle acties (grote knoppen op kaart):**
- ✓ Aangekomen → status `arrived`
- 🪑 Seated → status `seated`, koppel evt. tafel als nog niet gekoppeld
- 🧹 Tafel vrij → `cleared_at = now()`, status → `completed`
- ❌ No-show → status `no_show`, `no_show_marked_at = now()`
- 💬 Bericht → placeholder-button (toast "Berichtfunctie komt binnenkort")
- ➕ Walk-in → bestaand `WalkInDialog` hergebruiken

**Realtime:** Supabase realtime channel op `reservations` voor restaurant zodat meerdere tablets in sync blijven.

**Schema-mini:** `reservations.cleared_at timestamptz null` + extra status-waarden indien nodig (`arrived`, `seated`, `completed` — checken of die al in enum zitten, anders alter).

---

## Stap 6 — Marketing landingpage NL

**Route:** `/` (vervangt huidige `Index.tsx`, oude content kan eventueel naar `/app-info` verhuizen).

**Secties:**
1. **Hero**: "Het reserveringssysteem dat lege tafels voorkomt." Sub: commissievrij, tablet-first, voor Nederlandse horeca. CTA: "Probeer gratis" (→ `/auth`) + "Demo aanvragen".
2. **Pijnpunten → oplossingen**: 3 kolommen (no-shows, lege tafels, handmatig werk).
3. **Kernfeatures grid** (6 cards): Commissievrij, Eigen gastdata, Multichannel (web/WhatsApp/QR/Google/Insta), No-show preventie, Tablet-first floor mode, Wachtlijst.
4. **Integraties**: ClickWise, AI-ready, POS-ready (Loyverse als starter — "binnenkort"-badge).
5. **"Niet zomaar een widget"**-sectie met positioneringscitaat.
6. **Pricing teaser** (placeholder, "Vanaf €X/maand, geen commissie").
7. **FAQ NL** (5-6 vragen).
8. **Footer** met links.

**Stijl:** rustig, professioneel, Nederlandse hospitality-toon. Bestaand design-system (Tailwind + tokens uit `index.css`) hergebruiken. Geen nieuwe deps.

---

## Volgorde van uitvoering en regressiestrategie

Per stap:
1. Schema-migratie (klein, alleen wat die stap nodig heeft)
2. Edge function(s) aanpassen/toevoegen
3. UI bouwen
4. Snelle handmatige check via preview + één bestaande flow opnieuw doorlopen (bijv. boeking via widget na stap 1) om regressie uit te sluiten

Niets buiten scope wordt aangeraakt. POS, aftercare, deposits-flow, review-requests blijven datamodel-only zoals reeds gemigreerd — geen UI in deze fase.

---

## Technische details (samengevat)

**Migraties (gespreid over stappen):**
- Stap 1: `restaurants` (pacing-kolommen), `shifts` (override), `restaurants.large_group_minutes`
- Stap 3: nieuwe tabel `reservation_emails` + enum
- Stap 4: `waitlist_entries.seating_preference`
- Stap 5: `reservations.cleared_at`, evt. enum-uitbreiding voor reservation_status

**Nieuwe edge functions:** `guest_reservation`, `schedule_reservation_emails`, `dispatch_reservation_emails`, `match_waitlist`

**Bestaande edge functions aangepast:** `availability` (pacing), `book_reservation` (pacing + email scheduling)

**Nieuwe pagina's:** `/r/manage/:token`, `/app/wachtlijst`, `/app/floor`, `/app/instellingen/capaciteit`, vernieuwde `/`

**Bestaande pagina's:** AppSidebar krijgt items voor Wachtlijst en Floor; Settings krijgt Capaciteit-tab.

Akkoord? Dan start ik met Stap 1 (capaciteits-pacing).
