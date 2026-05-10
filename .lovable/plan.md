## Doel

De gast krijgt het volledige reserveringstraject in zijn eigen taal: widget (`/r/:slug`), bevestigings-/manage-pagina (`/r/:slug/manage`) en alle e-mails (bevestiging, herinnering, annulering, groep-bericht, groep-beslissing, aftercare). Talen: **NL (default), EN, DE, FR**. De NL-copy is de "master"; AI vertaalt éénmalig naar EN/DE/FR en het restaurant kan elke vertaling daarna handmatig aanpassen.

## Aanpak in vier blokken

### 1. Taaldetectie & opslag

- Nieuw util `src/lib/i18n/detectLocale.ts`: leest `navigator.language`, mapt naar `nl|en|de|fr`, valt terug op `nl`.
- Widget krijgt een **taal-dropdown** rechtsboven (vlag + code) met handmatige override; keuze wordt bewaard in `localStorage` per restaurant-slug.
- `guests.language` (bestaat al) en nieuw veld `reservations.guest_language` worden gevuld met de gekozen taal bij `book_reservation`.
- Reminder/annulerings-/groep-mails lezen de taal van `reservations.guest_language` (fallback `guests.language`, dan `restaurant.default_locale`, dan `nl`).
- Nieuw veld `restaurants.default_locale` (default `nl`) voor het geval een grensregio-restaurant DE als default wil.

### 2. i18n-framework

- Installeer `react-i18next` + `i18next-browser-languagedetector` (lichtgewicht, geen routing-impact).
- Map `src/lib/i18n/`:
  - `index.ts` — init met 4 namespaces: `widget`, `manage`, `common`, `email`.
  - `locales/{nl,en,de,fr}/{widget,manage,common}.json` — UI-strings.
- Wikkel widget + manage-pagina in i18n-provider, vervang hardcoded NL-strings door `t('...')` keys.
- `date-fns` locales (`nl`, `enGB`, `de`, `fr`) dynamisch geladen op basis van gekozen taal.

### 3. E-mailtemplates meertalig + AI-vertaling

**Datamodel** (één migratie):
- Nieuwe tabel `restaurant_email_templates`:
  - `restaurant_id`, `template_key` (bv. `reservation-confirmation`), `locale` (`nl|en|de|fr`)
  - `subject`, `heading`, `body_intro`, `body_outro`, `signature` (jsonb of platte velden)
  - `is_ai_generated boolean`, `is_edited boolean`, `updated_at`
  - Unique: `(restaurant_id, template_key, locale)`
  - RLS: managers van het restaurant kunnen lezen/schrijven.
- Default seed: NL-rijen worden bij eerste gebruik gevuld met de bestaande hardcoded copy.

**Edge function `translate-email-templates`**:
- Input: `restaurant_id`, `template_key`, `target_locales[]` (default: `['en','de','fr']`).
- Leest de NL-master uit `restaurant_email_templates`, roept Lovable AI Gateway aan (`google/gemini-2.5-flash`) met een prompt die hospitaliteits-toon, restaurantnaam, en variabele-tokens (`{{guestName}}`, `{{dateLabel}}`, etc.) bewaart.
- Schrijft resultaten terug met `is_ai_generated=true`, `is_edited=false`.

**Settings-UI** (`src/pages/app/settings/MessagesSettings.tsx`):
- Per template-key een card met 4 tabs (NL/EN/DE/FR).
- NL = altijd master (bewerkbaar).
- EN/DE/FR: knop "Vertaal met AI" + bewerkveld + badge "AI-vertaald" of "Aangepast door restaurant".
- Knop "Vertaal alle templates" voor bulk-actie bij onboarding.

**Render-laag**:
- React Email templates (`reservation-confirmation.tsx` etc.) accepteren een `locale` prop én een `copy` prop met de gerenderde teksten.
- `send-transactional-email` haalt de juiste rij uit `restaurant_email_templates` (op basis van `restaurantId` + `templateName` + `locale`) en geeft die als `copy` mee. Bij ontbrekende vertaling → fallback naar NL.
- Onderwerpregels komen uit dezelfde tabel.

### 4. Trigger-aanpassingen

- `book_reservation`, `reminder_scheduler`, `manage_reservation` (cancel) en de groep-mail handlers: lees `reservation.guest_language`, geef mee als `locale` bij `send-transactional-email`.
- `unsubscribe`-pagina en `/r/:slug/manage`-pagina krijgen `?lang=` query-param zodat de juiste taal getoond wordt na een mail-klik.

## Bestanden (overzicht)

```text
NIEUW
  src/lib/i18n/index.ts
  src/lib/i18n/detectLocale.ts
  src/lib/i18n/locales/{nl,en,de,fr}/widget.json
  src/lib/i18n/locales/{nl,en,de,fr}/manage.json
  src/lib/i18n/locales/{nl,en,de,fr}/common.json
  src/components/widget/LanguageSwitcher.tsx
  supabase/functions/translate-email-templates/index.ts
  supabase/migrations/<ts>_email_templates_i18n.sql

GEWIJZIGD
  src/pages/ReserveWidget.tsx            (i18n, dynamic date-fns locale, LanguageSwitcher, language opslaan)
  src/pages/GuestManageReservation.tsx   (i18n + ?lang= param)
  src/pages/Unsubscribe.tsx              (i18n)
  src/pages/app/settings/MessagesSettings.tsx (4-tab template editor + AI-vertaal knop)
  supabase/functions/_shared/transactional-email-templates/*.tsx (accept locale + copy props)
  supabase/functions/send-transactional-email/index.ts (resolve copy per locale)
  supabase/functions/book_reservation/index.ts (sla guest_language op, geef locale mee)
  supabase/functions/reminder_scheduler/index.ts (locale)
  supabase/functions/manage_reservation/index.ts (locale bij cancel-mail)
```

## Migratie (samenvatting)

- `ALTER TABLE restaurants ADD COLUMN default_locale text NOT NULL DEFAULT 'nl';`
- `ALTER TABLE reservations ADD COLUMN guest_language text;`
- `CREATE TABLE restaurant_email_templates (...)` met unique constraint + RLS-policies (`is_restaurant_manager`).
- Seed-functie die bij eerste lees van een ontbrekende NL-rij de huidige hardcoded copy invoegt (idempotent).

## Uitrol-volgorde

1. Migratie + types.
2. i18n-framework + widget + manage-pagina (alleen UI, e-mails blijven nog NL).
3. `restaurant_email_templates` + render-laag (NL werkt, andere talen vallen terug op NL).
4. `translate-email-templates` edge function + Settings-UI met AI-knop.
5. Trigger-functies geven `locale` door.
6. QA: één testreservering per taal → controleer widget, manage-pagina én bevestigingsmail.

## Niet in scope

- Operator-UI (`/app`) blijft Nederlands — alleen gastvlakken worden meertalig.
- Geen automatische taal-detectie op basis van telefoonnummer of e-maildomein.
- Geen vertaling van vrije velden zoals `special_requests` (blijft in de taal van de gast).
- WhatsApp/SMS via ClickWise: ClickWise gebruikt zijn eigen `{{custom_values.*}}`-templates; meertaligheid daar is een vervolgstap (kan later op zelfde tabel aangesloten worden).
