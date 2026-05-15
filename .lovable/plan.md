## Doel

Eén help-pagina (`src/pages/app/help/VoiceAgentHelp.tsx`) is in gebruik. Die loopt op meerdere punten achter op de huidige Voice Agent-pagina, het `agent_api` endpoint en de ClickWise snapshot-aanpak. Doel: alle informatie 100% correct + alle "wat moet ik doen" als duidelijke stap-voor-stap voor een niet-technisch persoon.

Geen andere help-bestanden gevonden (`docs/PUBLIC_API.md` is een API-referentie voor ontwikkelaars, geen eindgebruiker-help — laten staan zoals het is).

## Bevindingen (wat klopt niet meer)

1. **Tab-namen** kloppen niet met `VoiceAgentPage.tsx`:
   - Help noemt: "Configuratie" en "API-sleutels".
   - In de app heten ze nu: **Status & test**, **API-koppeling**, **Configuratie**, **Hoe koppelen**.
2. **Provider-naam**: help noemt "ClickWise Voice Agent", de selector toont **"ClickWise Voice AI"**.
3. **Sleutel genereren** (sectie 2): help laat de gebruiker zelf een sleutel aanmaken via een knop "Genereer". In de huidige UI is dat verwijderd — wanneer er nog geen sleutel is staat er: *"Neem contact op met TableWise support om een sleutel voor jouw restaurant te laten aanmaken."* De flow voor de eindgebruiker is dus: support / system admin maakt de sleutel, eindgebruiker kopieert hem.
4. **Endpoints**: alleen `check_availability`, `book_reservation`, `cancel_reservation`, `log_call` worden beschreven. `agent_api` ondersteunt óók: `find_reservation`, `update_reservation`, `create_waitlist_entry`, `get_opening_hours`, `reconfirm_reservation`. Deze moeten minstens als optionele uitbreiding genoemd worden.
5. **PROJECT_REF** is hardcoded bovenin het bestand. Beter consistent maken met `VoiceAgentPage` (env `VITE_SUPABASE_PROJECT_ID`).
6. **ClickWise snapshot-aanpak** (zie memory `clickwise-snapshot`): in productie is er een master sub-account met placeholders via `{{custom_values.*}}`. Per nieuwe klant zijn er ~6 handmatige stappen (custom values invullen). De help beschrijft alleen de "vanaf nul"-flow. Toevoegen: expliciete sectie "Snel klant onboarden vanaf master snapshot" met die 6 stappen.
7. **Pilot Launch koppeling ontbreekt**: voordat je live gaat moet de pilot-readiness check groen zijn. Verwijzen naar `/app/instellingen/pilot-launch`.
8. **Party-size grens**: prompt zegt 1–8. Klopt voor de telefoon-agent (groter wordt via large-group-aanvraag afgehandeld), maar onduidelijk dat die grens overeenkomt met `tw_max_party_online`. Kort verduidelijken zodat een klant snapt wat er gebeurt bij 9+ personen.
9. **Sandbox → Live overgang**: voeg een korte "Live-zetten" stap-voor-stap toe (incl. waar het in TableWise zit + readiness-check + verwachte ClickWise-effecten).

## Wijzigingen in `src/pages/app/help/VoiceAgentHelp.tsx`

A. **Bovenaan**
- Vervang `PROJECT_REF` constante door dynamische lezing van `VITE_SUPABASE_PROJECT_ID` (zelfde patroon als `VoiceAgentPage`). Fallback houden voor printweergave.
- Korte intro herschrijven: één alinea die uitlegt wie wat doet (TableWise = backend, ClickWise = belplatform, jij = invullen + testen).

B. **Sectie 1 — Vaste TableWise-waarden**: ongewijzigd, alleen base-URL via env.

C. **Sectie 2 — Stappen in TableWise (herschreven)**:
- Verwijder "Genereer-sleutel" stappen.
- Nieuwe stap-voor-stap (genummerd, één handeling per regel, zonder jargon):
  1. Open in de zijbalk **AI Voice Agent**.
  2. Tab **Status & test** — controleer of "API-sleutel" op ✅ Actief staat. Zo niet → vraag TableWise support om een sleutel.
  3. Tab **API-koppeling** — kopieer de **Base URL** en de **API-sleutel** (knop "Kopieer"). Plak ze tijdelijk in een kladblok.
  4. Tab **Configuratie** — Provider = **ClickWise Voice AI**, Modus = **Sandbox**, vul telefoonnummer in, klik **Opslaan**.
  5. Klaar — verder in ClickWise.

D. **Nieuwe sectie 2b — "Snel onboarden vanuit master snapshot"** (collapsible/toelichting):
- Wanneer ClickWise al een master sub-account met TableWise-snapshot heeft. 6 stappen:
  1. Maak nieuwe sub-account vanuit master snapshot.
  2. Custom Values → `tw_agent_api_key` plak nieuwe sleutel.
  3. `tw_restaurant_name` invullen.
  4. `tw_agent_api_url` controleren (blijft gelijk).
  5. Telefoonnummer koppelen aan de Voice Agent (sectie 6).
  6. Test-call zoals in sectie 10.
- Als dit niet van toepassing is → lees secties 3–9 voor de volledige opzet.

E. **Sectie 3 — Custom Fields**: ongewijzigd (klopt nog).

F. **Sectie 4 — Custom Values**: ongewijzigd (klopt nog).

G. **Sectie 5 — Voice Agent aanmaken**: ongewijzigd qua structuur; provider-naamcorrectie waar nodig.

H. **Sectie 6 — Telefoonnummer**: ongewijzigd.

I. **Sectie 7 — Inbound Webhook Workflow**: ongewijzigd.

J. **Sectie 8 — System Prompt**: kleine clarifier toevoegen: "1–8 personen" hoort bij `tw_max_party_online`; voor grotere groepen → niet boeken, doorverwijzen naar grote-groep aanvraag op de website.

K. **Sectie 9 — Tool-definities**:
- Houd 4 verplichte tools.
- Voeg subsectie **"Optionele extra tools"** toe (kort, met endpoint-URL en wanneer te gebruiken):
  - `find_reservation` — opzoeken via telefoon of code.
  - `update_reservation` — wijzigen.
  - `reconfirm_reservation` — herbevestiging via telefoon.
  - `create_waitlist_entry` — wachtlijst plaatsen als alles vol is.
  - `get_opening_hours` — openingstijden uitlezen voor info-vragen.
- Per tool: één regel doel + URL + verwijzing naar `docs/PUBLIC_API.md` (of agent_api implementatie) voor parameterdetails.

L. **Sectie 10 — Test & foutmeldingen**:
- Test-stappen ongewijzigd.
- Foutmeldingenlijst aanvullen met:
  - **403 Channel action not allowed** — sleutel mist deze action; vraag support om scope toe te voegen.
  - **404 Reservation not found** — code of telefoonnummer matcht geen reservering.
- Laatste callout uitbreiden met: voordat je naar **Live** schakelt, doorloop je eerst de **Pilot-readiness checklist** in TableWise → **Instellingen → Pilot lancering**. Pas als alle verplichte items groen zijn op Live zetten. (Met directe link `/app/instellingen/pilot-launch`.)

M. **Nieuwe sectie 11 — "Live zetten" stap-voor-stap**:
  1. Open TableWise → **Instellingen → Pilot lancering**.
  2. Controleer dat alle verplichte items op de checklist groen staan.
  3. Vink de handmatige checks af.
  4. Ga terug naar **AI Voice Agent → Configuratie**, zet Modus op **Live**, klik Opslaan.
  5. Bel het ClickWise-nummer en boek een echte reservering om te bevestigen dat ClickWise de bevestigings-SMS verstuurt.
  6. (Optioneel) Klik op **Markeer als live** in Pilot lancering om het restaurant officieel live te zetten.

## Niet in scope

- Geen wijzigingen aan `VoiceAgentPage.tsx`, `agent_api` of ClickWise-componenten.
- Geen nieuwe help-pagina's voor andere modules — alleen Voice Agent help bestaat en is in scope.
- Geen wijzigingen aan `docs/*.md` (developer-docs, niet eindgebruiker-help).

## Resultaat

Eén bijgewerkte help-pagina met:
- Correcte tab- en knopnamen.
- Realistische sleutel-flow (via support).
- Korte master-snapshot route voor nieuwe klanten (6 stappen).
- Volledige lijst van beschikbare agent-tools.
- Heldere "live-zetten" procedure met readiness-check.
