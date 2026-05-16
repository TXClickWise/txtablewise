## Doel

Geen aparte Instellingen-sidebar meer. Klik op "Instellingen" in de main sidebar klapt een sub-menu uit met alle settings-items (zoals in de Guestplan-screenshot). Sub-items met meerdere subpagina's (zoals Openingstijden, Reserveringen) kunnen op hun eigen settings-pagina nog tabs blijven gebruiken.

## Wijzigingen

### 1. `src/components/AppSidebar.tsx` — Settings als uitklapbare groep
- Vervang de huidige losse "Instellingen" `SidebarMenuButton` door een `Collapsible` (zoals de andere groepen), maar dan met het tandwiel-icoon + "Instellingen" als header.
- Standaard open als route met `/app/instellingen` start (anders dichtgeklapt, persisted via `useCollapsibleGroup("sidebar.settings")`).
- Sub-items als platte lijst onder elkaar (groep-labels Basis/Operatie/Gasten & communicatie/Techniek/Account blijven als kleine `SidebarGroupLabel`-achtige tussenkopjes binnen het uitgeklapte blok, of we gebruiken één geheel platte lijst — zie keuze hieronder).
- Gebruik dezelfde `SidebarMenuButton` + `NavLink` styling als andere items, zodat actieve route gehighlight wordt.
- In `collapsed` (icon-only) sidebar: tandwiel klikt door naar `/app/instellingen` (geen uitklap mogelijk).
- Owner-only items (Pilot launch) respecteren de rol; alleen tonen voor `owner`.
- De settings-items komen rechtstreeks uit dezelfde `GROUPS`-definitie die nu in `SettingsPage.tsx` staat — verplaats die naar een gedeeld bestand `src/components/settings-nav.ts` zodat zowel sidebar als (optioneel) mobile fallback dezelfde bron gebruiken.

### 2. `src/pages/app/SettingsPage.tsx` — verwijder de eigen sidebar
- Verwijder de hele `<aside>` met `SettingsGroupNav` en de mobile pill-strip.
- Layout wordt simpelweg `<Outlet />` in een container (geen 2-koloms grid meer).
- Importeer `GROUPS` uit het nieuwe shared bestand (alleen nog nodig voor de mobile fallback — zie keuze).
- `/app/instellingen` (index) blijft `GeneralSettings` tonen.

### 3. Mobiele weergave
Twee opties:
- **A (voorkeur):** mobile gebruikt de gewone main sidebar (sheet) met het uitgeklapte Instellingen-blok. Geen aparte mobile pill-strip meer. Eenvoudiger, één bron van waarheid.
- **B:** behoud mobile pill-strip bovenaan settings-pagina's als snelle navigatie.

Voorstel: **A**.

### 4. Tussenkopjes binnen uitgeklapt Instellingen-menu
Twee opties:
- **A (matcht screenshot):** platte lijst, zonder groep-labels. Volgorde: Algemeen, Openingstijden, Reserveringen, Online reserveren, Tafels & zones, Gasten, Berichten, Drankjes vooraf, AI & Voice, Integraties, API & webhooks, Gebruikers & rollen, Abonnement, Pilot lancering.
- **B:** met kleine tussenkopjes (Basis / Operatie / Gasten & communicatie / Techniek / Account).

Screenshot van Guestplan is platte lijst → **A**.

### 5. Niet aanraken
- Geen routes wijzigen.
- Geen settings-subpagina's wijzigen (Openingstijden, Reserveringen blijven hun eigen interne tabs houden).
- `useCollapsibleGroup` blijft zoals het is.

## Technische details

- Nieuw bestand: `src/components/settings-nav.ts` exporteert `SETTINGS_ITEMS: { to, label, icon, end?, ownerOnly? }[]`.
- `AppSidebar.tsx`: nieuwe sectie ná Beheer, voor Admin:
  ```
  <Collapsible open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild>
      <SidebarMenuButton isActive={settingsActive}>
        <Settings/> Instellingen <ChevronDown/>
      </SidebarMenuButton>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <SidebarMenuSub>… SETTINGS_ITEMS.map(…) …</SidebarMenuSub>
    </CollapsibleContent>
  </Collapsible>
  ```
  In `collapsed` mode: render als gewone `NavLink` naar `/app/instellingen`.
- `SettingsPage.tsx` wordt:
  ```tsx
  <div className="p-4 sm:p-6 max-w-5xl mx-auto"><Outlet/></div>
  ```
  (header "Instellingen" verplaatst naar individuele subpagina's, die hebben die al; `GeneralSettings` heeft eigen titel).
