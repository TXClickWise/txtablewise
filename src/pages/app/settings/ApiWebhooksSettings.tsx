import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { KeyRound, Webhook, Send, ScrollText, ChevronDown } from "lucide-react";
import { webhookFixtures, type WebhookFixture } from "@/lib/webhookFixtures";
import { WebhookHealthBadge } from "@/components/integrations/WebhookHealthBadge";

export default function ApiWebhooksSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();

  const { data: r } = useQuery({
    queryKey: ["restaurant-settings", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: tokens } = useQuery({
    queryKey: ["api-tokens", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("api_tokens")
        .select("id, name, scopes, last_used_at, revoked_at, created_at")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const patch = async (values: Record<string, any>) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from("restaurants")
      .update(values as any)
      .eq("id", restaurantId);
    if (error) toast.error("Opslaan mislukt: " + error.message);
    else {
      qc.invalidateQueries({ queryKey: ["restaurant-settings", restaurantId] });
      qc.invalidateQueries({ queryKey: ["onboarding-step-statuses", restaurantId] });
      toast.success("Opgeslagen");
    }
  };

  const sendTestEvent = async (fixture?: WebhookFixture) => {
    if (!restaurantId) return;
    if (!r?.webhook_url) {
      toast.error("Vul eerst een Webhook-URL in en klik buiten het veld om op te slaan.");
      return;
    }
    const event_type = fixture?.event_type ?? "test_webhook";
    const payload = fixture?.payload ?? { source: "settings_test", at: new Date().toISOString() };
    const { error } = await supabase.from("integration_events").insert({
      restaurant_id: restaurantId,
      event_type,
      target: "webhook",
      payload,
    } as any);
    if (error) { toast.error("Mislukt: " + error.message); return; }
    toast.success(`${fixture?.label ?? "Test-event"} verstuurd — bezorgen…`);
    const { data: dispatch, error: dispatchError } = await supabase.functions.invoke(
      "dispatch_webhooks",
      { body: { restaurant_id: restaurantId } },
    );
    if (dispatchError) {
      toast.error("Bezorgen mislukt: " + dispatchError.message);
    } else {
      const n = (dispatch as any)?.dispatched ?? 0;
      if (n > 0) toast.success(`Bezorgd aan ${n} endpoint(s) — check ClickWise + integratielog.`);
      else toast.message("Verstuurd — controleer de integratielog voor het resultaat.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">API &amp; webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Externe systemen koppelen aan TableWise — POS, CRM, AI agents of eigen back-office.
        </p>
      </div>

      {restaurantId && <WebhookHealthBadge restaurantId={restaurantId} />}

      <Card className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <Webhook className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="font-medium">Webhook-endpoint</h2>
            <p className="text-sm text-muted-foreground">
              TableWise stuurt reservering-, walk-in- en bezoek-events naar dit endpoint.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Webhook-URL</Label>
            <Input
              type="url"
              placeholder="https://jouw-systeem.example/webhooks/tablewise"
              defaultValue={r?.webhook_url ?? ""}
              onBlur={(e) => patch({ webhook_url: e.target.value || null })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => sendTestEvent()}>
              <Send className="h-4 w-4 mr-2" />
              Stuur leeg test-event
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Voorbeeld-events <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuLabel>Kies een realistisch test-event</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {webhookFixtures.map((f) => (
                  <DropdownMenuItem
                    key={f.key}
                    onClick={() => sendTestEvent(f)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{f.event_type}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-medium">API-tokens</h2>
              <p className="text-sm text-muted-foreground">
                Voor server-to-server toegang tot het publieke API.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/app/integraties/hub">Beheer in hub</Link>
          </Button>
        </div>
        {tokens && tokens.length > 0 ? (
          <div className="rounded-lg border border-border divide-y divide-border">
            {tokens.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Scopes: {(t.scopes ?? []).join(", ") || "—"}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {t.revoked_at ? (
                    <span className="text-red-600">Ingetrokken</span>
                  ) : t.last_used_at ? (
                    `Laatst gebruikt ${new Date(t.last_used_at).toLocaleDateString("nl-NL")}`
                  ) : (
                    "Nog niet gebruikt"
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nog geen tokens aangemaakt.
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <ScrollText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-medium">Integratie-logs</h2>
              <p className="text-sm text-muted-foreground">
                Bekijk inkomende en uitgaande events, fouten en oorzaken.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/app/integraties/logs">Open logs</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
