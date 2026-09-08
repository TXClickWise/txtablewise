# Reserveren via de agent-koppeling (MCP)

Doel: via een AI-assistent precies hetzelfde kunnen als een medewerker in de app —
beschikbaarheid checken, reserveren, wijzigen, annuleren — inclusief grote groepen,
aanbetalingen, tafelcombinaties en goedkeuringen.

## Uitgangspunt

De agent krijgt geen eigen reserveringslogica. Elke actie roept exact dezelfde motoren
aan die de app zelf gebruikt (`availability`, `book_reservation`, `manage_reservation`),
met de inlog van de medewerker die de koppeling heeft gemaakt. Daardoor gelden
automatisch dezelfde regels: openingstijden, sluitingen, zone-vulstrategie,
tafelcombinaties, grote-groepdrempel met goedkeuring, aanbetalingsregels,
bevestigingsmails en de gebeurtenissen richting ClickWise.

## Nieuwe acties (7)

1. **Beschikbaarheid checken** — datum, aantal personen, optioneel tijdvenster en
   terrasvoorkeur. Geeft vrije tijden terug, inclusief voorstellen met gecombineerde
   tafels voor grote gezelschappen, en meldt of goedkeuring of aanbetaling nodig is.
2. **Reservering maken** — naam, contactgegevens, datum, tijd, aantal personen,
   wensen/allergieën, gelegenheid. Kan een voorgestelde tafel of tafelcombinatie
   meekrijgen. Grote groepen komen net als in de app in de goedkeuringsstroom terecht
   in plaats van direct bevestigd te worden; dat wordt duidelijk teruggemeld.
3. **Reservering wijzigen** — tijd, datum, aantal personen, wensen, en desgewenst
   andere tafel(s) of combinatie. Bestaande tafelkoppelingen blijven behouden als er
   geen nieuwe worden meegegeven.
4. **Reservering annuleren** — met verplichte reden; verdwijnt daarna net als in de app
   uit alle overzichten en agenda's.
5. **Status bijwerken** — bevestigd, gezeten, afgerond, no-show.
6. **Grote groep afhandelen** — een aanvraag goedkeuren of afwijzen, zodat de agent de
   hele grote-groepsstroom kan afmaken (zelfde mail- en eventroutes als in de app).
7. **Wachtlijst-inschrijving toevoegen** — als er niets vrij is, kan de agent de gast op
   de wachtlijst zetten in plaats van "nee" te verkopen.

Naast de zes bestaande lees-acties (restaurants, reserveringen van een dag, één
reservering, gasten zoeken, wachtlijst bekijken, notitie toevoegen) komt het totaal
daarmee op dertien.

## Veiligheid

- Acties die iets veranderen (maken, wijzigen, annuleren, status, goedkeuring) worden
  gemarkeerd als ingrijpend, zodat de assistent bevestiging vraagt voordat hij ze uitvoert.
- Alles loopt op het account van de ingelogde medewerker; toegangsrechten per restaurant
  blijven exact zoals ze nu zijn.

## Technisch

- Nieuwe bestanden onder `src/lib/mcp/tools/`: `check-availability.ts`,
  `create-reservation.ts`, `update-reservation.ts`, `cancel-reservation.ts`,
  `set-reservation-status.ts`, `resolve-large-group.ts`, `add-waitlist-entry.ts`;
  registratie in `src/lib/mcp/index.ts`.
- Helper in `src/lib/mcp/supabase.ts` die de bestaande edge functions aanroept via
  `fetch` met `Authorization: Bearer <geverifieerd token>` en de publishable key als
  `apikey`. `manage_reservation`/`book_reservation` blijven zelf de gebruiker verifiëren.
- Grote groepen: geen eigen drempellogica in de tools; de drempel- en
  goedkeuringsafhandeling van `book_reservation` blijft leidend. Het antwoord bevat
  `requires_manual_approval` / `large_group_status` zodat de assistent dit kan uitleggen.
- Foutcodes uit de motoren worden als `isError` met de originele melding teruggegeven,
  niet stilzwijgend opgevangen.
- Geen wijzigingen aan bestaande app-schermen, routes, database of edge functions.
- Na de wijzigingen: manifest opnieuw uitlezen en de `mcp`-function deployen (wordt
  actief bij de eerstvolgende publicatie).
