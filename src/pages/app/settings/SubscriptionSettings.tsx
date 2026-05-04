import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Crown, Check, X, Sparkles, Clock, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  PLANS,
  FEATURE_ROWS,
  type SubscriptionPlan,
  planRank,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

const PLAN_ORDER: SubscriptionPlan[] = ["trial", "basic", "pro"];

export default function SubscriptionSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const { user } = useAuth();
  const { plan, trialDaysLeft, isTrial, trialExpired } = usePlan();
  const qc = useQueryClient();

  const [requestPlan, setRequestPlan] = useState<SubscriptionPlan | null>(null);
  const [note, setNote] = useState("");

  const { data: pendingRequest } = useQuery({
    queryKey: ["plan-upgrade-request", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_upgrade_requests")
        .select("id, requested_plan, status, created_at")
        .eq("restaurant_id", restaurantId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const requestUpgrade = useMutation({
    mutationFn: async () => {
      if (!restaurantId || !requestPlan || !user) throw new Error("missing");
      const { error } = await supabase.from("plan_upgrade_requests").insert({
        restaurant_id: restaurantId,
        requested_by: user.id,
        current_plan: plan,
        requested_plan: requestPlan,
        requester_note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Upgrade-aanvraag verstuurd. We nemen snel contact op.");
      setRequestPlan(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["plan-upgrade-request", restaurantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentRank = planRank(plan);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">Abonnement</h1>
        <p className="text-sm text-muted-foreground">
          TX TableWise is commissie-vrij. Eén vast tarief per maand, geen kosten per reservering.
        </p>
      </div>

      {/* Huidig plan */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Huidig plan</div>
              <h2 className="font-display text-xl mt-0.5">{PLANS[plan].name}</h2>
              <p className="text-sm text-muted-foreground">{PLANS[plan].tagline}</p>

              {isTrial && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  {trialExpired ? (
                    <span className="text-destructive font-medium">Proefperiode verlopen</span>
                  ) : (
                    <span>
                      Nog <strong>{trialDaysLeft}</strong>{" "}
                      {trialDaysLeft === 1 ? "dag" : "dagen"} in je proefperiode
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="capitalize">{plan}</Badge>
        </div>

        {pendingRequest && (
          <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Je upgrade-aanvraag naar <strong className="capitalize">{pendingRequest.requested_plan}</strong> wordt beoordeeld.
          </div>
        )}
      </Card>

      {/* Plan-kaarten */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((p) => {
          const def = PLANS[p];
          const isCurrent = p === plan;
          const isUpgrade = planRank(p) > currentRank;
          return (
            <Card
              key={p}
              className={cn(
                "p-5 flex flex-col",
                isCurrent && "border-primary ring-1 ring-primary",
                def.badge && !isCurrent && "border-primary/40",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg">{def.name}</h3>
                {def.badge && !isCurrent && (
                  <Badge className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/10">
                    {def.badge}
                  </Badge>
                )}
                {isCurrent && (
                  <Badge variant="secondary">Huidig</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{def.tagline}</p>
              <div className="mt-2 text-sm font-medium">{def.priceLabel}</div>

              <ul className="mt-4 space-y-1.5 text-sm flex-1">
                {topHighlights(p).map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">Huidig plan</Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => setRequestPlan(p)}
                    disabled={!!pendingRequest}
                  >
                    Upgraden naar {def.name}
                    <ArrowUpRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button variant="ghost" disabled className="w-full">Lager plan</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Vergelijkingstabel */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-medium">Wat zit er in elk plan?</h3>
          <p className="text-sm text-muted-foreground">Volledig overzicht van alle functies per abonnement.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left font-medium px-5 py-3">Functie</th>
                {PLAN_ORDER.map((p) => (
                  <th
                    key={p}
                    className={cn(
                      "text-center font-medium px-4 py-3",
                      p === plan && "text-primary",
                    )}
                  >
                    {PLANS[p].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="px-5 py-2.5">{row.label}</td>
                  {PLAN_ORDER.map((p) => (
                    <td
                      key={p}
                      className={cn(
                        "text-center px-4 py-2.5",
                        p === plan && "bg-primary/5",
                      )}
                    >
                      {PLANS[p].features[row.key] ? (
                        <Check className="h-4 w-4 text-primary inline" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 inline" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upgrade dialog */}
      <Dialog open={!!requestPlan} onOpenChange={(o) => !o && setRequestPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Upgraden naar {requestPlan ? PLANS[requestPlan].name : ""}
            </DialogTitle>
            <DialogDescription>
              We ontvangen je aanvraag en activeren het nieuwe plan binnen één werkdag.
              Je bestaande data en instellingen blijven behouden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Optionele toelichting</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bv. gewenste startdatum, vragen over de migratie…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestPlan(null)}>Annuleren</Button>
            <Button
              onClick={() => requestUpgrade.mutate()}
              disabled={requestUpgrade.isPending}
            >
              Aanvraag versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function topHighlights(p: SubscriptionPlan): string[] {
  if (p === "trial")
    return [
      "Reserveringen, tafelplan en walk-ins",
      "Tot 50 reserveringen / maand",
      "API in testmode",
      "1 locatie",
    ];
  if (p === "basic")
    return [
      "Onbeperkt reserveringen + no-show preventie",
      "1 AI voice agent (basis-flow)",
      "POS verkoopdata + WhatsApp",
      "Reviews & aftercare",
    ];
  return [
    "Alles uit Basic",
    "Meerdere voice agents + geavanceerde flows",
    "Volledige POS-integratie (artikelen + AI)",
    "ClickWise telefonie + WA + SMS",
    "Meerdere locaties + API/webhooks",
  ];
}
