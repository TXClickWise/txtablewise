# UI/UX-polish — consistent gebruik van het bestaande design system

## Uitgangspunt

Het design system is al sterk: warm-burgundy palette, status- en channel-tokens, gradient-card, shadow-soft/elegant/lifted, Fraunces display, `KpiCard`, `StatusBadge`, `StateViews` (Loading/Empty/Error/Connection) en touch-primitives. Het probleem is **inconsistente toepassing**: pagina's hebben hun eigen ad-hoc skeletons, lege states, ronde knopjes, status-pills en spacing.

De polish bestaat dus vooral uit **opruim- en hergebruikswerk** — niet uit nieuwe tokens of nieuwe layouts. Geen nieuwe globale styling, geen risico op kapotte andere pagina's.

## Stap 1 — Twee nieuwe shared primitives (klein, additief)

### `src/components/PageHeader.tsx` (nieuw)
Eén header voor alle `/app`-pagina's: titel (`font-display text-3xl`), optionele subtekst, optionele breadcrumb-/badge-strip en een rechterzijde voor primary/secondary actions. Tablet-first: actions worden onder de titel gestapeld < md.

```tsx
<PageHeader
  title="Vandaag"
  description="Maandag 28 april 2026"
  badge={<Badge variant="outline">Live</Badge>}
  actions={<Button>Reservering</Button>}
/>
```

### `src/components/SectionCard.tsx` (nieuw)
Dunne wrapper rond shadcn `<Card>` met `shadow-soft hover:shadow-elegant transition-smooth bg-gradient-card`, een gestandaardiseerde header met optioneel icoon + actions. Hiermee krijgen alle "secties" op alle pagina's exact dezelfde look zonder dat we elke `<Card>` afzonderlijk moeten herwerken.

Geen wijzigingen aan `Card` zelf — wie het niet wil gebruiken behoudt huidig gedrag.

## Stap 2 — `KpiCard` lichte uitbreiding

`KpiCard` krijgt twee optionele props (volledig backwards-compatible):
- `delta?: { value: string; trend: "up" | "down" | "flat" }` — kleine pill met pijltje, gebruikt status/success/destructive tokens
- `tone?: "neutral" | "premium"` — bij `premium` tonen we een dunne brass-accentlijn boven de waarde (gebruikt bestaande `--accent`)

## Stap 3 — Per pagina toepassing (geen logica wijzigen)

Per pagina exact deze drie ingrepen, niets meer:

1. Vervang ad-hoc header door `<PageHeader>`.
2. Vervang inline `<div className="text-center py-12 …">`-leegstates door `<EmptyState>`, inline pulses door `<CardSkeletonGrid>` of `<LoadingState>`, en error-blokjes door `<ErrorRetryState>`.
3. Vervang ruwe status-tekst door `<StatusBadge>` waar het type een reservation_status of large_group_status is.

Pagina's:

| Pagina | Voornaamste ingreep |
|---|---|
| **TodayPage** (Dashboard) | `PageHeader` met live-tijd badge; KpiCards krijgen `delta` waar zinvol; lege staat → `EmptyState`; skeleton → `CardSkeletonGrid` |
| **ReservationsPage** | `PageHeader` met primaire CTA; KPI strip via `KpiCard`; `EmptyState`; statussen via `StatusBadge` |
| **AgendaPage** | `PageHeader`; loading/empty primitives; legenda met `StatusBadge` mini variant |
| **FloorPlanPage** | `PageHeader` met "Bewerken/Bekijken" toggle; `EmptyState` als nog geen tafels |
| **FloorModePage** | `PageHeader` blijft compact (tablet); duidelijker connectiestatus via `<ConnectionStatusNotice>` bovenaan; statuspills via `StatusBadge` |
| **WalkInsPage** | `PageHeader` + `EmptyState` + `SectionCard` voor de quick-seat tegels |
| **WaitlistPage** | `PageHeader`; `EmptyState`; status- en kanaalbadges uniform |
| **GuestsPage** | `PageHeader` met zoek-action; `EmptyState`; segment-kpi's via `KpiCard` (totaal gasten, VIP's, frequent, no-show risico) |
| **NoShowPreventionPage** | `PageHeader`; KPI's krijgen `delta` (vorige periode); `EmptyState` voor "geen risico-reserveringen vandaag" |
| **AIHostPage / VoiceAgentPage** | `PageHeader` met provider-badge; readiness-checklist binnen `SectionCard`; `EmptyState` voor "nog geen calls" |
| **IntegrationHubPage** | `PageHeader` + per integratie een `SectionCard` met statuspil (verbonden / niet ingesteld / fout) |
| **SettingsPage** | bovenste hero blijft, sidebar krijgt subtieler hover-state (`hover:bg-sidebar-accent/60`); leesbare actieve indicator zonder zware achtergrond |

## Stap 4 — Mobiele/tablet polish

- Gestapelde header-acties onder titel < md, en standaard `min-h-[44px]` op alle CTA's via een `Button size="default"` audit (geen wijziging in component zelf — dit gebeurt al via de `pointer: coarse` media query in `index.css`).
- Sticky `<PageHeader>` op `/app` schermen met veel scroll (Reservations, Guests, NoShow): krijgt `sticky top-0 z-20 bg-background/80 backdrop-blur` als opt-in prop. Default uit.
- KPI grid: `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4` overal hetzelfde.

## Stap 5 — Iconenconsistentie

Eén pictogram per concept, bestaand:
- gasten = `Users`, reservering = `CalendarDays`, walk-in = `UserPlus`, tijd/aan tafel = `Clock`, no-show/risk = `AlertTriangle`, AI = `Sparkles`/`Bot`, integratie = `Plug`, instellingen = `Settings`. Bestaande pagina's die afwijken (bv. `TrendingUp` voor no-shows in TodayPage) worden afgestemd.

## Wat NIET verandert

- Geen wijzigingen aan `index.css` tokens (kleuren, radius, shadows, fonts) — dus geen kans op cascade-effect op andere pagina's
- Geen nieuwe routes
- Geen wijziging aan `Card`, `Button`, `Badge` shadcn primitives
- Geen wijziging in datafetching, queries of business-logica
- Geen nieuwe animaties — bestaande `transition-smooth` blijft de enige

## Bestanden

**Nieuw (2)**
- `src/components/PageHeader.tsx`
- `src/components/SectionCard.tsx`

**Aangepast (klein)**
- `src/components/KpiCard.tsx` — twee optionele props erbij
- 12 pagina's in `src/pages/app/` — alleen header- en state-blokken vervangen, geen logica raken

## Risico

Laag. Alle wijzigingen zijn additief of vervangen ad-hoc markup door bestaande, geteste primitives die al elders in de codebase werken (StatusBadge in detail-dialogen, StateViews in touch-folder). Performance verandert niet — minder DOM, niet meer.