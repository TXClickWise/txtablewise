Twee kleine, geïsoleerde bugs in de weer-feature. Beide alleen presentatie-/copy-laag, geen datamodel of business-logica.

## Bug 1 — "vrijdag" terwijl het zaterdag is

**Oorzaak:** `supabase/functions/weather_advise/index.ts` bouwt rule-based tips correct op (de headline gebruikt `formatDateNl(date)` → "za 13 jun"). Daarna polished de Lovable AI Gateway (`polishWithAi`) de tekst vrij — het model krijgt alleen `{type, date, headline_nl, body_nl}` en verzint zelf weekdagnamen, vandaar "deze vrijdag" op een zaterdag.

**Fix:** in `polishWithAi`
1. Per item een vooraf-berekende `weekday_nl` + `date_label_nl` (op basis van `Intl.DateTimeFormat("nl-NL", { weekday: "long" })` voor de item-`date`) toevoegen aan de payload die naar de AI gaat.
2. System-prompt aanscherpen: "Gebruik uitsluitend de meegegeven `weekday_nl`/`date_label_nl` als je naar de dag verwijst. Verzin nooit zelf een dag van de week of datum. Behoud cijfers (graden, km/u, tijden) exact." 
3. Vangnet na de AI-call: als `headline_nl` of `body_nl` een andere weekdagnaam bevat dan de verwachte → terugvallen op de originele rule-based tekst voor dat item (geen polished versie gebruiken).

## Bug 2 — Windpijl wijst de verkeerde kant op

**Oorzaak:** in `src/components/weather/WeatherPill.tsx` rendert `WindArrow` het Lucide `Navigation`-icoon en draait het met `rotate((deg + 180) % 360)`. Het `Navigation`-icoon wijst echter standaard naar rechts-boven (~NO), niet naar het noorden. Daardoor staat de pijl 45° verkeerd t.o.v. de tekstuele richting (W, NW, Z, etc.) die wél correct uit `degToCompass` komt.

**Fix:** rotatie corrigeren met -45° offset zodat `rotate(0deg)` daadwerkelijk noord is:
```
transform: `rotate(${(deg + 180 - 45 + 360) % 360}deg)`
```
Dit is één regel in de `WindArrow`-helper; alle gebruikers (pill, uurrij, 7-daagse rij) krijgen automatisch de correcte pijl. De tekst-labels (W/NW/…) en de Beaufort-kleur blijven ongewijzigd.

## Bestanden

- `supabase/functions/weather_advise/index.ts` — payload + prompt + post-validatie in `polishWithAi`.
- `src/components/weather/WeatherPill.tsx` — alleen `WindArrow`-rotatie.

## Verificatie

- Hard reload `/app/vandaag`: tip moet "deze zaterdag" (of geen weekdag) tonen i.p.v. "vrijdag".
- Op een W-wind moet de pijl horizontaal naar rechts wijzen (richting waarheen de wind blaast), bij N naar beneden, etc.
- Bestaande, al opgeslagen advisories met foute tekst worden bij de volgende `weather_fetcher`-run automatisch overschreven (upsert op `restaurant_id,date,type`).
