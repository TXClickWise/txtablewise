const pains = [
  {
    title: "Gasten die niet komen opdagen",
    body: "Je hebt een tafel geblokkeerd, mise-en-place klaar, bediening ingedeeld. En dan: geen gast. Geen bericht. Geen excuus.",
  },
  {
    title: "Drie systemen, nul overzicht",
    body: "WhatsApp-reserveringen in je telefoon, telefonische boekingen op een briefje, online via een platform dat commissie rekent.",
  },
  {
    title: "Geen tijd voor opvolging",
    body: "Je wilt gasten terugbrengen, reviews opvolgen, nieuwe gasten herkennen. Maar na een drukke avond wil je vooral naar huis.",
  },
];

export function PainPointsSection() {
  return (
    <section className="bg-gradient-warm py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Herkenbaar?
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-5xl">
            Drie dingen waar elke ondernemer moe van wordt.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
          {pains.map((p, i) => (
            <article
              key={p.title}
              className="rounded-2xl border bg-card p-7 shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="font-display text-5xl font-semibold text-primary/20">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                {p.title}
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
