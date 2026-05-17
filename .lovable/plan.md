# Analyse van de externe prompt FIX-010

## 1. Inhoudelijk: kloppen de fixes?

| # | Beoordeling |
|---|---|
| **1. Vangnet 19+ → `large_group_requests` insert** | **Juiste bug, juiste oplossing.** Vandaag schrijft de voice agent bij `large_group_required_manual` niets weg — alleen een mooi bericht. De widget doet dit wél. Fix gebruikt `keyRow.restaurant_id`, dus tenant-veilig. Voeg `metadata: { external_call_id: ctx.externalCallId }` toe als beschikbaar, voor traceability. |
| **2. Berichten herschrijven** | **Richting klopt, copy bevat een risico** (zie §3). Vervangen van "een collega belt u terug" door "voorlopig genoteerd" is correct. |
| **3. UI-labels in `LargeGroupSettings.tsx` en `VoiceAgentHelp.tsx`** | **Veilig en juist.** Pure tekstuele consistentie met nieuw beleid. |
| **4a. `slot_too_soon` + `beyond_booking_horizon` in `buildBookGuestResponse`** | **Goed.** Verandert 400 → 200 met bruikbare message. `error_code` blijft in de body (regel 157), dus ClickWise kan nog steeds filteren. |
| **4b. Horizon-check in `book_reservation`** | **Goed, maar zie §2 over de `?? 90` default.** Operator-kanalen (`manager`, `walk_in`) terecht uitgesloten via bestaande `operatorChannels` set. |
| **5. `confirmation_code` zoekpad in `find_reservation`** | **Veilig.** Geen hardcoding. `.toUpperCase()` klopt met hoe codes elders worden gegenereerd. Wel: voeg een check toe dat de code uitsluitend uit `[A-Z0-9]` bestaat vóór de query om SQL/LIKE-misbruik en logspam te vermijden. |

## 2. Hardcoded-waarden check (multi-tenant)

De externe prompt noemt Eigeweis-specifieke getallen (8 / 11 / 18 / 19, +31627437488, 11:00–20:30) in de **uitleg**, maar de **fix-snippets zelf** bevatten gelukkig **géén** van die tenant-waarden. Alles komt al uit `restaurants.*`:

- `large_group_threshold`, `large_group_manual_approval_from`, `extra_large_group_threshold`, `large_group_max_online_request`, `large_group_auto_book_max`, `large_group_minutes`, `large_group_extra_minutes`
- `transfer_phone`, `transfer_hours_start`, `transfer_hours_end`
- `booking_horizon_days`, `booking_lead_time_minutes`

Alle 22 relevante kolommen bestaan al op de `restaurants`-tabel — bevestigd via DB-introspectie. **Geen schema-wijzigingen nodig.**

### Echte hardcoding-risico's die de prompt introduceert

1. **"binnen 4 uur" + "per SMS of e-mail"** in messages 3 en 6.
   - Dat is een **SLA-belofte** die TableWise vandaag nergens afdwingt: er is geen 4-uurs timer, en SMS/e-mail bij goedkeuring is afhankelijk van ClickWise-workflow van de tenant. Een tenant zonder SMS gaat de belofte niet waarmaken.
   - **Aanbeveling:** gebruik bij voorkeur `restaurants.large_group_confirmation_text` als die niet leeg is, anders een neutrale fallback zonder concrete termijn én zonder kanaal-specificatie. Bv: *"voorlopig genoteerd. Het restaurant bevestigt zo snel mogelijk."*
   - Alternatief: voeg twee nieuwe kolommen toe (`large_group_response_sla_label text`, `large_group_response_channel_label text`) zodat elke tenant zelf bepaalt wat er beloofd wordt.

2. **`?? 90` als horizon-fallback** in FIX 4b.
   - Niet kritiek (de DB heeft een default), maar zorg dat de fallback consistent is met de DB-default en met `RestaurantSettings`. Liever `?? null` en bij `null` overslaan, of de DB-default ophalen.

3. **Alle berichten zijn hard Nederlands.**
   - Bestaande code in `agent_api` doet dit al — niet veroorzaakt door deze PR — maar het is wel het noemen waard: `restaurants.locale` / `guest.language` wordt nergens gebruikt in `buildBookGuestResponse`. Buiten scope van FIX-010, maar kandidaat voor follow-up.

4. **`transfer_phone` validatie ontbreekt.**
   - Niet in deze fix, maar relevant: de huidige `buildBookGuestResponse` vertrouwt blind op `rb.transfer.allowed`. Als `transfer_phone` leeg is moet de fallback altijd naar `promise_callback` / nu `large_group_request` gaan. Controleer dat `book_reservation` `transfer.allowed = false` zet als `transfer_phone` ontbreekt — anders kan de agent doorverbinden naar `null`.

## 3. Aanbevolen aanpassingen op de prompt vóór implementatie

1. **Vervang in messages 3 en 6 de SLA-zin.** Gebruik:
   ```
   const fallback = `Uw reservering voor ${partySize} personen op ${dateStr} om ${timeStr} is voorlopig genoteerd. Het restaurant bevestigt dit zo snel mogelijk.`;
   const messageForGuest = restaurant.large_group_confirmation_text?.trim() || fallback;
   ```
   Daarvoor moet `buildBookGuestResponse` óf `restaurant.large_group_confirmation_text` meegegeven krijgen, óf de caller bouwt de fallback. Zelfde voor bericht 6 in `book_reservation/index.ts` (waar `restaurant` al beschikbaar is — direct doen).

2. **Maak bericht 1 (19+ buiten transfer-venster) ook tenant-configureerbaar** met dezelfde fallback-logica.

3. **Voeg `metadata` toe aan de `large_group_requests` insert** met `source_channel: "phone_ai"`, `provider`, en `external_call_id` zodat het rapport-per-kanaal (zie memory `channels`) klopt. `source_channel` is per memory verplicht — controleer of die tabel die kolom heeft; zo niet, dan in `metadata` zetten.

4. **Voeg confirmation_code-formaatvalidatie toe** (`/^[A-Z0-9]{3,12}$/`) vóór de query in FIX 5.

5. **Documenteer in de UI** (`LargeGroupSettings.tsx` hint of `VoiceAgentHelp.tsx`) dat het "voorlopig genoteerd"-bericht uit `large_group_confirmation_text` komt zodra die ingevuld is — anders kan de tenant niet zien waarom de copy verandert.

## 4. Wat NIET in de prompt staat maar wel zou moeten

- **Test 9 toevoegen:** als `transfer_phone` leeg is en groep > online cap, moet de agent NOOIT `transfer_call` doen, ook niet binnen het venster.
- **Audit log entry** bij de `large_group_requests` insert via voice-agent (parallel aan de widget-flow), zodat owner-dashboard de bron ziet.
- **Geen wijziging aan `forbidden_phrases`** — die staan elders in de body; controleer dat de nieuwe message 3 niet per ongeluk een verboden woord ("bevestigd") herintroduceert. Concreet: *"U ontvangt binnen 4 uur een **bevestiging**"* gebruikt het stam-woord "bevestig" — dat moet de prompt of de `forbidden_phrases`-lijst niet meer blokkeren voor de "voorlopig"-flow. Check `agent_api/index.ts` op `forbidden_phrases` om collision te voorkomen.

## 5. Conclusie

De prompt vindt vijf echte issues en lost er vier correct op. **Probleemstuk 1, 3, 4 en 5 mogen 1-op-1 worden geïmplementeerd**, mits de kleine verbeteringen uit §3 punt 3 en 4 worden meegenomen.

**Probleemstuk 2 (messages) moet voorzichtig.** De voorgestelde copy is beter dan de huidige, maar bevat een SLA- en kanaalbelofte die per tenant niet waar hoeft te zijn. Of we maken het tenant-driven via `large_group_confirmation_text`, of we kiezen neutralere copy ("zo snel mogelijk", "het restaurant laat het u weten"). Mijn voorkeur: **tenant-driven met neutrale fallback**.

Als je akkoord bent met deze nuance, schakel ik naar build mode en implementeer ik FIX-010 met deze aanpassingen.
