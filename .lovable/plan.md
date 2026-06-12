## Plan

Ik pas de weerweergave aan zodat windrichting zichtbaar wordt én de windsterkte korter op één regel past.

### Aanpassingen

1. **Windsterkte zonder woord “wind”**
   - `Matige wind` wordt `Matig`
   - `Vrij krachtige wind` wordt `Vrij krachtig`
   - `Krachtige wind` wordt `Krachtig`
   - `Harde wind` wordt `Hard`
   - `Zwakke wind` wordt `Zwak`
   - Storm-benamingen blijven logisch kort: `Stormachtig`, `Storm`, `Zware storm`, etc.

2. **Windrichting als aparte, duidelijke informatie**
   - In de 7-dagen tabel komt de richting niet meer verstopt in dezelfde badge.
   - De windkolom toont bijvoorbeeld: `ZW · Vrij krachtig` of krijgt, als dat beter past, een aparte subregel met `uit ZW`.
   - Richting blijft altijd tekstueel zichtbaar, dus niet alleen als pijltje.

3. **Betere uitlijning van de tabel**
   - De windcel krijgt een vaste breedte/opbouw zodat badges niet afbreken zoals op de screenshot.
   - Headers blijven boven de juiste kolommen staan.
   - De tekst blijft compact en leesbaar op tablet/desktop.

### Technisch

- Aanpassen in `src/services/weather.ts`: Beaufort-labels inkorten.
- Aanpassen in `src/components/weather/WeatherPill.tsx`: windrichting explicieter tonen en de windkolom compacter uitlijnen.
- Geen backend- of datamodelwijzigingen nodig.