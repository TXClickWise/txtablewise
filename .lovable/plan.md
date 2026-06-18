## Wat ik ga aanpassen

### 1. `src/pages/AcceptInvite.tsx` — duidelijker scherm

Nu staat er een generieke kaart met "Uitnodiging / Word lid van een restaurant op TableWise" gevolgd door een blokje met labels (Restaurant / Rol / Voor). Dat leest als een formulier in plaats van een uitnodiging.

Nieuwe opzet voor een uitgelogde gebruiker (zoals `bediening@eigeweis.com`):

- **Titel**: "Je bent uitgenodigd bij **Texels Restaurant Eigeweis**"
- **Subtekst**: "Maak een account aan met **bediening@eigeweis.com** om als **Manager** mee te werken."
- Het labelblokje (Restaurant / Rol / Voor) verdwijnt — de informatie staat al in de titel/subtekst.
- Eén primaire knop: **"Account aanmaken"** → gaat direct naar het signup-scherm met e-mail én rolcontext vooringevuld.
- Secundaire link eronder (klein): "Heb je al een account? **Inloggen**".
- Geen TableWise-merkruis op deze pagina nodig; restaurantnaam staat centraal (later eventueel restaurant-logo als we dat per uitnodiging meesturen).

Voor de andere toestanden (ongeldig / verlopen / al ingelogd met verkeerd adres / al ingelogd met juist adres) hou ik de bestaande logica, maar herschrijf ik de teksten in dezelfde gastvrije toon:
- Juist ingelogd: één grote knop "Word lid van Texels Restaurant Eigeweis".
- Verkeerd adres: "Je bent ingelogd als X. Log uit om de uitnodiging voor Y te accepteren." + Uitloggen-knop.
- Ongeldig/verlopen/ingetrokken/al geaccepteerd: korte, vriendelijke uitleg + suggestie om het restaurant om een nieuwe uitnodiging te vragen.

Geen wijzigingen aan de RPC's of `teamMembers.ts` — alleen UI/copy.

### 2. Lovable-logo in de browser verbergen

Het korte logo dat je zag is de **"Edit with Lovable"-badge** die Lovable standaard op gepubliceerde apps toont. Die zit niet in onze code; het is een publish-instelling. Verbergen kan alleen op een betaald plan via de publish-settings (`set_badge_visibility`). Zodra je dit goedkeurt probeer ik 'm uit te zetten; lukt dat niet vanwege je plan, dan meld ik dat en blijft de badge zichtbaar tot je upgrade.

## Wat NIET verandert

- De uitnodigingsmail en token-flow.
- Backend RPC's, edge functions, database.
- De rest van de auth-flow / `/app/login`.
