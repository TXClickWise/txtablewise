import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const DISMISS_KEY = "tw.onboarding_banner_dismissed";

export const OnboardingBanner = () => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <p className="flex-1 text-sm">
          <span className="font-medium">Zet je restaurant in 15 korte stappen klaar.</span>{" "}
          <span className="text-muted-foreground">
            Slimme defaults, je kunt altijd later aanpassen.
          </span>
        </p>
        <Button asChild size="sm" variant="default">
          <Link to="/app/onboarding">Setup starten</Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
