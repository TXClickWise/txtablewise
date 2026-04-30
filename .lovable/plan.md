## Doel
Maak `VoiceAgentHelp.tsx` consistent met de admin-setupgids: gebruik standaard ClickWise/HighLevel contactvelden voor naam, telefoon en e-mail in plaats van losse template-variabelen.

## Wijziging
**Bestand:** `src/pages/app/help/VoiceAgentHelp.tsx` (regels 434–452)

**`book_reservation` voorbeeld JSON:**
- `{{first_name}}` → `{{contact.first_name}}`
- `{{last_name}}` → `{{contact.last_name}}`
- `{{phone}}` → `{{contact.phone}}`
- Toevoegen: `"email": "{{contact.email}}"`

**Toelichting eronder:**
- Verwijder de regel "first_name (verplicht), last_name (optioneel), phone (verplicht...)"
- Vervangen door uitleg dat naam/telefoon/e-mail uit de standaard ClickWise contactvelden komen via `{{contact.*}}` en niet als custom field hoeven te worden aangemaakt.

## Resultaat
Help-pagina en admin-setupgids tonen nu één consistente boodschap: identiteitsvelden = standaard `contact.*`, custom fields alleen voor TableWise-specifieke data.