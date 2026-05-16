# Booking horizon ook server-side i.p.v. Custom Value

In de vorige ronde is `TW Booking Horizon Days` al uit de Custom Values lijst gehaald in `VoiceAgentHelp.tsx` sectie 4 — de engine (`book_reservation`) weigert reserveringen voorbij `restaurants.booking_horizon_days` server-side. Wat nog rest zijn twee hardcoded "90 dagen" vermeldingen in de system-prompts die de suggestie wekken dat de operator hem in de prompt of als custom value moet onderhouden.

## Wijzigingen

**1. `src/pages/app/help/VoiceAgentHelp.tsx` (regel 129)** — SYSTEM_PROMPT regel:
- Was: `- Geen reserveringen maken voor groepen >8 of langer dan 90 dagen vooruit.`
- Wordt: `- Probeer geen reserveringen te boeken te ver in de toekomst. Als de engine TW_409_BEYOND_HORIZON of vergelijkbaar teruggeeft, leg dat vriendelijk uit aan de beller en bied aan dat een collega terugbelt.`

Reden: de grens (`booking_horizon_days`) staat per klant in TableWise; de agent hoeft hem niet te kennen — de tool-response is de autoriteit.

**2. `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` (regel 115)** — zelfde regel in de admin-prompt aanpassen op identieke manier.

**3. Callout in `VoiceAgentHelp.tsx` sectie 4 (regels ~330-336)** — Booking horizon bullet aanvullen met: "Zet hem in TableWise → Reserveringsregels → Booking horizon (dagen)."

**4. Geheugen `mem://features/clickwise-snapshot.md`** bijwerken zodat het expliciet vermeldt dat ook `booking_horizon_days` server-side enforced is en niet in de prompt of als Custom Value hoeft.

## Buiten scope

- Geen engine-/edge-function wijzigingen — `book_reservation` valideert booking-horizon al.
- Geen nieuwe tool of API-call nodig.
- Geen UI of dataschema-wijzigingen.
