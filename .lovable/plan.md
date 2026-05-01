## Doel

Eindgebruiker werkt sneller en intuïtiever doordat dezelfde informatie nog maar op één logische plek in het menu staat. Geen functionaliteit verdwijnt — alleen de navigatiestructuur wordt versmald van 22 naar 11 sidebar-items via tabs en redirects.

## Nieuwe sidebar (eindgebruiker)

```text
Operatie
  • Vandaag
  • Agenda            (tabs: Tijdlijn | Lijst)
  • Vloer             (tabs: Live | Bewerken)
  • Walk-ins
  • Wachtlijst

Gasten
  • Gasten            (tabs: Alle gasten | Grote groepen)

Hospitality
  • Gastcommunicatie  (tabs: No-show | Reviews & aftercare | Drankjes vooraf)
  • AI Host & Voice   (tabs: AI Host | Voice Agent)

Beheer
  • Rapportages
  • Koppelingen       (tabs: Overzicht | ClickWise | POS | Voice setup | Integratiehub)
  • Instellingen      (alle subpagina's bereikbaar via deze pagina, niet via sidebar)
```

Admin-sectie (alleen system admins) blijft ongewijzigd — daar is detail gewenst.

## Wat er gebeurt per samenvoeging

**Agenda + Reserveringen → één pagina "Agenda"**
- Bestaande tijdlijn wordt tab "Tijdlijn"
- Bestaande reserveringslijst wordt tab "Lijst"
- `/app/reserveringen` blijft werken, opent Agenda op tab "Lijst"

**Vloer + Tafelplan → één pagina "Vloer"**
- Floor Mode = tab "Live" (operationeel)
- Tafelplan-bewerken = tab "Bewerken" (achter expliciete switch)
- `/app/tafelplan` redirect naar Vloer + tab "Bewerken"

**Gasten + Grote groepen → één pagina "Gasten"**
- Alle gasten = standaardtab
- Grote groepen = tab met filter party_size ≥ drempel
- `/app/grote-groepen` redirect naar Gasten + tab "Grote groepen"

**Gastcommunicatie (nieuw containerscherm)**
- Tabs voor No-show preventie, Reviews & aftercare, Drankjes vooraf
- Bestaande pagina-inhoud wordt 1-op-1 ingeladen per tab
- Oude routes redirecten naar de juiste tab

**AI Host & Voice (nieuw containerscherm)**
- Tabs voor AI Host en Voice Agent (eindgebruikersweergave)
- Voice Agent debug/setup blijft bij Admin

**Koppelingen (uitgebreid met tabs)**
- Bestaande Koppelingen-pagina krijgt tabs: Overzicht, ClickWise, POS, Voice setup, Integratiehub
- `/app/integraties`, `/app/koppelingen/clickwise`, `/app/koppelingen/pos` etc. redirecten naar juiste tab
- Integratie-logs blijven admin-only

**Instellingen blijft hub**
- Geen losse settings-subpagina's in sidebar
- Alle subpagina's (openingstijden, no-show config, etc.) bereikbaar via Instellingen-overzicht

## Technisch

- Geen pagina-content herschrijven. Bestaande page-componenten worden hergebruikt als tab-content.
- Nieuwe wrapper-pagina's gebruiken shadcn `Tabs` met URL-sync (`?tab=...`) zodat directe links blijven werken.
- Oude routes blijven in de router maar renderen een `<Navigate>` naar het nieuwe pad met juiste `?tab=`.
- `src/components/AppSidebar.tsx` wordt afgeslankt tot de 11 items.
- Geen database- of edge-function wijzigingen.
- Alle bestaande deeplinks blijven werken via redirects.

## Buiten scope

- Geen visuele redesign van de pagina's zelf.
- Geen wijziging aan admin-sectie.
- Geen wijziging aan onboarding wizard of publieke booking widget.

## Acceptatie

- Sidebar toont 11 items in 4 groepen voor een gewone gebruiker.
- Alle bestaande functionaliteit blijft bereikbaar via maximaal 2 klikken.
- Oude URLs blijven werken (redirect naar nieuwe tab).
- Geen dubbele lijsten/cijfers meer onder verschillende menu-items.
