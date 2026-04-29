import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "tw_trial_banner_dismissed_until";

export function TrialBanner() {
  const { isTrial, trialDaysLeft, trialExpired } = usePlan();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Number(until) > Date.now()) setDismissed(true);
  }, []);

  if (!isTrial) return null;
  if (dismissed && !trialExpired) return null;

  const message = trialExpired
    ? "Je proefperiode is verlopen. Upgrade om te blijven werken zonder onderbreking."
    : trialDaysLeft === 1
      ? "Nog 1 dag in je proefperiode."
      : `Nog ${trialDaysLeft ?? "?"} dagen in je proefperiode.`;

  function dismiss() {
    // 24 uur verbergen
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1 text-foreground">{message}</span>
      <Button asChild size="sm" variant="default" className="h-7">
        <Link to="/app/settings/subscription">Upgrade nu</Link>
      </Button>
      {!trialExpired && (
        <button
          onClick={dismiss}
          className="rounded p-1 text-muted-foreground hover:bg-primary/10"
          aria-label="Sluiten"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
