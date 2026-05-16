# Plan: App radicaal vereenvoudigen voor horeca-ondernemers

## Probleem (wat ik aantref in de codebase)

Na een snelle audit zie ik op meerdere plekken dezelfde instelling, vaak in een technische én een eenvoudige variant naast elkaar. De ondernemer moet daardoor kiezen tussen pagina's die hij niet kan onderscheiden.

**Concrete duplicaten / overbodige UI nu:**

| Onderwerp | Komt voor op | Wat te doen |
|---|---|---|
| Webhook-URL (ClickWise) | `/app/instellingen/api` (ApiWebhooksSettings), `/app/instellingen/integraties` (IntegrationsSettings), `/app/integraties/hub` tab Webhooks (endpoint-tabel) | 1 plek voor ondernemer ("ClickWise koppeling"), endpoint-tabel naar Advanced |
| Integraties-overzicht | `KoppelingenPage`, `KoppelingenTabsPage` tab Overzicht, `IntegrationsPage`, `IntegrationHubPage` tab Overzicht | 1 overzicht; hub volledig achter Advanced/admin |
| Voice Agent | `/app/voice-agent`, `/app/ai-voice` tab Voice, `/app/instellingen/ai-voice`, hub tab Voice + ClickWise AI Voice | 1 simpele kaart op koppelingen-pagina + Help; admin-config naar Admin-sectie |
| Reservering-regels | `/app/instellingen/reserveringen` met 4 sub-tabs (capaciteit, grote groepen, no-show, gastwijzigingen) | Behouden, maar standaard "Aanbevolen" preset i.p.v. 30 velden |
| AI & Voice settings | `/app/instellingen/ai-voice` + `/app/ai-voice` | Settings-route verwijderen of redirect |
| Webhook-fixtures, health-badge, live test, preset payloads | hub + api-settings | Achter Advanced Mode (system admin + opt-in) |

**Tab `/app/integraties/hub` is in de huidige code al `isSystemAdmin`-only** in `KoppelingenTabsPage`, maar de pagina is alsnog rechtstreeks routebaar voor de eindgebruiker (zoals nu zichtbaar). Die deur moet dicht.

---

## Aanpak — 3 principes

1. **Eén plek per concept.** Voor elke instelling kiezen we de canonieke locatie. Andere plekken worden óf een redirect óf verdwijnen.
2. **Default = simpel.** Eindgebruiker ziet alleen wat hij/zij moet beslissen, met "Aanbevolen" presets en gastvrije copy. Geen JSON, geen events, geen secrets, geen HMAC, geen edge-function namen.
3. **Advanced Mode voor de rest.** Alles technisch (webhooks-tabel, fixtures, payload-logs, API-tokens, edge-function tests, retry-knoppen) zit achter `<AdvancedOnly>` of `RequireSystemAdmin`. Die toggle bestaat al (`useAdvancedMode`).

---

## Scope — fase 1 (deze ronde)

### A. Koppelingen vereenvoudigen (hoogste impact)

**Nieuwe canonieke pagina: `/app/integraties`** — één kaart-overzicht met max 4 tegels:

- **ClickWise** — status badge (Verbonden / Niet verbonden), één knop "Instellen" → simpele wizard (3 stappen: plak ClickWise webhook-URL, test, klaar).
- **AI Telefoon-agent** — status badge, knop "Instellen" → simpele wizard die alleen de API-sleutel toont + "Kopieer voor ClickWise".
- **Kassa (POS)** — status badge, knop "Verbinden met Loyverse" (huidige flow).
- **Eigen koppeling (geavanceerd)** — alleen zichtbaar met Advanced Mode aan; opent de huidige `IntegrationHubPage`.

**Wat verdwijnt voor eindgebruiker:**
- `/app/instellingen/api` (ApiWebhooksSettings): wordt redirect naar `/app/integraties`.
- `/app/instellingen/integraties` (IntegrationsSettings, dubbele webhook-form): wordt redirect.
- `KoppelingenTabsPage` tabs "Voice setup" en "Integratiehub" verbergen voor non-advanced users (al `isSystemAdmin`, maar route blijft open — afschermen met `<RequireSystemAdmin>` op de route).
- Sidebar-item "API & webhooks" weghalen uit `SETTINGS_ITEMS` voor non-advanced users (via een filter in `AppSidebar`).

### B. Settings-menu inkorten

Huidige `SETTINGS_ITEMS` heeft 15 entries. Doel: **max 8 zichtbaar** voor standaard-gebruiker.

Te verbergen achter `AdvancedOnly` of samenvoegen:
- "API & webhooks" → weg (zit in /app/integraties)
- "Integraties" → weg (zit in /app/integraties)
- "AI & Voice" → samenvoegen met "Berichten" als één "Gastcommunicatie"-blok, of verbergen tot AI-host echt aan staat
- "Pilot lancering" — al `ownerOnly`, prima

Resultaat zichtbaar voor standaard ondernemer: Algemeen, Openingstijden, Reserveringen, Online reserveren, Tafels & zones, Gasten, Gastcommunicatie, Gebruikers, Abonnement, (Pilot indien owner). = 9-10 items.

### C. ReservationRulesSettings inkorten

Vervang de 4 sub-tabs door één scherm met **3 presets** ("Aanbevolen", "Streng tegen no-shows", "Soepel — gastvrije focus") + één link "Geavanceerd aanpassen" (AdvancedOnly) die de huidige 4 tabs toont. Voorinstellingen vullen alle onderliggende velden in.

### D. Sidebar opruimen

`AppSidebar` filteren: alle items die `advanced: true` zijn alleen tonen als `canSeeAdvanced`. Concreet kandidaat-items om als advanced te markeren: Integratiehub, Voice setup, Integratielogs, eventueel POS-koppeling-detail.

### E. Microcopy-pass

Vervang technische termen door horeca-taal:
- "Webhook" → "ClickWise koppeling"
- "Endpoint" → "Verbinding"
- "Event" → "Gebeurtenis" (of vermijden)
- "API-sleutel" → "Toegangscode voor je telefoon-agent"
- "HMAC signing" → volledig verbergen (Advanced)
- "Dispatch", "Retry", "Payload" → volledig verbergen

## Out of scope deze ronde

- Geen wijziging in datamodel of edge functions — alles blijft draaien zoals het is.
- Geen visuele redesign van losse componenten — alleen structuur/copy.
- Subscription/billing UI blijft zoals het is.
- Floor mode + agenda blijven ongewijzigd (zijn al tablet-first en simpel).

## Technische uitvoering (kort)

1. **Routes**: in `App.tsx` redirects toevoegen voor `/app/instellingen/api` en `/app/instellingen/integraties` → `/app/integraties`. `IntegrationHubPage` route wrappen in `<RequireSystemAdmin>` of `<AdvancedOnly>`-equivalent.
2. **Nieuwe pagina** `src/pages/app/integraties/IntegrationsOverviewPage.tsx` — 4-tegel grid, gebruikt bestaande `WebhookHealthBadge` voor ClickWise-status, `clickwise.ts` service voor verbindingstest.
3. **Nieuwe wizard** `src/components/integrations/ClickWiseQuickSetup.tsx` — 3 stappen, plakt URL in `restaurants.webhook_url` + maakt automatisch een `webhook_endpoints` rij met alle events aan. Geen velden voor secret, events, label.
4. **`settings-nav.ts`** uitbreiden met `advanced?: boolean` flag; `AppSidebar` filtert op `useAdvancedMode().canSeeAdvanced`.
5. **`ReservationRulesSettings`** herschrijven naar preset-kaarten + verborgen tabs.
6. **Sweep microcopy** in: `ClickWiseVoiceCard`, `ApiWebhooksSettings`, `IntegrationsSettings`, `IntegrationHubPage` (laatste twee worden alsnog door admins gebruikt, maar copy mag menselijker).

## Vragen aan jou voor we starten

1. Mag ik `/app/instellingen/api` en `/app/instellingen/integraties` daadwerkelijk laten verdwijnen (redirect naar `/app/integraties`), of wil je ze bewaren als "expert view" achter Advanced Mode?
2. De drie reserverings-presets — wil je dat ik concrete waarden voorstel (bv. "Streng" = bevestiging verplicht binnen 2u + reminder 24u + 2u + auto-no-show na 20 min), of laat je die aan mij over?
3. Mag de "AI & Voice" sidebar-link helemaal weg voor eindgebruikers (alleen bereikbaar via Koppelingen-tegel), of wil je hem als top-level item houden?
4. Akkoord dat ik dit in **één PR** doe (structuur + copy + redirects samen), of liever opgesplitst per onderdeel (eerst Koppelingen, dan Settings-menu, dan Reservation-presets)?
