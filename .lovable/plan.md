# P1-001 — Volledige role-based route bescherming

## Doel
Alle 20+ routes beschermen volgens de rollenmatrix (owner/manager/host/staff), sidebar filteren per rol, en de Gasten-pagina alleen-lezen maken voor host/staff.

## Aanpak — 3 stappen

### Stap 1 — `src/App.tsx`: routes wrappen met `RequireRole`

**Manager + Owner** (top-level routes):
- `/app/rapportages` → `["owner","manager"]`
- `/app/gastcommunicatie` → `["owner","manager"]`
- `/app/ai-voice` → `["owner","manager"]`
- `/app/koppelingen` → `["owner","manager"]`

**Owner-only**:
- `/app/onboarding` → `["owner"]`
- `instellingen/gebruikers` → `["owner"]`
- `instellingen/api` → `["owner"]`
- `instellingen/integraties` → `["owner"]`
- (`abonnement` en `pilot-launch` zijn al beschermd ✅)

**Instellingen-parent** wrappen met `["owner","manager"]` zodat host/staff geen enkele instellingen-route kunnen openen. De owner-only child routes blijven extra gewrapped.

**Host/staff toegang behouden** voor: `/app` (Vandaag), `/app/agenda`, `/app/vloer`, `/app/walk-ins`, `/app/wachtlijst`, `/app/gasten` — geen wrapper nodig.

`RequireRole` leest `current.role` uit `useRestaurant()`. Bij actieve admin override geeft die hook `role: "owner"` terug, dus de admin-context-switch blijft werken zonder wijziging.

### Stap 2 — `src/components/AppSidebar.tsx`: items filteren per rol

- Huidige rol ophalen via `useRestaurant().current?.role`.
- Per groep een `roles` whitelist definiëren:
  - `operatie`, `gasten` → iedereen
  - `hospitality` (Gastcommunicatie, AI Host & Voice) → owner/manager
  - `beheer` (Rapportages, Koppelingen, Instellingen) → owner/manager
  - `admin` → alleen system admin (al gefilterd via `isSystemAdmin`)
- In de bestaande `Group`-component een `allowedRoles` filter toevoegen die items verbergt als de huidige rol niet match. System admin override ziet alles (omdat overrideroleforced naar "owner" staat).

### Stap 3 — `src/pages/app/GuestsPage.tsx` + sub-componenten: read-only modus

- In `GuestsPage`: bepaal `const readOnly = role === "host" || role === "staff"`.
- Verberg/disable wanneer `readOnly`:
  - "Nieuwe gast"-knop (`UserPlus`)
  - "Bewerken" en "Verwijderen" in detail/sheet
  - Notitie-invoer in `GuestNotesSection` (prop `readOnly`)
- Props doorzetten naar `GuestFormSheet` en `GuestNotesSection` (nieuwe optionele `readOnly` prop). Form niet renderen als readOnly.

## Verificatie
- Host: sidebar toont alleen Operatie + Gasten; `/app/rapportages` → "Geen toegang" kaart.
- Manager: alles behalve Gebruikers/API/Integraties instellingen + onboarding.
- Owner: alles behalve admin-sectie.
- System admin override op restaurant: ziet alle pagina's (override forceert owner-rol).

## Niet wijzigen
- `RequireRole` component zelf
- Edge functions, database, RLS
- Routing structuur (alleen wrappers toevoegen)
