import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const DemoDataResetCard = () => {
  const { current } = useRestaurant();
  const qc = useQueryClient();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [archiveDemoDrinks, setArchiveDemoDrinks] = useState(false);
  const [busy, setBusy] = useState(false);

  // Owner-only
  if (!current || current.role !== "owner") return null;

  const reset = () => {
    setStep(0);
    setConfirmText("");
    setArchiveDemoDrinks(false);
  };

  const handlePurge = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc(
        "purge_restaurant_operational_data" as never,
        { _restaurant_id: current.restaurant_id } as never,
      );
      if (error) throw error;
      const counts = (data ?? {}) as Record<string, number>;

      let archivedItems = 0;
      if (archiveDemoDrinks) {
        const { data: archived, error: archErr } = await supabase
          .from("pre_order_items")
          .update({ is_active: false })
          .eq("restaurant_id", current.restaurant_id)
          .filter("metadata->>demo_seed", "eq", "true")
          .eq("is_active", true)
          .select("id");
        if (archErr) {
          toast.error("Demo-drankjes archiveren mislukt", { description: archErr.message });
        } else {
          archivedItems = archived?.length ?? 0;
        }
      }

      toast.success("Demodata verwijderd", {
        description: `${counts.reservations ?? 0} reserveringen en ${counts.guests ?? 0} gasten verwijderd${archiveDemoDrinks ? `, ${archivedItems} demo-drankjes gearchiveerd` : ""}. Tafels en instellingen behouden.`,
      });
      qc.invalidateQueries();
      reset();
    } catch (e: any) {
      toast.error("Verwijderen mislukt", { description: e?.message ?? "Onbekende fout" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            Demodata verwijderen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Verwijder alle reserveringen, gasten, wachtlijst, reviews en logs om met een
            schone database te starten. <strong>Tafels, zones, openingstijden, instellingen
            en medewerkers blijven behouden.</strong>
          </p>
          <Button
            variant="destructive"
            onClick={() => setStep(1)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Demodata verwijderen en starten met schone database
          </Button>
        </CardContent>
      </Card>

      <Dialog open={step !== 0} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Weet je het zeker?
                </DialogTitle>
                <DialogDescription className="pt-2">
                  Dit verwijdert <strong>alle reserveringen, gasten, wachtlijstitems, reviews en logs</strong>{" "}
                  van <strong>{current.restaurants.name}</strong>.
                  <br /><br />
                  Tafels, zones, openingstijden, instellingen en medewerkers blijven behouden.
                  <br /><br />
                  <strong className="text-destructive">Dit kan niet ongedaan worden gemaakt.</strong>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={reset}>Annuleren</Button>
                <Button variant="destructive" onClick={() => setStep(2)}>Verder</Button>
              </DialogFooter>
            </>
          )}
          {step === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>Bevestig verwijdering</DialogTitle>
                <DialogDescription>
                  Typ <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">VERWIJDEREN</code> om definitief te bevestigen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="confirm">Bevestiging</Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="VERWIJDEREN"
                  autoFocus
                />
                <label className="flex items-start gap-2 pt-3 cursor-pointer text-sm">
                  <Checkbox
                    checked={archiveDemoDrinks}
                    onCheckedChange={(v) => setArchiveDemoDrinks(!!v)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Demo-drankjes ook archiveren</span>
                    <span className="block text-muted-foreground text-xs mt-0.5">
                      Zet de 8 standaard starter-drankjes (Prosecco, Borrelplank, etc.) op inactief.
                      Omkeerbaar — je kunt ze later weer activeren in Pre-orders.
                    </span>
                  </span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={reset} disabled={busy}>Annuleren</Button>
                <Button
                  variant="destructive"
                  onClick={handlePurge}
                  disabled={confirmText !== "VERWIJDEREN" || busy}
                  className="gap-2"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Definitief verwijderen
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
