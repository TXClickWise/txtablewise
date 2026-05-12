## Probleem

In portrait (mobiel + tablet) en in mobile-landscape opent de sidebar als bottom/side **Sheet**, en die toont een **lichte kaartachtergrond** in plaats van de navy `--sidebar-background`. In landscape op desktop/tablet (≥1280px) klopt de styling wél (donker navy met goud accenten), want daar wordt de eigen `<aside>` met `glass-sidebar` gerenderd.

### Oorzaak

In `src/components/ui/sidebar.tsx` (mobiele branch, regel 154-171) wordt `SheetContent` van shadcn gebruikt. `sheetVariants` in `src/components/ui/sheet.tsx` zet standaard de class **`glass-sheet`** op de container, die in `index.css` `background-color: hsl(var(--card) / 0.85)` toepast — een licht/cremekleurige achtergrond. De toegevoegde `bg-sidebar` utility verliest van `glass-sheet` doordat beide `background-color` schrijven en `glass-sheet` later in de stylesheet komt (specificiteitsgelijk, volgorde wint).

Daardoor:
- achtergrond = licht beige in plaats van navy
- tekstkleur is `--sidebar-foreground` (licht) → menu-items lijken bijna onzichtbaar (zie screenshot 1)
- `--sidebar-primary` (goud) op "TX TableWise" en actieve item klopt nog wel, maar contrast is verbroken

## Fix (frontend, alleen presentatie)

Eén bestand wijzigen: `src/components/ui/sidebar.tsx`, mobiele branch (regel 156-170).

1. Voeg `glass-sidebar` toe aan de `SheetContent` className zodat de navy achtergrond met blur uit `index.css` wint.
2. Voorkom dat de erfelijke `glass-sheet` lichte achtergrond doorlekt door de background expliciet te overrulen met `!bg-sidebar` (Tailwind important) — sluit het probleem definitief af, los van CSS-volgorde.
3. Border kleur uit shadcn-sheet (`border-r/border-l/border-t/border-b`) → laat `border-sidebar-border` toepassen voor consistente navy rand.

Concrete className wordt:
```
"glass-sidebar w-[--sidebar-width] !bg-sidebar p-0 text-sidebar-foreground border-sidebar-border [&>button]:hidden"
```

Geen andere bestanden (geen wijziging in `AppSidebar.tsx`, `index.css`, of tokens) — de tokens zijn al correct, alleen de Sheet-wrapper hield ze tegen.

## QA

Na fix verifiëren in 3 viewports:
- 360×800 portrait → mobiele sheet
- 820×1180 tablet portrait → mobiele sheet (zelfde branch want `<1280`)
- 1366×768 desktop landscape → ongewijzigd, moet hetzelfde blijven

Verwachte uitkomst: achtergrond = navy `hsl(222 44% 10%)`, menu-items goed leesbaar in licht grijs, "TX TableWise" + actieve "Dashboard" in goud — identiek aan tweede screenshot (tablet landscape).
