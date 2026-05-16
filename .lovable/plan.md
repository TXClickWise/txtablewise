## Scope

Twee provisioning-routes voor ClickWise ↔ TableWise. **Telefoonnummer aanschaffen + koppelen blijft buiten scope** (handmatig in HighLevel/LC-Phone i.v.m. Twilio Regulatory Bundle). Route 2 maakt gebruik van een HighLevel **SaaS-plan "TX TableWise"** waaraan de master-snapshot al gekoppeld is — die snapshot wordt automatisch geladen bij het aanmaken van een nieuw sub-account, dus TableWise hoeft de snapshot-load API niet zelf aan te roepen.

---

## Route 1 — Snapshot uitrollen op een **bestaand** sub-account

**Wanneer:** tenant (of agency) heeft al een ClickWise sub-account, met of zonder de TableWise-snapshot al geladen.

**Wat TableWise doet:**
1. Operator opent admin-pagina onder Koppelingen → ClickWise.
2. Plakt eenmalig de `clickwise_location_id` van het bestaande sub-account.
3. Optioneel: vinkje "snapshot al geladen in ClickWise" (anders eerst handmatig vanuit HighLevel UI snapshot loaden — Route 1 doet géén snapshot-load).
4. Knop **"Sync configuratie naar ClickWise"** → edge function:
   - `PUT`/`UPSERT` alle Custom Values (zie `mem://features/clickwise-snapshot`) op het sub-account.
   - Raakt géén native sub-account velden (naam, adres, e-mail, telefoon, tijdzone).
   - Idempotent — kan onbeperkt opnieuw gedraaid worden.
5. Audit-log + `clickwise_synced_at` timestamp tonen.

**Operator-handwerk:** sub-account aanmaken, snapshot één keer laden (als nog niet via SaaS-plan gebeurd), LC-Phone nummer kopen + koppelen, Voice AI assistant aan dat nummer hangen.

**Benodigd:**
- Migratie: `restaurants.clickwise_location_id`, `restaurants.clickwise_synced_at`.
- Edge function `clickwise_sync_custom_values` (alleen Custom Values push).
- 1 secret: `HIGHLEVEL_AGENCY_API_KEY` (of per-locatie PIT-token).
- UI: read-only preview van Custom Values + "Sync nu" knop.

---

## Route 2 — **Nieuw** sub-account aanmaken vanuit TableWise (via SaaS-plan)

**Wanneer:** tenant heeft nog géén sub-account en heeft de ClickWise-add-on geactiveerd.

**Voorwerk in HighLevel (eenmalig, door TableWise admin):**
- SaaS-plan **"TX TableWise"** aanmaken met de master-snapshot al gekoppeld → `HIGHLEVEL_SAAS_PLAN_ID` als secret in TableWise.
- Master-snapshot bevat alle workflows, triggers, templates en **placeholder Custom Values** zoals beschreven in `mem://features/clickwise-snapshot`.

**Wat TableWise doet (één "Provisioneer ClickWise" knop):**
1. **Billing-gate:** `restaurants.clickwise_addon = 'active'` vereist. In pilot-fase handmatig door system admin op active gezet (factuur buiten Lovable).
2. **Pre-flight:** bedrijfsnaam, e-mail, telefoon, adres, tijdzone en `locale` ingevuld (wizard om aan te vullen indien niet).
3. Edge function `clickwise_provision_subaccount`:
   - `POST /locations/` met tenant-data **+ `saasPlanId = HIGHLEVEL_SAAS_PLAN_ID`** → HighLevel maakt locatie en koppelt automatisch de snapshot uit het plan. Geen aparte snapshot-load API call meer nodig.
   - Korte wachtperiode (~5–10s) zodat workflows/templates klaarstaan.
   - `PUT /locations/{id}/customValues/{key}` voor álle TableWise Custom Values (hergebruikt de Route-1 sync-functie).
   - Update `restaurants` met `clickwise_location_id`, `clickwise_provisioned_at`, `clickwise_saas_plan_id`.
   - Audit-log.
   - Bij failure ná `POST /locations`: `DELETE /locations/{id}` rollback, zodat tenant niet voor een halve sub-account betaalt.
4. UI toont stap-checklist: ✅ Sub-account + snapshot aangemaakt / ✅ Custom Values gesynchroniseerd / ⏳ Telefoonnummer (handmatige vervolgactie).

**Operator-handwerk (na auto-provisioning):** LC-Phone nummer kopen, Regulatory Bundle indienen bij Twilio, nummer koppelen aan Voice AI assistant. Buiten dit plan.

**Benodigd:**
- Migratie: `restaurants.clickwise_location_id`, `clickwise_provisioned_at`, `clickwise_saas_plan_id` (text), `clickwise_addon` (enum: `none | active | past_due | cancelled`), `clickwise_addon_updated_at`.
- Edge function `clickwise_provision_subaccount` (met rollback + 1/uur rate-limit per restaurant).
- 3 secrets: `HIGHLEVEL_AGENCY_API_KEY`, `HIGHLEVEL_COMPANY_ID`, `HIGHLEVEL_SAAS_PLAN_ID`.
  - `HIGHLEVEL_MASTER_SNAPSHOT_ID` is **niet meer nodig** als directe parameter, omdat de snapshot via het SaaS-plan gekoppeld is. (Wel handig om als referentie ergens vast te leggen.)
- Admin-UI (`/app/admin/clickwise-voice-setup` of nieuwe pagina):
  - Add-on status (toggle voor system admin in pilot-fase).
  - "Provisioneer" knop (alleen actief als add-on `active` + tenant-velden compleet).
  - Live stap-status met rollback-melding bij fail.
  - Deeplink "open in ClickWise" na succes.
- Hergebruik van Route-1 sync-functie voor latere updates aan Custom Values.

---

## Wijzigingen t.o.v. vorige planversie

- ✅ `POST /snapshots/{id}/load` + status-polling **vervalt** in Route 2 — snapshot komt via SaaS-plan mee.
- ✅ Nieuwe secret `HIGHLEVEL_SAAS_PLAN_ID`, oude `HIGHLEVEL_MASTER_SNAPSHOT_ID` niet meer hard nodig.
- ✅ Nieuwe kolom `clickwise_saas_plan_id` op `restaurants` voor traceability (welk plan gebruikt voor provisioning).
- ✅ Provisioning-flow korter: locatie aanmaken → korte wait → Custom Values pushen → klaar.
- ❌ Geen LC-Phone automation (telefoonnummer + Regulatory Bundle blijven handmatig).
- ❌ Geen Stripe/Paddle voor add-on billing — handmatig door system admin in pilot-fase.

---

## Open vragen vóór ik bouw

1. **Beide routes tegelijk** (aanbevolen — Route 2 hergebruikt Route-1 sync) of alleen Route 1 eerst?
2. **Add-on billing pilot-fase**: akkoord dat `clickwise_addon` voorlopig handmatig op `active` wordt gezet door system admin (Stripe-integratie later)?
3. **SaaS-plan in HighLevel**: heb je het plan "TX TableWise" met snapshot-koppeling al aangemaakt, of doe je dat parallel met deze bouw? (`HIGHLEVEL_SAAS_PLAN_ID` heb ik nodig vóór ingebruikname.)
