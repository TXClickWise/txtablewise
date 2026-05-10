## Doel
In `/app/grote-groepen` staan inkomende formulier-aanvragen (`large_group_requests`) onder **"Aanvragen via formulier"**. Die zijn nu niet klikbaar. Maak ze klikbaar en bouw een werkflow waarin de operator de aanvraag omzet naar een echte reservering (met tafel/combi) of afwijst — met een gastvrije communicatie-keuze.

## Scope
Alleen frontend-werk in `src/pages/app/LargeGroupsPage.tsx` plus één nieuwe component `src/components/large-groups/LargeGroupRequestDialog.tsx`. Geen DB-wijzigingen, geen edge functions.

## UX-flow

1. **Klik op aanvraag-rij** → opent `LargeGroupRequestDialog` (Sheet, tablet-first, grote tap targets).
2. **Stap 1 — Aanvraag bekijken**
   - Gegevens uit `large_group_requests` + (optioneel) duplicate-check op telefoon/email tegen `guests`.
   - Snelkeuzes: **Omzetten naar reservering** | **Afwijzen** | **Sluiten**.
3. **Stap 2a — Omzetten naar reservering**
   - Pre-filled formulier (datum/tijd/party_size/naam/contact/occasion/message → special_requests).
   - Operator past datum/tijd aan indien nodig.
   - **Tafel toewijzen**: dezelfde UI als bij gewone reserveringen → hergebruik `AssignTableSheet`-logica of inline tafel/combinatie-multi-select op basis van `tables` + `table_combinations` voor het tijdvenster.
   - "Bevestig & maak reservering" → roept `book_reservation` edge function aan met `channel='manager'`, party_size kan > max_online_request zijn, gevolgd door insert in `reservation_tables`.
   - Markeer `large_group_requests.status = 'converted'` + `assigned_to = auth.uid()`.
4. **Stap 3 — Vervolgactie kiezen** (na succesvolle conversie of direct vanaf stap 1):
   - **A. Alleen bevestiging sturen** — kanaal kiezen (WhatsApp / Email / beide), gebruikt `requestGuestMessage({ kind: "custom" })` met sjabloon "bevestiging".
   - **B. Eerst overleggen** — kanaal kiezen + custom bericht-veld; reservering blijft in `pending` / `hold`-status, status-history krijgt note "wacht op overleg".
   - **C. Afwijzen** — snelkeuzes (vol op die datum / groepsgrootte niet mogelijk / sluitingsdag / ander voorstel) + custom textarea, kanaal kiezen, zet `large_group_requests.status='declined'`, en (indien al converted) reservering naar `cancelled` via `resService.declineLargeGroup`.
5. Toast + invalideer queries `large-group-requests`, `large-group-reservations`, `reservations-day`.

## Communicatie-implementatie
- Alle berichten lopen via `integration_events` (bestaand patroon `requestGuestMessage`). Voeg `channel_preference: 'whatsapp' | 'email' | 'both'` toe aan `payload` zodat ClickWise het juiste workflow-kanaal kiest. Geen TableWise-eigen WhatsApp/SMS — conform memory `clickwise-live`.
- Snelkeuze-templates als constants bovenin de dialog (NL, gastvrije toon, conform `microcopy`-memory).

## Bestanden
- **NEW** `src/components/large-groups/LargeGroupRequestDialog.tsx` — sheet met 3 stappen (bekijken → omzetten/afwijzen → kanaal/bericht).
- **EDIT** `src/pages/app/LargeGroupsPage.tsx`
  - Maak `RequestRow` klikbaar (`button` wrapper, `onOpen`).
  - State `selectedRequestId`, render `<LargeGroupRequestDialog>`.
  - Filter "new" + nieuwe statussen `converted`, `declined`, `contacted` in inbox-rendering.

## Status-uitbreiding (zonder migratie)
`large_group_requests.status` is al `text` met enum-type — bestaande waarden `new`, `contacted`, `converted`, `declined` worden gebruikt; geen schema-wijziging nodig (controleer in implementatie via een select; als enum strikt is doe ik dat in een vervolgmigratie en gebruiken we tot die tijd alleen `new` → `contacted`/`converted`/'declined' mits toegestaan).

## QA
- Klik op aanvraag → dialog opent.
- Omzetten met tafel → reservering verschijnt in "Goedgekeurde groepsreserveringen".
- "Alleen bevestiging" → `integration_events`-rij met juiste payload.
- "Afwijzen" → aanvraagstatus `declined`, gast krijgt bericht volgens kanaalkeuze.
- Tablet 1024px en mobiel 360px: sheet vult scherm, knoppen ≥44px.
