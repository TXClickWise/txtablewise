# E-mailadres Jennifer-service-identity wijzigen naar backoffice@eigeweis.com

## Doel
Het e-mailadres van het gebruikersaccount achter de service identity "Jennifer - HighLevel Voice AI" wijzigen van `admin@clickwise.app` naar `backoffice@eigeweis.com`. Geen functionele wijzigingen aan MCP-logica, code of koppelingen.

## Vastgestelde huidige stand
- `backoffice@eigeweis.com` is **niet bekend** in de backend — geen bestaand account met dit adres. Wijzigen kan dus veilig.
- Bestaand account: `admin@clickwise.app`, user_id `2975b6eb-81be-4d67-a8bc-55546ff768ad`, e-mail bevestigd.
- Service identity "Jennifer - HighLevel Voice AI": profiel `guest_voice`, restaurant Texels Restaurant Eigeweis (`b56f3a25-36f8-4847-ae06-5df1426e8e03`), actief, capabilities `availability.read, reservation.read, reservation.create, reservation.update, reservation.cancel, waitlist.create`.

## Stappen
1. Wijzig het e-mailadres van user_id `2975b6eb-81be-4d67-a8bc-55546ff768ad` naar `backoffice@eigeweis.com` in de auth-accounts (alleen het e-mailveld; bevestigingsstatus behouden zodat inloggen direct werkt).
2. Verifieer: e-mail is nu `backoffice@eigeweis.com`, user_id ongewijzigd.
3. Controleer dat de service identity en de Eigeweis-medewerkerskoppeling intact zijn (deze verwijzen naar user_id, dus blijven automatisch gekoppeld — alleen verificatie, geen wijziging).
4. Rapporteer feitelijk: nieuw e-mailadres, user_id, restaurant, profiel, capabilities, revoked-status. Geen wachtwoorden of tokens delen.

## Expliciet buiten scope
- Geen nieuwe service identity, geen UI, geen wijzigingen aan MCP-code, RLS of andere accounts.
- Het wachtwoord van het account blijft ongewijzigd; een eerder ingesteld wachtwoord (indien aanwezig) blijft werken.

## Consequentie voor HighLevel
Bij het verbinden van HighLevel Voice AI met de TX TableWise MCP moet voortaan worden ingelogd met `backoffice@eigeweis.com` in plaats van `admin@clickwise.app`.
