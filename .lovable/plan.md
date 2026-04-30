# Bouwplan — Ronde 1 t/m 8 vereenvoudiging

Ik begin **deze ronde met Ronde 1**. De rest beschrijf ik per ronde zodat je vooraf weet wat erin zit; ik bouw ze één voor één in volgende rondes (na jouw seintje per ronde, of in één keer door als je dat liever hebt).

## Ronde 1 — Fundament Advanced Mode (deze loop)

**Nieuwe bestanden**
- `src/hooks/useAdvancedMode.tsx` — leest `is_system_admin()` + `restaurants.metadata.advanced_mode`. Levert `{ enabled, isAdmin, canSeeAdvanced, setEnabled, toggle }`. Schrijft naar `restaurants.metadata` en invalidateert `my-restaurants` query.
- `src/components/AdvancedOnly.tsx` — wrapper: `<AdvancedOnly>...</AdvancedOnly>` rendert children alleen als `canSeeAdvanced`. Optioneel `fallback` prop voor placeholder.

**Wijzigingen in bestaande bestanden**
- `src/components/AppSidebar.tsx`:
  - Voeg `advanced?: boolean` toe aan `Item`-type.
  - Markeer als `advanced: true`: `Integraties` (in beheer-groep), en in admin-groep blijft alles admin-only zoals nu (wordt al gefilterd op `isSystemAdmin`).
  - Filter elke groep op `canSeeAdvanced` voordat ze gerenderd worden. Items zonder `advanced`-flag blijven altijd zichtbaar.
- `src/pages/app/settings/GeneralSettings.tsx`:
  - Nieuwe Card "Geavanceerde modus" onderaan met `Switch` (uit/aan) + korte uitleg ("Toon technische opties zoals webhooks, integratie-logs en API-mappings. Voor de meeste restaurants niet nodig.").
  - Gebruikt `useAdvancedMode().enabled` + `setEnabled`.

**Geen DB-migratie nodig** — `restaurants.metadata` is al `jsonb`. Geen RLS-wijziging — managers kunnen al `restaurants` updaten.

**Niet stuk gemaakt**
- Routes blijven werken (alleen sidebar-link verborgen).
- Admin-sectie blijft op `isSystemAdmin` zoals nu.

## Ronde 2 — Simpele Koppelingen-pagina (`/app/koppelingen`)

- Nieuwe pagina + route. Eén kaart per integratie: ClickWise, AI Voice (ClickWise), POS (Loyverse), Webhook.
- Per kaart: status badge (Verbonden / Niet verbonden / Fout), `Test verbinding`-knop, `Aan/Uit`-switch waar van toepassing, één-zin uitleg in mensentaal.
- Footer-link "Geavanceerd beheren →" wrapped in `<AdvancedOnly>` → leidt naar bestaande `IntegrationHubPage`.
- Sidebar item "Integraties" laat ik **dubbel** bestaan: standaard wijst naar `/app/koppelingen` (simpel), de oude `/app/integraties` (Hub) wordt `advanced: true`.

## Ronde 3 — Vereenvoudigde logs

- Nieuwe component `src/components/integrations/SimpleEventLog.tsx`: per event ✅/❌-badge, actienaam in mensentaal, tijdstip (relatief), bij fout een korte uitleg + "Wat te doen"-tip (uit `tw-errors` mapping).
- `IntegrationLogsPage` toont default `SimpleEventLog`, met knop "Toon technische details" (achter `<AdvancedOnly>`) die de bestaande raw-tabel toont.

## Ronde 4 — ReservationService abstractie

- `src/services/reservationService.ts` met `check()`, `book()`, `cancel()`, `reschedule()` — bundelt de aanroepen naar `availability` + `book_reservation` + `manage_reservation` edge functions.
- Centrale validatie + retry + error mapping (hergebruik `tw-errors` codes als die in client beschikbaar moeten zijn).
- Refactor in volgorde: `WalkInDialog`, `ReservationFormSheet`, publieke booking widget. Edge functions blijven 100% ongewijzigd.

## Ronde 5 — AI Voice Agent simplificatie (afmaken)

- Server-deel is al af (nieuwe `/public_api/reservation-request` endpoint).
- Restant: `/app/voice-agent` opsplitsen in twee tabs: "Status & test" (eindgebruiker, simpel) en "Configuratie" (achter `<AdvancedOnly>` — prompts, mapping, secrets).
- `agent_api`-pad refactoren naar dezelfde simpele flow waar nog niet gedaan.

## Ronde 6 — Defaults boven opties

- Audit per settings-pagina (`NoShowPreventionPage`, `WaitlistPage`, deposit-secties, preorders-flags).
- Toggles met aanbevolen-default = aan worden verstopt achter een `Accordion` "Geavanceerde instellingen" binnen elke pagina.

## Ronde 7 — Eén vaste reserveringsflow

- Audit publieke widget (`/r/:slug`) + interne `ReservationFormSheet`.
- Consolideer naar één flow: datum → tijd → personen → contact → bevestig.
- Alternatieve paden (occasion-first, pre-order-first) achter "Meer opties"-link.

## Ronde 8 — UX sweep

- Loop alle `/app/*` pagina's langs met test "begrijpt een ondernemer dit zonder uitleg?".
- Versimpel headers, verwijder jargon, voeg empty-state uitleg toe.
- Geen functionaliteit verwijderen — alleen taal en informatiehiërarchie.

## Guardrails (elke ronde)

- Geen routes verwijderen — alleen verbergen.
- Geen edge functions of DB-velden verwijderen.
- Geen RLS-wijzigingen tenzij expliciet nodig.
- Geen kleuren hardcoded — alle styling via design tokens.
