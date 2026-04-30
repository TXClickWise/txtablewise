# Plan: Radicale vereenvoudiging TableWise

Doel: eindgebruikers (horecaondernemers) zien alleen wat ze nodig hebben. Alle technische complexiteit (webhooks, mappings, raw payloads, workflow IDs) verdwijnt achter een **Advanced Mode**. Onderliggende logica blijft 100% intact — backward compatible.

## Beslissingen
- **Aanpak**: gefaseerd, per ronde 1-2 stappen. Geen big bang.
- **Advanced Mode**: dubbel mechanisme.
  - System admins (`is_system_admin()`) zien alles altijd.
  - Restaurant managers krijgen toggle "Geavanceerde modus" in `restaurants.metadata.advanced_mode` (default `false`).
- **Bestaande pagina's**: nieuwe simpele "Koppelingen"-pagina als hoofdingang. Bestaande uitgebreide pagina's blijven bereikbaar via "Geavanceerd beheren"-link, alleen zichtbaar in Advanced Mode of voor admins.

## Centrale primitives (eenmalig bouwen — Ronde 1)
1. `useAdvancedMode()` hook → `{ enabled, isAdmin, canSeeAdvanced, toggle() }`. Leest `is_system_admin()` + `restaurants.metadata.advanced_mode`.
2. `<AdvancedOnly>` wrapper component → rendert children alleen als `canSeeAdvanced`.
3. Sidebar items krijgen optionele `advanced: true` flag → automatisch verborgen voor basisgebruikers.

## Rondes

### Ronde 1 — Fundament Advanced Mode (Stap 1, 9 deels)
- Bouw `useAdvancedMode` + `<AdvancedOnly>`.
- Voeg toggle toe in Settings → Algemeen ("Geavanceerde modus voor technische opties").
- Markeer in `AppSidebar.tsx` deze items als `advanced`:
  - Integratie-hub, Integratie-logs, ClickWise-integratie (volledige pagina), API & webhooks settings.
- Verberg ze in sidebar voor non-advanced users. Routes blijven werken (geen breaking change).

### Ronde 2 — Nieuwe simpele Koppelingen-pagina (Stap 9)
- Nieuwe route `/app/koppelingen` met kaarten per integratie (ClickWise, POS, AI Voice, Webhook).
- Per kaart: status badge (Verbonden/Niet verbonden/Fout), `Test verbinding`-knop, `Aan/Uit`-switch, korte uitleg in mensentaal.
- Footer-link "Geavanceerd beheren →" alleen zichtbaar in Advanced Mode → leidt naar bestaande `IntegrationHubPage`.
- Vervang sidebar-link "Integratie-hub" door deze pagina als standaard.

### Ronde 3 — Vereenvoudigde logs (Stap 10)
- Nieuwe component `SimpleEventLog`: toont per event alleen `✅/❌ + actie + tijdstip + (bij fout) menselijke uitleg + "Wat te doen"-tip`.
- Vervang default view in `IntegrationLogsPage` door deze. Knop "Toon technische details" → bestaande raw view (alleen advanced).

### Ronde 4 — ReservationService abstractie (Stap 4, 5)
- Bundel `availability` + `book_reservation` + `manage_reservation` aanroepen in `src/services/reservationService.ts`.
- Eén interface: `check()`, `book()`, `cancel()`, `reschedule()`. Validatie + retry + error mapping centraal.
- Refactor `WalkInDialog`, `ReservationFormSheet`, `publicBooking` om deze service te gebruiken. Edge functions blijven ongewijzigd.

### Ronde 5 — AI Voice Agent simplificatie (Stap 6)
- `agent_api` edge function: AI levert alleen ruwe data (datum, tijd, party, contact). Server doet validatie + availability + booking via ReservationService.
- UI op `/app/voice-agent` toont alleen: status, test-knop, transcript-log. Mapping/prompts verhuizen naar admin tab.

### Ronde 6 — Defaults boven opties (Stap 7)
- Audit alle settings-pagina's. Verberg toggles waarvan default = aanbevolen waarde.
- Behoud achter "Geavanceerd"-accordeon binnen elke settings-pagina.
- Concrete kandidaten: no-show toggles, waitlist toggles, deposit exempties, preorders flags.

### Ronde 7 — Eén vaste reserveringsflow (Stap 2, 3)
- Audit publieke widget + interne forms → consolideer naar 1 flow: datum → tijd → personen → contact → bevestig.
- Verwijder/verberg alternatieve paden (occasion-first, pre-order-first, etc.) uit hoofdflow. Optioneel via "Meer opties".

### Ronde 8 — UX sweep (Stap 8)
- Loop alle `/app/*` pagina's langs met test "begrijpt een ondernemer dit zonder uitleg?".
- Versimpel headers, verwijder jargon, voeg empty-state uitleg toe.

## Guardrails (gelden elke ronde)
- Geen routes verwijderen — alleen verbergen.
- Geen edge functions of DB-velden verwijderen.
- Geen RLS-wijzigingen tenzij expliciet nodig.
- Elke ronde: korte test in preview voor merge.
