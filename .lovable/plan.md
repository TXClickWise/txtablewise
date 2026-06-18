## Wat & waarom

Twee dingen samenvoegen in één turn:

1. **Basic/Pro CTA's koppelen aan Stripe-checkout** via signup-flow (er is nog geen restaurant_id op de publieke pagina, dus directe checkout kan niet).
2. **Landingscopy ontjargonnen** — geen "API", "webhooks", "POS-koppeling", "endpoints" enz. op de publieke pagina. Toon = senior horecamarketeer: focus op rust op de vloer, minder no-shows, meer eigen gasten, minder commissie. Features worden vertaald naar voordelen.

## 1. CTA → Stripe checkout

### `src/components/landing/PricingSection.tsx`
- Basic: knop "Start met Basic" → `/auth?mode=signup&plan=basic`.
- Pro: knop "Start met Pro" → `/auth?mode=signup&plan=pro`.
- Kleine secundaire link onder beide: "of plan eerst een rondleiding" → `#contact`.
- Trial-knop blijft `"/auth?mode=signup"`.

### `src/pages/Auth.tsx`
- Bij signup `plan` query lezen, opslaan in `localStorage` als `pending_checkout_plan` (overleeft e-mail-confirmatie + redirect).
- `plan` doorgeven aan `/onboarding`.

### `src/pages/Onboarding.tsx`
- Na restaurant aanmaken: als `pending_checkout_plan` = basic/pro → `supabase.functions.invoke("stripe-checkout", { body: { target, restaurant_id } })`, redirect naar `data.url`. Bij fout: toast + door naar `/app/today` (trial blijft). Daarna `pending_checkout_plan` wissen.

### Edge case in `AppShell` (login)
- Bestaande gebruiker met restaurant + `pending_checkout_plan` in storage → direct doorsturen naar `/app/settings/subscription` en checkout starten.

## 2. Copy-herziening (toon: gastvrij, helder, voordeel-eerst)

Principes:
- Spreek de eigenaar / gastvrouw aan, niet de IT-er.
- Vervang techniek door uitkomst: "API & webhooks" → "werkt mee met je bestaande systemen", "POS-koppeling" → "weet wat er op tafel staat / praat met je kassa", "AI voice agent" → "neemt 24/7 de telefoon op zoals een goede gastvrouw".
- Korte zinnen. Cijfers/beloftes waar het kan ("minder lege tafels", "geen commissie per couvert").
- Geen jargon: API, webhooks, endpoints, SDK, JSON, multi-tenant, integratie, dashboard → vervang door "rapport", "overzicht", "koppelt vanzelf met …".

### Bestanden + richting

**`HeroSection.tsx`** — herschrijven naar één heldere belofte + 2 sub-bullets en 2 CTAs.
Bv. headline: *"Een vollere zaak, rustigere avonden en geen commissie per gast."* Sub: *"TX TableWise neemt de reserveringen, herinneringen en no-shows uit handen — zodat jij je gasten kunt verwennen."*

**`PainPointsSection.tsx`** — controleren dat pijnpunten in horeca-taal staan (no-shows, telefoon die rinkelt tijdens service, gasten die alleen via platforms boeken, hoge commissie). Aanpassen waar techniek doorschemert.

**`SolutionGrid.tsx`** — elke kaart begint met **voordeel** (titel) en pas daarna in 1 zin *hoe*. Verwijder woorden als "integratie", "module".

**`WhyTableWiseSection.tsx`** — 4-6 voordelen in plaats van features: *eigen gastenboek, geen commissie, rust tijdens service, vollere avonden door slimme wachtlijst, gasten die terugkomen, alles op één tablet*.

**`TrustSection.tsx`** — copy check, geen wijzigingen aan logo's/structuur.

**`PricingSection.tsx`** — features per plan herschrijven:
- "Onbeperkt reserveringen" ✓ blijft.
- "Tafelplan met zones, combinaties en vul-strategie" → "Slim tafelplan dat zelf de beste plek voorstelt".
- "POS-koppeling (Loyverse) — basis" → "Werkt samen met je kassa (Loyverse) zodat je weet wat er op tafel staat".
- Pro: "Publieke API & webhooks (live)" → schrappen of vervangen door "Koppelt met je bestaande software (boekhouding, marketing, kassa)".
- "POS-koppeling met artikelen + AI-koppeling" → "Volledige kassa-koppeling, inclusief gerechten en slimme suggesties".
- "Multi-locatie" → "Werkt voor één zaak of meerdere locaties".
- "AI-host voor telefoon, WhatsApp en webchat" → "AI-gastvrouw die 24/7 de telefoon, WhatsApp en webchat aanneemt".

**`WhyTableWiseSection.tsx`** badge/sub-copy: vervang "commissie-vrij" eventueel met "geen euro commissie per couvert" voor extra duidelijkheid (één keer in hero is genoeg).

### Wat niet wijzigt
- Backoffice / `SubscriptionSettings.tsx` blijft technischer mag — daar zit de operator al achter login.
- Plan-namen zelf (Trial/Basic/Pro) blijven.
- Geen wijzigingen aan datamodel, RLS, edge functions, of de bestaande `stripe-checkout` function.
- ClickWise add-on blok blijft, maar tekst lichtjes vereenvoudigen ("eigen telefoonnummer met AI-gastvrouw, WhatsApp en SMS").

## Verificatie
- Klik "Start met Pro" op landing → signup → onboarding → Stripe-checkout met Pro line item.
- Trial-CTA leidt nog steeds naar gewone signup zonder checkout.
- Snelle leesbeurt landingspagina: geen voorkomen meer van "API", "webhooks", "endpoint", "integratie" in zichtbare copy (JSON-LD script blijft, dat is SEO, geen UI).
