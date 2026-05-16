# Probleem

Als een gast zelf via de selfservice-link een reservering wijzigt en de wijziging **niet automatisch toegepast kan worden** (in jouw geval: 13 → 15 personen, boven de large group threshold), gebeurt server-side dit:

- `guest_reservation` zet uitkomst op `pending_review` (reden `large_party_needs_staff`).
- De reservering zelf wordt **niet** gewijzigd.
- Er wordt een `integration_events` rij + `audit_log` rij weggeschreven met event `reservation.change_pending_staff`.
- De gast krijgt een "wijzigingsverzoek ontvangen"-mail.

Maar:

- Er is **geen tabel** waar het verzoek bewaard wordt (alleen een event-rij).
- Er is **geen UI** die deze verzoeken toont.
- `usePendingLargeGroups` triggert niet, want `requires_manual_approval` / `large_group_status` / `large_group_requests` wordt niet aangeraakt.
- De sidebar krijgt dus geen badge en jij ziet niks.

Korte versie: het bestaande "grote-groep goedkeuring"-mechanisme dekt alleen nieuwe boekingen, niet wijzigingen op bestaande boekingen.

# Oplossing

Nieuwe tabel + hook + badge + review-paneel, in de stijl van het bestaande large-group flow.

## 1. Datamodel: `guest_change_requests`

Nieuwe tabel met RLS (members lezen, managers schrijven, service role insert via edge):

| kolom | type | doel |
|---|---|---|
| `id` | uuid pk | |
| `restaurant_id` | uuid fk | scoping + RLS |
| `reservation_id` | uuid fk | originele reservering |
| `status` | text | `new` / `approved` / `rejected` / `cancelled` |
| `reason_code` | text | bv `large_party_needs_staff`, `no_table_available` |
| `current_date` / `current_start_time` / `current_party_size` | snapshot huidige boeking |
| `desired_date` / `desired_time` / `desired_party_size` | gewenste wijziging |
| `message` | text | bericht van gast |
| `contact_patch` | jsonb | naam/email/telefoon/dieet diff |
| `created_at` / `reviewed_at` / `reviewed_by` | timestamps + user_id | |

Plus realtime publication aan.

## 2. Edge function `guest_reservation`

Bij `outcome === "pending_review"`: **ook** een rij in `guest_change_requests` (status `new`) wegschrijven, naast de bestaande integration_event en e-mail naar gast.

Bij `outcome === "applied"` of `rejected` mag een eventueel bestaand `new`-request voor dezelfde reservering automatisch op `cancelled` worden gezet — dan stapelen we niet als de gast nog eens wijzigt.

## 3. Hook + badge

- Nieuwe hook `usePendingGuestChanges` (zelfde patroon als `usePendingLargeGroups`): count + realtime invalidate op `guest_change_requests`.
- In `AppSidebar` een badge naast **Reserveringen vandaag** (of Reserveringen) met deze count, optellend bij/los van de bestaande large-group badge.

## 4. UI: review-paneel

Op `TodayPage` (boven of naast "Reserveringen vandaag") een inklapbare kaart **"Wijzigingsverzoeken van gasten"** die alleen verschijnt als er `new` rijen zijn. Per rij:

- Gastnaam + originele datum/tijd/party
- Gewenste datum/tijd/party (visueel als diff)
- Reden (`Grote groep — handmatige goedkeuring nodig`, etc.)
- Bericht van gast
- Knoppen:
  - **Goedkeuren** → roept een nieuwe edge `apply_guest_change` (of een server-action in `manage_reservation`) die de wijziging alsnog probeert door te voeren (tafelcheck + update), zet request op `approved`, stuurt `reservation-change-approved`-mail.
  - **Afwijzen (met reden)** → zet op `rejected`, stuurt `reservation-change-rejected`-mail met opgegeven reden.
- Realtime-update zodat de kaart leeg wordt zodra alles is afgehandeld.

## 5. Geen impact op bestaande flows

- Pure contact/dieet-wijzigingen blijven direct toegepast.
- Auto-apply binnen threshold blijft werken.
- Large-group **nieuwe** boekingen blijven via `usePendingLargeGroups`.

# Technische details

- Migratie via `supabase--migration` voor de nieuwe tabel + RLS + realtime + indices op `(restaurant_id, status)` en `reservation_id`.
- Edge functions die wijzigen: `guest_reservation` (insert request), nieuwe `apply_guest_change` (approve/reject met re-evaluatie van tafel + mail).
- Frontend nieuw: `src/hooks/usePendingGuestChanges.ts`, `src/components/reservations/GuestChangeRequestsPanel.tsx`, integratie in `AppSidebar` en `TodayPage`.
- Geen wijziging aan e-mail-templates nodig — `reservation-change-approved` en `reservation-change-rejected` bestaan al.

# Out of scope

- Geen wijzigingen aan de gast-selfservice pagina zelf.
- Geen aparte "approvals"-pagina; we tonen het inline op Today (later eenvoudig uit te breiden naar eigen route als gewenst).
