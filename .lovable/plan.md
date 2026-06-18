## Probleem
De `AdvisoryStrip` op Vandaag toont "Mooi weer voorspeld op vrijdag, 28°C" terwijl het donderdag is. Oorzaak: `fetchActiveAdvisories` in `src/services/weather.ts` filtert op `date >= today`, dus advisories voor morgen/overmorgen lekken door naar het Vandaag-scherm.

## Fix
Eén regel aanpassen in `src/services/weather.ts`:

```diff
-    .gte("date", today)
+    .eq("date", today)
```

Daarmee toont de strip op `/app` (Vandaag) alleen het weer + bijbehorende tip voor de actuele dag. De `WeatherPill` gebruikt al `currentHour()` en is onveranderd correct.

## Out of scope
- Geen wijziging aan de weer-edge-functie of aan de advisory-generatie zelf — toekomstige advisories blijven bestaan voor latere rapportages/pagina's, ze worden alleen niet meer op Vandaag getoond.
- `WeatherPill` blijft ongewijzigd.
- Geen UI- of designwijziging.

## Verificatie
- Vandaag-scherm: alleen advisory met `date = today` zichtbaar, of niets als die er niet is.
- Test: als er enkel een advisory voor morgen bestaat → strip toont niets meer.
