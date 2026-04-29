import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import {
  type FeatureKey,
  FEATURE_LABELS,
  PLANS,
  requiredPlanFor,
} from "@/lib/plans";

interface Props {
  feature: FeatureKey;
  children: ReactNode;
  /** Toon alleen niets in plaats van een upsell-blok */
  silent?: boolean;
  /** Render je eigen fallback */
  fallback?: ReactNode;
  /** Inline (kleinere) variant */
  inline?: boolean;
}

export function FeatureGate({ feature, children, silent, fallback, inline }: Props) {
  const { hasFeature, isLoading } = usePlan();

  if (isLoading) return null;
  if (hasFeature(feature)) return <>{children}</>;
  if (silent) return null;
  if (fallback) return <>{fallback}</>;

  const needed = requiredPlanFor(feature);
  const neededName = PLANS[needed].name;
  const label = FEATURE_LABELS[feature];

  if (inline) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          {label} is beschikbaar in <span className="font-medium text-foreground">{neededName}</span>.
        </span>
        <Button asChild size="sm" variant="ghost" className="ml-auto h-7">
          <Link to="/app/instellingen/abonnement">Upgraden</Link>
        </Button>
      </div>
    );
  }

  return (
    <Card className="p-6 border-dashed">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{label} zit in {neededName}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade je abonnement om deze functie te activeren. Je bestaande data en instellingen blijven behouden.
          </p>
          <Button asChild className="mt-3">
            <Link to="/app/instellingen/abonnement">Bekijk abonnementen</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
