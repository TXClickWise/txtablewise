import { Link } from "react-router-dom";
import { UtensilsCrossed } from "lucide-react";

const links = [
  { href: "#functies", label: "Functies" },
  { href: "#tarieven", label: "Tarieven" },
  { href: "#contact", label: "Contact" },
];

export function LandingFooter() {
  return (
    <footer className="bg-primary py-14 text-primary-foreground/80">
      <div className="container flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-glow-gold">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold text-primary-foreground">TX TableWise</span>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-primary-foreground">
              {l.label}
            </a>
          ))}
          <Link to="/auth" className="transition-colors hover:text-primary-foreground">
            Inloggen
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-primary-foreground">
            Privacybeleid
          </Link>
        </nav>
      </div>
      <div className="container mt-8 space-y-1">
        <div className="text-xs">
          © {new Date().getFullYear()} TX TableWise — Premium horeca reserveringen.
        </div>
        <div className="text-xs text-primary-foreground/85">
          Created with <span className="text-accent">❤</span> on Texel by{" "}
          <a
            href="https://clickwise.app"
            target="_blank"
            rel="noopener"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            ClickWise
          </a>
        </div>
      </div>
    </footer>
  );
}
