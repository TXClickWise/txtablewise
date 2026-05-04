
# Plan — Landingpage Redesign (Prompt 26)

## Doel
Volledige herschrijving van `src/pages/Index.tsx` naar een premium, Nederlandstalige B2B-conversiepagina gericht op horecaondernemers. Eén conversiedoel: demo aanvragen. Geen verwijzingen naar "Reserveer een tafel" of technisch jargon.

## Wijzigingen in 1 oogopslag

```text
src/pages/Index.tsx                  → volledig herschreven
src/components/landing/              → nieuwe map met subcomponenten
  ├── LandingHeader.tsx              → sticky header + mobiel hamburgermenu
  ├── HeroSection.tsx                → hero met 2 CTA's + vertrouwenstrip
  ├── PainPointsSection.tsx          → 3 herkenbare scenario's
  ├── SolutionGrid.tsx               → 6 features (icon + titel + 1 zin)
  ├── TrustSection.tsx               → "gebouwd voor NL horeca" + product mockup
  ├── PricingSection.tsx             → Trial / Basic / Pro (op aanvraag)
  ├── DemoRequestForm.tsx            → formulier → Supabase
  └── LandingFooter.tsx              → minimale footer
supabase/migrations/<ts>_demo_requests.sql  → nieuwe tabel + RLS
```

## Database

Nieuwe tabel `public.demo_requests`:

| kolom | type | notitie |
|---|---|---|
| id | uuid pk | gen_random_uuid() |
| restaurant_name | text not null | |
| contact_name | text not null | |
| email | text not null | |
| phone | text | optioneel |
| status | text | default 'new' (new/contacted/converted/closed) |
| created_at | timestamptz | default now() |

RLS:
- `INSERT` toegestaan voor `anon` + `authenticated` met simpele lengte-checks (naam ≤ 200, email ≤ 255, message niet relevant)
- `SELECT/UPDATE` alleen voor `is_system_admin()`

## Pagina-structuur (mobile-first, 375px)

### 1. Header (sticky, transparant over hero, wordt solid bij scroll)
- Logo "TX TableWise" links
- Desktop nav: Functies · Tarieven · Contact
- CTA-knop "Gratis demo" altijd zichtbaar (scrollt naar `#contact`)
- Mobiel: hamburger met nav + Inloggen-link

### 2. Hero
- Achtergrond: bestaande `hero-restaurant.jpg` met donkere warm-overlay (gradient hero token)
- H1: "Minder no-shows. Vollere tafels. Rustiger team."
- Sub: "TX TableWise is het reserveringssysteem voor restaurants die hun eigen gasten willen beheren — zonder commissie, zonder gedoe."
- Primair: **Plan een demo** → `#contact`
- Secundair: **Bekijk wat het kan** → `#functies`
- Vertrouwenstrip: "Commissievrij · Eigen gastdata · Klaar in 15 minuten"
- Mobiel: H1 max 3 regels, knoppen full-width 48px hoog

### 3. Pijnpunt-sectie ("Herkenbaar?")
3 cards op licht canvas:
- Gasten die niet komen opdagen
- Drie systemen, nul overzicht
- Geen tijd voor opvolging

### 4. Oplossing (`#functies`)
6 blokken (icon + titel + 1 zin):
Reserveringen · Tafelplan op tablet · No-show preventie · Wachtlijst · Gastprofielen · AI-host
Lucide icons, geen jargon (geen ClickWise/POS/CRM op homepage).

### 5. Trust-sectie
- Linker kolom: 4 bullets (NL support, geen commissie, eigenaar gastdata, direct live)
- Rechter kolom: dashboard mockup in afgerond device-frame met soft shadow. Gemaakt als pure HTML/CSS preview (geen externe asset) met demo-reservering rijen — premium, lichtgrijs canvas

### 6. Tarieven (`#tarieven`)
3 kaarten:
- **Trial** — Gratis · 14 dagen → "Start gratis trial" → `/auth`
- **Basic** — Op aanvraag → "Plan een demo"
- **Pro** — Op aanvraag, badge "Aanbevolen" → "Plan een demo"
- Onderschrift: "Transparante maandprijzen, geen commissie per couvert, maandelijks opzegbaar."

### 7. Contact (`#contact`) — Demo formulier
Velden: restaurant_name, contact_name, email, phone (optioneel)
- Validatie via zod (`trim`, `email`, lengte-limieten)
- Submit via supabase client → `demo_requests` insert
- Success-state met dankboodschap, error-state met toast
- Tekst onder knop: "We nemen binnen 24 uur contact op. Geen verplichtingen."

### 8. Footer
Logo + links (Functies, Tarieven, Contact, Inloggen, Privacybeleid placeholder) + copyright "© 2026 TX TableWise — Commissievrij reserveren voor moderne horeca"

## Design / responsive
- Hergebruik bestaande tokens: `bg-background`, `text-foreground`, `bg-primary`, `bg-accent`, `shadow-elegant`, `bg-gradient-hero`, `bg-gradient-warm`, radius `--radius`
- Geen hardcoded HSL — alles via tokens
- Breakpoints: mobiel single column, `md:` 2-kolom, `lg:` 3-kolom waar passend
- Scroll-fade-in via `IntersectionObserver` hook (klein, inline) — geen extra dependencies
- Lazy-load hero met `loading="eager"` (above-the-fold) maar `decoding="async"`

## Wat wegvalt
- "Reserveer een tafel" knoppen (overal)
- "−42% no-shows" en alle verzonnen statistieken
- Differentiators sectie met ClickWise / Loyverse referenties
- "AI-first" badges

## Verificatie
- `/` op 375px → hero past, geen horizontaal scroll, CTA's tikbaar
- Demo-formulier insert → check via `supabase--read_query` op `demo_requests`
- Inlog-link → `/auth`
- Geen "Reserveer" tekst meer in `Index.tsx`
