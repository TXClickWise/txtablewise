<!-- documentatie — niet uitvoeren -->

# TX TableWise — BOUWLOG

> Gecategoriseerde bouwlog. Tijdzone: Europe/Amsterdam.
> Laatst bijgewerkt: 2026-07-06

## Categorieën: Feature | Bugfix | UI-UX | Refactor | Config | Beslissing | Overig

### 001 · Feature · Prompt 00–21 · Volledige MVP gebouwd
Alle kernmodules: reserveringsengine, dashboard, agenda, floor mode, walk-ins, wachtlijst, gastprofielen, no-show preventie, pre-orders, reviews/aftercare, ClickWise-voorbereiding, AI Host actions, POS-ready structuur, rapportages, tablet UX, QA polish, production hardening. 36 tabellen, 12 edge functions, 14 services, 30+ pagina's.

### 002 · Bugfix · FIX-001 · Reservation status enum mismatch
Database enum had `finished` maar code gebruikte `completed`. Migratie: ALTER TYPE ADD VALUE 'completed'. Frontend opgeschoond.

### 003 · Bugfix · FIX-002 · Resterende finished-refs + walk-in e-mailvervuiling
AgendaPage en FloorPlanPage hadden nog `finished` referenties. Walk-in service genereerde synthetische @tablewise.local e-mailadressen.

### 004 · Bugfix · FIX-003 · Publieke widget RLS policies (KRITIEK)
Booking widget kon niet werken voor ongeauthenticeerde gasten. Ontbrekende anon SELECT/INSERT policies op restaurants, pre_order_items, waitlist_entries.

### 005 · Bugfix · FIX-004 · Widget URL preview domain
Widget-URLs toonden Lovable preview-domein. Opgelost met public_base_url veld en getWidgetUrl() helper met fallback naar txtablewise.nl.

### 006 · Feature · FIX-005 · White-label: Lovable verwijderen + custom domein
public_base_url verplaatst naar admin-only. custom_widget_domain als Pro-feature. Lovable safety check. Hardcoded fallback naar txtablewise.nl.

### 007 · Bugfix · FIX-006 · Onboarding bugs + tafelcombinatie-UI
Test reservering enum error (manual → manager). Integratie-logs knop verwijderd uit onboarding. Overslaan-optie voor stap 10/11. Logo upload component. Tafelcombinatie beheer-UI.

### 008 · UI-UX · FIX-007 · Texel/ClickWise branding
Tagline in sidebar-footer en landingpage-footer. "by ClickWise" link naar clickwise.app. "Vanaf Texel, voor heel Nederland" in hero.

### 009 · Refactor · FIX-008 · White-label: alle third-party merknamen
37 verwijzingen naar HighLevel/Vapi/Retell/ElevenLabs verwijderd uit 11 bestanden. Provider-dropdown vereenvoudigd naar alleen "ClickWise Voice AI". HighLevelToolSetupPanel hernoemd naar ClickWiseToolSetupPanel.

### 010 · Feature · Prompt 22 delta · ClickWise Live Integration
Contact upsert, custom field sync, tag sync, reminder scheduler edge function, agent API cancel via manage_reservation. Alles als uitbreiding op bestaande code.

### 011 · Feature · Prompt 23 delta · AI Agent Live Booking Actions
Vijf nieuwe agent_api endpoints. Guest-safe response wrapper. Per-channel permissions. Testconsole, action logs, channel readiness cards, ClickWise tool setup panel.

### 012 · Feature · Prompt 24 · Pilot Restaurant Setup
is_live kolom. Demodata purge functie. PilotReadinessChecklist met 10 checks. ErrorBoundary. RequireRole. Widget rate limiting. Booking horizon afdwinging. Pilot launch pagina met QR-code generator.

### 013 · Feature · Prompt 25 · SaaS Admin Dashboard
AdminRestaurantsPage (overzicht). AdminRestaurantDetailPage. Admin context-switch met override banner. Restaurant aanmaak. RLS policies voor system admin.

### 014 · UI-UX · Prompt 26 + 26b · Landingpage redesign
Volledige herschrijving als B2B conversiepagina. Hero, pijnpunten, oplossingen, USP-sectie, vertrouwen, tarieven, demo-aanvraagformulier, footer. demo_requests tabel.

### 015 · Feature · Prompt 27 · E-mailnotificaties
send_reservation_email edge function. auth-email-hook voor branded auth-e-mails. 7+ e-mail templates. Email queue via pgmq. Suppression lists. Unsubscribe flow.

### 016 · UI-UX · Prompt 28 · UX Redesign + PWA
Walk-ins pagina verwijderd. Floating Action Buttons. Operationele tabbar. Sidebar als overlay op tablet. Floor Mode opgeschoond. PWA manifest + service worker + offline fallback + install prompt.

### 017 · Feature · Niet-gevraagd · E-mail infrastructure uitbreiding
Queue-systeem met dead-letter queues, bounce/complaint handling, rate limiting, preview endpoint, template vertaling.

### 018 · Feature · Niet-gevraagd · Meertaligheid (i18n)
4 talen (NL/EN/DE/FR) met 170+ vertalingen per taal. Automatische taaldetectie. LanguageSwitcher in widget.

### 019 · Feature · Niet-gevraagd · Loyverse POS live koppeling
OAuth flow, token refresh, geplande synchronisatie, pre-order push naar kassa.

### 020 · Feature · Niet-gevraagd · Auto no-show marker
Edge function die reserveringen automatisch als no-show markeert na grace period.

### 021 · Feature · Niet-gevraagd · Gastwijzigingen systeem
Gasten kunnen via magic link wijzigingen aanvragen. Restaurant bepaalt auto-approve regels. Review edge function. E-mail templates.

### 022 · Feature · Niet-gevraagd · ClickWise provisioning
Edge functions voor sub-account aanmaak en custom values sync via HighLevel API. Admin provisioning-pagina.

### 023 · Feature · Niet-gevraagd · Guest snapshot op reserveringen
Gastnaam/email/telefoon direct op reserveringen-tabel. Backfill-migratie.

### 024 · Feature · Niet-gevraagd · Diverse
Call transfer configuratie. Webhook health badges. Reservation quick actions. Pending badges. Theme toggle. SEO. Stripe checkout/webhook edge functions.

---

## Beslissingen

| # | Beslissing | Rationale |
|---|---|---|
| B-01 | Delta-prompts i.p.v. volledige herschrijvingen | Voorkomt dat Lovable bestaande code overschrijft |
| B-02 | completed als enum-waarde, niet finished | Volledige codebase gebruikte al completed |
| B-03 | E-mail via TX TableWise, niet alleen via ClickWise | ClickWise mag niet verplicht zijn |
| B-04 | Trial zonder ClickWise sub-account | Voorkomt lege sub-accounts |
| B-05 | Walk-ins pagina verwijderd, FAB in plaats daarvan | Dubbele functionaliteit elimineren |
| B-06 | Donker navy + warm goud i.p.v. teal | Afstemming op ClickWise branding |
| B-07 | Verkeerslichtlogica voor statussen | Intuïtief zonder uitleg |
| B-08 | is_live als expliciete kolom, niet afgeleid van plan | Live-status en betaalplan zijn twee concepten |
| B-09 | Purge = alle operationele data, niet alleen seed-marked | Pre-launch reset moet altijd schoon zijn |

## Blokkades

| # | Blokkade | Impact | Status |
|---|---|---|---|
| BL-01 | ClickWise base snapshot nog niet gebouwd | Voice AI en SMS niet testbaar | Open |
| BL-02 | Sending domain nog niet geverifieerd | E-mails worden niet verstuurd | Open |
| BL-03 | HighLevel API-key niet geconfigureerd | Provisioning niet werkend | Open |
| BL-04 | Reminder scheduler cron niet geactiveerd | Automatische reminders niet actief | Open |

## Openstaande punten

| # | Punt | Prioriteit |
|---|---|---|
| OP-01 | Prompt 29 (visuele redesign) nog aan Lovable geven | Hoog |
| OP-02 | FIX-010 (laatste HighLevel refs + tagline) nog aan Lovable geven | Hoog |
| OP-03 | P1-001 (role-based routes) nog aan Lovable geven | Hoog |
| OP-04 | P1-002 (tafelcombinaties in engine) nog aan Lovable geven | Hoog |
| OP-05 | P2-001 (API audit, cron, race-condition) nog aan Lovable geven | Middel |
| OP-06 | Database trigger voor automatische event-verwerking | Middel |
| OP-07 | Integration_logs retention/cleanup | Laag |
| OP-08 | Agent API deprecaten ten gunste van Public API | Laag |
| OP-09 | Guest upsert verfijnen | Laag |
