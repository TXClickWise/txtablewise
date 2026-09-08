# Jennifer (Voice AI) — minimale, veilige fixronde

Doel: Jennifer volgt de vastgelegde gastregels, en TableWise geeft haar geen informatie of velden die die regels doorbreken. Zo min mogelijk code, bestaande reserveringsmotor blijft leidend.

## Eerst verifiëren in HighLevel (vóór enige codewijziging)

1. **Caller ID doorgeven.** Kan de Voice AI-agent in HighLevel een variabele uit de callcontext (het nummer waarmee de gast belt) automatisch als tool-parameter meesturen, zonder dat Jennifer het nummer uitspreekt of uitvraagt? Bevestig de exacte variabelenaam en of die ook in Managed Agents/Workflows beschikbaar is.
2. **E-mail.** Kwam de niet-lege e-mail bij de 18-persoonsboeking uit de HighLevel-contactcontext of uit Jennifers eigen prompt? Controleer het transcript van die call.
3. **Party size 5 vs 4.** Bekijk het calltranscript naast de tool-call van diezelfde call om vast te stellen of de gast 4 of 5 zei. Backendlog alleen zegt wat de agent stuurde, niet wat de gast vroeg.
4. **Bewaartermijn/toegang transcripts** — is er een vaste plek waar we per call transcript + tool-calls kunnen terugzien? Dat is nodig voor toekomstige verificatie.

Punten 1 en 2 bepalen of we het toolcontract mogen aanscherpen (phone verplicht laten, e-mail weglaten). Zonder uitsluitsel op 1 niets aan `phone` veranderen.

## Wijzigingen per laag

### A. Prompt-only (HighLevel, geen code)

- Gespreksregels vastleggen: nooit e-mail vragen; nummer nooit laten dicteren; alleen vragen of het nummer waarmee gebeld wordt gebruikt mag worden; één vraag per beurt (naam → aantal → dag en tijd); al gegeven info alleen kort bevestigen; nooit laten spellen tenzij onverstaanbaar.
- Nooit een bevestigings-/reserveringscode noemen, vragen of voorlezen.
- Terugzoekvolgorde: caller ID → datum+tijd → voor-/achternaam.
- Grote groepen: bij `requires_manual_approval: true` of `large_group_status: awaiting_approval` de reservering als *aanvraag in behandeling* presenteren, nooit als bevestigd. Beslissing komt uit TableWise, Jennifer verzint geen drempels.
- Bij een blokkerende foutcode: gastvriendelijk terugvallen op "ik zet het als aanvraag/terugbelverzoek", niet doorvragen op technische velden.

### B. MCP-toolcontract (`supabase/functions/mcp_key/index.ts`)

Alleen het contract dat aan deze voice-route wordt aangeboden; agent_api en app blijven ongewijzigd.

1. `find_reservation`: `confirmation_code` uit het inputschema halen voor deze route, en de beschrijving herschrijven naar de volgorde telefoon → datum+tijd → naam. Wat de agent niet aangeboden krijgt, kan ze niet uitvragen.
2. Uitgaande tool-responses op deze route filteren: `confirmation_code` verwijderen uit alles wat naar de agent teruggaat. Interne opslag, e-mails, widget en app blijven de code gewoon gebruiken — alleen deze gateway strippt het veld.
3. `create_reservation`: `email` niet als parameter aanbieden (agent_api vult zelf al een placeholder als er geen e-mail is). `phone` blijft verplicht; beschrijving wordt "nummer uit de callcontext, niet uitvragen".
4. Beschrijvingen van de grote-groepvelden verduidelijken zodat `requires_manual_approval` en `large_group_status` ondubbelzinnig zijn.

### C. agent_api / backend (minimaal)

1. **Grote-groep-inconsistentie oplossen.** `check_availability` zegt bij 18 personen `large_group: false` / `next_action: book_now`, terwijl `create_reservation` daarna `requires_manual_approval: true` geeft. Oorzaak: availability gebruikt andere drempelvelden dan de centrale grote-groepevaluatie bij boeken. Fix: availability laat de grote-groep-uitkomst door dezelfde centrale evaluatie bepalen als het boekpad (o.a. `large_group_threshold`, `manual_approval_from_party_size`, `extra_large_group_threshold`, online caps), en geeft dan `large_group: true` met `next_action: request_large_group` in plaats van `book_now`. Geen nieuwe regels, alleen één bron van waarheid.
2. Verder geen backendwijzigingen. `seated → confirmed` UX blijft in de bestaande UI/UX-backlog.

### D. HighLevel-configuratie

- Caller-ID-variabele als vaste parameter aan `create_reservation` en `find_reservation` koppelen (afhankelijk van verificatiepunt 1).
- Contact-e-mail niet als tool-parameter mappen.

## Verificatie na implementatie

- `check_availability` en `create_reservation` voor 18 personen op Eigeweis geven nu hetzelfde grote-groepoordeel.
- Boeking van 5 personen blijft normaal bevestigd.
- `find_reservation` levert geen `confirmation_code` meer terug en accepteert die ook niet.
- Testcall: nummer nooit uitgesproken, e-mail nooit gevraagd, terugzoeken lukt op caller ID, wijzigen slaagt tot en met `update_reservation`.

## Buiten scope

Geen UI-redesign, geen nieuwe betaal-/depositflow, geen wijziging aan app, widget of bestaande OAuth-MCP-route.
