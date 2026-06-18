## Huidige aanmeldsituatie

- **E-mail + wachtwoord** (min. 8 tekens, max 72) en **Google login** (via Lovable OAuth-broker) op `/app/login`.
- Na `signUp()` navigeert de code direct naar `/app` → dit werkt alleen als **auto-confirm e-mail aan staat** (geen verificatielink). Als verificatie aan staat, blijven nieuwe gebruikers hangen zonder duidelijke melding.
- **Geen "wachtwoord vergeten"-flow** en **geen `/reset-password`-pagina**.
- **HIBP-check** (gelekte wachtwoorden) staat niet aan.
- E-maildomein `notify.txtablewise.nl` is geverifieerd, maar er zijn **nog geen gebrande auth-mails** — Lovable verstuurt standaardteksten in default-stijl namens een Lovable-afzender.
- Onboarding (`/onboarding` → `create_restaurant_with_owner` RPC) werkt: na aanmaken restaurant trial van 14 dagen + eventueel direct Stripe checkout als plan-keuze in `localStorage` staat.
- Anonieme sign-ups: uit (correct).

## Wat je minimaal nodig hebt voor pilot live

### 1. Beslissing: e-mailverificatie aan of uit?
- **Aan** (aanbevolen voor pilot): zekerheid dat het e-mailadres klopt, geen fake accounts, betere deliverability voor latere mails. Wrijving: 1 extra klik in inbox.
- **Uit** (auto-confirm): snelste onboarding, maar je hebt geen garantie op een geldig e-mailadres voor latere reservation-mails.

→ **Aanbeveling: aan**, omdat TX TableWise sterk leunt op e-mail (bevestigingen, reminders, reviews).

### 2. Auth-flow aanpassen in de app
- `Auth.tsx`: na `signUp()` niet meteen naar `/app` navigeren als verificatie aan staat — toon een "Check je inbox"-scherm. `emailRedirectTo` blijft `${window.location.origin}/app` (gaat na klik door naar onboarding/app).
- Nieuwe `/forgot-password`-pagina met `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/reset-password })`.
- Nieuwe `/reset-password`-pagina (public route) die `type=recovery` in URL-hash detecteert, een nieuw wachtwoord-formulier toont en `supabase.auth.updateUser({ password })` aanroept.
- Linkje "Wachtwoord vergeten?" onder het login-formulier.
- Routes registreren in `App.tsx` (beide public, geen `RequireAuth`).

### 3. Auth-configuratie
Via `supabase--configure_auth`:
- `auto_confirm_email: false` (verificatie aan)
- `password_hibp_enabled: true` (blokkeer gelekte wachtwoorden)
- `disable_signup: false`
- `external_anonymous_users_enabled: false`

### 4. Gebrande auth-mails (aanbevolen — domein is al klaar)
Scaffold de zes auth-templates (signup-confirm, recovery, magic-link, invite, email-change, reauthentication) op het al geverifieerde `notify.txtablewise.nl`, in NL en met TableWise-stijl (kleuren uit `index.css`, logo). Daarna deployen.

→ Zonder dit blijven auth-mails komen van een Lovable-afzender in default styling, wat onprofessioneel oogt richting pilot-klanten.

### 5. Verificatie vóór live
- Test signup met een echt mailadres → bevestigingsmail komt aan op `notify.txtablewise.nl`, link werkt, gebruiker komt op `/onboarding`.
- Test "wachtwoord vergeten" → reset-mail, klik, nieuw wachtwoord, login werkt.
- Test Google login → OAuth-provider is geconfigureerd in Cloud (anders krijg je "Unsupported provider").
- Test op productie-domein `txtablewise.nl` (custom domain) zodat OAuth-redirect klopt.

## Niet-auth zaken die ook gecheckt moeten worden vóór pilot live

Niet binnen deze plan-scope, maar wel relevant — meld het kort na implementatie:
- **Pilot Launch instellingen per restaurant**: demo-data purge, `is_live` markering, widget-URL/QR (volgens project-memory `features/pilot-launch`).
- **Betaling**: Stripe checkout flow eind-tot-eind getest (Basic/Pro), webhook actief.
- **Reservation-mails**: `send_reservation_email` edge function en restaurant_email_templates per pilot-restaurant ingevuld.
- **ClickWise koppeling**: per pilot-restaurant snapshot-flow doorlopen (6 handmatige stappen).

## Wijzigingen samengevat

| Bestand | Wijziging |
|---|---|
| `src/pages/Auth.tsx` | "Check je inbox"-state na signup; link "Wachtwoord vergeten?" |
| `src/pages/ForgotPassword.tsx` | Nieuw — e-mail invoeren, `resetPasswordForEmail` |
| `src/pages/ResetPassword.tsx` | Nieuw — recovery-token afhandelen, nieuw wachtwoord zetten |
| `src/App.tsx` | Routes `/forgot-password` en `/reset-password` (public) |
| Auth-config | `auto_confirm_email=false`, `password_hibp_enabled=true` |
| `supabase/functions/auth-email-hook/` + `_shared/email-templates/*` | Scaffold + NL/brand styling, deploy |

Geen migraties nodig, geen schema-wijzigingen.
