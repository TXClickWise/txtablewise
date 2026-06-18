## Grote-groepen USP toevoegen aan landingspagina

### Doel
De "slimme afhandeling van grote groepen" expliciet benoemen als uniek voordeel op de publieke landingspagina, aansluitend bij de horeca-vriendelijke toon.

### Wijzigingen

1. **`src/components/landing/WhyTableWiseSection.tsx`**
   - Voeg een 7e USP toe aan de `usps`-array:
     - **Icoon:** `Users` (lucide-react) — past bij groepen/gasten.
     - **Titel:** "Grote groepen, slim geregeld"
     - **Body:** Vanaf een zelfgekozen drempel checkt TX TableWise of er plek is, vraagt netjes om goedkeuring en stelt een aanbetaling voor. Geen verrassingen meer met een tafel voor zestien die eigenlijk nooit had gepast.
   - Pas de grid-layout aan zodat 7 items netjes renderen op alle schermbreedtes. De huidige `lg:grid-cols-3` geeft bij 7 items een los item op de laatste rij; dit wordt opgelost door de laatste kaart te centreren (`lg:col-start-2` op large screens) of door een flex-wrap-gebaseerde aanpak te gebruiken die automatisch balanceert.

2. **`src/components/landing/SolutionGrid.tsx`** *(alleen indien nodig na review)*
   - Indien de gebruiker wil dat het ook in de feature-grid verschijnt, wordt een gelijkwaardige feature-kaart toegevoegd. Anders blijft deze sectie ongewijzigd om overlap te voorkomen.

### Copy-richtlijn
Geen technische termen (geen "threshold", "auto-book", "approval workflow"). Alleen de **uitkomst** voor de horecaondernemer: minder verrassingen, nette communicatie, aanbetaling zonder gedoe.

### Acceptatie
- De 7e USP verschijnt visueel in balans met de bestaande 6 kaarten.
- De tekst bevat geen jargon.
- De build compileert zonder fouten.