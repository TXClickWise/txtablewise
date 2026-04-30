## Doel
Vervang in de admin-setupgids voor de ClickWise Voice Agent het onnodige gebruik van custom fields voor naam/telefoon/e-mail door de **standaard contactvelden** van HighLevel/ClickWise. Dat is simpeler, voorkomt dubbele velden en zorgt dat alle bestaande HL-features (SMS, e-mail, contact-merge, deduplicatie, opt-in tracking) automatisch werken.

## Wijzigingen op `AdminClickWiseVoiceSetupPage.tsx`

### 1. Custom fields lijst opschonen
**Verwijderen** uit het Custom Fields blok (zijn standaard in HL):
- `guest_first_name` → standaard `contact.first_name`
- `guest_last_name` → standaard `contact.last_name`
- `guest_email` → standaard `contact.email`
- `caller_phone` → standaard `contact.phone`

**Behouden als custom fields** (echt TableWise-specifiek):
- `preferred_language`, `reservation_id`, `reservation_code`, `reservation_date`, `reservation_time`, `party_size`, `notes`, `cancel_reason`, `outcome`, `summary`

Nieuwe sectie toevoegen boven custom fields: **"Standaard HighLevel velden die we hergebruiken"** met een korte mappingtabel:

```
TableWise veld        → HighLevel standaardveld
voornaam              → contact.first_name
achternaam            → contact.last_name
telefoon (beller)     → contact.phone
e-mail                → contact.email
```

### 2. Tool/action JSON-payloads aanpassen
In `book_reservation` action body:
```json
"first_name": "{{contact.first_name}}",
"last_name":  "{{contact.last_name}}",
"phone":      "{{contact.phone}}",
"email":      "{{contact.email}}"
```
(was: `{{guest_first_name}}`, `{{caller_phone}}`, etc.)

In `log_call` action body:
```json
"caller_phone": "{{contact.phone}}"
```

Toelichting toevoegen: tijdens een inbound call vult HL `contact.phone` automatisch met het nummer van de beller; bij nieuwe contacten wordt het contact automatisch aangemaakt op basis van dit nummer.

### 3. Workflow YAML aanpassen
Vervang in alle `send_sms`, `notify_team` en condition-stappen:
- `{{caller_phone}}` → `{{contact.phone}}`
- (eventuele `{{guest_email}}` → `{{contact.email}}`)

### 4. System prompt — kleine notitie
In de prompt toevoegen onder "Hoe je een reservering maakt": *"Naam, telefoon en e-mail komen uit het HighLevel-contact ({{contact.first_name}} {{contact.last_name}}, {{contact.phone}}, {{contact.email}}). Vraag alleen wat ontbreekt."*

### 5. Stap "Custom values & velden aanmaken"
- Eerst tonen: **"Geen actie nodig — deze velden zijn al standaard in ClickWise"** (groene check-stijl met de 4 standaardvelden).
- Daaronder: **"Custom fields die je wél moet aanmaken"** (de afgeslankte lijst).

## Bestanden
- `src/pages/app/admin/AdminClickWiseVoiceSetupPage.tsx` — enige wijziging.

## Resultaat
- Korter, duidelijker setup voor de admin (4 minder velden om handmatig aan te maken).
- Compatible met ClickWise/HL native contact-flows (deduplicatie op telefoon/e-mail, SMS/e-mail-acties zonder mapping).
- Voice agent payloads en workflows verwijzen consistent naar `{{contact.*}}` voor identiteitsvelden en custom fields alléén voor reserveringsdata.