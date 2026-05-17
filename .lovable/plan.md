## Doel

De SLA-belofte ("binnen 4 uur") en het terugkoppelkanaal ("per SMS of e-mail") moeten **per tenant** instelbaar zijn, en voor Eigeweis vooraf ingevuld worden. Vandaag verstopt FIX-010 die copy achter een neutrale fallback — de belofte verdwijnt daardoor uit zowel de voice-agent als de Voice-prompt.

## Aanpak

**Tenant-driven, niet hardcoded.** Twee nieuwe optionele kolommen op `restaurants` voor de SLA en het kanaal, die zowel de edge function (agent_api / book_reservation) als de Voice-prompt via `custom_values` voeden. Zo blijft het multi-tenant en kan Eigeweis "binnen 4 uur" + "SMS of e-mail" behouden, terwijl een andere tenant bv. "binnen 1 werkdag" + "e-mail" kan zetten — of het leeg laten voor een neutrale fallback.

## Wijzigingen

### 1. Database (migratie)

Twee nieuwe nullable kolommen op `restaurants`:

- `large_group_response_sla_label text` — vrij tekstveld, bv. `"binnen 4 uur"`, `"binnen 1 werkdag"`, leeg = niets beloven
- `large_group_response_channel_label text` — bv. `"per SMS of e-mail"`, `"per e-mail"`, leeg = niets beloven

Standaardwaarde: `NULL`. Voor restaurant **Eigeweis** vullen we ze direct via dezelfde migratie:
- `large_group_response_sla_label = 'binnen 4 uur'`
- `large_group_response_channel_label = 'per SMS of e-mail'`

(En desgewenst meteen ook `large_group_confirmation_text` zetten voor Eigeweis als die nog leeg is.)

### 2. `supabase/functions/agent_api/index.ts` — `buildBookGuestResponse`

Vervang de neutrale fallback uit FIX-010 door een **dynamische zin** die de tenantvelden gebruikt:

```ts
function composeLargeGroupPendingMessage(r, partySize, dateStr, timeStr) {
  if (r.large_group_confirmation_text?.trim()) return r.large_group_confirmation_text.trim();
  const sla = r.large_group_response_sla_label?.trim();
  const channel = r.large_group_response_channel_label?.trim();
  const tail =
    sla && channel ? ` U ontvangt ${sla} een bericht ${channel}.`
    : sla ? ` U ontvangt ${sla} een bericht.`
    : channel ? ` U ontvangt een bericht ${channel}.`
    : ` Het restaurant laat het u zo snel mogelijk weten.`;
  return `Uw aanvraag voor ${partySize} personen op ${dateStr} om ${timeStr} is genoteerd.${tail}`;
}
```

Toepassen op zowel `large_group_required_manual` (groep 11–18) als de 19+ catch-all branch én de `pending`-tak van een normale boeking buiten transfer-venster.

Belangrijk: deze twee nieuwe velden moeten ook in de `restaurants`-select binnen `agent_api` worden meegenomen.

### 3. `supabase/functions/book_reservation/index.ts`

Dezelfde compose-helper gebruiken voor `message_for_guest` op pending reservations. Velden zijn al beschikbaar in het gelezen `restaurant`-object — alleen toevoegen aan de select.

### 4. ClickWise custom values — `_shared/clickwise-hl.ts` + `buildCustomValues`

Twee extra `custom_values` toevoegen zodat de Voice-prompt ze direct kan renderen:
- `tablewise_large_group_sla_label`
- `tablewise_large_group_channel_label`

Doorgeven vanuit `clickwise_provision_subaccount` en `clickwise_sync_custom_values` (huidige selects uitbreiden met de twee nieuwe kolommen).

### 5. Voice-prompt v2.0 (in `AdminClickWiseVoiceSetupPage.tsx` + `VoiceAgentHelp.tsx`)

Vervang de hardcoded "binnen 4 uur"-zinnen door placeholders, bv.:

> "Uw aanvraag is genoteerd. U ontvangt {{custom_values.tablewise_large_group_sla_label}} een bericht {{custom_values.tablewise_large_group_channel_label}}."

Met een natuurlijke fallback-formulering in de prompt-instructies: "Als één van deze velden leeg is, zeg dan 'zo snel mogelijk' in plaats van een termijn, en laat het kanaal weg."

Ook de tekst in `large_group_required_manual` corrigeren — die moet uitleggen dat 19+ wél via voice-agent loopt (consistent met FIX-010 catch-all).

### 6. UI — `LargeGroupSettings.tsx`

Twee nieuwe invoervelden toevoegen onder de bestaande grote-groepen-instellingen:

- **"Beloofde reactietijd"** — placeholder "bijv. binnen 4 uur", helptekst: "Laat leeg om geen termijn te beloven."
- **"Kanaal voor terugkoppeling"** — placeholder "bijv. per SMS of e-mail", helptekst: "Wordt door de voice-agent en e-mail letterlijk uitgesproken/getoond. Laat leeg om geen kanaal te beloven. Zorg dat dit kanaal echt actief is in ClickWise."

Plus waarschuwingsblok: "Deze beloftes worden gebruikt door de voice-agent, bevestigingsberichten en e-mail. Controleer dat je ze ook waarmaakt."

### 7. Help-pagina + admin-pagina

`VoiceAgentHelp.tsx` en `AdminClickWiseVoiceSetupPage.tsx`: documenteren dat deze twee velden uit Instellingen → Grote groepen komen, en hoe de prompt erop reageert.

## Wat NIET verandert

- Geen wijziging aan `forbidden_phrases` (eerdere ronde al opgeschoond).
- Geen wijziging aan het `large_group_requests` vangnet of `confirmation_code`-pad — die blijven zoals in FIX-010.
- Geen schema-wijziging op `large_group_requests`.

## Tenant-veiligheidscheck

| Veld | Bron | Hardcoded? |
|---|---|---|
| SLA-label | `restaurants.large_group_response_sla_label` | nee — per tenant |
| Kanaal-label | `restaurants.large_group_response_channel_label` | nee — per tenant |
| Restaurantnaam in prompt | `custom_values.tablewise_restaurant_name` | nee |
| Transfer-nummer | `restaurants.transfer_phone` | nee |
| Drempels (8/11/18/19) | bestaande `restaurants.large_group_*` kolommen | nee |
| Eigeweis-waarden | gezet via seed-migratie, geen code | nee |

## Te wijzigen bestanden

- migratie: nieuwe kolommen + Eigeweis-seed
- `supabase/functions/agent_api/index.ts`
- `supabase/functions/book_reservation/index.ts`
- `supabase/functions/_shared/clickwise-hl.ts`
- `supabase/functions/clickwise_provision_subaccount/index.ts`
- `supabase/functions/clickwise_sync_custom_values/index.ts`
- `src/pages/app/settings/LargeGroupSettings.tsx`
- `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx`
- `src/pages/app/help/VoiceAgentHelp.tsx`

Akkoord = ik implementeer dit en deploy de twee edge functions plus de ClickWise-provisioners.