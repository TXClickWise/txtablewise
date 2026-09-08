# TX TableWise MCP — definitief plan (agentintegratie voor reserveren)

Alle HighLevel-agents (Voice AI, Managed Agents, AI Agents in Workflows en Workflows die
een Managed Agent aanroepen) praten aan de voorkant met één TableWise MCP-server. Die
server bevat géén eigen reserveringslogica; hij roept de bestaande motoren aan:
`availability`, `book_reservation`, `manage_reservation` en de bestaande wachtlijst- en
gastservices. `agent_api` blijft bestaan als onderliggend patroon en fallback, maar is
niet langer de integratie-voorkant.

```text
HighLevel Voice AI      ─┐
HighLevel Managed Agent ─┤
Workflow AI Agent       ─┼──> TX TableWise MCP ──> bestaande TableWise business logic
Workflow → Managed      ─┘        (identity + tenant + capabilities)
```

Het ontwerp draait niet om productnamen, maar om drie dingen per aanroep: **wie ben je
(identity), voor welk restaurant (tenant), en wat mag je (capabilities)**.

## Wat de huidige code laat zien (gecontroleerd)

- `availability` en `book_reservation` zijn publieke endpoints (widget) met volledige
  rechten. Zij doen openingstijden, sluitingen, pacing, zone-vulstrategie,
  tafelcombinaties, lead time, boekingshorizon en de grote-groepdrempels.
- `book_reservation` bepaalt bij aanmaken `requires_manual_approval`,
  `large_group_status` en de status (`pending` vs `confirmed`) uit
  `large_group_threshold`, `extra_large_group_threshold`,
  `large_group_manual_approval_from`, `manual_approval_from_party_size` en `auto_confirm`.
- **`manage_reservation` herberekent dit NIET bij een wijziging.** Alleen de duur wordt
  opnieuw bepaald; een reservering die van 4 naar 14 personen gaat blijft bevestigd
  staan zonder goedkeuring. Dit is een echte bug in de motor.
- **Aanbetalingen zijn niet geautomatiseerd.** `book_reservation` raakt deposits niet
  aan; alleen `manage_reservation` kent een handmatige `set_deposit_status`. Geen
  betaalflow — dat wordt in dit plan ook niet zo gepresenteerd.
- Geen idempotency op boekingen.
- `agent_api` bestaat al met sleutels per restaurant (`agent_api_keys`: restaurant_id,
  provider, key_hash, key_prefix, scopes, revoked_at) en grofmazige scopes
  (`availability`, `book`, `update`, `cancel`), plus een verplichte
  `confirmed_by_guest`-bevestiging vóór wijzigen. Dat model is het fundament voor de
  MCP-identiteiten hieronder, maar met fijnmazigere capabilities.

## Authenticatiemodel (punt 7)

De huidige MCP-opzet gebruikt OAuth per menselijke medewerker. Dat past bij een
medewerker die zijn assistent koppelt, maar **niet** bij HighLevel-agents: die draaien
zonder mens, hebben geen sessie die verloopt met een medewerker, en mogen niet stilvallen
als iemand uit dienst gaat of zijn wachtwoord wijzigt. Voorstel: twee naast elkaar
bestaande identiteitsvormen op dezelfde MCP-server.

1. **Human OAuth (blijft)** — medewerker logt in; tenant = zijn lidmaatschappen,
   capabilities = afgeleid van zijn rol.
2. **Service/connection identity (nieuw, voor HighLevel)** — een MCP-verbinding met een
   eigen sleutel, vast gekoppeld aan één restaurant en één clientprofiel. Opslag als
   uitbreiding van het bestaande sleutelmodel: velden `profile` (clientprofiel),
   `capabilities` (fijnmazige lijst), `restaurant_id` (harde binding), `label`,
   `revoked_at`, `last_used_at`. Elke aanroep wordt gelogd met identity + tool + uitkomst.

Beide vormen leveren intern hetzelfde object op:
`{ identity_type, identity_id, restaurant_id, capabilities[] }`. Alle tools werken
uitsluitend met dat object.

## Tenant-isolatie (punt 6)

- Een service identity heeft één vast `restaurant_id`. Geeft de client een ander
  `restaurant_id` mee, dan wordt de aanroep geweigerd met `tenant_mismatch` — hij wordt
  niet stil overschreven.
- Een menselijke identiteit mag alleen restaurants kiezen waar hij lid van is; bij één
  lidmaatschap wordt dat automatisch gekozen (bestaande `resolveRestaurantId`).
- De tenantcheck gebeurt centraal in één helper, vóór elke motoraanroep, ook bij lezen.
- Elke tool die een `reservation_id` krijgt, controleert eerst dat die reservering bij de
  gebonden tenant hoort; anders `not_found` (geen bestaanbevestiging lekken).

## Capabilities en clientprofielen

Fijnmazige capabilities: `availability.read`, `reservation.read`, `reservation.create`,
`reservation.update`, `reservation.cancel`, `reservation.status.write`, `waitlist.read`,
`waitlist.create`, `guest.search`, `reservation.note.write`, `large_group.approve`,
`large_group.decline`, `table.override`. Later: `deposit.read`, `deposit.write`,
`reconfirmation.read`, `reconfirmation.write`.

| Profiel | Standaard capabilities | Nadrukkelijk niet |
|---|---|---|
| `guest_voice` | availability.read, reservation.read (alleen via gevonden treffer), reservation.create, reservation.update, reservation.cancel, waitlist.create | large_group.*, reservation.status.write, reservation.note.write, table.override, deposit.*, guest.search |
| `guest_conversation` | zelfde als `guest_voice` | zelfde uitsluitingen |
| `workflow_agent` | leeg by default; per verbinding expliciet aanvinken (bijv. alleen availability.read + waitlist.create) | nooit automatisch manager-rechten; geen wildcard |
| `operations_agent` | availability.read, reservation.read, reservation.update, reservation.status.write, waitlist.read, waitlist.create, guest.search, reservation.note.write | large_group.approve/decline, table.override, deposit.write |
| `manager_agent` | alles van operations_agent + large_group.approve, large_group.decline, table.override, reservation.cancel | deposit.write zolang er geen betaalflow is |
| `revenue_agent` | availability.read, reservation.read, waitlist.read (en later deposit.read) | alle schrijfacties |
| `system_automation` | uitsluitend de expliciet benoemde acties per verbinding (bijv. alleen reservation.status.write voor no-show markering) | wildcards, en alles wat niet benoemd is |

Afdwinging is server-side: één helper `requireCapability(identity, capability)` die
draait vóór elke motoraanroep. MCP-annotations (`readOnlyHint`, `destructiveHint`) blijven
puur hints voor de assistent en zijn expliciet géén beveiliging (punt 6 van de vorige
ronde blijft staan).

### Extra begrenzing voor gastgerichte profielen

- Geen tafelkeuze: `table_id`/`table_ids`/`combination_id` worden genegeerd en geweigerd
  zonder `table.override`. TableWise past zelf zone-, pacing- en combinatielogica toe.
- Wijzigen en annuleren vereisen een expliciet `confirmed: true` plus een reden bij
  annuleren; de agent moet in het gesprek eerst naam, datum, tijd en aantal personen
  terugkoppelen en een hoorbaar "ja" krijgen (zelfde patroon als het bestaande
  `confirmed_by_guest`).
- `find_reservation` geeft alleen minimale gegevens terug (datum, tijd, personen, status,
  voornaam) en nooit een volledige daglijst.

## Centrale correcties in de motor (blijven staan)

1. **Grote groepen bij wijzigen.** Nieuwe gedeelde helper
   `supabase/functions/_shared/large-group.ts` die uit restaurantinstellingen +
   groepsgrootte afleidt: `requires_manual_approval`, `large_group_status` en of de status
   naar `pending` moet. `book_reservation` gebruikt hem in plaats van de inline-logica;
   `manage_reservation` roept hem aan zodra het aantal personen wijzigt. Groot geworden →
   terug naar `pending` + goedkeuringswerkbak + bestaande mail-/gebeurtenisroute. Weer
   klein vóór goedkeuring → vlag vervalt. Ook de harde bovengrens voor gastkanalen geldt
   dan bij wijzigen.
2. **Idempotency.** Optioneel veld `idempotency_key` op reserveringen, uniek per
   restaurant, afgedwongen in `book_reservation`: bekende sleutel geeft dezelfde
   reservering en hetzelfde `reservation_id` terug met `duplicate: true`, zonder extra
   mails of gebeurtenissen. De widget blijft ongewijzigd (geen sleutel = geen dwang).
3. **Rechten vóór de publieke boekingsmotor.** `book_reservation` blijft publiek voor de
   widget; de MCP-laag doet altijd eerst tenantbinding + `reservation.create` vóór de
   aanroep.
4. **Deposits.** Alleen lezen van de bestaande status; zelf zetten pas als er een echte
   betaalflow is. Niet presenteren als automatische betaling.

## MCP-toolset

Bestaand (blijft): `list_restaurants`, `list_reservations`, `get_reservation`,
`search_guests`, `list_waitlist`, `add_reservation_note` — voortaan achter respectievelijk
`reservation.read`, `guest.search` en `reservation.note.write`.

Nieuw:

| Tool | Aard | Motor | Capability | Kerninvoer | Uitvoer / foutcodes |
|---|---|---|---|---|---|
| `check_availability` | lezen | `availability` | availability.read | date, party_size | vrije tijden, combinatie-indicatie, druktewaarschuwing, `large_group` |
| `find_reservation` | lezen | directe zoekopdracht binnen de tenant | reservation.read | confirmation_code, telefoon, e-mail, naam, datum, tijd | max 5 minimale treffers; leeg = niet gevonden, meerdere = vraag om verduidelijking |
| `create_reservation` | schrijven | `book_reservation` | reservation.create | date, time, party_size, gast, wensen, idempotency_key | reservation_id, status, code, `requires_manual_approval`, `large_group_status`; fouten: `no_table_available`, `pacing_limit_reached`, `slot_too_soon`, `beyond_booking_horizon`, `large_group_required_manual`, `message_required`, `duplicate` |
| `update_reservation` | schrijven | `manage_reservation` (update) | reservation.update | reservation_id, nieuwe datum/tijd/personen, wensen, confirmed | nieuwe status incl. eventueel hernieuwde goedkeuringsplicht; fouten: `final_status`, `no_table_available`, `pacing_limit_reached` |
| `cancel_reservation` | ingrijpend | `manage_reservation` (cancel) | reservation.cancel | reservation_id, reden (verplicht), confirmed | bevestiging; fout bij ontbrekende bevestiging |
| `set_reservation_status` | ingrijpend | `manage_reservation` | reservation.status.write | reservation_id, nieuwe status | fout `invalid_transition` |
| `resolve_large_group` | ingrijpend | `manage_reservation` (goedkeuren/afwijzen) | large_group.approve / .decline | reservation_id, besluit, reden, confirmed | bevestiging + bestaande mail-/gebeurtenisroute |
| `add_waitlist_entry` | schrijven | wachtlijstservice | waitlist.create | date, tijdvenster, personen, contact | wachtlijst-id en status |

Later: `get_deposit_status` (lezen), daarna pas schrijven; herbevestigingstools.

## Testplan

Routes:
1. **Voice AI → MCP → reservering**: beschikbaarheid, boeken, `confirmed`, tafel
   gekoppeld, bevestigingsmail.
2. **Managed Agent → MCP → manageractie**: grote groep goedkeuren; status en mail volgen
   dezelfde route als in de app.
3. **Workflow AI Agent → MCP → beperkte actie**: verbinding met alleen
   `availability.read` + `waitlist.create`; boeken wordt geweigerd.
4. **Workflow → Managed Agent → MCP**: keten levert dezelfde uitkomst als route 2, met
   correcte identity in het logboek.

Scenario's:
5. Grote groep boven de drempel: `pending` + `awaiting_approval`; agent zegt "aanvraag
   ontvangen", niet "bevestigd".
6. Wijziging klein → groot (4 → 14): opnieuw `pending` en goedkeuringsplicht.
7. Wijziging groot → klein vóór goedkeuring: goedkeuringsplicht vervalt.
8. Annuleren zonder reden of zonder bevestiging wordt geweigerd; met beide verdwijnt de
   reservering uit alle overzichten.
9. Geen beschikbaarheid → wachtlijst.
10. Timeout/retry met dezelfde idempotency-sleutel: één reservering, hetzelfde id.
11. **Capability-denial**: `guest_voice` probeert `resolve_large_group`,
    `set_reservation_status`, `add_reservation_note` en een tafeloverride — alle vier
    geweigerd; `revenue_agent` krijgt geen enkele schrijfactie door.
12. **Tenant-isolatie**: verbinding van restaurant A vraagt reserveringen en wijzigingen
    op bij restaurant B — geweigerd (`tenant_mismatch` / `not_found`), ook bij een
    reservering-id dat wel bestaat maar bij B hoort.

Eerst end-to-end testen vóór alles: route 1 (Voice AI boeken), scenario 6
(klein → groot), scenario 10 (retry) en scenario 12 (tenant-isolatie).

## Scope

Geen wijzigingen aan schermen, ontwerp, de publieke widget of de bestaande
`agent_api`-contracten. Buiten de MCP-map alleen: de gedeelde grote-groephelper, het
idempotency-veld en de uitbreiding van het sleutel-/identiteitsmodel — precies wat nodig
is om MCP dezelfde regels te laten volgen als de app.

## Technische bestandenlijst

- Database: velden `profile` en `capabilities` op het bestaande agentsleutelmodel;
  `idempotency_key` op reserveringen met unieke index per restaurant.
- Nieuw: `supabase/functions/_shared/large-group.ts`.
- Aangepast: `supabase/functions/book_reservation/index.ts` (helper + idempotency),
  `supabase/functions/manage_reservation/index.ts` (helper in het wijzigingspad).
- Nieuw in `src/lib/mcp/`: `identity.ts` (identity + tenantbinding + capability-check),
  en tools `check-availability.ts`, `find-reservation.ts`, `create-reservation.ts`,
  `update-reservation.ts`, `cancel-reservation.ts`, `set-reservation-status.ts`,
  `resolve-large-group.ts`, `add-waitlist-entry.ts`.
- Aangepast: `src/lib/mcp/supabase.ts` en `src/lib/mcp/index.ts` (registratie,
  instructies, capability-poort op bestaande tools).
- Afsluitend: manifest opnieuw uitlezen en de MCP-functie uitrollen; actief bij de
  eerstvolgende publicatie.
