## Status van de Voice Agent — Koppelhandleiding

Kort antwoord: **nee, nog niet helemaal.** De handleiding gebruikt op meerdere plekken nog het oude model waarin `max_party_size_online` de grens bepaalt tussen "direct boeken" en "ter beoordeling". Met de nieuwe 2-drempel-opzet klopt dat niet meer:

- **Grote groep** = vanaf `large_group_threshold` (bv. 8) — krijgt langere verblijfsduur en valt vanaf `large_group_manual_approval_from` op manual approval.
- **Extra-grote groep** = vanaf `extra_large_group_threshold` (bv. 19) — altijd manual approval.
- **Harde online bovengrens** = `large_group_max_online_request` — daarboven `TW_409_PARTY_TOO_LARGE` + call transfer.
- `max_party_size_online` is geen drempel meer in dit verhaal en staat ook niet meer in *Algemeen*.

## Wat moet bijgewerkt worden in `src/pages/app/help/VoiceAgentHelp.tsx`

### 1. System prompt (regels 206–223) — sectie "GROTE GROEPEN"
- Titel "3-traps logica" → "2-drempel logica (engine bepaalt)".
- Tekst hoeft de drempels niet uit te leggen — de agent moet gewoon `requires_manual_approval` en `TW_409_PARTY_TOO_LARGE` volgen. Verwijder elke impliciete suggestie dat de agent zelf met `max_party_size_online` rekent. De huidige a/b/c-flow blijft inhoudelijk correct; alleen de openingszin en titel aanpassen.

### 2. Sectie 5 — "Mappen van TableWise → ClickWise sub-account" (regels 443–453)
Vervang het "Groepsgrootte (3-traps)"-blok door:

```text
Groepsgrootte (2-drempel) — engine bepaalt, agent probeert altijd te boeken:
  • party_size < large_group_threshold              → normale boeking, direct bevestigd
  • party_size ≥ large_group_manual_approval_from   → requires_manual_approval=true
  • party_size ≥ extra_large_group_threshold        → altijd requires_manual_approval=true
  • party_size > large_group_max_online_request     → TW_409_PARTY_TOO_LARGE → Call Transfer / callback (sectie 7b)
Pas aan in TableWise → Instellingen → Reserveringen → Grote groepen.
```

### 3. Sectie 7b — "Call Transfer" (regels 703–709)
Callout "Niet voor normale grote groepen" — vervang `max_party_size_online` door `large_group_threshold` (of `large_group_manual_approval_from`) en `large_group_max_online_request` blijft de bovengrens.

### 4. Sectie 8 — "System prompt — paste-ready" (regels 727–737)
Callout "Groepsgrootte — 3-traps logica" → "2-drempel logica" met dezelfde herschreven uitleg als in punt 2. Pas de slotzin aan naar **Instellingen → Reserveringen → Grote groepen** (i.p.v. *Reserveringsregels*).

### 5. Tool-parametertabellen — `party_size` beschrijvingen (regels 847, 886, 958, 1104)
Pas de description-tekst aan zodat ze niet meer suggereren dat `max_party_size_online` de bovengrens is. Voorstel:

> "Aantal personen, geheel getal ≥ 1. De engine valideert zelf tegen `large_group_max_online_request`; bij overschrijding volgt `TW_409_PARTY_TOO_LARGE` (zie GROTE GROEPEN in de prompt)."

Voor `update_reservation.new_party_size` analoog: verwijs alleen naar `large_group_max_online_request`.

## Niet wijzigen

- De a/b/c-flow in de prompt zelf (requires_manual_approval → transfer.allowed) klopt — die leest gewoon de engine-response.
- Endpoints, headers, auth, language-parameter, openings-/afsluitzinnen, transactionele mail/SMS-secties.

## Bestanden die wijzigen

- `src/pages/app/help/VoiceAgentHelp.tsx` — alleen tekst/labels in de hierboven genoemde regels.

Geen edge function- of DB-wijziging nodig: dit is puur documentatie-bijwerking om de handleiding in lijn te brengen met het nieuwe Grote-groepen-model.

Geef akkoord en ik werk de handleiding in één pass bij.