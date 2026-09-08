# MCP-koppeling met sleutel + vraag over aanmelden zonder bevestiging

## Deel 1 — Waarom de ClickWise-koppeling faalt

Het "Add MCP"-venster van ClickWise kan alleen een adres, een tijdslimiet en vaste headers meesturen. De huidige TableWise-koppeling vereist een echte inlogronde in de browser (met toestemmingsscherm). Die twee passen niet op elkaar; vandaar "Error adding MCP server".

## Deel 1 — Oplossing: tweede ingang met sleutel

Ik bouw een extra ingang die werkt met alleen een adres plus één vaste sleutel-header, zonder browserinlog. De bestaande koppeling met inlog blijft ongewijzigd bestaan.

Werking:
- Nieuw adres: `.../functions/v1/mcp_key`.
- ClickWise stuurt één header mee met de sleutel van dit restaurant.
- De sleutel wordt versleuteld opgeslagen en gecontroleerd tegen de bestaande sleuteltabel die de app al gebruikt voor agent-toegang; de sleutel is hard gekoppeld aan Eigeweis.
- De ingang spreekt dezelfde taal als een MCP-server (aanmelden, toolslijst opvragen, tool uitvoeren), zodat ClickWise Jennifer's tools automatisch ziet.
- Achter de schermen loopt elke actie via exact dezelfde reserveringsmotor en dezelfde regels als in de app: beschikbaarheid, openingstijden, pacing, grote groepen, tafelcombinaties, statussen en wachtlijst. Er komt geen tweede reserveringslogica.
- Rechten blijven beperkt tot wat Jennifer mag: beschikbaarheid bekijken, reservering opzoeken, maken, wijzigen, annuleren en op de wachtlijst zetten. Geen tafeltoewijzing forceren, geen goedkeuren van grote groepen, geen statusbeheer of interne notities.
- Alles is strikt gebonden aan Eigeweis; een aanvraag voor een ander restaurant wordt geweigerd.

Sleutel: ik genereer die veilig en toon hem één keer zodat je hem in ClickWise kunt plakken; hij wordt niet leesbaar opgeslagen.

Daarna testen: aanmelden, toolslijst, beschikbaarheid opvragen, reservering maken, wijzigen en annuleren, plus een test met een foute sleutel en met een verkeerd restaurant.

## Deel 2 — Inloggen zonder bevestiging

Beide bestaande accounts zijn in april aangemaakt en waren op dat moment al als bevestigd gemarkeerd; daarom kun je gewoon inloggen zonder mailbevestiging. Dat is verwacht gedrag voor bestaande accounts.

Wat ik nog niet kan uitlezen: of "e-mailadres automatisch bevestigen" nu nog aanstaat voor nieuwe aanmeldingen. Daarom:

1. De aanmeldinstellingen expliciet op de gewenste stand zetten: automatisch bevestigen uit, controle op gelekte wachtwoorden aan, anonieme aanmeldingen uit, aanmelden blijft open.
2. Testen met een vers testadres: geen toegang vóór bevestiging, bevestigingsmail komt aan, inloggen zonder bevestiging wordt geweigerd.
3. Testaccount opruimen.

## Technisch

- Nieuwe edge function `mcp_key`: MCP Streamable HTTP JSON-RPC (`initialize`, `tools/list`, `tools/call`), header-auth via sha-256 hash tegen `agent_api_keys` (bestaande tabel, scopes bepalen toegestane tools), tenant vast op `restaurant_id` van de sleutelrij.
- Toolset spiegelt de guest_voice-tools: `check_availability`, `find_reservation`, `create_reservation`, `update_reservation`, `cancel_reservation`, `add_waitlist_entry`.
- Handlers roepen de bestaande engines aan (`availability`, `book_reservation`, `manage_reservation`, waitlist-pad), inclusief `idempotency_key` bij create; foutcodes van de engines worden ongewijzigd doorgegeven als MCP-toolfout.
- Geen wijziging aan de bestaande `mcp`-function, `defineMcp`-OAuth-opzet of MCP-tools in `src/lib/mcp/`.
- `supabase--configure_auth` met `auto_confirm_email: false`, `password_hibp_enabled: true`, `external_anonymous_users_enabled: false`, `disable_signup: false`.
- Geen UI-redesign; hooguit een klein leesveld met het koppeladres als je dat wilt (niet in scope tenzij gevraagd).
