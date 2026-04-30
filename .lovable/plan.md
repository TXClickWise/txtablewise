## Doel

Zorg dat de admin-setup voor ClickWise zo is opgezet dat álles wat nu in de "moeder"-subaccount gebouwd wordt, in één HighLevel snapshot past en in een nieuwe sub-account met **maximaal 6 handmatige aanpassingen** werkend is.

## Achtergrond — wat HighLevel snapshots wél/niet meenemen

| Onderdeel | Snapshot-bare? | Actie nodig |
|---|---|---|
| Custom Values (sleutels + waarden) | Ja, mét waarden | Waarden per klant overschrijven |
| Custom Fields (definities) | Ja | Geen |
| Custom Actions / Workflow Actions (definitie + body + headers) | Ja | Geen, mits geen hardcoded keys |
| Workflows | Ja | Geen |
| Voice AI Agent | Beperkt — meestal **nee** | Per sub-account opnieuw aanmaken + tools koppelen |
| Twilio nummer | Nee | Per klant koppelen |
| Custom Action *response sample / field mapping* | Onbetrouwbaar | "Trainen"-stap per sub-account opnieuw uitvoeren |

## Wijzigingen in `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx`

### 1. Nieuwe tab "Snapshot" (laatste tab)

Inhoud — drie cards:

**Card A: "Snapshot bouwen (eenmalig in master sub-account)"**
- Korte uitleg: bouw alles in één 'master' sub-account, exporteer als snapshot, en hergebruik bij elke klant.
- Checklist welke onderdelen dééél van de snapshot moeten zijn:
  - 4 Custom Actions
  - Custom Values (skelet met placeholders, niet echte keys)
  - Custom Fields
  - Workflow "Voice Agent — Inbound call → TableWise"
- Expliciete waarschuwing: **vul in de master sub-account de Custom Values met dummy-placeholders**, niet met de echte API key van een bestaande klant — anders lekt die mee in elke import.

**Card B: "Per nieuwe klant — wat moet je nog instellen?"**
Genummerde lijst (de "max 6 handmatige stappen"):
1. Snapshot importeren in nieuwe sub-account.
2. **Custom Values** vervangen: `tablewise_api_key`, `tablewise_restaurant_id`, `restaurant_name`, `restaurant_phone`, `restaurant_address`, `opening_hours_short` (`tablewise_base_url` blijft).
3. **Voice AI Agent** opnieuw aanmaken (system prompt + first message uit tab Prompt) — kan niet via snapshot.
4. **Tools koppelen** aan de nieuwe agent (de Custom Actions zelf zitten in de snapshot).
5. **Telefoonnummer (Twilio)** koppelen.
6. **Trainen** per Custom Action (eenmalige test-run met realistische payload, response sample opslaan, field mapping bevestigen).

**Card C: "Custom Values placeholder-template (master sub-account)"**
Copy-block met dummy-waarden zodat de master nooit een echte klant-key bevat:
```
tablewise_api_key       = REPLACE_PER_CLIENT_tw_live_xxx
tablewise_restaurant_id = REPLACE_PER_CLIENT_uuid
tablewise_base_url      = https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1
restaurant_name         = REPLACE_PER_CLIENT
restaurant_phone        = REPLACE_PER_CLIENT
restaurant_address      = REPLACE_PER_CLIENT
opening_hours_short     = REPLACE_PER_CLIENT
```

### 2. System prompt snapshot-neutraal maken (tab "Prompt")

- Vervang in de gegenereerde prompt elke harde `${current?.restaurants?.name}` door `{{custom_values.restaurant_name}}`.
- Idem voor adres/telefoon/openingstijden indien die in de prompt staan.
- Reden: een snapshot bevat de prompt-tekst zoals jij die plakt; placeholders zorgen dat dezelfde tekst in elke sub-account werkt.

### 3. First-message snapshot-neutraal (tab "Prompt")

- Huidige tekst gebruikt `${current?.restaurants?.name ?? "<restaurant>"}` letterlijk → vervang in het copy-block door `{{custom_values.restaurant_name}}`.

### 4. Tools-bodies via Custom Value voor base_url (tab "Actions")

- Optioneel maar aanbevolen: bouw in elke tool de URL als `{{custom_values.tablewise_base_url}}/check_availability` i.p.v. de letterlijke `https://...supabase.co/functions/v1/check_availability`.
- Voordeel: één Custom Value omschakelen = staging/prod-split mogelijk, en geen URL hardcoded in snapshot-bodies.
- Toon een korte toggle/uitleg "Aanbevolen voor snapshot-distributie".

### 5. Stappenplan-tab — voeg Step 7 toe

- "Snapshot maken & hergebruiken" met verwijzing naar de nieuwe Snapshot-tab.

### 6. Banner bovenaan de pagina

- Subtiele info-callout: *"Bouw deze setup eenmalig in een 'master' sub-account, exporteer als snapshot, en gebruik die voor elke nieuwe klant. Zie tab Snapshot."*

## Niet in scope

- Geen wijziging in edge functions of database — dit is alléén documentatie en copy-blocks in de admin-pagina.
- Geen automatische snapshot-export via API (HighLevel snapshots maak je in hun UI).

## Resultaat

Na deze update kan een system admin:
- Eén keer een master sub-account inrichten met de copy-blocks uit deze pagina.
- Een snapshot exporteren waarvan de tekst-content (prompt, SMS, tool bodies) géén klant-specifieke data bevat.
- Bij elke nieuwe klant precies 6 handmatige stappen doen, allemaal expliciet gedocumenteerd in tab "Snapshot".
