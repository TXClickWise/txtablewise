## Diagnose

De widget toont "Reserveren is op dit moment niet mogelijk…" omdat de anonieme `SELECT` op de `restaurants`-tabel mislukt met:

```
permission denied for function is_restaurant_member
```

Oorzaak: de RLS-policy `members read restaurant` op `public.restaurants` is gericht op **alle rollen** (PUBLIC) i.p.v. alleen `authenticated`. Postgres evalueert daardoor ook voor anonieme requests `is_restaurant_member(id)` — die functie is niet uitvoerbaar door `anon`, en de hele query faalt. De aparte policy `public read restaurant by slug` (TO anon) komt nooit aan bod.

Dit betreft zowel `https://txtablewise.nl/r/eigeweis` als de ClickWise-embed `eigeweis.clickwise.app/reserveren` — beide laden onze widget en raken dezelfde RLS-fout. Het is dus géén iframe-URL-probleem (URL klopt: `txtablewise.lovable.app/reserveer/eigeweis`), maar een backend-/RLS-bug die álle publieke restaurant-lookups raakt.

## Fix

Eén migratie die de auth-only policies expliciet aan rol `authenticated` koppelt, zodat anon alleen nog de publieke slug-policy ziet:

```sql
DROP POLICY "members read restaurant" ON public.restaurants;
CREATE POLICY "members read restaurant"
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(id));

DROP POLICY "managers update restaurant" ON public.restaurants;
CREATE POLICY "managers update restaurant"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_manager(id));
```

Andere tabellen scan ik in dezelfde migratie kort op hetzelfde patroon (policies die `is_restaurant_member/has_role/is_system_admin` aanroepen maar geen `TO`-clausule hebben) en fix die mee — anders krijgen we later hetzelfde probleem op `zones`, `pre_order_items`, etc. zodra anon ze nodig heeft.

## Verificatie

1. `curl` met anon key op `/rest/v1/restaurants?slug=eq.eigeweis` → moet 200 met de row geven (i.p.v. 42501).
2. `https://txtablewise.nl/r/eigeweis` openen → widget moet party/datum/tijd-stap tonen.
3. Embed `eigeweis.clickwise.app/reserveren` opnieuw laden → iframe vult zich met de widget.

## Niet wijzigen

- ClickWise-pagina blijft zoals hij is (iframe-URL is correct).
- Geen wijziging aan `is_active`/`is_live` van restaurants — `eigeweis` blijft op `is_live=false` totdat jij hem live zet via Pilot Launch.