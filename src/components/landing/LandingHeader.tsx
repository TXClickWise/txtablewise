import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#functies", label: "Functies" },
  { href: "#tarieven", label: "Tarieven" },
  { href: "#contact", label: "Contact" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all",
        scrolled
          ? "glass-header border-b border-border/60 shadow-soft"
          : "bg-transparent",
      )}
    >
      <div className="container flex h-16 items-center justify-between md:h-20">
        <Link to="/" className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              scrolled
                ? "bg-primary text-primary-foreground"
                : "bg-primary-foreground/15 text-primary-foreground backdrop-blur",
            )}
          >
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span
              className={cn(
                "font-display text-lg font-semibold tracking-tight transition-colors md:text-xl",
                scrolled ? "text-foreground" : "text-primary-foreground drop-shadow",
              )}
            >
              TX TableWise
            </span>
            <span
              className={cn(
                "mt-0.5 text-[10px] tracking-wide transition-colors",
                scrolled ? "text-muted-foreground/60" : "text-primary-foreground/50",
              )}
            >
              by{" "}
              <a
                href="https://clickwise.app"
                target="_blank"
                rel="noopener"
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                ClickWise
              </a>
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "text-sm font-medium transition-colors",
                scrolled
                  ? "text-foreground/80 hover:text-foreground"
                  : "text-primary-foreground/85 hover:text-primary-foreground",
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "hidden h-10 px-4 font-medium md:inline-flex",
              scrolled
                ? "text-foreground hover:bg-muted"
                : "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
            )}
          >
            <Link to="/auth">Inloggen</Link>
          </Button>
          <Button asChild size="sm" className="h-10 px-4 font-medium">
            <a href="#contact">Gratis demo</a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "md:hidden",
                  scrolled
                    ? "text-foreground"
                    : "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                )}
                aria-label="Menu openen"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <div className="mt-8 flex flex-col gap-1">
                {navLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                  >
                    {l.label}
                  </a>
                ))}
                <Link
                  to="/auth"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                >
                  Inloggen
                </Link>
                <Button asChild className="mt-4 h-12 w-full text-base">
                  <a href="#contact" onClick={() => setOpen(false)}>
                    Plan een demo
                  </a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
