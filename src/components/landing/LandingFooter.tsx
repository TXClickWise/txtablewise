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
      <div className="container mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} TX TableWise — Commissievrij reserveren voor moderne horeca.
      </div>
    </footer>
  );
}
