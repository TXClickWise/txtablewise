// Admin — ClickWise provisioning (Route 1 + Route 2).
// Route 1: bestaand sub-account → Custom Values syncen.
// Route 2: nieuw sub-account aanmaken via SaaS-plan (snapshot komt automatisch mee).
//
// Telefoonnummer + Twilio Regulatory Bundle blijven HANDMATIG (buiten scope).
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Settings = {
  restaurant_id: string;
  location_id: string | null;
  clickwise_addon: "none" | "active" | "past_due" | "cancelled";
  clickwise_addon_updated_at: string | null;
  provisioning_status: "idle" | "provisioning" | "failed" | "provisioned";
  provisioning_error: string | null;
  provisioned_at: string | null;
  synced_at: string | null;
  saas_plan_id: string | null;
};

type Restaurant = {
  id: string; name: string; email: string | null; phone: string | null;
  address_line1: string | null; postal_code: string | null; city: string | null;
  country: string | null; timezone: string | null;
};

const REQUIRED_FIELDS: Array<keyof Restaurant> = [
  "name", "email", "phone", "address_line1", "postal_code", "city", "country", "timezone",
];

export default function AdminClickWiseProvisioningPage() {
  const params = useParams();
  const nav = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState<string>(params.id ?? "");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [agentApiKey, setAgentApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("restaurants")
        .select("id,name,email,phone,address_line1,postal_code,city,country,timezone")
        .order("name");
      setRestaurants((data ?? []) as Restaurant[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (selectedId) loadOne(selectedId); }, [selectedId]);

  async function loadOne(id: string) {
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from("restaurants").select("*").eq("id", id).maybeSingle(),
      supabase.from("clickwise_settings").select("*").eq("restaurant_id", id).maybeSingle(),
    ]);
    setRestaurant(r as Restaurant);
    setSettings(s as Settings | null);
  }

  const missingFields = restaurant
    ? REQUIRED_FIELDS.filter((f) => !restaurant[f])
    : [];

  async function setAddon(next: Settings["clickwise_addon"]) {
    if (!selectedId) return;
    const { error } = await supabase.from("clickwise_settings").upsert({
      restaurant_id: selectedId, clickwise_addon: next,
    }, { onConflict: "restaurant_id" });
    if (error) return toast.error(error.message);
    toast.success(`Add-on status: ${next}`);
    loadOne(selectedId);
  }

  async function invoke(fn: "clickwise_sync_custom_values" | "clickwise_provision_subaccount", dryRun = false) {
    if (!selectedId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { restaurant_id: selectedId, agent_api_key: agentApiKey || undefined, dry_run: dryRun },
      });
      if (error) throw error;
      if (!(data as any)?.ok) {
        toast.error(`Fout: ${(data as any)?.error ?? "onbekend"}`);
        console.error(data);
      } else {
        toast.success(dryRun ? "Dry-run OK — bekijk console" : "Klaar");
        console.log(fn, data);
        loadOne(selectedId);
      }
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const canProvision = settings?.clickwise_addon === "active"
    && !settings?.location_id
    && missingFields.length === 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="ClickWise provisioning"
        description="Sub-account aanmaken of bestaand sub-account synchroniseren. Telefoonnummer + Twilio bundle blijven handmatig."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Restaurant kiezen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); nav(`/app/admin/clickwise-provisioning${e.target.value ? `/${e.target.value}` : ""}`); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={loading}
          >
            <option value="">— Selecteer —</option>
            {restaurants.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
        </CardContent>
      </Card>

      {restaurant && settings !== undefined && (
        <>
          {/* Add-on billing */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> ClickWise add-on
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={settings?.clickwise_addon === "active" ? "default" : "secondary"}>
                  {settings?.clickwise_addon ?? "none"}
                </Badge>
                {settings?.clickwise_addon_updated_at && (
                  <span className="text-xs text-muted-foreground">
                    laatst gewijzigd: {new Date(settings.clickwise_addon_updated_at).toLocaleString("nl-NL")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["none", "active", "past_due", "cancelled"] as const).map((s) => (
                  <Button
                    key={s} size="sm"
                    variant={settings?.clickwise_addon === s ? "default" : "outline"}
                    onClick={() => setAddon(s)} disabled={busy}
                  >{s}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Pilot-fase: handmatig door system admin. Stripe-integratie volgt later.
              </p>
            </CardContent>
          </Card>

          {/* Pre-flight */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pre-flight check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {REQUIRED_FIELDS.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  {restaurant[f]
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <AlertCircle className="h-4 w-4 text-destructive" />}
                  <span className={restaurant[f] ? "" : "text-destructive"}>{f}</span>
                  <span className="text-xs text-muted-foreground truncate">{restaurant[f] ?? "— ontbreekt —"}</span>
                </div>
              ))}
              {missingFields.length > 0 && (
                <p className="text-xs text-muted-foreground pt-2">
                  Vul ontbrekende velden in op de instellingen-pagina van het restaurant voordat je provisioneert.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Optional agent API key */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agent API key (optioneel)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="aak">Plaintext agent API key — wordt gepusht als <code>tablewise_api_key</code> custom value</Label>
              <Input id="aak" type="password" value={agentApiKey} onChange={(e) => setAgentApiKey(e.target.value)} placeholder="tw_live_..." />
              <p className="text-xs text-muted-foreground">
                Laat leeg om alleen base_url, restaurant_id en webhook_secret te pushen. API key kan later handmatig in ClickWise worden gezet.
              </p>
            </CardContent>
          </Card>

          {/* Route 2 — Provision new */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Rocket className="h-4 w-4" /> Route 2 — Nieuw sub-account aanmaken
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Maakt een nieuw ClickWise sub-account via het SaaS-plan <code>TX TableWise</code>.
                Snapshot komt automatisch mee. Daarna worden Custom Values gepusht.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">status: {settings?.provisioning_status ?? "idle"}</Badge>
                {settings?.location_id && <Badge variant="default">location: {settings.location_id}</Badge>}
                {settings?.provisioned_at && (
                  <span className="text-xs text-muted-foreground">
                    aangemaakt: {new Date(settings.provisioned_at).toLocaleString("nl-NL")}
                  </span>
                )}
              </div>
              {settings?.provisioning_error && (
                <div className="rounded-md bg-destructive/10 text-destructive p-3 text-xs">
                  {settings.provisioning_error}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => invoke("clickwise_provision_subaccount", true)} disabled={busy} variant="outline">
                  Dry-run
                </Button>
                <Button onClick={() => invoke("clickwise_provision_subaccount")} disabled={busy || !canProvision}>
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}
                  Provisioneer
                </Button>
              </div>
              {!canProvision && !settings?.location_id && (
                <p className="text-xs text-muted-foreground">
                  {settings?.clickwise_addon !== "active"
                    ? "Activeer eerst de ClickWise add-on hierboven."
                    : missingFields.length > 0
                    ? `Vul eerst de ontbrekende velden in: ${missingFields.join(", ")}.`
                    : "Klaar voor provisioning."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Route 1 — Sync existing */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Route 1 — Custom Values syncen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Werkt op een bestaand sub-account. Idempotent — kan onbeperkt opnieuw.
                Raakt geen native velden (naam/adres/telefoon).
              </p>
              <div className="grid gap-2">
                <Label>ClickWise location_id</Label>
                <Input
                  defaultValue={settings?.location_id ?? ""}
                  placeholder="loc_..."
                  onBlur={async (e) => {
                    const v = e.target.value.trim();
                    if (v && v !== settings?.location_id) {
                      await supabase.from("clickwise_settings").upsert({
                        restaurant_id: selectedId, location_id: v,
                      }, { onConflict: "restaurant_id" });
                      toast.success("location_id opgeslagen");
                      loadOne(selectedId);
                    }
                  }}
                />
              </div>
              {settings?.synced_at && (
                <p className="text-xs text-muted-foreground">
                  laatste sync: {new Date(settings.synced_at).toLocaleString("nl-NL")}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => invoke("clickwise_sync_custom_values", true)} disabled={busy} variant="outline">
                  Dry-run
                </Button>
                <Button onClick={() => invoke("clickwise_sync_custom_values")} disabled={busy || !settings?.location_id}>
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Sync nu
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Handmatige vervolgstappen</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                <li>Koop telefoonnummer in het ClickWise sub-account</li>
                <li>Dien Twilio Regulatory Bundle in (NL geografische nummers)</li>
                <li>Koppel nummer aan Voice AI assistant</li>
                <li>Plak inbound webhook URLs in TableWise (per event)</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
