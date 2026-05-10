## Doel

Gast-emails activeren vanuit TableWise zelf, met Reply-To naar het restaurant zodat conversaties (vooral bij grote-groep custom berichten) in hun eigen inbox terechtkomen. Hybride met ClickWise: ClickWise neemt over zodra dat live staat.

## Architectuur

```text
Trigger (reservering / reminder / large-group reply)
        │
        ▼
emailDispatcher service
   ├─ ClickWise live?  →  integration_events  → ClickWise verzendt
   └─ anders          →  send-transactional-email edge function
                              │
                              ▼
                       Lovable Emails queue
                              │
                              ▼
                    From: reservations@reservations.txtablewise.nl
                    From-name: "Bistro X via TableWise"
                    Reply-To: <restaurant.guest_reply_to_email>
```

## Onderdeel 1 — E-mail domein & infrastructuur

- Subdomein **`reservations.txtablewise.nl`** opzetten via de domein-setup dialog.
- Email-infra wordt automatisch aangemaakt (queue, suppression, log).
- Transactional templates worden gescaffold.

## Onderdeel 2 — Database

Nieuw veld op `restaurants`:
- `guest_reply_to_email text` — adres waar antwoorden van gasten heen gaan (ingesteld door owner).
- `guest_email_enabled boolean default true` — kill-switch per restaurant.

Nieuwe tabel `guest_email_log` (alleen aanvullend op `email_send_log` voor app-level context):
- `restaurant_id`, `reservation_id`, `large_group_request_id`, `kind` (confirmation/reminder/cancellation/large_group_reply/custom), `recipient_email`, `message_id`, `status`, `sent_at`, `error`.
- RLS: leden van het restaurant kunnen lezen.

## Onderdeel 3 — Templates (React Email)

Onder `supabase/functions/_shared/transactional-email-templates/`:

1. **`reservation-confirmation.tsx`** — bevestiging na booking. Props: restaurant naam/adres/tel, datum, tijd, partySize, manage-link, cancel-link.
2. **`reservation-reminder.tsx`** — 24u herinnering, met reconfirm-link wanneer aan.
3. **`reservation-cancellation.tsx`** — bevestiging van annulering.
4. **`large-group-message.tsx`** — custom bericht vanuit large-group scherm. Props: bodyText (door medewerker getypt), restaurantnaam, medewerker-naam, party_size, preferred_date.
5. **`large-group-decision.tsx`** — bij goedkeuring/afwijzing van een groepsaanvraag.

Alle templates: brand-kleuren uit `index.css`, witte body, Nederlands, gastvrije toon. Onderaan elk template — **niet** als unsubscribe (die voegt het systeem toe) maar als duidelijke hint:

> *"Heeft u een vraag of wilt u iets wijzigen? Beantwoord deze mail — uw bericht komt direct bij {restaurant.name} terecht."*

## Onderdeel 4 — Service-laag

Nieuwe `src/services/guestEmail.ts`:

```ts
sendGuestEmail({
  restaurantId, kind, recipientEmail, reservationId?, largeGroupRequestId?,
  templateData, replyToOverride?
})
```

Logica:
1. Laad restaurant: `guest_email_enabled`, `guest_reply_to_email`, ClickWise live-status, naam.
2. Als ClickWise live = `true` en `kind` is iets dat ClickWise afhandelt → schrijf `integration_event` en stop. Geen dubbele mail.
3. Anders: bouw payload met:
   - `templateName`
   - `recipientEmail`
   - `idempotencyKey` = `${kind}-${reservationId|largeGroupRequestId}`
   - `templateData` inclusief `restaurantName`, `replyHintEmail`
   - `replyTo` = `replyToOverride ?? guest_reply_to_email ?? null`
   - `fromName` = `"${restaurant.name} via TableWise"`
4. Roep `send-transactional-email` aan.
5. Log naar `guest_email_log` met message_id.

## Onderdeel 5 — Edge function aanpassing

`send-transactional-email` heeft standaard geen `replyTo`/`fromName` per call. We breiden de request body uit met optionele `replyTo` en `fromName` velden en geven die door aan de Mailgun call (`h:Reply-To` header). Defaults blijven werken voor andere mails.

## Onderdeel 6 — Trigger-punten in de app

| Trigger | Locatie | Kind |
|---|---|---|
| Nieuwe bevestigde reservering | `book_reservation` edge function | confirmation |
| 24u reminder (cron) | `reminder_scheduler` edge function | reminder |
| Annulering (gast of restaurant) | `manage_reservation` action `cancel` | cancellation |
| Large-group goedkeuring/afwijzing | `manage_reservation` action `approve_large_group` / `decline_large_group` | large_group_decision |
| Custom bericht vanuit `LargeGroupsPage` | nieuwe knop "Bericht sturen" → dialoog → `sendGuestEmail` met `kind: 'large_group_message'` en `bodyText` | large_group_message |

Bestaande knop "Bericht sturen" gaat nu via `guestEmail` i.p.v. alleen ClickWise event (met dezelfde hybride logica).

## Onderdeel 7 — Settings UI

Op `/app/settings/general` (of nieuw blok "Gast-emails"):
- Toggle **"Stuur emails naar gasten vanuit TableWise"** → `guest_email_enabled`.
- Tekstveld **"Antwoordadres voor gastmail"** → `guest_reply_to_email` (placeholder: `reservations@uwrestaurant.nl`).
- Helptext: *"Wanneer een gast antwoordt op een mail van TableWise, komt het antwoord op dit adres binnen. Laat leeg om antwoorden uit te schakelen — dan staat in de mail een telefoonnummer als terugkoppeling."*
- Validatie: geldig e-mail formaat.
- Status-indicator: badge "ClickWise actief" als ClickWise live, met uitleg dat ClickWise dan reserveringsmail verstuurt.

## Onderdeel 8 — Large-group conversatie UI

In `LargeGroupsPage` per aanvraag:
- Lijst van eerder verzonden custom berichten (uit `guest_email_log` waar `kind='large_group_message'`).
- Knop **"Bericht sturen"** → dialoog met textarea, kies "Aanvullende vraag" of "Antwoord op vraag van gast", verzendknop.
- Onderaan de uitleg: *"Antwoord van de gast komt binnen op {guest_reply_to_email}."*
- Geen inbound parsing in dit plan — antwoord komt fysiek in de inbox van het restaurant.

## Onderdeel 9 — Wat verandert er NIET

- Geen wijziging aan `auth-email-hook` (login-mails blijven default).
- Geen marketing-mails.
- Geen inbound mail parsing (komt eventueel in een later plan).
- ClickWise live blijft de aangewezen route voor white-label op eigen domein.

## QA

1. Domein verifiëren in Cloud → Emails.
2. Test-reservering aanmaken (publiek widget) → bevestigingsmail komt aan met restaurantnaam in From-naam.
3. Antwoorden op de mail → komt aan op `guest_reply_to_email`.
4. ClickWise live aanzetten op een testrestaurant → bij volgende reservering verstuurt TableWise zelf NIET, alleen integration_event.
5. Large-group custom bericht versturen → mail aan gast met duidelijke "antwoord komt bij restaurant" hint.
6. Annulering door gast → cancellation-mail.
7. `guest_email_log` toont alles met message_id en status.
