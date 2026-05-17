## Plan: Documenteer `large_group_sla_label` + `channel_label` in Voice-helpbestanden

### Context
De server composeert bij grote-groep-reserveringen het volledige belofte-bericht (bijv. "U ontvangt binnen 4 uur een bericht per SMS of e-mail.") in `response.message_for_guest`. De afzonderlijke waarden `tablewise_large_group_sla_label` en `tablewise_large_group_channel_label` worden WEL naar ClickWise gesynchroniseerd, maar zijn niet nodig als aparte placeholders in de Voice-prompt — de agent leest gewoon `message_for_guest` letterlijk. Deze waarden zijn wel handig voor ClickWise-templates (WhatsApp, e-mail, etc.).

### Wijzigingen

#### 1. `src/pages/app/help/VoiceAgentHelp.tsx`
- In **sectie 4 (Custom Values)**, onder het bestaande `<Callout tone="success">` blok met automatisch gepushte waarden, een nieuw lijstitem toevoegen:
  - Vermeld dat `tablewise_large_group_sla_label` en `tablewise_large_group_channel_label` ook automatisch worden gepusht uit **Instellingen → Grote groepen**.
  - Leg uit dat de Voice Agent deze NIET als aparte placeholders nodig heeft — `message_for_guest` bevat al de volledige zin.
  - Vermeld dat ze WEL bruikbaar zijn in ClickWise-templates (WhatsApp/e-mail) via `{{custom_values.tablewise_large_group_sla_label}}` en `{{custom_values.tablewise_large_group_channel_label}}`.

#### 2. `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx`
- In de `customValues` string (regels 269-277): toevoegen:
  ```
  tablewise_large_group_sla_label = <auto, gepusht door TableWise>
  tablewise_large_group_channel_label = <auto, gepusht door TableWise>
  ```
  met een comment dat deze voor ClickWise-templates zijn, niet voor de voice-prompt.
- In de `customValuesSnapshot` string (regels 281-289): dezelfde twee velden toevoegen met `REPLACE_PER_CLIENT` placeholders.

### Wat blijft ongewijzigd
- Edge functions, database, migraties, ClickWise-sync logica.
- De voice-prompt zelf (die al `message_for_guest` letterlijk laat voorlezen).
