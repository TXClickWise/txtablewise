## Doel
Snel kunnen inloggen als (owner-)admin zonder e-mailbevestiging, zodat je TableWise meteen kunt testen.

## Wat ik ga doen

1. **Auto-confirm e-mail aanzetten** voor dit project via de auth-configuratie. Nieuwe registraties zijn dan direct ingelogd, geen bevestigingsmail nodig.

2. **Korte instructie** geven hoe je vervolgens admin/owner wordt:
   - Ga naar `/auth` → registreer met e-mail + wachtwoord (of Google).
   - Je wordt doorgestuurd naar `/onboarding`.
   - Vul restaurantnaam in → de database-functie `create_restaurant_with_owner` koppelt jouw user automatisch als **owner** (volledige rechten: alle managementschermen, ClickWise, POS, rapportage, pilot readiness).

## Wat ik bewust NIET doe
- Geen platform-/SaaS-admin rol bouwen (dat is een aparte feature, prompt-waardig).
- Geen demo-account zaaien (kan ik in een vervolgstap doen als je wil).
- Geen wijzigingen aan auth-providers, RLS of bestaande data.

## Daarna
Zodra je ingelogd bent als owner heb je toegang tot:
- `/app/dashboard`, reserveringen, vloer, gasten, wachtlijst
- `/app/reports`, `/app/integrations/clickwise`, `/app/pilot-readiness`
- Alle manager-only acties (ClickWise live mode, POS, instellingen)

Let op: auto-confirm is handig voor build/test, maar voor productie hoor je dit weer uit te zetten zodat gasten hun e-mail verifiëren. Ik kan dat later voor je terugdraaien wanneer je richting echte pilot gaat.