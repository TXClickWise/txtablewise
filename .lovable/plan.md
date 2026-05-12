# Plan: Premium Redesign afmaken (Prompt 29) — volledig gecontroleerd

Hieronder eerst een afvinklijst per DEEL met de status nu, daarna 5 implementatie-pakketten die alles met status ⚠️ of ❌ afronden.

---

## Afvinklijst tegenover prompt 29

### DEEL 1 — Kleurenpalet
- ✅ Surfaces, brand, neutrals, semantic, borders, status, table, channel, shadows, gradients, sidebar tokens — allemaal in `src/index.css`.

### DEEL 2 — Typografie
- ✅ Plus Jakarta Sans geladen + tailwind `font-display`.
- ⚠️ Hiërarchie consequent doorvoeren op ALLE pagina's — nog niet sweep.

### DEEL 3 — Componentstijlen
- ⚠️ **Cards**: tokens beschikbaar; `Card`/`SectionCard` hover-translate + p-5 niet doorgevoerd.
- ❌ **Knoppen**: `ui/button.tsx` niet aangepast (geen `font-display`, geen gold-glow hover, geen h-10/h-12 onderscheid).
- ✅ **Tabbar actieve tab** — goud met navy tekst.
- ❌ **Sidebar actief item** — alleen `glass-sidebar`, niet de gouden tekst + linker 2px border + bg-sidebar-accent.
- ❌ **Status badges** — nog `/10` zachte tinten i.p.v. wit-op-volle-kleur.
- ⚠️ **KPI-kaarten** — geen 3px top-border per status; wel gradient-card.
- ❌ **Reserveringskaarten** — 4px linker statusborder, kanaalbadge, VIP/allergie/pre-order glyphs niet toegepast.
- ❌ **Tafelkaarten Floor Mode** — tokens staan klaar, niet aangebracht; geen pulserende dots; geen "VRIJ" pill; geen geblokkeerd-streep.

### DEEL 4 — Glasmorfisme
- ✅ `.glass-sidebar` toegepast.
- ✅ `.glass-header` toegepast.
- ⚠️ `.glass-sheet` als utility aanwezig, niet toegepast op Sheet/Dialog/Drawer.
- ⚠️ `.fab-button` als class aanwezig, niet toegepast op `FloatingActions`.

### DEEL 5 — Animaties
- ⚠️ `pulse-dot` keyframe + class staan in css, nergens gebruikt.
- ❌ Hover states (cards translateY, tabelrijen bg, iconen scale) niet systematisch.
- ❌ Focus ring `ring-accent/50` niet doorgevoerd (button/input).
- ❌ Skeleton shimmer niet toegevoegd.
- ❌ Scroll-shadows niet toegevoegd.
- ❌ Page-fade transition niet toegevoegd.
- ❌ FAB stagger expand niet doorgevoerd.

### DEEL 6 — Agenda tijdlijn upgrade
- ❌ Huidige-tijd indicator: gouden 2px lijn + glow + label pill.
- ❌ Reserveringsblokken: 30-40% transparante statuskleur, 3px linkerborder, hover→100% opacity + schaduw + tooltip.

### DEEL 7 — Landingpage
- ❌ Hero cinematic: dubbele radial-gradient + lineair op donker navy; H1 `text-5xl md:text-7xl font-extrabold` met goud-accentwoord; CTA goud + outline wit; trust-pills frosted glass.
- ❌ Scroll-triggered fade-in via `IntersectionObserver` met stagger.
- ❌ Pricing kaarten: Trial vlak, Basic met schaduw, Pro donker navy + gouden "Aanbevolen" badge + `scale(1.03)`.
- ❌ USP-kaarten: gradient-border on hover (`::before` truc) + translateY-4px lift.
- ❌ Productscreenshot in 3D device-frame onder/in hero.
- ❌ Footer donker navy met goud ClickWise-link.

### DEEL 8 — Specifieke pagina-details
- ❌ Vandaag-pagina: KPI top-border per metric + reserveringskaarten linkerborder + badge.
- ❌ Floor Mode: zie DEEL 3 tafelkaarten, plus zone-headers als subtiele strip (geen kaart-stijl).
- ❌ Agenda: zie DEEL 6.

### Slot-notities
- ⚠️ `backdrop-filter` fallback — pakket A: dubbele `background-color` regel verifiëren in `.glass-*` utilities (gedeeltelijk al in css; controleren).
- ❌ iPad Safari smoke test na implementatie.
- ⚠️ Geen functionele/route/edge wijzigingen — bewaken tijdens implementatie.

---

## Pakket A — Kerncomponenten + typografie sweep
1. `ui/button.tsx`: `font-display font-semibold rounded-lg`, primary `bg-accent text-accent-foreground shadow-soft hover:shadow-glow-gold`, outline navy, ghost `hover:bg-muted`, focus `ring-2 ring-accent/50 ring-offset-2`, sizes `h-10` desktop / `h-12` op `pointer:coarse`.
2. `StatusBadge.tsx` → gevuld wit-op-statuskleur, `rounded-full px-2.5 py-0.5 text-xs font-semibold`. Pulserende `.status-dot-active` bij `seated` en `no_show`.
3. `ui/card.tsx` + `SectionCard.tsx`: `rounded-xl shadow-soft p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-elevated`.
4. `KpiCard.tsx`: nieuwe prop `statusAccent` → 3px `border-t-[3px] border-status-{x}`.
5. `PageHeader.tsx`: titel `font-display text-2xl font-bold`, eyebrow `text-xs uppercase tracking-wide text-muted-foreground`.
6. `AppSidebar.tsx`: actieve items `text-sidebar-primary border-l-2 border-sidebar-primary bg-sidebar-accent`, inactief `text-sidebar-foreground/70`.
7. `touch/FloatingActions.tsx`: `.fab-button` class + staggered open (delays 0/75/150ms, scale-in).
8. `ui/sheet.tsx` + `ui/dialog.tsx` + `ui/drawer.tsx`: content `glass-sheet`.
9. `ui/input.tsx` + `ui/select.tsx` + `ui/textarea.tsx`: focus `ring-accent/50`.
10. `index.css`: borg fallback achtergrondkleur op alle `.glass-*` (al gedeeltelijk; verifiëren).

## Pakket B — Floor Mode + Reserveringskaarten + DEEL 8-details
1. Tafelkaart-component (FloorMode + Plattegrond in AgendaPage):
   - Per `FloorTone` → `bg-[hsl(var(--table-{x}))]` + `border-l-4 border-[hsl(var(--table-{x}-border))]`.
   - Tafelnummer `font-display text-xl font-bold`.
   - Lege tafel: wit + groen "VRIJ" pill.
   - `seated` en `overdue`: pulserende statusdot.
   - Geblokkeerd: `repeating-linear-gradient` diagonale streep.
2. Reserveringskaart-lijst (`src/components/reservations/*` + ReservationDetailDialog header):
   - 4px linker statusborder, gevulde StatusBadge, kanaal-icoon-badge, VIP★ goud, allergie▲ rood, pre-order🥂.
   - Hover `bg-muted/50 shadow-elevated`.
3. Vandaag-pagina KPI's: per metric `statusAccent` doorgeven aan `KpiCard`.
4. Floor Mode zone-headers: subtiele strip (`bg-muted/40 border-y px-3 py-1 text-xs uppercase tracking-wide`) i.p.v. kaart.

## Pakket C — Agenda tijdlijn (DEEL 6)
1. Huidige-tijd indicator: `width:2px; bg-accent; box-shadow:0 0 8px hsl(40 72% 52% / 0.4)` met label-pill `bg-accent text-accent-foreground rounded text-[10px] font-bold px-1.5 py-0.5`.
2. Reserveringsblokken in tijdlijn: `bg-[hsl(var(--status-{x})/0.35)]` + `border-l-[3px] border-[hsl(var(--status-{x}))]`, hover `opacity:1 + shadow-elevated + tooltip`.
3. Uurlijnen `border-border/40`, half-uur dashed.
4. Scroll-shadow utilities (`mask-image`) op tijdlijn-container links/rechts.

## Pakket D — Animaties, focus, polish (DEEL 5 restant)
1. Skeleton shimmer keyframe + `.skeleton` utility; toepassen op KpiCard, lijsten, agenda-grid bij `loading`.
2. Page-transition wrapper (fade+translateY-8px) op `<main>` children via `key={location.pathname}`.
3. Focus-visible audit alle interactieve elementen.
4. Hover micro-interacties: tabelrijen `hover:bg-muted/50`, iconen `transition-transform hover:scale-110`.
5. `.scroll-shadow-y` / `.scroll-shadow-x` utilities + toepassen op tafelgrid, agenda, lange lijsten.

## Pakket E — Landingspage (DEEL 7)
1. `Index.tsx` ritme + section eyebrow style (`text-xs font-semibold uppercase tracking-[0.22em] text-accent`).
2. `LandingHeader.tsx`: sticky `glass-header`, woordmerk `font-display`, primary CTA goud.
3. `HeroSection.tsx`:
   - `.hero` met dubbele radial + lineaire gradient.
   - H1 `font-display text-5xl md:text-7xl font-extrabold`, accentwoord (bv. "Rustiger team.") in `text-accent`.
   - Subkop `text-lg text-primary-foreground/80`.
   - CTA primary goud + secondary outline wit.
   - Trust-pills `.trust-pill` frosted glass.
   - Stagger entry via reveal-class.
   - Productscreenshot in 3D device-frame `.product-screenshot` (perspective + rotate + shadow).
4. `PainPointsSection.tsx`: kaarten `bg-card shadow-soft rounded-xl p-6` + iconen in goud-cirkel `bg-accent/10 text-accent`.
5. `SolutionGrid.tsx` (USP-kaarten): `.usp-card` met `::before` gradient-border, hover lift + shadow-lifted.
6. `WhyTableWiseSection.tsx`: 2-koloms, beeld `rounded-2xl shadow-elegant`, lijst met goud Check.
7. `TrustSection.tsx`: ClickWise-callout in navy band, testimonial `glass-sheet`.
8. `PricingSection.tsx`:
   - Trial vlakke witte kaart.
   - Basic witte kaart + `shadow-soft`.
   - Pro `bg-gradient-hero text-primary-foreground shadow-glow-gold scale-[1.03]` met goud "Aanbevolen" badge.
9. `DemoRequestForm` sectie: card `shadow-elevated rounded-2xl p-8`, inputs focus `ring-accent/50`, submit goud + glow.
10. `LandingFooter.tsx`: `bg-primary text-primary-foreground/80`, ClickWise link in `text-accent`.
11. **Scroll reveal** (DEEL 7): kleine `useReveal` hook met IntersectionObserver → `.reveal` / `.reveal.visible` keyframes met stagger via `delay-{n}` data-attr.

## Verificatie (na alle pakketten)
- iPad Safari (820×1180) smoke test: Vandaag, Agenda, Floor Mode, instelling-pagina, landingspage.
- Visueel checklist uit prompt 29 "Verificatie" sectie afvinken (gouden actieve items, contrast, dramatic verschil, family of clickwise.app).
- Geen routes/edge functions/datamodel aangeraakt.

---

## Bestanden per pakket
```text
A  src/components/ui/{button,card,sheet,dialog,drawer,input,select,textarea}.tsx
   src/components/{StatusBadge,SectionCard,KpiCard,PageHeader,AppSidebar}.tsx
   src/components/touch/FloatingActions.tsx
   src/index.css (fallbacks borgen)

B  src/pages/app/FloorModePage.tsx
   src/pages/app/AgendaPage.tsx (FloorPlanBody)
   src/components/reservations/* (kaart)
   src/components/ReservationDetailDialog.tsx
   src/pages/app/TodayPage.tsx (KPI accents)

C  src/pages/app/AgendaPage.tsx (tijdlijn-grid + reserveringsblok + huidige-tijd)
   src/index.css (scroll-shadow utilities)

D  src/index.css (skeleton shimmer keyframes, page-fade)
   src/components/AppShell.tsx (page-transition wrapper)
   toepassing in lijsten, agenda, KpiCard

E  src/pages/Index.tsx
   src/components/landing/{LandingHeader,HeroSection,PainPointsSection,
     SolutionGrid,WhyTableWiseSection,TrustSection,PricingSection,
     DemoRequestForm,LandingFooter}.tsx
   src/index.css (.hero, .trust-pill, .usp-card, .product-screenshot, .reveal)
   src/hooks/useReveal.ts (nieuw, alleen IntersectionObserver wrapper)
```

Geen schemawijzigingen, geen routes, geen edge functions, geen functionele logica — uitsluitend styling, markup en één presentational hook.

## Volgorde
A → B → C → D → E, met review-momenten tussen pakketten. Pakket A is de fundering; daarna kunnen B/E parallel als jij dat sneller wilt.
