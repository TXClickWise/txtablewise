Ik heb de huidige prompt en help/admin-teksten gecontroleerd. Je hebt gelijk: er staan nog meerdere ongewenste SMS/WhatsApp/SMS-bevestigingsteksten in de ClickWise Voice Agent setup, waaronder precies bij `requires_manual_approval=true`.

Plan:

1. Corrigeer de System Prompt in `VoiceAgentHelp.tsx`
   - Vervang `create_reservation` door de werkelijke actionnaam `book_reservation`.
   - Verwijder alle zinnen waarin de agent belooft dat de gast een persoonlijke bevestiging per SMS/SMS/WhatsApp krijgt.
   - Nieuwe grote-groep-flow:
     - Altijd eerst `check_availability`.
     - Daarna, na mondelinge bevestiging, altijd `book_reservation` proberen zolang de engine dit accepteert.
     - Bij `requires_manual_approval=true`: de boeking/aanvraag is opgeslagen in TableWise en wacht intern op handmatige goedkeuring; de agent zegt alleen dat het team de reservering beoordeelt en contact opneemt als er iets aangepast moet worden. Geen SMS-belofte.
     - Bij `TW_409_PARTY_TOO_LARGE`: niet boeken; Call Transfer als toegestaan, anders terugbelnotitie via `log_call`.

2. Corrigeer de admin ClickWise setup-prompt in `AdminClickWiseVoiceSetupPage.tsx`
   - De korte prompt bovenin uitbreiden met dezelfde 2-drempel grote-groep-logica.
   - De algemene bevestigingszin `Je krijgt een bevestiging per sms/whatsapp` vervangen door een neutrale mondelinge bevestiging zonder kanaalbelofte.
   - De webhook/CRM-teksten aanpassen van “stuur bevestigings-SMS/WhatsApp” naar “optionele bevestigingsworkflow indien ingericht”, zodat de master snapshot niet meer impliceert dat SMS verplicht of beloofd is.

3. Corrigeer alle setup-bundles en helptekst-notities
   - Verwijder/neutraliseer `gast krijgt automatisch per SMS/WhatsApp` uit de one-click bundle.
   - Pas sectie 7b aan waar nu nog staat dat grote groepen via SMS-bevestiging vanuit het team lopen.
   - Houd alleen callback/Call Transfer teksten over voor groepen boven `large_group_max_online_request`, omdat dat wél een fallback is en geen boekingsbevestiging.

4. Functionele eindcontrole
   - Zoek opnieuw op `persoonlijke bevestiging`, `bevestiging per SMS`, `SMS/WhatsApp`, `sms/whatsapp` en `create_reservation` binnen de relevante prompt/setup-bestanden.
   - Controleer dat de uiteindelijke instructie consistent is met de backend:
     - 10p: `confirmed` + `large_group_status='approved'`.
     - 17p: `pending` + `requires_manual_approval=true` + `large_group_status='awaiting_approval'`.
     - > max online request: `TW_409_PARTY_TOO_LARGE` → transfer/callback.

Na implementatie moet je de vernieuwde prompt opnieuw plakken in de live Eigeweis sub-account én in de master snapshot, anders blijft ClickWise met de oude tekst werken.