# TableWise Public API — Foutcodes

Alle fouten retourneren JSON in dit formaat:

```json
{
  "error": {
    "code": "TW_<HTTP>_<REASON>",
    "message": "Mensvriendelijke uitleg in NL.",
    "field": "<veldnaam of null>",
    "suggestedFix": "Concrete actie om het op te lossen."
  }
}
```

| Code | HTTP | Wanneer | Voorgestelde actie |
|---|---|---|---|
| `TW_400_MISSING_DATE`        | 400 | `localDate` ontbreekt | Voeg `localDate` toe (YYYY-MM-DD). |
| `TW_400_MISSING_TIME`        | 400 | `localTime` ontbreekt | Voeg `localTime` toe (HH:MM). |
| `TW_400_MISSING_PARTY_SIZE`  | 400 | `partySize` ontbreekt of < 1 | Voeg `partySize` toe als integer ≥ 1. |
| `TW_400_MISSING_NAME`        | 400 | `contact.fullName` of firstName ontbreekt | Voeg `contact.fullName` toe. |
| `TW_400_MISSING_PHONE`       | 400 | `contact.phone` ontbreekt | Voeg `contact.phone` toe (+31...). |
| `TW_400_INVALID_PHONE`       | 400 | Telefoonnummer voldoet niet aan E.164-achtig formaat | Gebruik `+31612345678` formaat. |
| `TW_400_INVALID_EMAIL`       | 400 | Email ongeldig | Geef geldig email of laat veld weg. |
| `TW_400_INVALID_DATE`        | 400 | Datum geen YYYY-MM-DD | Corrigeer formaat. |
| `TW_400_INVALID_TIME`        | 400 | Tijd geen HH:MM | Corrigeer formaat. |
| `TW_400_DATE_IN_PAST`        | 400 | Datum/tijd ligt in het verleden | Kies toekomstige datum/tijd. |
| `TW_400_INVALID_BODY`        | 400 | Body is geen geldige JSON | Stuur valide JSON met `Content-Type: application/json`. |
| `TW_401_AUTH_MISSING`        | 401 | Header `X-TableWise-Api-Key` ontbreekt | Voeg de header toe. |
| `TW_401_AUTH_INVALID`        | 401 | Sleutel onbekend of ingetrokken | Genereer een nieuwe sleutel in de Hub. |
| `TW_403_SCOPE_MISSING`       | 403 | Sleutel mist scope (availability/book/cancel/update) | Pas scopes aan in de Hub. |
| `TW_403_TENANT_MISMATCH`     | 403 | `locationId` wijkt af van vestiging van de sleutel | Laat `locationId` weg of gebruik juiste sleutel. |
| `TW_404_RESERVATION_NOT_FOUND`| 404 | Reservering niet gevonden of niet bij deze vestiging | Controleer `reservationId`. |
| `TW_404_RESTAURANT_NOT_FOUND`| 404 | Vestiging onvindbaar | Controleer `locationId` of API-sleutel. |
| `TW_405_METHOD_NOT_ALLOWED`  | 405 | Verkeerde HTTP-methode op endpoint | Zie PUBLIC_API.md voor toegestane methodes. |
| `TW_409_TIMESLOT_UNAVAILABLE`| 409 | Geen vrije tafel meer voor dit tijdslot | Probeer een ander tijdstip of vraag /availability op. |
| `TW_409_PACING_FULL`         | 409 | Tijdslot operationeel vol (covers/rate-limiet) | Kies aangrenzend tijdstip of wachtlijst. |
| `TW_409_PARTY_TOO_LARGE`     | 409 | Groep groter dan toegestaan voor online | Stuur large-group aanvraag of laat het restaurant boeken. |
| `TW_409_POSSIBLE_DUPLICATE`  | 409 | Vergelijkbare reservering binnen 5 min van zelfde gast | Wijzig bestaande of stuur met `externalReference`. |
| `TW_422_RESERVATION_NOT_VALID`| 422 | Reservering is gecanceld/voltooid/no-show — niet aanpasbaar | Maak nieuwe reservering. |
| `TW_423_RESTAURANT_CLOSED`   | 423 | Restaurant gesloten op gevraagd moment | Kies tijd binnen openingstijden. |
| `TW_500_INTERNAL`            | 500 | Onverwachte interne fout | Probeer opnieuw of contacteer support@tablewise.nl. |
