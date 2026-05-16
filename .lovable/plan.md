Ik ga dit gericht oplossen in de bestaande app-e-mailflow:

1. **Bevestigingsmail: beheerlinks echt meesturen**
   - In de directe boekingsflow (`book_reservation`) worden `manageUrl` en `cancelUrl` nu niet meegestuurd naar de bevestigingstemplate, waardoor de knop in de template niet rendert.
   - Ik voeg daar de beheerlink en annuleerlink toe op basis van de reserveringstokens.

2. **Wijzigingsmail: beheerlinks toevoegen waar ze horen**
   - De wijzigingsmail “Wijziging bevestigd” krijgt dezelfde primaire knop **“Beheer je reservering”** en secundaire link **“Kan je niet komen? Laat het ons weten”**.
   - Ik voeg de vertaalde CTA-copy toe voor NL/EN/DE/FR.
   - Ik geef bij wijzigingsmails `manageUrl` en `cancelUrl` mee vanuit de manage-flow.
   - Annulering- en bedankmail blijven bewust zonder deze beheer/cancel CTA’s; bedankmail behoudt alleen de review-CTA.

3. **Reply-to adres corrigeren**
   - De automatische reserveringsmails vanuit de event-dispatcher lezen nu het veld “Reply-to inbox van het restaurant” niet mee.
   - Ik pas de restaurant-query aan zodat `guest_reply_to_email` wordt opgehaald.
   - Bij het versturen geef ik `fromName` en `replyTo` mee, zodat antwoorden naar het door de klant ingestelde restaurantadres gaan.
   - Ik pas dit ook toe op wijzigingsmails vanuit de gast-manage-flow.

4. **Deploy van e-mailfuncties**
   - Omdat dit wijzigingen onder `supabase/functions/` zijn, deploy ik de aangepaste backendfuncties daarna opnieuw zodat de live e-mails de nieuwe template en reply-to gebruiken.

5. **Controle**
   - Ik controleer via code/preview-data dat de bevestiging en wijziging-bevestigd template de CTA’s krijgen, en dat annulering/bedankmail buiten scope blijven zoals bedoeld.