## Doel

Eén theme-toggle waarmee de hele app (landingspagina + `/app` shell) in één klik tussen lichte en donkere modus schakelt. Voorkeur wordt onthouden per browser.

## Huidige situatie

- `next-themes@^0.3.0` staat al in `package.json`, maar er zit nog geen `ThemeProvider` om de app heen.
- `src/index.css` heeft volledige `:root` (light) en `.dark` HSL-tokens.
- Veel componenten gebruiken al `dark:` Tailwind classes en semantische tokens, dus theming werkt zodra de `dark` class op `<html>` staat.

## Wijzigingen

1. **`src/main.tsx`** — wrap met `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` uit `next-themes`.

2. **`tailwind.config.ts`** — `darkMode: "class"` toevoegen als die nog niet aanwezig is.

3. **Nieuwe component `src/components/ThemeToggle.tsx`** — knop met `Sun`/`Moon` icoon (lucide-react), gebruikt `useTheme()`. Dropdown-menu (shadcn) met opties Licht / Donker / Systeem. Ghost-button stijl, `aria-label`, 44px touch target.

4. **Plaatsing**:
   - **App-shell header** (`src/components/AppShell.tsx`) — rechts in de header, naast bestaande iconen.
   - **Landing header** (`src/components/landing/LandingHeader.tsx`) — naast "Inloggen / Demo aanvragen".
   - **Widget** (`/r/:slug`) — geen toggle; volgt automatisch het systeem.

## Niet in scope

- Geen restyling van bestaande componenten (alle huidige `dark:` classes en tokens werken zodra de class flipt).
- Geen per-restaurant theme-instelling in de database.
- Geen toggle in de gast-widget.

## Open vraag

Voorstel = 3-state dropdown (Licht / Donker / Systeem). Wil je liever een simpele 2-state toggle-knop (alleen licht ⇄ donker)? Zo niet, dan ga ik door met de dropdown.
