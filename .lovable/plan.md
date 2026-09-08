# Inloggen zonder bevestiging: nakijken en dichtzetten

## Wat ik nu feitelijk zie

Beide bestaande accounts (`jeroen@eigeweis.com` en `backoffice@eigeweis.com`) zijn in april aangemaakt en waren op datzelfde moment al als "bevestigd" gemarkeerd. Er is voor die accounts nooit een bevestigingsmail nodig geweest. Dat verklaart waarom je nu gewoon kunt inloggen: het account bestond al, was al bevestigd, en het wachtwoord van toen werkt nog.

Wat ik hiermee nog niet weet: of de instelling "e-mailadres automatisch bevestigen" op dit moment nog aan staat voor nieuwe aanmeldingen. Die instelling kan ik niet uitlezen, alleen zetten.

## Plan

1. Zet de aanmeldinstellingen expliciet op de gewenste stand: automatisch bevestigen uit, bescherming tegen gelekte wachtwoorden aan, anonieme aanmeldingen uit, aanmelden blijft open.
2. Test daarna met een verse test-mailadres een echte aanmelding en controleer dat:
   - er geen sessie ontstaat vóór bevestiging (je komt op het "check je inbox"-scherm),
   - de bevestigingsmail daadwerkelijk verstuurd wordt,
   - inloggen zonder bevestiging geweigerd wordt.
3. Test ook nog één keer "wachtwoord vergeten" end-to-end.
4. Ruim het testaccount daarna op.

Bestaande accounts blijven werken zoals nu; die zijn en blijven bevestigd.

## Technisch

- `supabase--configure_auth` met `auto_confirm_email: false`, `password_hibp_enabled: true`, `external_anonymous_users_enabled: false`, `disable_signup: false`.
- Verificatie via de auth REST API (signup + signin) en `email_send_log` / functielogs.
- Geen wijzigingen aan app-code, UI of routes.
