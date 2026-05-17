## Wat ik in de logs zie

Ik heb de laatste calls van vandaag uitgepluisd. Drie concrete dingen gaan mis:

1. **Geen naam gevraagd → fallback "Gast"**
   - Call van 10:48 (16 personen, 19 mei) is opgeslagen met `first_name = "Gast"`. De voice agent vulde dat zelf in omdat hij niet om de naam vroeg. Onze `agent_api` accepteert elke niet-lege string als first_name, dus "Gast" / "Klant" / "Unknown" glipt erdoorheen.
   - Resultaat: reservering aangemaakt zonder echte naam, en pas toen jij er zelf om vroeg vulde de agent het alsnog aan (10:48:43 update).

2. **Drempel "handmatige goedkeuring" staat te hoog**
   - Restaurant heeft `max_party_size_online = 10`, maar `large_group_max_online_request = 18`. Onze code gebruikt nu de hoogste van die twee als grens. Dus 11–17 personen wordt automatisch bevestigd terwijl jij verwacht dat alles boven 10 een handmatige goedkeuring nodig heeft. Dit verklaart de 15-persoons reservering om 09:55 die "approved" werd.
   - 16-persoons reservering van 10:48 ging wél naar `awaiting_approval` omdat hij boven 18 zou moeten zitten? Nee — die ging naar pending omdat `large_group_threshold = 8` en aparte flow. De logica is inconsistent tussen drempels.

3. **Agent zegt "reservering is gemaakt" bij pending**
   - Onze `reservation_request` response geeft expliciet `"Let op — dit is nog geen definitieve reservering ..."` terug als `message_for_guest`. De ClickWise voice-prompt parafraseert dit en laat dat "nog geen definitieve" deel weg.

## Plan

### 1. Naam echt verplicht maken (agent_api)
- In `agent_api` bij `reservation_request` en `book_reservation`: reject lege of placeholder-namen (`gast`, `klant`, `unknown`, `anoniem`, `guest`, `customer`, `n.v.t.`, `-`, alleen 1 letter). Error code `missing_field` met `field: "guest.first_name"`, zodat de agent gedwongen wordt opnieuw te vragen.
- Achternaam niet verplicht maken (voor telefonische context), maar wel doorvragen via prompt.
- Idem voor `check_availability` — geen wijziging nodig; daar hoeft geen naam.

### 2. Drempel handmatige goedkeuring uniform op `max_party_size_online`
- In `agent_api` (en `book_reservation` waar nodig) `onlineHardCap` wijzigen naar: `max_party_size_online` als die gezet is, anders fallback naar `large_group_max_online_request`, anders 18.
- Concreet effect: alles boven `max_party_size_online = 10` (dus 11+) krijgt `requires_manual_approval = true` en `large_group_status = awaiting_approval`. Geen automatische bevestiging meer voor groepen > online cap.

### 3. Response harder maken zodat agent niet "geboekt" kan zeggen
- Bij pending/awaiting_approval response: `status` veld toevoegen (`"awaiting_approval"`), `confirmed: false`, en `message_for_guest` herschrijven naar één korte zin die de agent niet kán wegparafraseren: *"Ik heb uw aanvraag voor {date} om {time} voor {n} personen genoteerd. Een collega bevestigt dit zo snel mogelijk per telefoon of WhatsApp."*
- Voice-prompt in ClickWise setup-pagina (`AdminClickWiseVoiceSetupPage` en `VoiceAgentHelp`) bijwerken: harde regel toevoegen "Lees ALTIJD letterlijk de `message_for_guest` voor. Zeg NOOIT 'reservering bevestigd' tenzij `confirmed: true`."
- Voice-prompt: harde regel "Vraag ALTIJD eerst de voornaam (en zo mogelijk achternaam) voordat je een reservering aanmaakt. Vul NOOIT zelf 'Gast' of 'Klant' in."

### 4. Logging & alert
- In `agent_api`: bij geweigerde placeholder-naam log met action `reservation_request` en `error_code: "placeholder_name_blocked"` zodat we in `IntegrationLogsPage` precies kunnen zien hoe vaak de agent dit nog probeert.

### 5. Quick scan rest van app
- Voor de tweede vraag ("zelf auto-debuggen"): ik draai daarna de Supabase linter + database security scan en bekijk de recente fail/warning-logs in `integration_logs` van de afgelopen 7 dagen om andere issues te vinden (webhook-fouten, 5xx in book_reservation, etc.). Per gevonden issue korte beslissing: nu fixen of apart melden. Ik raak alleen écht foute dingen aan, geen refactors zonder reden.

## Wat ik bewust NIET doe
- Geen wijzigingen aan ClickWise CAP action-headers (die fix van vorige ronde laat ik staan).
- Geen wijziging aan de algemene tafel-logica of pacing.
- Geen wijziging aan businessregels die niet aantoonbaar fout zijn.

## Acceptatiecheck
- Bel-test 16 personen op datum X → agent vraagt naam → response geeft `awaiting_approval` + duidelijke "nog niet bevestigd" zin → reservering staat in `Grote groepen` lijst, niet automatisch bevestigd.
- Bel-test 6 personen → normaal proces, naam wordt gevraagd, response `confirmed: true`.
- Integration logs: geen `first_name = "Gast"` entries meer voor nieuwe calls.
