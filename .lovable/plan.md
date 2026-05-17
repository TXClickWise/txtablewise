## Doel

De huidige Grote-groepen-instellingen zijn dubbel en verwarrend. We brengen het terug tot **één helder model met 2 drempels** dat zowel de widget als de AI Voice Agent gebruikt, en verplaatsen "Verblijfsduur grote groep" naar het juiste tabblad.

## Het nieuwe model (voorbeeld Eigeweis)

```text
party_size
  1 ─ 7   → Normale reservering    duur = standaard
  8 ─ 18  → Grote groep            duur = standaard + extra_minuten_groot
                                   auto-boeken (tenzij > "Handmatige goedkeuring vanaf")
 19 ─ ?   → Extra-grote groep      duur = standaard + extra_minuten_groot + extra_minuten_xl
                                   ALTIJD handmatige goedkeuring
 > max_online_request → niet via widget/agent → groepsformulier / call transfer
```

## Wijzigingen in de UI van **Settings → Grote groepen**

We reduceren de "Drempels"-sectie tot deze velden, in deze volgorde:

1. **Grote groep vanaf (personen)** — `large_group_threshold` (bv. 8)
2. **Extra verblijfsduur grote groep (min)** — *nieuw label voor* `large_group_minutes` (verplaatst vanuit Capaciteit). Wordt opgeteld bij standaardduur zodra ≥ drempel 1.
3. **Extra-grote groep vanaf (personen)** — `extra_large_group_threshold` (optioneel, bv. 19). Leeg = uit.
4. **Extra verblijfsduur extra-grote groep (min)** — `large_group_extra_minutes`. Wordt bovenop #2 opgeteld zodra ≥ drempel 2.
5. **Handmatige goedkeuring vanaf (personen)** — één enkel veld (bv. 11). Boven dit aantal = altijd manueel.
6. **Maximale online groepsaanvraag (personen)** — harde bovengrens voor widget + voice agent (bv. 18). Daarboven: widget toont groepsformulier; agent doet call-transfer (binnen venster) of belofte tot terugbel.
7. **Toelichting verplicht vanaf (personen)** — optioneel, default = drempel 1.
8. **Aanbetaling aanbevolen vanaf (personen)** — blijft.
9. **Standaardstatus voor groepsaanvraag** — blijft (`pending` / `hold`).

### Verwijderd / opgeschoond

- Veld **"Automatisch boeken tot (personen)"** (`large_group_auto_book_max`) verdwijnt uit de UI. Het was inhoudelijk een spiegel van #5.
- Veld **"Verblijfsduur grote groep (min)"** verdwijnt uit *Capaciteit → Pacing & capaciteit* en komt hier terug als #2 met het nieuwe label.
- Hint-teksten worden herschreven met duidelijke voorbeelden ("Bij groep van 12 personen wordt standaardduur 105 + 30 = 135 minuten").

### Visuele groepering

Drie kaarten i.p.v. één lange:

- **Kaart A — "Wanneer is het een grote groep?"** → velden 1 + 2.
- **Kaart B — "Wanneer is het een extra-grote groep?"** → velden 3 + 4 (uitgegrijsd zolang drempel 2 leeg is).
- **Kaart C — "Goedkeuring & online limieten"** → velden 5 + 6 + 7 + 8 + 9.
- Bestaande kaart "Communicatie naar gast", "Reserveringsgarantie" en "Call Transfer" blijven ongewijzigd.

Boven kaart A komt een korte uitleg-strip met live-preview van bv. *"Bij Eigeweis: 8–18 personen = grote groep, 19+ = extra-groot, handmatige goedkeuring vanaf 11, max 18 via widget."*

## Wijzigingen in de **edge functions** (zelfde regels voor widget én voice agent)

### `book_reservation/index.ts` (regels 213–227)

Vervang het blok door één bron-van-waarheid:

```ts
const largeFrom    = restaurant.large_group_threshold ?? 9;
const xlFrom       = restaurant.extra_large_group_threshold ?? null;
const manualFrom   = restaurant.large_group_manual_approval_from ?? largeFrom;
const onlineMax    = restaurant.large_group_max_online_request
                   ?? restaurant.max_party_size_online;

// 1. harde bovengrens — al afgehandeld vroeger met TW_409_PARTY_TOO_LARGE
// 2. extra-grote groep → altijd manueel
if (xlFrom !== null && body.party_size >= xlFrom) {
  requiresManualApproval = true;
  largeGroupStatus = "awaiting_approval";
}
// 3. grote groep → manueel alléén als boven manual-drempel
else if (body.party_size >= largeFrom) {
  if (body.party_size >= manualFrom) {
    requiresManualApproval = true;
    largeGroupStatus = "awaiting_approval";
  } else {
    largeGroupStatus = "auto_booked";
  }
}
```

`large_group_auto_book_max` wordt nergens meer gelezen (kolom blijft staan, maar krijgt geen UI; later op te ruimen).

### `_shared/duration.ts`

Logica werkt al volgens dit model — geen wijziging nodig. Controle:

```text
duur = standaard
       + (party ≥ largeFrom        ? large_group_minutes − standaard : 0)
       + (party ≥ xlFrom           ? large_group_extra_minutes        : 0)
```

(De huidige implementatie vervangt `standaard` door `large` zodra ≥ largeFrom, en telt `extra_minutes` er bovenop bij ≥ xlFrom — semantisch identiek aan de nieuwe labels.)

### `availability/index.ts` + `manage_reservation/index.ts`

Geen functionele wijziging. Lezen al dezelfde kolommen.

## Wijzigingen in de **widget** (`src/pages/ReserveWidget.tsx`)

- Lees voortaan `extra_large_group_threshold` en gedraag je net als de agent: boven die drempel **altijd** banner "Aanvraag wordt na bevestiging door het restaurant goedgekeurd".
- `manualApprovalFrom` blijft `large_group_manual_approval_from`; ongeleden velden verdwijnen.
- Boven `large_group_max_online_request` zoals nu → doorsturen naar groepsformulier.

## Wijzigingen in **Capaciteit**

- In `CapacitySettings.tsx` verwijderen we het veld "Verblijfsduur grote groep (min)" (regels rond 100). Bovenaan een kleine hint: *"Verblijfsduur voor grote groepen staat nu onder Instellingen → Grote groepen."*

## Wijzigingen in **DB**

Geen schema-wijziging vereist. Alle kolommen bestaan al:

- `large_group_threshold`, `large_group_minutes`, `extra_large_group_threshold`, `large_group_extra_minutes`, `large_group_manual_approval_from`, `large_group_max_online_request`, `large_group_extra_info_from`, `large_group_deposit_recommended_from`, `large_group_default_status`.
- `large_group_auto_book_max` wordt niet meer gelezen door code — kolom laten staan voor backward-compatibility en in een latere opruimmigratie droppen.

## Validatie bij opslaan

In `LargeGroupSettings.save()`:

- `extra_large_group_threshold` > `large_group_threshold` (al aanwezig).
- `large_group_manual_approval_from` ≥ `large_group_threshold` (nieuw — anders is "grote groep" zinloos want alles is sowieso manueel).
- `large_group_max_online_request` ≥ `large_group_threshold` (nieuw).
- Toon waarschuwing als `extra_large_group_threshold` > `large_group_max_online_request` (dan kan extra-grote groep nooit via widget binnenkomen — bedoeld?).

## Bestanden die wijzigen

- `src/pages/app/settings/LargeGroupSettings.tsx` — herstructureer UI (3 kaarten), nieuw veld voor `large_group_minutes`, verwijder `large_group_auto_book_max`, validaties.
- `src/pages/app/settings/CapacitySettings.tsx` — verwijder veld "Verblijfsduur grote groep" + hint toevoegen.
- `supabase/functions/book_reservation/index.ts` — vervang regels 213–227 met de bovenstaande logica.
- `src/pages/ReserveWidget.tsx` — lees + respecteer `extra_large_group_threshold` voor "altijd manueel"-banner.
- `src/services/aiHost/dispatcher.ts` — select-lijst aanvullen met `extra_large_group_threshold` als die ergens in beslislogica meedoet (controle).

## Niet in scope (apart te bespreken)

- Database-cleanup van ongebruikte kolom `large_group_auto_book_max` (later migratie).
- Wijzigingen aan de voice-agent prompt zelf — de agent leest al `requires_manual_approval` uit het `book_reservation`-antwoord, dus correct gedrag volgt automatisch.

Geef akkoord en ik bouw dit in één pass.
