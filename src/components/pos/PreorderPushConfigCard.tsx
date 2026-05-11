// Configuratie voor automatisch pushen van pre-order drankjes naar Loyverse als open ticket.
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getPreorderPushConfig,
  updatePreorderPushConfig,
  type PreorderPushConfig,
  type LoyverseConnectionStatus,
} from "@/services/pos";

type Props = {
  restaurantId: string;
  loyverse: LoyverseConnectionStatus;
};

export function PreorderPushConfigCard({ restaurantId, loyverse }: Props) {
  const [config, setConfig] = useState<PreorderPushConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [diningOptionId, setDiningOptionId] = useState("");

  const connected = loyverse?.status === "connected";

  useEffect(() => {
    if (!restaurantId || !connected) return;
    getPreorderPushConfig(restaurantId).then((c) => {
      setConfig(c);
      setStoreId(c.store_id ?? "");
      setDiningOptionId(c.dining_option_id ?? "");
    }).catch(() => undefined);
  }, [restaurantId, connected]);

  async function save(patch: Partial<PreorderPushConfig>) {
    if (!connected) return;
    setSaving(true);
    try {
      const next = await updatePreorderPushConfig(restaurantId, patch);
      setConfig(next);
      toast.success("Instelling opgeslagen");
    } catch (e) {
      toast.error("Opslaan mislukt", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" /> Pre-orders automatisch naar Loyverse
          </CardTitle>
          <CardDescription>
            Beschikbaar zodra Loyverse is gekoppeld. Eenmaal verbonden kun je instellen
            dat TableWise een open bon met de bestelde drankjes klaarzet, een aantal
            minuten voor aankomst van de gast.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Configuratie laden…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" /> Pre-orders automatisch naar Loyverse
        </CardTitle>
        <CardDescription>
          Zet drankjes klaar als open bon in Loyverse, een instelbaar aantal minuten voor
          aanvang van de reservering. Personeel rondt af bij betaling.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded border p-3">
          <div>
            <Label className="text-sm font-medium">Automatisch open bon aanmaken</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Loyverse-bon wordt automatisch klaargezet vóór aanvangstijd.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            disabled={saving}
            onCheckedChange={(v) => save({ enabled: !!v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Minuten vóór aanvang</Label>
          <Select
            value={String(config.minutes_before)}
            onValueChange={(v) => save({ minutes_before: Number(v) })}
            disabled={saving || !config.enabled}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minuten</SelectItem>
              <SelectItem value="30">30 minuten</SelectItem>
              <SelectItem value="45">45 minuten</SelectItem>
              <SelectItem value="60">60 minuten</SelectItem>
              <SelectItem value="90">90 minuten</SelectItem>
              <SelectItem value="120">120 minuten</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store_id" className="text-sm">Loyverse store ID (optioneel)</Label>
          <div className="flex gap-2">
            <Input
              id="store_id"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              placeholder="bv. abcd-1234-..."
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={saving || storeId === (config.store_id ?? "")}
              onClick={() => save({ store_id: storeId.trim() || null })}
            >Opslaan</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Vereist als je meerdere stores hebt. Te vinden in Loyverse → Settings → Stores.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dining_option_id" className="text-sm">Dining option ID (optioneel)</Label>
          <div className="flex gap-2">
            <Input
              id="dining_option_id"
              value={diningOptionId}
              onChange={(e) => setDiningOptionId(e.target.value)}
              placeholder="bv. dine-in / terras"
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={saving || diningOptionId === (config.dining_option_id ?? "")}
              onClick={() => save({ dining_option_id: diningOptionId.trim() || null })}
            >Opslaan</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Loyverse koppelt de bon dan aan deze dining option (bv. "Tafel" / "Terras").
          </p>
        </div>

        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Eerlijk over Loyverse:</strong> de Loyverse API maakt strikt genomen
          een onafgeronde bon aan (zonder betalingen). Of die zichtbaar wordt als
          "open ticket" op je POS-tablet hangt af van je Loyverse-instellingen.
          Test eerst met één reservering en controleer of de bon op de juiste tafel verschijnt
          voordat je dit voor alle gasten activeert.
        </div>
      </CardContent>
    </Card>
  );
}
