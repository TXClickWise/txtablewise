# MCP-agentintegratie voor reserveren — aangescherpt plan

Doel: via de agent-koppeling exact dezelfde reserveringsregels als in de app, zonder een
tweede reserveringslogica. Alle bestaande motoren blijven leidend:
`availability`, `book_reservation`, `manage_reservation` en de al bestaande
gast-agent-laag `agent_api`.

## Wat de code nu laat zien (gecontroleerd)

- `availability` en `book_reservation` zijn publieke endpoints (widget) en draaien met
  volledige rechten. Ze doen zelf openingstijden, sluitingen, pacing, zone-fill,
  tafelcombinaties, lead time, boekingshorizon en de grote-groepdrempels.
- `book_reservation` bepaalt bij het aanmaken `requires_manual_approval`,
  `large_group_status` (`awaiting_approval`) en de status (`pending` vs `confirmed`),
  op basis van `large_group_threshold`, `extra_large_group_threshold`,
  `large_group_manual_approval_from`, `manual_approval_from_party_size` en `auto_confirm`.
- `manage_reservation` vereist een ingelogde gebruiker en leunt op de bestaande
  toegangsregels. **Bevinding (punt 4): bij een wijziging van klein naar groot wordt de
  grote-groeplogica NIET opnieuw toegepast.** Alleen de duur wordt herberekend;
  `requires_manual_approval`, `large_group_status` en de status blijven staan. Een groep
  van 4 die naar 14 gaat blijft dus gewoon bevestigd staan zonder goedkeuring.
- Er bestaat al een volledige gast-agentlaag: `agent_api`, met API-sleutels per
  restaurant en scopes (`availability`, `book`, `update`, `cancel`). Die heeft al
  `check_availability`, `reservation_request`, `find_reservation`, `update_reservation`,
  `cancel_reservation`, `create_waitlist_entry`, `get_opening_hours`,
  `reconfirm_reservation` én een verplichte `confirmed_by_guest`-bevestiging vóór
  wijzigen. Dit hoeft niet opnieuw gebouwd te worden.
- **Aanbetalingen (punt 5): er is geen automatische betaalflow.** `book_reservation`
  raakt deposits niet aan. Alleen `manage_reservation` kent `set_deposit_status`, een
  handmatige statuswissel met bijbehorende gebeurtenis. Deposits worden dus in dit plan
  alleen als lezen/handmatig-zetten behandeld, niet als betaalstroom.
- Er is nergens idempotency op boekingen (punt 7).

## Kernkeuze: twee duidelijk gescheiden agent-oppervlakken

1. **Gast-agent (HighLevel Voice AI)** blijft op `agent_api` met zijn API-sleutel en
   scopes. Dat is al server-side afgedwongen per actie en per restaurant.
2. **MCP-server** is het personeelsoppervlak: elke gebruiker logt in met zijn eigen
   TableWise-account (OAuth), en krijgt precies zijn eigen rechten.

Capability-scheiding wordt server-side afgedwongen (punt 2 en 6), niet via omschrijvingen
of annotations:

- Nieuwe helper `requireCapability(ctx, restaurant_id, capability)` in
  `src/lib/mcp/supabase.ts`. Die haalt de rol van de ingelogde gebruiker op uit de
  bestaande ledenadministratie (`restaurant_members.role`) en weigert de actie met een
  duidelijke fout als de rol de capability niet heeft.
- Capability-matrix: `read` (iedereen), `book` (staff en hoger), `manage` (staff en
  hoger), `approve` (alleen manager/eigenaar), `override_tables` (alleen manager/eigenaar).
- Elke schrijf-tool begint met deze check, vóór er iets richting een motor gaat.
- Annotations (`destructiveHint` enz.) blijven staan als hint voor de assistent, maar
  zijn nadrukkelijk geen beveiliging. Annuleren en grote-groepbesluiten worden extra
  begrensd: verplichte reden, en een `confirmed: true`-veld dat de tool zelf eist —
  dezelfde aanpak als `confirmed_by_guest` in `agent_api`. De Voice Agent moet in het
  gesprek datum, tijd, naam en aantal personen hardop terugkoppelen en een expliciet
  "ja" krijgen voordat hij annuleert of een grote groep afwijst.

## Toegang tot `book_reservation` (punt 3)

De publieke widgetroute blijft ongewijzigd. In de MCP-laag geldt: vóór elke aanroep van
`book_reservation` wordt eerst het restaurant bepaald via de bestaande
`resolveRestaurantId()` en daarna `requireCapability(..., "book")` uitgevoerd. Er wordt
nooit een `restaurant_id` uit de invoer doorgegeven zonder die controle. Zo kan een agent
niet bij een restaurant boeken waar de ingelogde medewerker geen lid van is.

## Centrale correctie: grote groepen bij wijziging (punt 4)

Dit hoort in de motor, niet in een tool:

- Nieuwe gedeelde helper `supabase/functions/_shared/large-group.ts` met één functie die
  uit de restaurantinstellingen en het aantal personen afleidt: `requires_manual_approval`,
  `large_group_status` en of de status naar `pending` moet.
- `book_reservation` gaat die helper gebruiken in plaats van de huidige inline-logica
  (zelfde uitkomst, één bron).
- `manage_reservation` roept dezelfde helper aan in het wijzigingspad zodra het aantal
  personen verandert. Wordt een reservering daarmee een grote groep die goedkeuring
  vereist, dan gaat de status terug naar `pending`, komt hij in de
  grote-groepenwerkbak en wordt de bestaande gebeurtenis/mailroute gevolgd. Wordt hij
  weer klein en was er nog geen goedkeuring gegeven, dan vervalt de goedkeuringsvlag.
- De harde bovengrens voor gastgerichte kanalen wordt in het wijzigingspad net zo
  toegepast als bij aanmaken.

Hiermee volgen aanmaken en wijzigen dezelfde regels, ongeacht of het uit de app, de
widget, de Voice Agent of MCP komt.

## Idempotency (punt 7)

- Nieuw, optioneel veld `idempotency_key` op reserveringen, uniek per restaurant.
- Afdwingen in `book_reservation` (de centrale plek): is de sleutel al gebruikt, dan
  wordt de bestaande reservering teruggegeven met hetzelfde `reservation_id` en een
  markering `duplicate: true` — er wordt niets nieuws aangemaakt en er gaan geen extra
  mails of gebeurtenissen uit.
- De MCP-tool `create_reservation` accepteert `idempotency_key` en geeft die door; als de
  agent er geen meestuurt, wordt er niets afgedwongen (widget blijft ongewijzigd).

## Tafelkeuze (punt 8)

`create_reservation` en `update_reservation` bieden standaard géén tafelkeuze; TableWise
past zelf de bestaande vul-strategie, zones, pacing en combinaties toe. Alleen een
gebruiker met `override_tables` (manager/eigenaar) mag tafels of een combinatie
meegeven; bij een lagere rol geeft de tool een nette weigering terug.

## Definitieve MCP-toolset

Bestaand (blijven, ongewijzigd): `list_restaurants`, `list_reservations`,
`get_reservation`, `search_guests`, `list_waitlist`, `add_reservation_note`.

Nieuw:

| Tool | Aard | Motor | Wie mag het | Belangrijkste invoer | Uitvoer / foutmeldingen |
|---|---|---|---|---|---|
| `check_availability` | lezen | `availability` | iedereen met toegang | date, party_size, restaurant_id | vrije tijden, combinatie-indicatie, druktewaarschuwing; `large_group` bij te grote groep |
| `find_reservation` | lezen | directe zoekopdracht op de reserveringen van het restaurant | iedereen met toegang | confirmation_code, telefoon, e-mail, naam, datum, tijd | max 5 treffers met id, datum, tijd, personen, status; leeg = niets gevonden, meerdere = vraag om verduidelijking |
| `create_reservation` | schrijven | `book_reservation` | book | date, time, party_size, gast (naam, telefoon/e-mail), wensen, idempotency_key | reservation_id, status, bevestigingscode, `requires_manual_approval`, `large_group_status`; fouten: geen tafel, te druk, te laat, buiten horizon, grote groep vereist aanvraag, bericht verplicht |
| `update_reservation` | schrijven | `manage_reservation` (update) | manage | reservation_id, nieuwe datum/tijd/personen, wensen | nieuwe status inclusief eventuele nieuwe goedkeuringsplicht; fouten: definitieve status, geen tafel, te druk |
| `cancel_reservation` | ingrijpend | `manage_reservation` (cancel) | manage | reservation_id, reden (verplicht), confirmed | bevestiging van annulering |
| `set_reservation_status` | ingrijpend | `manage_reservation` | manage | reservation_id, nieuwe status | fout bij niet-toegestane statusovergang |
| `resolve_large_group` | ingrijpend | `manage_reservation` (goedkeuren/afwijzen) | approve (manager/eigenaar) | reservation_id, besluit, reden, confirmed | bevestiging + bestaande mail-/gebeurtenisroute |
| `add_waitlist_entry` | schrijven | bestaande wachtlijstservice | book | date, tijdvenster, personen, contact | wachtlijst-id en status |

Later (bewust niet nu): deposit-tools blijven beperkt tot lezen van de huidige status;
zelf zetten pas als er een echte betaalflow is. Herbevestigingstools volgen daarna.

## Testplan (end-to-end, gast-agent → motor → database → antwoord)

1. Gewone reservering: beschikbaarheid checken, boeken, status `confirmed`, tafel
   gekoppeld, bevestigingsmail verstuurd.
2. Grote groep boven de goedkeuringsdrempel: status `pending`,
   `large_group_status = awaiting_approval`, zichtbaar in de grote-groepenwerkbak, agent
   meldt "aanvraag ontvangen", niet "bevestigd".
3. Wijziging klein → groot: reservering van 4 naar 14; verwacht opnieuw `pending` en
   goedkeuringsplicht (dit is het gedrag dat de motorcorrectie oplevert).
4. Wijziging groot → klein vóór goedkeuring: goedkeuringsplicht vervalt.
5. Annuleren: zonder reden of zonder bevestiging wordt geweigerd; met beide verdwijnt de
   reservering uit alle overzichten.
6. Geen beschikbaarheid: agent krijgt "geen tafel" terug en zet de gast op de wachtlijst.
7. Timeout/retry: tweemaal boeken met dezelfde idempotency-sleutel geeft één reservering
   en hetzelfde id.
8. Verkeerd restaurant: boeken/wijzigen bij een restaurant zonder lidmaatschap wordt
   geweigerd met een duidelijke fout.
9. Rolcontrole: een gebruiker zonder managerrol krijgt `resolve_large_group` en een
   tafeloverride geweigerd.

## Scope

Geen wijzigingen aan schermen, ontwerp, de publieke widget of de bestaande gast-agent
API-contracten. De enige aanpassingen buiten de MCP-map zijn de gedeelde
grote-groephelper (`book_reservation` + `manage_reservation`) en het idempotency-veld,
omdat MCP anders niet dezelfde regels volgt als de app.

## Technische bestandenlijst

- Nieuw: `supabase/functions/_shared/large-group.ts`; databaseveld `idempotency_key` op
  reserveringen met unieke index per restaurant.
- Aangepast: `supabase/functions/book_reservation/index.ts` (helper + idempotency),
  `supabase/functions/manage_reservation/index.ts` (helper in het wijzigingspad).
- Nieuw in `src/lib/mcp/tools/`: `check-availability.ts`, `find-reservation.ts`,
  `create-reservation.ts`, `update-reservation.ts`, `cancel-reservation.ts`,
  `set-reservation-status.ts`, `resolve-large-group.ts`, `add-waitlist-entry.ts`.
- Aangepast: `src/lib/mcp/supabase.ts` (`requireCapability`, helper om de bestaande
  functies aan te roepen met het geverifieerde token) en `src/lib/mcp/index.ts`
  (registratie + instructies).
- Afsluitend: manifest opnieuw uitlezen en de MCP-functie uitrollen; actief bij de
  eerstvolgende publicatie.
