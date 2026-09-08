# Voice-agent koppeling: foutmelding oplossen

## Wat er nu misgaat

In het "Add MCP"-venster staat als adres alleen:

```text
lbhtztbpxmqlzhyephew.supabase.co/functions/
```

Het laatste stuk van het adres ontbreekt. Daardoor komt de aanvraag niet bij de
juiste ingang aan en meldt ClickWise "Error adding MCP server".

## Wat jij invult

- MCP Name: `TX TableWise`
- MCP URL: `lbhtztbpxmqlzhyephew.supabase.co/functions/v1/mcp_key`
- Timeout: `10000`
- Header naam: `X-Agent-Api-Key`
- Header waarde: de sleutel die eerder is aangemaakt (begint met `twk_`),
  volledig geplakt zonder spaties ervoor of erachter

## Wat ik doe als het daarna nog fout gaat

1. Ik roep de ingang zelf aan met exact dezelfde sleutel en controleer het
   antwoord (opstartbericht en lijst met beschikbare acties).
2. Ik bekijk de logboeken van de aanroep om te zien of ClickWise binnenkomt,
   en zo ja met welke melding hij wordt afgewezen.
3. Afhankelijk daarvan: sleutel opnieuw uitgeven, of de ingang aanpassen aan
   wat ClickWise precies verstuurt (bijvoorbeeld een andere manier van
   verbinden of een extra antwoord-type).

## Wat er niet verandert

De bestaande koppeling met browserinlog — die je bij de Managed Agent gebruikt —
blijft ongewijzigd werken. Ook de rest van de app en de telefoonkoppeling
blijven zoals ze zijn.
