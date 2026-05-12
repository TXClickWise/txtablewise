## Doel

Een live status-indicator (rood/oranje badge met aantal) voor openstaande grote-groepen-aanvragen, op twee plekken:

1. **Sidebar** — naast "Grote groepen" in groep "Snel naar".
2. **Operationele tabbar** (bovenin) — naast "Gasten".

Klikken navigeert naar `/app/gasten?tab=grote-groepen` (bestaande route) zodat de operator direct in de juiste sectie landt.

## Telmethode

Een aanvraag telt als "wacht op handmatige beoordeling" wanneer minstens één van:

- `reservations` met `requires_manual_approval = true` OF `large_group_status = 'awaiting_approval'`, en `status` niet in `cancelled / no_show / completed`.
- `large_group_requests` met `status = 'new'`.

Som = totaal openstaande aanvragen.

## Implementatie

### 1. Nieuwe hook `src/hooks/usePendingLargeGroups.ts`

- React Query hook, key `["pending-large-groups", restaurantId]`.
- Twee parallelle `count`-queries (head=true, count=exact) op `reservations` en `large_group_requests`.
- `staleTime: 30s`, `refetchInterval: 60s` zodat de badge vanzelf actueel blijft.
- Returnt `{ count, isLoading }`.
- Realtime (optioneel, lichte versie): subscriben op `postgres_changes` voor beide tabellen → `invalidateQueries`. Houden achter een feature-flag-vrije eenvoudige useEffect in de hook zelf.

### 2. Herbruikbare `PendingBadge`-component `src/components/PendingBadge.tsx`

- Kleine pill met afwijkende kleur (`bg-destructive text-destructive-foreground`) en lichte pulse (`animate-pulse` of bestaande `status-dot-active`).
- Props: `count: number`, `variant?: "sidebar" | "tab"` (sidebar = compact rond, tab = ronde pill rechts van label).
- Niets renderen als `count === 0`.
- Toon `9+` bij count > 9 om layout stabiel te houden.

### 3. Sidebar (`src/components/AppSidebar.tsx`)

- `Group` uitbreiden met optionele `badgeFor?: (item) => number` of simpeler: speciale render-logica voor item met url die eindigt op `tab=grote-groepen`.
- Hook aanroepen in `AppSidebar` en count meegeven aan het juiste item.
- Badge rechts uitgelijnd binnen `SidebarMenuButton` (gebruikt `flex` met `ml-auto`).
- Bij `collapsed` sidebar: kleine rode dot rechtsboven het icoon (geen getal).

### 4. Operationele tabbar (`src/components/touch/OperationTabBar.tsx`)

- Hook aanroepen.
- Naast "Gasten"-tab een afwijkend gevormde indicator: rond pillvormig (vs. rechthoekige tabs), `bg-destructive text-destructive-foreground`, met getal of `9+`.
- Optioneel: subtiele glow `shadow-[0_0_0_3px_hsl(var(--destructive)/0.25)]` voor extra signaal.
- Verbergen wanneer count 0.

### 5. Navigatie

Beide indicatoren gebruiken bestaande URL `/app/gasten?tab=grote-groepen`. `GastenTabsPage` selecteert al die tab via query param — geen wijziging nodig.

## Niet in scope

- Geen nieuwe DB-velden of migraties.
- Geen wijziging aan de telling-logica op `LargeGroupsPage` zelf.
- Geen wijziging aan login/permissies — hook respecteert RLS automatisch.

## Bestanden

Nieuw:
- `src/hooks/usePendingLargeGroups.ts`
- `src/components/PendingBadge.tsx`

Aangepast:
- `src/components/AppSidebar.tsx`
- `src/components/touch/OperationTabBar.tsx`
