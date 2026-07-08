import { RevealOnScroll } from "./RevealOnScroll";

const pains = [
  {
    title: "Gasten die niet komen opdagen",
    body: "Vier couverts ingepland, mise-en-place draait, bediening staat klaar. Half acht, niemand. Geen telefoontje, geen berichtje. Dat doet meer dan alleen omzet mislopen — het vreet aan je planning, je team en je humeur.",
  },
  {
    title: "Drie systemen, nul overzicht",
    body: "Reserveringen via de website in het ene systeem, telefonische boekingen op een kladblok, WhatsApp-berichten in je privételefoon. En dan vraagt een gast: 'Is er vrijdag nog plek voor zes?' En jij weet het niet zeker.",
  },
  {
    title: "Geen tijd voor opvolging",
    body: "Mooie avond gehad, tevreden gasten — maar niemand die ze een bedankje stuurt, om een review vraagt of ze over drie maanden herinnert. Je weet dat het omzet oplevert, maar na een dubbele shift wil je vooral je schoenen uit.",
  },
];

export function PainPointsSection() {
  return (
    <section className="bg-gradient-warm py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Herkenbaar?
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-5xl">
            Drie dingen waar elke ondernemer moe van wordt.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
          {pains.map((p, i) => (
            <RevealOnScroll key={p.title} delayMs={i * 120}>
              <article
                className="h-full rounded-2xl border bg-card p-7 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-elevated"
              >
                <div className="font-display text-5xl font-semibold text-primary/20">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{p.body}</p>
              </article>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
