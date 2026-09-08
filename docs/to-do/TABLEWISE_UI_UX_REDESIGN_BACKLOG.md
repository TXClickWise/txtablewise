# TX TableWise — UI/UX Redesign & Quality Audit Backlog

**Status:** Later grondig uitvoeren — nu alleen vastgelegd  
**Prioriteit:** Hoog  
**Scope:** Volledige applicatie, met extra nadruk op tablet en mobiel  
**Doel:** Minimaal 50% cleaner, eenvoudiger en duidelijker dan de huidige interface

## Aanleiding

De huidige UI/UX van TX TableWise moet integraal worden herzien. De applicatie bevat op meerdere plekken zichtbare en functionele problemen en voldoet onvoldoende aan de kwaliteit die van een moderne hospitality SaaS-app verwacht mag worden.

Dit is geen losse cosmetische optimalisatie, maar een volledige productbrede UI/UX- en kwaliteitsronde.

## Bekende problemen die expliciet moeten worden meegenomen

- 404-pagina's en dode/niet-werkende routes.
- Knoppen en acties die niet werken, onduidelijk zijn of visueel onvoldoende kwaliteit hebben.
- Teksten, kaders en componenten die buiten pagina's of schermbreedtes lopen.
- Slechte of inconsistente mobiele en tabletweergave.
- Onlogische of onduidelijke statusacties en herstelpaden.
- Voorbeeld: na per ongeluk **Aan tafel / seated** kiezen is er in de normale bediening geen duidelijke directe herstelactie.
- Inconsistente of misleidende UI ten opzichte van backend-regels.
- Slecht of inconsistent kleurgebruik.
- Onvoldoende contrastverhoudingen.
- Te veel visuele ruis en onvoldoende hiërarchie.
- Inconsistente spacing, componentgroottes, iconen, borders, radii en states.
- Schermen die te druk, technisch of administratief aanvoelen.
- Onduidelijke primaire versus secundaire acties.
- Desktop-first gedrag dat op tablet/mobiel niet goed schaalt.
- Onvoldoende fout-, leeg-, loading- en success-states.
- Pagina's en workflows die niet conform moderne toegankelijkheids- en responsive standaarden zijn gebouwd.
- Onnodige complexiteit in navigatie en bediening.
- Teksten en labels die niet consequent, duidelijk of gastvrij zijn.

## Gewenste eindkwaliteit

De applicatie moet uiteindelijk:

- minimaal **50% cleaner, eenvoudiger en duidelijker** worden;
- professioneel en consistent ogen;
- snel te begrijpen zijn zonder uitleg;
- primair goed werken op **tablet en mobiel**, naast desktop;
- geschikt zijn voor drukke horeca-omgevingen;
- duidelijke, grote en betrouwbare touch-controls hebben;
- alleen relevante informatie tonen op het moment dat die nodig is;
- visueel rustiger zijn met een sterke informatiehiërarchie;
- consistente componenten en design tokens gebruiken;
- duidelijke states hebben voor hover, focus, disabled, loading, success, warning en error;
- toegankelijk zijn volgens moderne standaarden, minimaal gericht op **WCAG 2.2 AA**;
- goede contrastverhoudingen gebruiken;
- geen horizontale overflow of aflopende componenten bevatten;
- geen 404's, dode links of niet-functionerende knoppen bevatten;
- consistente foutafhandeling en herstelacties bieden;
- duidelijke confirmation/undo-patronen gebruiken voor risicovolle statuswijzigingen.

## Toekomstige aanpak

Wanneer dit traject wordt gestart, eerst **geen redesign op gevoel uitvoeren**. Eerst een volledige audit van de bestaande applicatie uitvoeren en bevindingen vastleggen.

De audit moet minimaal omvatten:

1. Alle routes en pagina's openen en controleren op 404's, crashes, overflow en kapotte states.
2. Alle primaire en secundaire knoppen en interacties testen.
3. Alle reserveringsflows testen: aanmaken, wijzigen, annuleren, statuswijzigingen, waitlist, grote groepen en foutscenario's.
4. Responsive audit uitvoeren voor desktop, tablet en mobiel.
5. Navigatie en informatiearchitectuur beoordelen.
6. Design consistency audit uitvoeren.
7. Accessibility audit uitvoeren: contrast, focus, toetsenbordbediening, labels, touch targets en leesbaarheid.
8. UX-frictie inventariseren per rol en hoofdtaak.
9. Screenshots en issue-lijst per pagina/component maken.
10. Problemen prioriteren op ernst: blocker, high, medium, low.
11. Eerst een vereenvoudigde designrichting/design system vastleggen.
12. Daarna stapsgewijs herbouwen en per flow testen.

## Belangrijk ontwerpprincipe

**Niet meer functionaliteit tonen dan op dat moment nodig is.**

Voor elke pagina en workflow moet worden gevraagd:

- Wat probeert de gebruiker hier nu te doen?
- Wat is de primaire actie?
- Welke informatie is echt nodig?
- Wat kan weg, worden samengevoegd of pas later worden getoond?
- Kan deze handeling met minder stappen?
- Is de actie op een tablet met één hand duidelijk en veilig uit te voeren?

## Mobiel/tablet als kernvereiste

Tablet en mobiel zijn geen afgeleide desktopweergaven. Ze moeten als volwaardige gebruikssituaties worden ontworpen.

Extra aandacht voor:

- grote touch targets;
- vaste primaire acties waar logisch;
- geen piepkleine controls;
- geen brede tabellen die simpelweg worden samengeperst;
- alternatieve card/list layouts waar nodig;
- duidelijke bottom sheets/drawers op mobiel;
- minimale invoer;
- zo min mogelijk modals bovenop modals;
- snelle bediening tijdens restaurantservice;
- veilige statuswijzigingen met duidelijke feedback en herstelmogelijkheid.

## Niet nu uitvoeren

Dit bestand is bedoeld als **canonieke backlog/brief voor een latere, grondige UI/UX-revisie**.

Losse UI-fixes mogen tussentijds alleen worden gedaan wanneer ze een actuele blocker oplossen. Ze mogen niet worden gebruikt als vervanging voor de volledige audit en redesignronde.

## Besluit

TX TableWise krijgt later een volledige UI/UX-, responsive-, accessibility- en functionele kwaliteitsronde. Het doel is niet een oppervlakkige facelift, maar een aantoonbaar professionelere, eenvoudigere en betrouwbaardere applicatie.
