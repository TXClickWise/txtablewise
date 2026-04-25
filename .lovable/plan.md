# Voice Agent Help / Knowledge Base pagina

Doel: de complete copy-paste handleiding voor het koppelen van de ClickWise Voice AI Agent aan TableWise beschikbaar maken als doorzoekbare help-pagina ín de app, zodat de gebruiker hem altijd bij de hand heeft. Alle vermeldingen van "HighLevel" / "GoHighLevel" worden vervangen door **ClickWise** (white-label).

## Wat ik ga maken

### 1. Nieuwe pagina: `src/pages/app/help/VoiceAgentHelp.tsx`
Tablet-vriendelijke kennisbank-pagina met:

- **Sticky inhoudsopgave** links (anchors naar elke sectie)
- **Zoekbalk** bovenin (filtert secties op tekst)
- **Per sectie een Card** met titel, korte intro en de inhoud
- **Copy-knop** op elk codeblok, JSON-blok en lange tekst (prompt, body, headers, custom-value waarden) — gebruikt `navigator.clipboard` + `sonner` toast (zelfde patroon als `VoiceAgentPage`)
- **Tabellen** voor custom fields, custom values en tool-parameters
- **Callout-blokken** voor tips en troubleshooting
- Print-vriendelijk (eenvoudige `@media print` styling)

Secties (in deze volgorde):
1. Vaste TableWise-waarden (URL's, headers, datum/tijd-formaten)
2. Stappen in TableWise (sleutel aanmaken)
3. ClickWise — Custom Fields (8 velden met type)
4. ClickWise — Custom Values (6 waarden, copy-paste)
5. ClickWise — Voice AI Agent aanmaken (general / prompt / tools / settings)
6. ClickWise — Telefoonnummer koppelen
7. ClickWise — Inbound Webhook Workflow
8. **System Prompt** (groot copy-paste blok)
9. **Tool definities** — 4 tools (`check_availability`, `book_reservation`, `cancel_reservation`, `log_call`) elk met URL, headers, body JSON en parameters
10. Eerste test (5 min) + foutmeldingen

### 2. Routing & navigatie
- Route toevoegen in `src/App.tsx`: `/app/help/voice-agent` → `VoiceAgentHelp`
- Een **"Help & koppeling"** knop (icon `BookOpen` of `HelpCircle`) bovenaan `VoiceAgentPage.tsx` die linkt naar deze pagina
- (Optioneel) extra menu-item in `AppSidebar.tsx` "Hospitality" sectie — of bewust **niet** in sidebar zetten en alleen via de Voice Agent pagina ontsluiten, zodat de sidebar niet overvol raakt. **Voorstel: alleen via knop op Voice Agent pagina + via een algemene `/app/help` index later.**

### 3. White-label tekst-policy (strikt toegepast)
- Alle teksten zeggen **"ClickWise"** — nooit "HighLevel", "GoHighLevel" of "GHL"
- Voorbeelden van gewijzigde formuleringen:
  - "in HighLevel logs" → "in de ClickWise call logs"
  - "Sub-account → Settings → Custom Fields" → "ClickWise → Instellingen → Custom Fields"
  - "Voice AI" / "AI Employee" → "ClickWise Voice Agent"
  - "Twilio-nummer in HighLevel" → "telefoonnummer in ClickWise"
- De provider-keuze in `VoiceAgentPage` heet nu nog "HighLevel Voice AI (ClickWise)" — die label pas ik aan naar **"ClickWise Voice Agent"**.

### 4. Geen backend-wijzigingen
Geen migrations, geen edge functions, geen secrets. Puur een nieuwe React-pagina + 1 routing-regel + 1 knop + 1 label-aanpassing.

## Bestanden die aangeraakt worden

| Bestand | Wijziging |
|---|---|
| `src/pages/app/help/VoiceAgentHelp.tsx` | **nieuw** — de kennisbank-pagina |
| `src/App.tsx` | route toevoegen `/app/help/voice-agent` |
| `src/pages/app/VoiceAgentPage.tsx` | knop "Help & koppeling" bovenaan + provider-label "ClickWise Voice Agent" |

## Wat NIET in scope zit (voor later)

- Algemene `/app/help` index met meerdere onderwerpen (POS, ClickWise, No-show, etc.)
- Meertalige (EN) versie van de help-pagina
- Inline interactieve "test deze endpoint"-knop (kan in v2)
