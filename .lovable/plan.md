## Doel

De pagina **Instellingen → Gebruikers & rollen** wordt volledig werkend: zien wie toegang heeft, **medewerkers per e-mail uitnodigen**, openstaande uitnodigingen beheren, rollen wijzigen en leden verwijderen. Owners en managers krijgen die rechten; hosts en staff hebben alleen-lezen.

## Wat verandert (UX)

Pagina krijgt drie blokken:

1. **Teamleden** — lijst met naam (uit `profiles.display_name`), rol-badge, "jij"-marker, en (voor owner/manager, niet op zichzelf en niet op een owner) een menu: *Rol wijzigen* (manager/host/staff) en *Verwijderen*. Eigenaar kan niet verlaagd of verwijderd worden vanuit deze UI.
2. **Openstaande uitnodigingen** — e-mail, rol, "uitgenodigd door", verloopt over X dagen, knoppen *Opnieuw versturen* en *Intrekken*. Alleen zichtbaar voor owner/manager.
3. **Nieuwe uitnodiging** — formulier met e-mail, rol-keuze (manager / host / staff) en knop *Uitnodigen*. Owner-rol kan alleen door bestaande owner toegekend worden (via support of latere admin-flow); zit niet in deze dropdown.

Toaster bij succes; duidelijke fouten ("deze e-mail is al lid", "deze e-mail heeft al een openstaande uitnodiging", "alleen owners kunnen owners uitnodigen").

### Uitnodigings-flow voor de ontvanger

1. E-mail met "Je bent uitgenodigd voor *{restaurant}* als *{rol}*" en knop "Uitnodiging accepteren" → `https://<app>/invite?token=...`.
2. Op `/invite`:
   - Token wordt server-side gevalideerd via een publieke RPC die alleen rolling info teruggeeft (restaurantnaam, rol, e-mail, geldig).
   - Niet ingelogd: knop *Account aanmaken* (naar `/auth?mode=signup&email=...&invite=...`) of *Inloggen* met dezelfde e-mail. Na auth keert hij terug naar `/invite?token=...`.
   - Ingelogd en e-mail komt overeen: knop *Word lid van {restaurant}* → roept RPC `accept_member_invitation(token)` aan → redirect naar `/app/today`.
   - Ingelogd maar andere e-mail: duidelijke melding ("Log in met {email} of vraag een nieuwe uitnodiging op je huidige adres").

## Technische details

### Database — migratie

Nieuwe tabel:

```sql
create table public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  role public.app_role not null check (role in ('manager','host','staff')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, lower(email)) deferrable initially deferred
);

grant select, insert, update on public.member_invitations to authenticated;
grant all on public.member_invitations to service_role;
alter table public.member_invitations enable row level security;
```

Policies:
- `select`: `is_restaurant_member(restaurant_id) or is_system_admin()` (zodat owners/managers + ledenlijst kunnen lezen; geen anon).
- `insert/update`: alleen `is_restaurant_manager(...)` of `is_system_admin()` (de echte uitnodig-logica draait via RPC voor validatie).
- Het accepteren loopt via een SECURITY DEFINER RPC, niet via directe writes.

RPC's (alle `security definer`, `set search_path = public`):

```sql
-- Owner/manager-only invite met validatie + duplicate-checks.
create function public.invite_member(
  _restaurant_id uuid, _email text, _role app_role
) returns jsonb …

-- Publiek leesbaar maar alleen via token: voor /invite preview.
create function public.get_invitation_preview(_token uuid) returns jsonb …
grant execute on function public.get_invitation_preview(uuid) to anon, authenticated;

-- Ingelogde user accepteert; e-mail moet matchen auth.users.email.
create function public.accept_member_invitation(_token uuid) returns jsonb …
grant execute on function public.accept_member_invitation(uuid) to authenticated;

-- Beheer
create function public.revoke_member_invitation(_invitation_id uuid) returns void …
create function public.resend_member_invitation(_invitation_id uuid) returns jsonb …

-- Membership-beheer
create function public.update_member_role(_member_id uuid, _role app_role) returns void …
create function public.remove_member(_member_id uuid) returns void …
```

Regels in deze RPC's:
- Alleen `is_restaurant_manager(restaurant_id) or is_system_admin()` voor invite/revoke/resend/update/remove.
- `update_member_role` en `remove_member` blokkeren als doel-rol = `owner` of als doelgebruiker = jezelf.
- `invite_member` weigert `role = 'owner'`, weigert als e-mail al lid is, hergebruikt bestaande pending uitnodiging in plaats van duplicaat (refresh expires_at + nieuw token).
- `accept_member_invitation` checkt status=pending, niet verlopen, `lower(email) = lower(auth.users.email)`; zet status=accepted en doet `insert into restaurant_members` in één transactie.

Audit-log entry per actie (`member.invited`, `member.role_changed`, `member.removed`, `invitation.revoked`, `invitation.accepted`).

### Edge function `send-member-invite`

Nieuwe service-role functie die door `invite_member`/`resend_member_invitation` wordt aangeroepen via `supabase.functions.invoke` vanuit de frontend (of via DB trigger op insert; we kiezen voor frontend-trigger zodat we de gebruiker meteen feedback geven).

Stappen:
1. Verifieer JWT van de aanroeper, check `is_restaurant_manager(restaurant_id)` via een query.
2. Haal invitation + restaurantnaam op.
3. Bouw `inviteUrl = ${SITE_URL}/invite?token=${token}`.
4. Verstuur via bestaande `send-transactional-email` met nieuw template `member-invitation` (`templateData: { restaurantName, role, inviterName, inviteUrl, expiresAt }`).
5. Geef `{ ok: true }` terug.

### Nieuw e-mail template

`supabase/functions/_shared/transactional-email-templates/member-invitation.tsx` — React Email template met restaurantbranding, CTA "Uitnodiging accepteren", vervaldatum, optie om te negeren. Registreer in `registry.ts`. Daarna `deploy_edge_functions` voor `send-transactional-email` (én `send-member-invite`).

### Frontend

- **`src/services/teamMembers.ts`** (nieuw) — wrappers voor RPC's + `supabase.functions.invoke('send-member-invite')`. Types voor `Invitation`, `MemberWithProfile`.
- **`src/pages/app/settings/UsersRolesSettings.tsx`** — herschrijven:
  - Haal leden op + join met `profiles` (via `auth.users.email` is niet direct mogelijk in client; we slaan email op in het invitation-record en koppelen op accept). Voor reeds bestaande leden tonen we `display_name` (of "Onbekend" fallback). Eigen rij krijgt label "Jij".
  - Pending invitations tabel.
  - `InviteMemberDialog` met e-mail-input + rolselect.
  - Acties (rol wijzigen, verwijderen, intrekken, opnieuw versturen) als dropdown-menu per rij.
  - Read-only fallback als huidige rol ≠ owner/manager.
- **`src/pages/AcceptInvite.tsx`** (nieuw, route `/invite`) — gebruikt `get_invitation_preview` voor de drie staten (geldig+match, geldig+andere e-mail, ongeldig/verlopen). Knoppen "Account aanmaken" / "Inloggen" / "Word lid".
- **Auth-pagina** krijgt support voor `?email=…&invite=…` (preset e-mailveld, na succes redirect naar `/invite?token=…`).
- **Routes** in `src/App.tsx`: publieke route `/invite`.

### Wat NIET verandert
- `auth.users`-tabel en bestaande RLS op andere tabellen blijven onaangetast.
- Owners worden niet via deze UI aangemaakt of verwijderd (blijft via `create_restaurant_with_owner` RPC en support).
- We bouwen geen multi-restaurant uitnodigingen in één keer; één invite per restaurant.

## Verificatie
1. Owner ziet zichzelf in lijst met badge "Jij", rol "Owner", zonder verwijder-knop.
2. Owner nodigt nieuw e-mailadres uit als "host" → pending-rij verschijnt, e-mail komt binnen.
3. Ontvanger opent link → ziet restaurantnaam + rol → kan account maken → na inloggen → "Word lid" → komt op `/app/today` met host-rechten.
4. Tweede uitnodiging naar zelfde adres → backend hergebruikt pending invite (geen duplicaat).
5. Owner kan rol van een ander lid wijzigen (manager↔host↔staff); kan niemand naar owner promoveren.
6. Host/staff ziet de pagina alleen-lezen.
7. Intrekken → invitation krijgt status `revoked` en link wordt geweigerd.
