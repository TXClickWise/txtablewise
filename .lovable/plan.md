## Wat ik in de screenshot zie

- De voice agent roept tool **`Book Reservation`** aan (de oude tool), niet `reservation_request`.
- Output bevat alleen ruwe velden + `execution_message: "Ik zet je reservering in ons systeem."` en `synthetic: true`.
- Daarna zegt de agent gewoon "Perfect, ik …" — geen "Let op, dit is nog geen definitieve reservering."

## Oorzaak

Twee onafhankelijke problemen werken tegen elkaar:

1. In `agent_api` heeft de `book_reservation`-branch (regels 323-353) géén logica voor `message_for_guest` / `next_action` / `requires_manual_approval` afhandeling. Het stuurt de raw `book_reservation`-respons terug. De LLM heeft dus geen letterlijk voor te lezen zin en parafraseert vrolijk "geboekt".
2. In de admin-setup staat de tool `book_reservation` óók nog als beschikbare action. Onze "reservation_request" is bedoeld als enige boekings-tool, maar bij dit account is de oude `book_reservation`-tool nog aangesloten. Daarom gebruikt de agent die.

## Plan

### A. `agent_api` `book_reservation`-branch gelijktrekken met `reservation_request`
Zelfde response-vorm leveren zodat ook deze oude tool veilig is:
- `message_for_guest` zetten op exact dezelfde Nederlandse copy als bij `reservation_request`.
- `next_action` zetten (`confirm_booking` / `confirm_pending_approval` / `offer_alternatives_or_waitlist` / `promise_callback` / `apologize_and_callback`).
- `status_label` toevoegen: `"voorlopig"` als `requires_manual_approval=true`, anders `"definitief"`.
- Bij `error_code` "no_table_available", "pacing_limit_reached", "message_required" hetzelfde 200-met-gastvrije-copy-pad als `reservation_request`.

### B. `message_for_guest` voor "pending approval" harder maken
In beide branches (`reservation_request` en `book_reservation`):
- Tekst begint met: **"Let op — dit is nog geen definitieve reservering."** gevolgd door de bestaande "Ik leg uw aanvraag voor aan een collega…"-zin.
- Zo kan zelfs een parafraserende LLM moeilijk "geboekt" zeggen zonder eerst "nog geen definitieve" voor te lezen.

### C. Admin voice setup-pagina (`AdminClickWiseVoiceSetupPage.tsx`)
- `reservation_request` blijven aanbevelen als enige boekings-tool.
- `book_reservation` markeren als **DEPRECATED** met een rode banner: "Verwijder deze tool uit de voice agent. Gebruik alleen `reservation_request`."
- In de system-prompt template een harde regel toevoegen:
  > Gebruik UITSLUITEND `reservation_request` voor boekingen. De tool `book_reservation` is verouderd — als die nog in je agent staat, verwijder hem.
- Aan case b (requires_manual_approval=true) een verbod toevoegen:
  > Zeg NOOIT "geboekt", "bevestigd", "gelukt" of "rond". Zeg LETTERLIJK `response.message_for_guest`. Geen eigen parafrase.

### D. `VoiceAgentHelp.tsx`
- Zelfde deprecation-melding voor `book_reservation`.
- Voorbeeld van fout vs goed antwoord voor grote-groep-scenario.

### E. UI consistency (klein)
- `StatusBadge`: pending reserveringen met `requires_manual_approval=true` labelen als **"Voorlopig"** in plaats van "Verwacht", zodat operator en voice agent dezelfde taal spreken.
- `LargeGroupsPage` "Wacht op goedkeuring"-sectie: 1 regeltje "De gast heeft te horen gekregen dat het nog beoordeeld wordt — bel alleen terug bij wijziging."

## Wat ik NIET aanpas

- `book_reservation` edge function zelf. Werkt correct.
- `manage_reservation` approve_large_group. Werkt correct.
- Drempels (`large_group_threshold`, `manual_approval_from`, etc.). Werken correct.

## Bestanden

- `supabase/functions/agent_api/index.ts` — `book_reservation`-case uitbreiden, `message_for_guest` text in beide cases aanscherpen, `status_label` veld toevoegen.
- `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` — deprecation-banner + prompt-regels.
- `src/pages/app/help/VoiceAgentHelp.tsx` — deprecation-banner + voorbeeld.
- `src/components/StatusBadge.tsx` — variant "voorlopig" toevoegen (nieuwe prop of conditionele tekst).
- `src/pages/app/LargeGroupsPage.tsx` — kort uitleg-regeltje.

Geen DB-migratie, geen secrets, geen wijzigingen aan `book_reservation` of `manage_reservation`.

## Test na implementatie

1. **Bij voorkeur**: oude `book_reservation`-tool in de voice agent verwijderen (alleen `reservation_request` aanzetten).
2. Test bel 12+ personen → agent moet letterlijk zeggen: "Let op — dit is nog geen definitieve reservering. Ik leg uw aanvraag voor 12 personen voor aan een collega…"
3. In Grote-groepen-pagina staat reservering met badge "Voorlopig".
4. **Fallback test**: als oude `book_reservation`-tool nog actief is, agent moet zich ook dán correct gedragen (dankzij fix A).
