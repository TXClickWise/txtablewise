## Doel

Drie aanpassingen aan de Voice Agent help-pagina (`src/pages/app/help/VoiceAgentHelp.tsx`) — puur copy/prompt-werk, geen engine-wijziging:

1. **Grote-groepen logica corrigeren** (was nog niet doorgevoerd).
2. **Telefoonnummers cijfer-voor-cijfer uitspreken** toevoegen.
3. **Call Transfer-setup** documenteren met `tw_transfer_phone` custom value en dynamisch openingstijden-venster.

## 1. System prompt — grote groepen (3-traps logica)

Vervang regel 206 ("De engine weigert te grote groepen automatisch met TW_409_PARTY_TOO_LARGE. Zeg dan dat een collega persoonlijk terugbelt en boek NIET.") door:

```
- Probeer ALTIJD eerst gewoon te boeken via create_reservation, ongeacht groepsgrootte.
  De engine bepaalt zelf of de boeking direct doorgaat, ter goedkeuring naar het team
  gaat, of geweigerd wordt:
  • Direct geboekt (response ok) → bevestig hardop als normale boeking.
  • requires_manual_approval = true in response → zeg: "Voor een groep van [aantal] personen
    laat ik uw aanvraag persoonlijk beoordelen door een collega. U ontvangt binnen [X] uur
    een bevestiging per SMS." (DE/EN-varianten in prompt).
  • TW_409_PARTY_TOO_LARGE error → groep is te groot voor online aanvraag. Volg dan:
    - Binnen openingstijden (= {{custom_values.tw_transfer_hours}}): zeg "Ik verbind u
      direct door met een medewerker, één moment alstublieft" en roep action
      'Call Transfer' aan naar {{custom_values.tw_transfer_phone}}.
    - Buiten openingstijden: roep log_call met outcome="callback_needed" + summary met
      groepsgrootte. Zeg: "Een collega belt u morgen tijdens openingstijden persoonlijk
      terug op dit nummer."
```

## 2. System prompt — telefoonnummer uitspraak

Voeg na regel 183 (telefoonnummer-regel) een nieuwe regel toe:

```
- Wanneer je een telefoonnummer hardop terugleest ter bevestiging, spreek dan
  CIJFER VOOR CIJFER uit met een korte pauze tussen ieder cijfer en groepeer NIET
  in tientallen of paren. Voorbeeld voor +31612345678: "plus drie één — zes — één —
  twee — drie — vier — vijf — zes — zeven — acht". In het Duits: "plus drei eins —
  sechs — eins — zwei — drei — vier — fünf — sechs — sieben — acht". In het Engels:
  "plus three one — six — one — two — three — four — five — six — seven — eight".
  Doe dit ook bij het uitspreken van het transfer-nummer en bij het herhalen wanneer
  de beller een ander nummer dicteert.
```

Pas ook regel 179 lichtjes aan: "bevestig altijd hardop alle gegevens (naam, datum, tijd, aantal personen en het te noteren telefoonnummer **— cijfer-voor-cijfer**) vóór je definitief boekt."

## 3. Tool-parameter descriptions opschonen

Update de "1 t/m 8" beperking in tool-descriptions (regels ~756, 795, 867, 1013) naar:

```
"Aantal personen, geheel getal ≥ 1. De engine valideert zelf tegen
max_party_size_online en large_group_max_online_request van het restaurant."
```

## 4. Callouts in de doc-pagina

- **Regels 423-432** (`max_party_size_online`-callout): herschrijf naar de 3-traps uitleg (direct → manueel goedkeuren → Call Transfer) zodat het matcht met de prompt.
- **Regels 640-648** (ClickWise-sectie): zelfde 3-traps uitleg + verwijzing naar nieuwe Call Transfer-sectie.

## 5. Nieuwe sectie "Call Transfer instellen" (in ClickWise tab)

Nieuwe `<Card>` met instructies:

1. **Custom Value aanmaken** in ClickWise sub-account:
   - `tw_transfer_phone` (Single line) → het nummer waarnaar grote-groep bellers worden doorverbonden (mobiel manager, hoofdlijn keuken, etc.). E.164 formaat, bv. `+31612345678`.
   - `tw_transfer_hours` (Single line) → menselijk-leesbaar venster, bv. `dagelijks 11:00–20:30` of `di-zo 17:00–22:00`. De AI gebruikt dit letterlijk in zijn beslissing + tegen de gast.
2. **Action in Voice Agent workflow**: voeg een **Call Transfer** action toe in de ClickWise inbound-call workflow, met `{{custom_values.tw_transfer_phone}}` als doelnummer. Trigger = wanneer de AI de `Call Transfer` tool-action aanroept (Vapi/Retell escalatie-action).
3. **Test**: bel met groep van bv. 25 personen → krijg `TW_409_PARTY_TOO_LARGE` → check dat AI binnen `tw_transfer_hours` doorverbindt, en daarbuiten `log_call(outcome=callback_needed)` doet.

Callout: "Het venster in `tw_transfer_hours` is een vrije tekst die de AI letterlijk interpreteert. Houd het simpel ('11:00–20:30') zodat de detectie betrouwbaar is."

## Niet aangeraakt

- `agent_api` edge function — engine doet al het juiste werk (drie-traps party-size + `requires_manual_approval` response).
- Geen datamodel-wijziging, geen migrations, geen UI-componenten buiten de help-pagina.

## Test na implementatie

1. Diff-check op de drie wijzigingen in de prompt.
2. Visueel check op de help-pagina: nieuwe "Call Transfer instellen" card zichtbaar onder ClickWise-tab.
3. Geen TypeScript-fouten.