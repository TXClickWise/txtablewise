# ClickWise Snapshot Setup - TableWise Voice AI

Deze checklist beschrijft hoe de TableWise Voice AI module als HighLevel / ClickWise snapshot uitgerold moet worden naar nieuwe of bestaande subaccounts.

## Doel

Een herbruikbare snapshot waarmee een restaurant snel beschikt over:

- Voice AI Agent voor reserveringen
- Custom Actions naar TableWise `agent_api`
- minimale TableWise Custom Values
- workflows voor opvolging en logging
- tags en custom fields voor rapportage
- testscenario's voor Nederlands, Duits en Engels

## Uitrolroutes

### Route 1 - Bestaand subaccount

Gebruik wanneer het restaurant al een ClickWise / HighLevel subaccount heeft.

Proces:

1. Pas de snapshot toe op het bestaande subaccount.
2. Vul of controleer native subaccountgegevens in HighLevel.
3. Vul in TableWise het ClickWise `location_id` in.
4. Run `clickwise_sync_custom_values`.
5. Controleer of de TableWise custom values in HighLevel bestaan.
6. Controleer de Voice AI Agent en Custom Actions.
7. Koppel het telefoonnummer handmatig.
8. Test in sandbox.
9. Zet live.

### Route 2 - Nieuw subaccount

Gebruik wanneer TableWise / ClickWise een nieuw subaccount aanmaakt.

Proces:

1. Zorg dat het restaurant in TableWise compleet is ingevuld.
2. Activeer ClickWise add-on in TableWise admin.
3. Run `clickwise_provision_subaccount`.
4. HighLevel maakt een nieuw subaccount aan via SaaS plan.
5. Snapshot komt via het SaaS plan mee.
6. TableWise pusht de custom values.
7. Koop/koppel LC Phone nummer handmatig.
8. Dien indien nodig Twilio Regulatory Bundle in.
9. Koppel het nummer aan de Voice AI Agent.
10. Test in sandbox.
11. Zet live.

## Native HighLevel gegevens

Vul deze zo veel mogelijk op subaccountniveau in:

- bedrijfsnaam
- adres
- postcode
- plaats
- land
- timezone
- telefoon
- e-mail
- website

Let op: voor Voice AI prompts en Custom Action bodies gebruikt deze integratie toch expliciete `tablewise_` custom values, omdat `{{location.*}}` daar niet betrouwbaar rendert.

## TableWise Custom Values

Deze worden via TableWise gesynchroniseerd:

```text
tablewise_base_url
tablewise_restaurant_id
tablewise_webhook_secret
tablewise_api_key
tablewise_anon_key
tablewise_restaurant_name
tablewise_timezone
tablewise_large_group_sla_label
tablewise_large_group_channel_label
```

Deze waarden mogen door de snapshot gebruikt worden als:

```text
{{custom_values.tablewise_base_url}}
{{custom_values.tablewise_restaurant_id}}
{{custom_values.tablewise_webhook_secret}}
{{custom_values.tablewise_api_key}}
{{custom_values.tablewise_anon_key}}
{{custom_values.tablewise_restaurant_name}}
{{custom_values.tablewise_timezone}}
{{custom_values.tablewise_large_group_sla_label}}
{{custom_values.tablewise_large_group_channel_label}}
```

## Aanbevolen Custom Fields

Maak deze contactvelden in de snapshot aan voor opvolging en rapportage:

```text
tablewise_last_reservation_id
tablewise_last_reservation_status
tablewise_last_reservation_date
tablewise_last_reservation_time
tablewise_last_party_size
tablewise_last_call_outcome
tablewise_last_call_summary
tablewise_requires_followup
tablewise_followup_reason
tablewise_large_group_request
tablewise_waitlist_requested
tablewise_voice_language
```

## Aanbevolen tags

```text
TW - Voice AI
TW - Booked
TW - Changed
TW - Cancelled
TW - Pending Approval
TW - Manual Follow-up
TW - Large Group
TW - Waitlist
TW - API Error
TW - No Action
```

## Aanbevolen workflows

### TW - Voice AI - Post Call Processing

Trigger:

- Voice AI call completed
- of `log_call` webhook ontvangen

Acties:

- call outcome opslaan
- call summary opslaan
- tag toevoegen op basis van outcome
- eventueel contactveld `tablewise_last_reservation_id` vullen

### TW - Manual Follow-up Needed

Trigger:

- `tablewise_requires_followup = yes`
- of tag `TW - Manual Follow-up`

Acties:

- interne notificatie naar restaurantteam
- taak aanmaken
- eventueel pipeline/opportunity aanmaken

### TW - Large Group Request

Trigger:

- tag `TW - Large Group`
- of `tablewise_large_group_request = yes`

Acties:

- notify eigenaar/manager
- taak aanmaken
- reminder als niet opgevolgd

### TW - API Error Alert

Trigger:

- tag `TW - API Error`
- of outcome `fallback_to_human`

Acties:

- notify ClickWise/TableWise beheerder
- taak voor technische controle

### TW - Waitlist Created

Trigger:

- tag `TW - Waitlist`
- of `tablewise_waitlist_requested = yes`

Acties:

- interne melding
- eventueel bevestiging afhankelijk van restaurantbeleid

## Voice AI Agent instellingen

Aanbevolen:

```text
Mode: Advanced Mode
Language: Multi-language / Dutch, German, English
Creativity/temperature: low
Response length: short
Interruption handling: enabled
Tool timeout: 10-20 seconds
Retry: 1x
```

Greeting:

```text
Goedendag, u spreekt met de reserveringsassistent van {{custom_values.tablewise_restaurant_name}}. Waarmee kan ik u helpen?
```

## Handmatige onderdelen

Deze worden niet volledig automatisch meegenomen of blijven bewust handmatig:

1. LC Phone nummer kopen/koppelen
2. Twilio Regulatory Bundle voor NL geografische nummers
3. Nummer toewijzen aan Voice AI Agent
4. Eventuele provider-specifieke voice/stem keuze
5. Laatste live testcall

## Acceptatiecriteria

De snapshot is klaar wanneer:

- alle Custom Actions werken in sandbox
- `reservation_request` succesvol boekt
- grote groep niet foutief definitief bevestigd wordt
- pending approval correct wordt uitgesproken
- wijziging en annulering werken
- `log_call` wordt opgeslagen
- Nederlandse, Duitse en Engelse testcalls goed verlopen
- Call Transfer alleen gebeurt na engine-response `transfer_call`
- geen placeholder-namen worden geaccepteerd
