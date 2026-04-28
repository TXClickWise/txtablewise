# Onboarding & Instellingen herstructurering

## Doel
Nieuwe restaurants binnen 30 minuten productie-klaar krijgen, en bestaande gebruikers een rustige, logisch gegroepeerde instellingen-omgeving geven — zonder bestaande routes, componenten of data te raken.

## Uitgangspositie (vastgesteld bij verkenning)
- `OnboardingWizardPage` bestaat met ~13 stappen (welcome, restaurant, location, hours, shifts, zones, tables, rules, walkins, large-groups, noshow, waitlist, preorders, integrations, done) maar mist 5 stappen uit de opdracht en heeft geen status/testknop per stap.
- `SettingsPage` is een platte tab-balk met 9 items (Algemeen, Openingstijden, Shifts, Capaciteit, Zones & tafels, Sluitingen, Grote groepen, No-show, Integraties) — geen groepering, geen sub-secties voor Berichten / AI / API / Gebruikers / Abonnement (die leven nu losse pagina's onder `/app/...`).
- Alle individuele settings-componenten en sub-routes onder `/app/instellingen/*` werken en moeten exact zo blijven werken.

## Aanpak — twee deliverables

### 1. Setup-wizard uitbreiden naar 12 stappen + statussysteem

Stappen exact volgens opdracht (hernoem/voeg toe — bestaande stap-componenten hergebruiken):

1. Restaurantgegevens — bestaand
2. Openingstijden — bestaand (hours)
3. Tafels en zones — bestaand (zones+tables samenvoegen tot één stap)
4. Reserveringsregels — bestaand (rules)
5. **Online widget** — NIEUW: toont publieke widget-URL `/r/:slug`, kopieer-knop, embed-snippet, "Open widget"-testknop
6. Walk-ins en wachtlijst — bestaand (walkins+waitlist samenvoegen)
7. No-show preventie — bestaand
8. **Berichten en reminders** — NIEUW: bevestigingsmail/SMS aan/uit, reminder 24u/2u, herbevestigingsvenster, gastvrije copy-templates (uit `mem://design/microcopy`), testknop "Stuur testbericht"
9. **AI Host / Voice Agent** — NIEUW: link naar `/app/voice-agent`, status agent-key aanwezig ja/nee, knop "Test voice flow"
10. ClickWise-integratie — bestaand (integrations)
11. **API/webhooks** — NIEUW: link naar API-tokens beheer, webhook-URL veld, "Stuur test-event" knop
12. **Test reservering** — NIEUW: knop die end-to-end een testreservering aanmaakt via `public_api`, toont resultaat (success/fout + integration_log link)

Per stap toevoegen:
- **Status-badge**: `niet gestart` (grijs) / `bezig` (oranje) / `voltooid` (groen) / `aandacht nodig` (rood)
- **Status afgeleid uit data** (geen nieuwe kolommen): bv. "Tafels en zones = voltooid" als `tables` rij-aantal > 0, "Berichten = voltooid" als `noshow_confirmation_enabled` aan, "API = aandacht nodig" als webhook_url gezet maar laatste `integration_logs` voor source=webhook status=failed.
- **Korte uitleg** (1–2 zinnen, gastvrije toon)
- **Primaire actie** (knop)
- **Testknop** waar relevant (widget, bericht, voice, webhook, test-reservering)

Stappen-overzicht links wordt een lijst met badge per stap zodat gebruiker direct ziet waar werk ligt. Voortgangsbalk toont % voltooide stappen.

### 2. Instellingen hergroeperen in 11 secties

Vervang de platte tab-balk door een 2-koloms layout: links sectie-nav (gegroepeerd), rechts inhoud via `<Outlet />`. Alle bestaande sub-routes onder `/app/instellingen/*` blijven bestaan; nieuwe secties krijgen nieuwe routes die naar bestaande pagina's wijzen of een lichte wrapper gebruiken.

| Sectie | Route | Bron (bestaand) |
|---|---|---|
| Algemeen | `/app/instellingen` | `GeneralSettings` |
| Openingstijden | `/app/instellingen/openingstijden` | `OpeningHoursSettings` + `ClosuresSettings` (sub-tab) + `ShiftsSettings` |
| Reserveringen | `/app/instellingen/reserveringen` | `CapacitySettings` + `LargeGroupSettings` |
| Tafels & zones | `/app/instellingen/zones` | `ZonesTablesSettings` |
| Gasten | `/app/instellingen/gasten` | nieuwe wrapper met links naar `/app/gasten`-instellingen + CRM-toggles uit restaurants-tabel |
| Berichten | `/app/instellingen/berichten` | NIEUW: bundelt `noshow_*` toggles, reminder-instellingen, copy-templates |
| AI & Voice | `/app/instellingen/ai-voice` | wrapper met deeplinks naar `/app/ai-host` en `/app/voice-agent` |
| Integraties | `/app/instellingen/integraties` | `IntegrationsSettings` + deeplinks naar ClickWise/POS pagina's |
| API & webhooks | `/app/instellingen/api` | NIEUW: lijst `api_tokens` + `agent_api_keys`, webhook_url-veld, link naar `integration_logs` |
| Gebruikers & rollen | `/app/instellingen/gebruikers` | NIEUW: `restaurant_members` lijst, rol wijzigen (manager-only via RLS) |
| Abonnement | `/app/instellingen/abonnement` | NIEUW: read-only kaart met `plan_type` uit restaurants, contact-knop |

No-show blijft beschikbaar maar verhuist naar **Berichten** (gastvrije reminders) en **Reserveringen** (regels) — oude route `/app/instellingen/no-show` redirect via `<Navigate>` naar nieuwe locatie zodat oude links blijven werken.

## Bestanden

**Nieuw**
- `src/components/onboarding/StepStatusBadge.tsx` — badge-component met 4 statussen
- `src/components/onboarding/useStepStatuses.ts` — hook die per stap-key status afleidt uit react-query data (tables, restaurants, integration_logs, agent_api_keys)
- `src/pages/app/settings/MessagesSettings.tsx` — Berichten & reminders
- `src/pages/app/settings/AiVoiceSettings.tsx` — wrapper-pagina met deeplinks/status
- `src/pages/app/settings/ApiWebhooksSettings.tsx` — tokens, webhook-URL, test
- `src/pages/app/settings/UsersRolesSettings.tsx` — restaurant_members beheer
- `src/pages/app/settings/SubscriptionSettings.tsx` — abonnement read-only
- `src/pages/app/settings/ReservationRulesSettings.tsx` — bundelt capaciteit + grote groepen

**Aangepast**
- `src/pages/app/OnboardingWizardPage.tsx` — herordenen naar 12 stappen, status-badges, testknoppen
- `src/pages/app/SettingsPage.tsx` — 2-koloms layout met gegroepeerde nav (groepen: Basis / Operatie / Gasten & communicatie / Techniek / Account)
- `src/App.tsx` — extra sub-routes onder `/app/instellingen` + redirect oude no-show route

**Niet aangeraakt**
- Bestaande settings-componenten (`GeneralSettings`, `OpeningHoursSettings`, etc.) — alleen geïmporteerd
- Database schema, RLS, edge functions
- Routes buiten `/app/instellingen` en `/app/onboarding`

## Guardrails toegepast
- Bestaande instellingen behouden — alle huidige componenten blijven gebruikt
- Routes blijven werken — oude paden ofwel ongewijzigd ofwel via `<Navigate>` redirect
- Geen data-migraties nodig — status wordt afgeleid, niet opgeslagen
- Tablet-first conform `mem://core` — sectie-nav klapt op smal scherm in een Sheet