import { PlaceholderPage } from "@/components/PlaceholderPage";

const LargeGroupsPage = () => (
  <PlaceholderPage
    title="Grote groepen"
    intro="Voor grotere groepen kun je extra tijd, handmatige goedkeuring of een reserveringsgarantie instellen."
    comingSoon="Goedkeuringsflow en aanbetalingsverzoeken volgen. Instellingen zijn al zichtbaar."
    sections={[
      {
        title: "Aanvragen — wachten op goedkeuring",
        items: [
          { label: "Bakker — 12 personen — vrijdag 19:00", meta: "Verjaardag · serre", badge: "In aanvraag" },
          { label: "Familie Van Dijk — 10 personen — zaterdag 18:30", meta: "Diner", badge: "Aanbetaling aanbevolen" },
        ],
      },
      {
        title: "Goedgekeurde groepsreserveringen",
        items: [
          { label: "Vereniging De Haven — 18 personen", meta: "Volgende week dinsdag · wijnarrangement", badge: "Goedgekeurd" },
          { label: "Bedrijf Acme — 14 personen", meta: "Zakelijke lunch", badge: "Aanbetaling ontvangen" },
        ],
      },
      {
        title: "Instellingen — preview",
        description: "Zacht configureerbaar via Instellingen → Grote groepen",
        items: [
          { label: "Grote groep vanaf", badge: "8 personen" },
          { label: "Extra verblijfsduur", badge: "+30 minuten" },
          { label: "Handmatige goedkeuring vanaf", badge: "10 personen" },
          { label: "Aanbetaling gewenst vanaf", badge: "8 personen" },
          { label: "Automatische boeking toegestaan tot", badge: "12 personen" },
        ],
      },
      {
        title: "Hospitality-toon",
        description: "Hoe gasten de aanvraag ervaren",
        children: (
          <blockquote className="rounded-md border-l-2 border-primary bg-muted/30 px-4 py-3 text-sm italic">
            "Bedankt voor je aanvraag voor 12 personen. We bevestigen graag persoonlijk binnen 24 uur — zo zorgen we dat alles klopt."
          </blockquote>
        ),
      },
    ]}
  />
);

export default LargeGroupsPage;
