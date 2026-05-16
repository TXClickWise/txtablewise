## Tijdslot-generator fixen (availability edge function)

Beide problemen ontstaan in `supabase/functions/availability/index.ts` bij hoe shift-vensters naar tijdslots worden vertaald.

### Oorzaak

```ts
const windows: Window[] = [];           // één Window per (openingstijd × shift)
…
for (const w of windows) {
  let cur = toMinutes(w.start);
  const lastStart = toMinutes(w.end) - durationMinutes;   // ⚠️ stopt elk venster `duration` minuten voor het einde
  while (cur <= lastStart) { … slotCandidates.push(…) }
}
```

1. **Gat 14:30 → 17:00**
   Lunch- en dinershift worden als **aparte vensters** behandeld. Voor elk venster wordt afgekapt op `end − reserveringsduur`. Met lunch tot 17:00 en duur ±150 min stopt het laatste lunchslot rond 14:30; het volgende venster (diner) start pas om 17:00. Het is dus geen "te dichte sluitingstijd", het is de loze afkapping per shift terwijl de keuken eigenlijk doorloopt naar diner.

2. **Slots niet op chronologische volgorde**
   `windows` wordt gevuld in de volgorde waarin Supabase de shifts teruggeeft (geen ORDER BY). Komt diner-shift eerst uit de DB, dan worden eerst alle diner-slots gegenereerd en daarna pas de lunch-slots → in de UI staat 17:00, 17:15, …, 12:00, 12:15.

3. **Mogen eind- en begintijd gelijk zijn?**
   Ja, lunch 11:00–17:00 + diner 17:00–22:00 is prima — mits we de vensters samenvoegen zodat de slot-generator ze als één doorlopend blok 11:00–22:00 ziet.

### Oplossing in `availability/index.ts`

Tussen het bouwen van `windows` (regel ±117) en de slot-generatie (regel 127) één extra stap toevoegen:

```ts
// 1. Sorteer vensters chronologisch
windows.sort((a, b) => a.start.localeCompare(b.start));

// 2. Voeg aansluitende of overlappende vensters samen
//    (lunch 11-17 + diner 17-22 → 11-22; diner 17-22 + late 21-24 → 17-24)
const merged: Window[] = [];
for (const w of windows) {
  const last = merged[merged.length - 1];
  if (last && w.start <= last.end) {
    last.end = w.end > last.end ? w.end : last.end;
  } else {
    merged.push({ ...w });
  }
}
```

Daarna `merged` gebruiken in de bestaande `for (const w of windows)`-loop in plaats van `windows`.

Effect:
- **Issue 1**: lunch- en dinershift worden samengevoegd tot één doorlopend venster, dus de slot-generator plaatst slots elke `slot_duration_minutes` minuten van 11:00 t/m `eindtijd − reserveringsduur`. Geen gat meer rond 14:30–17:00.
- **Issue 2**: door eerst te sorteren staan slots altijd op chronologische volgorde, ongeacht de volgorde waarin shifts uit de DB komen.
- **Vraag over eindtijd = begintijd**: blijft toegestaan en werkt nu correct dankzij de merge (`w.start <= last.end`).

### Out of scope

Geen wijzigingen aan settings-schermen, reserveringsduur, pacing, sluitingsdagen of UI van de widget — alleen de venster-naar-slot logica in de edge function.
