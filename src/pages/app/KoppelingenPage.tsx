import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvancedOnly } from "@/components/AdvancedOnly";
import {
  Plug, Phone, CreditCard, Webhook, CheckCircle2, AlertTriangle, Circle, Settings as SettingsIcon, ChevronRight,
} from "lucide-react";

type ConnState = "connected" | "ready" | "off" | "error" | "loading";

const STATE_LABEL: Record<ConnState, { text: string; tone: "ok" | "warn" | "off" | "err" }> = {
  connected: { text: "Verbonden", tone: "ok" },
  ready: { text: "Klaar om te koppelen", tone: "warn" },
  off: { text: "Niet gekoppeld", tone: "off" },
  error: { text: "Fout — check details", tone: "err" },
  loading: { text: "Laden…", tone: "off" },
};

function StatusBadge({ state }: { state: ConnState }) {
  const m = STATE_LABEL[state];
  const Icon = state === "connected" ? CheckCircle2 : state === "error" ? AlertTriangle : Circle;
  const cls =
    m.tone === "ok"
      ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
      : m.tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
        : m.tone === "err"
          ? "bg-destructive/10 text-destructive border-destructive/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`gap-1 ${cls}`}>
      <Icon className="h-3 w-3" /> {m.text}
    </Badge>
  );
}

type CardSpec = {
  key: string;
  icon: typeof Plug;
  title: string;
  description: string;
  state: ConnState;
  detail?: string;
  manageHref?: string;
};

function IntegrationRow({ spec }: { spec: CardSpec }) {
  const Icon = spec.icon;
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="rounded-md bg-muted/40 p-2">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            {spec.title}
            <StatusBadge state={spec.state} />
          </CardTitle>
          <CardDescription className="mt-1">{spec.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground min-h-[1rem]">{spec.detail ?? ""}</div>
        {spec.manageHref ? (
          <Button asChild variant="outline" size="sm">
            <Link to={spec.manageHref}>
              <SettingsIcon className="h-3 w-3 mr-1" /> Beheren
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function KoppelingenPage() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;

  const [clickwise, setClickwise] = useState<ConnState>("loading");
  const [clickwiseDetail, setClickwiseDetail] = useState<string | undefined>();
  const [voice, setVoice] = useState<ConnState>("loading");
  const [voiceDetail, setVoiceDetail] = useState<string | undefined>();
  const [pos, setPos] = useState<ConnState>("loading");
  const [posDetail, setPosDetail] = useState<string | undefined>();
  const [webhooks, setWebhooks] = useState<ConnState>("loading");
  const [webhooksDetail, setWebhooksDetail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // ClickWise: check clickwise_settings + recent error
      const cwQ = supabase
        .from("clickwise_settings")
        .select("connection_mode, sandbox_mode, last_test_at, last_error")
        .eq("restaurant_id", rid)
        .maybeSingle();

      // AI Voice: actieve api keys met scope 'book'
      const keysQ = supabase
        .from("agent_api_keys")
        .select("id, scopes, last_used_at, revoked_at")
        .eq("restaurant_id", rid)
        .is("revoked_at", null);

      // POS: bestaande connections
      const posQ = supabase
        .from("pos_connections")
        .select("provider, status, last_error, last_synced_at")
        .eq("restaurant_id", rid)
        .order("created_at", { ascending: false });

      // Webhooks: tabel kan ontbreken — fallback safe
      const webQ = supabase
        .from("webhook_endpoints" as never)
        .select("id, is_active")
        .eq("restaurant_id", rid);

      const [cw, keys, posR, web] = await Promise.all([cwQ, keysQ, posQ, webQ]);
      if (cancelled) return;

      // ClickWise state
      const cwRow = cw.data as { connection_mode?: string; sandbox_mode?: boolean; last_test_at?: string | null; last_error?: string | null } | null;
      if (!cwRow) {
        setClickwise("off");
        setClickwiseDetail("Nog niet ingesteld.");
      } else if (cwRow.last_error) {
        setClickwise("error");
        setClickwiseDetail(cwRow.last_error.slice(0, 80));
      } else if (cwRow.connection_mode === "live") {
        setClickwise("connected");
        setClickwiseDetail(cwRow.sandbox_mode ? "Live (sandbox)" : "Live");
      } else {
        setClickwise("ready");
        setClickwiseDetail("Voorbereid in sandbox-modus.");
      }

      // Voice state — een actieve key met 'book' scope = klaar
      const validKeys = (keys.data ?? []).filter((k: { scopes?: string[] }) => (k.scopes ?? []).includes("book"));
      if (validKeys.length === 0) {
        setVoice("off");
        setVoiceDetail("Nog geen API-sleutel met boek-rechten.");
      } else {
        const lastUsed = validKeys
          .map((k: { last_used_at?: string | null }) => k.last_used_at)
          .filter(Boolean)
          .sort()
          .reverse()[0];
        setVoice("connected");
        setVoiceDetail(
          lastUsed
            ? `Laatst gebruikt: ${new Date(lastUsed as string).toLocaleString("nl-NL")}`
            : `${validKeys.length} sleutel(s) actief — nog niet gebruikt.`
        );
      }

      // POS state
      const posRows = (posR.data ?? []) as Array<{ provider: string; status: string; last_error: string | null; last_synced_at: string | null }>;
      if (posRows.length === 0) {
        setPos("off");
        setPosDetail("Optioneel — koppel een POS voor besteding & afrekening.");
      } else {
        const errored = posRows.find((p) => p.last_error);
        const active = posRows.find((p) => p.status === "active");
        if (active) {
          setPos("connected");
          setPosDetail(
            `${active.provider}${active.last_synced_at ? ` — sync ${new Date(active.last_synced_at).toLocaleString("nl-NL")}` : ""}`
          );
        } else if (errored) {
          setPos("error");
          setPosDetail(`${errored.provider}: ${(errored.last_error ?? "").slice(0, 60)}`);
        } else {
          setPos("ready");
          setPosDetail(`${posRows[0].provider} (${posRows[0].status})`);
        }
      }

      // Webhooks
      if (web.error) {
        setWebhooks("off");
        setWebhooksDetail("Nog geen webhooks.");
      } else {
        const rows = (web.data ?? []) as Array<{ is_active: boolean }>;
        if (rows.length === 0) {
          setWebhooks("off");
          setWebhooksDetail("Geen actieve webhooks. Niet vereist voor de meeste restaurants.");
        } else {
          const actives = rows.filter((r) => r.is_active).length;
          setWebhooks(actives > 0 ? "connected" : "ready");
          setWebhooksDetail(`${actives} van ${rows.length} actief.`);
        }
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [rid]);

  if (!rid) return <div className="p-6 text-muted-foreground">Selecteer eerst een restaurant.</div>;

  const cards: CardSpec[] = [
    {
      key: "clickwise",
      icon: Plug,
      title: "ClickWise",
      description: "Bevestigingen, reminders en reviews via WhatsApp/SMS/E-mail.",
      state: clickwise,
      detail: clickwiseDetail,
      manageHref: "/app/integraties/clickwise",
    },
    {
      key: "voice",
      icon: Phone,
      title: "AI Voice (telefoon)",
      description: "Telefonische reserveringen — gast belt, AI verzamelt, TableWise boekt.",
      state: voice,
      detail: voiceDetail,
      manageHref: "/app/voice-agent",
    },
    {
      key: "pos",
      icon: CreditCard,
      title: "Kassa (POS)",
      description: "Optioneel. Koppel je kassa voor omzet per reservering en automatische match.",
      state: pos,
      detail: posDetail,
      manageHref: "/app/integraties/pos",
    },
    {
      key: "webhooks",
      icon: Webhook,
      title: "Webhooks",
      description: "Stuur reservering-events naar je eigen systemen of automation tools.",
      state: webhooks,
      detail: webhooksDetail,
      manageHref: "/app/integraties/hub",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Koppelingen"
        description="Eén overzicht van wat verbonden is. TableWise blijft werken — ook zonder externe systemen."
      />

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="grid gap-3">
          {cards.map((c) => (
            <IntegrationRow key={c.key} spec={c} />
          ))}
        </div>
      )}

      <AdvancedOnly>
        <div className="rounded-md border border-dashed p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">Geavanceerd beheren</div>
            <p className="text-xs text-muted-foreground">
              API-sleutels, webhook-payloads, mappings, rate limits en raw logs.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/integraties/hub">
              Open Integratiehub <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </AdvancedOnly>
    </div>
  );
}
