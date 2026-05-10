## Doel

Een gast die een groep groter dan `large_group_max_online_request` (in jouw geval 18) opgeeft, moet automatisch in de **Groepsaanvraag**-flow (handmatige aanvraag, tot 200 pers.) terechtkomen — niet stilletjes worden teruggeknipt naar 18.

## Probleem

In `src/pages/ReserveWidget.tsx`, het "Grotere groep?"-inputveld (regels 442–458):

- `max={maxOnlineRequest}` blokkeert invoer >18 in de browser.
- `onChange` doet `setPartySize(Math.min(v, maxOnlineRequest))` — clamped elke waarde naar 18.

Hierdoor wordt de switch naar `step="large_group"` in `goToDetails` (regel 273) onbereikbaar via dit veld. De groepsaanvraag-flow zelf werkt al (regels 865–937, met `min={large_group_threshold} max={200}`).

## Wijziging (UI-only, één bestand)

Bestand: `src/pages/ReserveWidget.tsx`

1. **Veld niet meer hard-clampen.** In het "Grotere groep?"-blok:
   - `max` attribuut weghalen (of op een ruim platform-maximum zetten, bv. 200).
   - `onChange` vereenvoudigen tot: `if (!Number.isNaN(v) && v >= 1) setPartySize(v);` — geen `Math.min` meer.
   - `value` zo houden dat het veld ook getoond wordt zodra `partySize > max_party_size_online`, ook als de waarde > `maxOnlineRequest` is.
   - Placeholder houden als `tot {maxOnlineRequest} personen` of aanpassen naar `bv. 25 personen` zodat duidelijk is dat groter ook kan.

2. **Hint-tekst** onder het veld (regels 465–469) blijft staan: zodra `partySize > maxOnlineRequest` toont hij al "Voor groepen groter dan {maxOnlineRequest} personen vragen we een aparte aanvraag." — eventueel iets gastvrijer maken: "Vanaf {maxOnlineRequest+1} personen sturen we je door naar een korte groepsaanvraag — dan plant {restaurant.name} jullie persoonlijk in."

3. **Doorroutering.** `goToDetails` (regel 271–281) doet al `if (partySize > maxOnlineRequest) setStep("large_group")`. Dit werkt automatisch zodra de clamp weg is. Geen verdere wijziging nodig.

4. **`partyOptions`-knoppen** (regel 353): blijven gecapt op `max_party_size_online` (typisch 8–10). Onveranderd; het invoerveld is voor afwijkende aantallen.

## Wat NIET wijzigt

- Datamodel, edge functions, `LargeGroupSettings.tsx`, `publicBooking.ts`: ongewijzigd. Het is puur een widget-UX-fix.
- De instelling blijft per tenant configureerbaar via Instellingen → Grote groepen.

## QA

- Met `large_group_max_online_request = 18`: typ "25" in "Grotere groep?" → widget springt naar Groepsaanvraag-stap, formulier accepteert tot 200.
- Met veld leeg (fallback op `max_party_size_online`): zelfde gedrag op basis van fallback-waarde.
- Onder de drempel (bv. 6): normale beschikbaarheidsflow blijft werken.
