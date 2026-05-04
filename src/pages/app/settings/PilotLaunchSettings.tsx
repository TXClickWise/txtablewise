import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Loader2, PartyPopper, Rocket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { usePilotReadiness } from "@/hooks/usePilotReadiness";
import { PilotReadinessChecklist } from "@/components/pilot/PilotReadinessChecklist";
import { DemoDataResetCard } from "@/components/pilot/DemoDataResetCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWidgetUrl } from "@/lib/widgetUrl";

const MANUAL_CHECKS = [
  "Openingstijden kloppen voor komende week",
  "Tafelplan komt overeen met de werkelijke vloer",
  "Testreservering gemaakt en geannuleerd",
  "Team is geïnformeerd over de widget URL",
  "ClickWise workflows zijn getest (als van toepassing)",
];

export default function PilotLaunchSettings() {
  const { current } = useRestaurant();
  const qc = useQueryClient();
  const restaurantId = current?.restaurant_id;
  const { data: readiness } = usePilotReadiness(restaurantId);
  const [manualChecked, setManualChecked] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState(false);

  const widgetUrl = useMemo(() => {
    if (!current) return "";
    return getWidgetUrl(current.restaurants.slug, (current.restaurants as any).public_base_url);
  }, [current]);

  const { data: liveStatus } = useQuery({
    queryKey: ["restaurant-live-status", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("is_live, marked_live_at")
        .eq("id", restaurantId!)
        .maybeSingle();
      return data as { is_live: boolean; marked_live_at: string | null } | null;
    },
  });

  if (!current) return null;

  // Owner-only access
  if (current.role !== "owner") {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Alleen de eigenaar kan deze pagina openen.
        </CardContent></Card>
      </div>
    );
  }

  const allManualChecked = MANUAL_CHECKS.every((c) => manualChecked[c]);
  const canGoLive = !!readiness?.allRequiredOk && allManualChecked;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(widgetUrl);
    toast.success("Widget URL gekopieerd");
  };

  const markLive = async () => {
    if (!canGoLive || !restaurantId) return;
    setMarking(true);
    try {
      const { error: upErr } = await supabase
        .from("restaurants")
        .update({ is_live: true, marked_live_at: new Date().toISOString() })
        .eq("id", restaurantId);
      if (upErr) throw upErr;

      await supabase.from("audit_log").insert([{
        restaurant_id: restaurantId,
        entity: "restaurant",
        entity_id: restaurantId,
        action: "restaurant.marked_live",
        actor_label: "owner",
        after_data: { manual_checks: manualChecked },
      }]);

      toast.success("Gefeliciteerd!", {
        description: "Je restaurant is nu live. Gasten kunnen reserveren via je widget.",
      });
      qc.invalidateQueries({ queryKey: ["restaurant-live-status"] });
    } catch (e: any) {
      toast.error("Kon niet als live markeren", { description: e?.message ?? "Onbekende fout" });
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Pilot Lancering</h2>
          <p className="text-muted-foreground text-sm">
            Loop alle checks door en markeer je restaurant als live zodra alles groen is.
          </p>
        </div>
        {liveStatus?.is_live && (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1">
            <PartyPopper className="h-3.5 w-3.5" />
            Live sinds {liveStatus.marked_live_at ? new Date(liveStatus.marked_live_at).toLocaleDateString("nl-NL") : "—"}
          </Badge>
        )}
      </div>

      <PilotReadinessChecklist />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Booking widget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Widget URL</Label>
            <div className="flex gap-2">
              <Input value={widgetUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyUrl}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={widgetUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-6">
            <div className="bg-white p-3 rounded-md border border-border">
              <QRCodeSVG value={widgetUrl} size={140} />
            </div>
            <div className="text-sm text-muted-foreground">
              Scan deze QR-code om de widget direct te openen — handig voor menukaarten,
              flyers of vensterstickers.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Laatste handmatige controles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MANUAL_CHECKS.map((check) => (
            <label key={check} className="flex items-center gap-3 cursor-pointer text-sm">
              <Checkbox
                checked={!!manualChecked[check]}
                onCheckedChange={(v) =>
                  setManualChecked((prev) => ({ ...prev, [check]: !!v }))
                }
              />
              <span>{check}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className={canGoLive ? "border-primary" : ""}>
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Markeer dit restaurant als live</p>
            <p className="text-sm text-muted-foreground">
              {canGoLive
                ? "Alle checks zijn groen. Je kunt nu live."
                : "Vink eerst alle handmatige controles af en zorg dat alle verplichte items in de checklist groen zijn."}
            </p>
          </div>
          <Button
            size="lg"
            disabled={!canGoLive || marking || liveStatus?.is_live}
            onClick={markLive}
            className="gap-2"
          >
            {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {liveStatus?.is_live ? "Al live" : "Markeer als live"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <DemoDataResetCard />
    </div>
  );
}
