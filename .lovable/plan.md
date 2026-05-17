## Probleem

Tijdens je testcall om 02:32 mislukte het boeken. In de logs zie ik twee pogingen van de voice agent naar `book_reservation` met:

```json
{
  "date": "2026-05-17",
  "time": "19:00",
  "party_size": 4,
  "first_name": "Jeroen",
  "last_name": "van Rossem",
  "phone": "+316…66"
}
```

→ beide kregen `400 Missing field: guest`.

De agent stuurt de gastgegevens **plat** (`first_name`, `last_name`, `phone`, `email`), maar `agent_api/book_reservation` verwacht een **genest** `guest`-object:

```json
{ "guest": { "first_name": "...", "last_name": "...", "phone": "...", "email": "..." } }
```

Hetzelfde issue zal optreden bij `update_reservation` en `create_waitlist_entry` als de agent daar ook flat keys stuurt.

## Plan

**Backend (agent_api soepeler maken — voorkeur)**

`supabase/functions/agent_api/index.ts`:

1. In `book_reservation` (regel ~197): vóór de "required"-check een normalisatiestap toevoegen. Als `payload.guest` ontbreekt maar er staan top-level `first_name` / `last_name` / `phone` / `email` / `name` / `full_name`, bouw daar dan `payload.guest` uit op (en split `full_name` op spatie als `first_name` ontbreekt).
2. Zelfde normalisatie in `create_waitlist_entry` (regel ~394): `guest_name` / `guest_phone` mogen ook afgeleid worden van `name`+`phone` of `first_name`+`last_name`.
3. In `update_reservation` (regel ~362): accepteer flat `phone`/`email`/`name` en map naar de bestaande veldnamen.
4. Geen wijziging aan de strikte `Missing field`-respons als ook flat fields ontbreken — error blijft duidelijk.

**Frontend (alleen documentatie)**

`src/pages/app/help/VoiceAgentHelp.tsx`: in de tool-schema-voorbeelden expliciet beide vormen tonen ("genest `guest`-object óf flat `first_name`/`last_name`/`phone`/`email`"), zodat klanten weten dat beide werken.

**Geen wijzigingen** aan `public_api` (externe partners houden contract), aan ClickWise-config of aan de agent-prompt zelf.

## Resultaat

Na deploy slaagt dezelfde voice-call payload zonder dat je iets in ClickWise/Retell hoeft aan te passen. De foutmelding "technisch probleem" verdwijnt en de reservering wordt aangemaakt.
