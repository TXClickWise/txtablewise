## Wat speelt er

In ClickWise/HighLevel is een **Inbound Webhook** trigger pas op te slaan als er een **Mapping Reference** is gekozen. Dat is een eerder ontvangen sample-payload die HighLevel gebruikt om de JSON-structuur (en dus de `{{trigger.*}}` velden) te kennen. Zolang er nog geen request naar de unieke webhook-URL is gestuurd, blijft de dropdown leeg en krijg je de melding *"A Mapping Reference is required for an Inbound Webhook Trigger"*.

Dit zit nu nog niet in de helptekst (stap 7 op `/app/help/voice-agent`) en ook niet in de admin setup-tab. Daarom loopt elke nieuwe klant hier tegenaan.

## Doel

Gebruiker (en system admin) precies vertellen hoe ze die Mapping Reference krijgen, zonder zelf te hoeven Googlen.

## Aanpassing

**Bestand:** `src/pages/app/help/VoiceAgentHelp.tsx` — sectie *7. ClickWise — Inbound Webhook Workflow* (rond regel 509–515, het "Trigger" blokje).

Onder het "Trigger" blokje een nieuwe **Callout (tone="warning")** toevoegen met titel *"Mapping Reference verplicht — stuur eerst een test-payload"* en daarin de stappen:

1. Kopieer de **Inbound Webhook URL** die ClickWise toont (bv. `https://services.leadconnectorhq.com/hooks/...`).
2. Stuur eenmalig een voorbeeld-payload naar die URL — twee opties:
   - **Snel via TableWise:** open *Instellingen → API & Webhooks*, maak een tijdelijk webhook-endpoint aan met die URL en klik **Test** (event `reservation.created`). Of, voor admins: vanuit `AdminClickWiseVoiceSetupPage` tab *Inbound webhooks* de "Stuur testpayload" knop (indien aanwezig — anders cURL).
   - **Via cURL** (één-regel voorbeeld in een `CodeBlock`) met een minimale JSON die alle `{{trigger.*}}` velden bevat die we in Action 1 gebruiken (`phone`, `first_name`, `email`, `reservation_id`, `reservation_date`, `reservation_time`, `party_size`, `manage_token`).
3. Ga terug naar ClickWise → de trigger-popup → klik in de dropdown **Mapping Reference** op **"Check for new requests"**. De zojuist verzonden payload verschijnt — selecteer hem.
4. Klik **Save Trigger**. Vanaf nu zijn `{{trigger.phone}}` etc. beschikbaar in alle Actions.

Plus een kleine tip: als je later de payload-structuur uitbreidt (extra velden), moet je nogmaals een sample sturen en de Mapping Reference verversen, anders blijven nieuwe velden onzichtbaar.

## Eventueel ook

Korte spiegel-zin toevoegen in `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` rond regel 785 (`<li>ClickWise → Automation → Workflow → New → trigger: Inbound Webhook</li>`) — één regel "Eerst sample-payload sturen voor Mapping Reference, zie helptekst stap 7" zodat admins die de stappenkaart volgen niet vastlopen.

## Niet doen

- Geen wijzigingen aan edge functions of `dispatch_webhooks` — payload-structuur is al correct, dit is puur een ClickWise-configuratiestap die gedocumenteerd moet worden.
- Geen nieuwe knop/automatisering bouwen (kan later, eerst documentatie afmaken).
