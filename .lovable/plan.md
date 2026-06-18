## Diagnose

De uitnodiging naar `bediening@eigeweis.com` is wél verstuurd. In `email_send_log`:

- 14:31:24 — `pending`
- 14:31:28 — **`sent`** (geaccepteerd door Mailgun, geen error)
- Geen rij in `suppressed_emails`, geen bounce, geen complaint.

Hele flow werkt correct:
`invite_member` RPC → `send-member-invite` edge function → `send-transactional-email` → queue → Mailgun = `sent`.

Het probleem zit dus **na** de mailprovider (spamfilter van eigeweis.com, greylisting, of typo in adres) — niet in onze code.

## Wat de gebruiker nu kan doen

1. Spam/Junk-folder van `bediening@eigeweis.com` checken.
2. Verifiëren dat het adres correct is (geen `eigenwijs` etc.).
3. Eventueel `noreply@…` whitelisten bij hun mailprovider.

## Voorgestelde verbetering (code)

Voeg een **manager-fallback** toe zodat een uitnodiging nooit "vast" zit op mail-aflevering:

1. **`UsersRolesSettings.tsx`** — bij openstaande uitnodigingen: voeg knop **"Kopieer uitnodigingslink"** toe naast "Opnieuw versturen" / "Intrekken".
2. **`teamMembers.ts`** — nieuwe helper `getInvitationLink(invitationId)` die de `token` ophaalt via een nieuwe lichte RPC `get_invitation_link(_invitation_id uuid)` (alleen voor managers van het restaurant of system admin). Retourneert `{ token }`. UI bouwt `${window.location.origin}/invite?token=…`.
3. **Invite-dialoog** — na succesvol versturen direct de link tonen met copy-knop + toast "Uitnodiging verstuurd. Komt de mail niet aan? Deel deze link direct."

Geen wijzigingen aan email-infra nodig. Klein, focused, lost dit type situatie permanent op.

### Bestanden
- nieuw: `supabase/migrations/<timestamp>_invitation_link_rpc.sql` — `get_invitation_link` RPC + grants
- edit: `src/services/teamMembers.ts` — `getInvitationLink()` helper
- edit: `src/pages/app/settings/UsersRolesSettings.tsx` — copy-link knop in lijst + na uitnodigen
