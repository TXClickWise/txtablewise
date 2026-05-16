## Antwoord kort

Ja, de prompt moet aangepast worden. Telefoonnummer wordt verplicht (met `{{contact.phone}}` als default), e-mail blijft optioneel. Alleen prompt-tekst en de parameter-tabel van `create_reservation` in de help-pagina — geen edge functions of contracts.

## Wijzigingen in `src/pages/app/help/VoiceAgentHelp.tsx`

### A. `SYSTEM_PROMPT` — telefoonnummer-regel

Vervangen onder GESPREKSREGELS:
- **Oud:** "Vraag het mobiele nummer ter bevestiging, ook als nummerherkenning aanwezig is."
- **Nieuw:** "Telefoonnummer is VERPLICHT bij elke reservering. Het nummer waarmee de beller belt is automatisch beschikbaar als `{{contact.phone}}`. Vraag NIET opnieuw om het nummer als `{{contact.phone}}` gevuld is — vraag in plaats daarvan één keer kort: *'Mag ik het nummer waarmee u nu belt noteren bij de reservering?'* Bij **ja** → gebruik `{{contact.phone}}`. Bij **nee** of als de beller een ander nummer noemt → vraag dat nummer uit, herhaal het hardop cijfer-voor-cijfer ter controle, en gebruik dát nummer. Als `{{contact.phone}}` leeg is (anoniem/withheld) → vraag het nummer actief uit en herhaal cijfer-voor-cijfer. Boek NIET zonder geldig telefoonnummer."

### B. `SYSTEM_PROMPT` — bevestigingsregel

Vervangen:
- **Oud:** "Bevestig altijd hardop alle gegevens (naam, datum, tijd, aantal personen, telefoonnummer) vóór je definitief boekt."
- **Nieuw:** "Bevestig altijd hardop alle gegevens (naam, datum, tijd, aantal personen en het te noteren telefoonnummer) vóór je definitief boekt."

### C. `SYSTEM_PROMPT` — VERPLICHTE TOOL-VOLGORDE stap 3

Vervangen:
- **Oud:** "Zodra de beller een tijd kiest én je naam + telefoon hebt → bevestig hardop alles → roep book_reservation aan."
- **Nieuw:** "Zodra de beller een tijd kiest én je naam hebt + een geldig telefoonnummer (bevestigd `{{contact.phone}}` of door beller opgegeven nummer) → bevestig hardop alles → roep `create_reservation` aan met `phone` = dat nummer."

### D. `SYSTEM_PROMPT` — "WAT JE NIET DOET" → e-mail

Vervangen:
- **Oud:** "Geen e-mailadres uitvragen tenzij de beller het uit zichzelf wil geven."
- **Nieuw:** "E-mailadres is optioneel. Vraag het NIET standaard uit. Alleen noteren als de beller het uit zichzelf opgeeft of expliciet een digitale bevestiging vraagt."

### E. ANNULEREN / WIJZIGEN — auto-match op nummer

In beide blokken één regel toevoegen bovenaan:
- "Probeer eerst stilzwijgend te matchen op `{{contact.phone}}` via `find_reservation`. Lukt dat → bevestig hardop welke reservering je gevonden hebt. Lukt dat niet → vraag het bevestigingsnummer of een ander telefoonnummer."

### F. Sectie 9 — `create_reservation` parameter-tabel

In de `ToolParamTable` voor `create_reservation`:
- `phone`: Required **ja** (was: nee). Description: "Telefoonnummer in E.164. Default `{{contact.phone}}` (nummer waarmee beller belt). Alleen anders als beller expliciet ander nummer opgeeft."
- `email`: Required **nee** (blijft). Description aanvullen: "Optioneel. Alleen invullen als de beller dit zelf opgeeft of digitale bevestiging vraagt."

Ook in `buildBundle()` de `params`-string voor `create_reservation`/`book_reservation` aanpassen: `"phone (String, required)"` en `"email (String, optional)"`.

## Niet veranderen

- `agent_api/index.ts` — `phone` blijft daar technisch optional op DB-niveau; de prompt dwingt de verplichting af op gesprek-niveau. Geen schema-wijziging nodig.
- `contracts.ts` — ongewijzigd.
- `voiceFlow.ts` (in-app simulator) — daar is `phone` al required.
- ClickWise tool-config — `phone` blijft als body-param bestaan; alleen de description/required-vlag in de help-tabel verandert zodat de gebruiker bij het invullen weet dat ie het op Required moet zetten.

## Verificatie

- Zoeken op "nummerherkenning" → 0 hits.
- Zoeken op "{{contact.phone}}" in `SYSTEM_PROMPT` → ≥1 hit.
- `create_reservation`-rij voor `phone` in sectie 9 toont Required = ja.
- `buildBundle()` JSON-export bevat `"phone (String, required)"`.
