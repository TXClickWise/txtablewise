import { Link } from "react-router-dom";
import { UtensilsCrossed } from "lucide-react";

const links = [
  { href: "#functies", label: "Functies" },
  { href: "#tarieven", label: "Tarieven" },
  { href: "#contact", label: "Contact" },
];

export function LandingFooter() {
  return (
    <footer className="border-t bg-background py-12">
      <div className="container flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-semibold">TX TableWise</span>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </a>
          ))}
          <Link to="/auth" className="hover:text-foreground">
            Inloggen
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacybeleid
          </Link>
        </nav>
      </div>
      <div className="container mt-8 space-y-1">
        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TX TableWise — Premium horeca reserveringen.
        </div>
        <div className="text-xs text-muted-foreground/60">
          Created with <span className="text-primary">❤</span> on Texel by{" "}
          <a
            href="https://clickwise.app"
            target="_blank"
            rel="noopener"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            ClickWise
          </a>
        </div>
      </div>
    </footer>
  );
}
