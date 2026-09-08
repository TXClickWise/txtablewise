# Reserveren, wijzigen en annuleren via de agent-koppeling

Doel: een AI-assistent (ChatGPT, Claude) kan straks ook reserveringen aanmaken, wijzigen en annuleren — zonder dat er iets aan de werking of opbouw van de app verandert.

## Hoe dit veilig kan zonder iets te veranderen

De app heeft al twee "motoren" die precies dit werk doen wanneer een medewerker in het scherm klikt: één voor het maken van een reservering en één voor wijzigen/annuleren/statuswissel. Daar zitten alle regels in: beschikbaarheid, tafelcombinaties, grote groepen, pacing, bevestigingsmails en de logboeken.

De nieuwe agent-acties roepen exact diezelfde motoren aan, met de inlog van de medewerker die gekoppeld heeft. Dus:
- geen nieuwe reserveringsregels, geen tweede route langs de bestaande logica
- dezelfde rechten en restaurantafscherming als in de app
- bevestigings- en annuleringsmails en meldingen blijven vanzelf werken

## Nieuwe acties (5)

1. Beschikbaarheid checken — vrije tijden voor een datum en aantal personen.
2. Reservering maken — datum, tijd, aantal personen, naam, telefoon/e-mail, opmerking. Kanaal wordt vast op een agent-kanaal gezet, nooit door de assistent te kiezen.
3. Reservering wijzigen — datum, tijd, aantal personen, opmerkingen; tafel wordt door de motor opnieuw bepaald.
4. Reservering annuleren — met verplichte reden.
5. Status bijwerken — aan tafel, vertrokken, no-show, bevestigd.

Wijzigen, annuleren en status krijgen de markering "wijzigt gegevens", zodat assistenten die dat ondersteunen eerst om bevestiging vragen. Annuleren wordt als ingrijpend gemarkeerd.

## Wat er niet gebeurt

- Geen wijziging aan bestaande schermen, routes, database of e-mails.
- Geen nieuwe tabellen of instellingen.
- Geen omzeiling van grote-groep-goedkeuring: die blijft de normale route volgen.

## Technisch

- Nieuwe bestanden onder `src/lib/mcp/tools/`: `check-availability.ts`, `create-reservation.ts`, `update-reservation.ts`, `cancel-reservation.ts`, `set-reservation-status.ts`; registratie in `src/lib/mcp/index.ts` (tools-array + korte aanvulling op `instructions`).
- Kleine helper in `src/lib/mcp/supabase.ts` die de edge functions `availability`, `book_reservation` en `manage_reservation` aanroept via `fetch` met `Authorization: Bearer <verified token>` en de publishable key als `apikey`. Alternatief `sb.functions.invoke` — dezelfde client stuurt de token al mee.
- `manage_reservation` doet zelf `auth.getUser()` op de meegestuurde token en checkt lidmaatschap; `book_reservation` blijft ongewijzigd, `source_channel` wordt server-onafhankelijk in de payload op een vaste waarde gezet.
- Foutmeldingen van de motoren (`reason_code`, bv. `no_table_available`, `pacing_limit_reached`) worden als `isError` teruggegeven zodat de assistent het netjes kan uitleggen.
- Na de wijziging: manifest opnieuw uitlezen en de `mcp` function opnieuw deployen.
