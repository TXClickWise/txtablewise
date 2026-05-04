import { useState, ReactNode, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Building2,
  Clock,
  LayoutGrid,
  ListChecks,
  Users,
  ShieldCheck,
  Plug,
  PartyPopper,
  Globe,
  MessageSquare,
  Bot,
  KeyRound,
  PlayCircle,
  Copy,
  ExternalLink,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import GeneralSettings from "@/pages/app/settings/GeneralSettings";
import OpeningHoursSettings from "@/pages/app/settings/OpeningHoursSettings";
import ZonesTablesSettings from "@/pages/app/settings/ZonesTablesSettings";
import IntegrationsSettings from "@/pages/app/settings/IntegrationsSettings";
import MessagesSettings from "@/pages/app/settings/MessagesSettings";

import { useStepStatuses, type WizardStepKey } from "@/components/onboarding/useStepStatuses";
import { StepStatusBadge, StepStatusDot } from "@/components/onboarding/StepStatusBadge";
import { getWidgetUrl } from "@/lib/widgetUrl";

type StepCtx = {
  restaurantId: string;
  settings: any;
  patch: (values: Record<string, any>) => Promise<void>;
  goNext: () => void;
};

type Step = {
  key: WizardStepKey | "welcome" | "done";
  title: string;
  subtitle?: string;
  explainer?: string;
  icon: typeof Sparkles;
  render: (ctx: StepCtx) => ReactNode;
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="flex-1">
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const NumberField = ({
  label,
  hint,
  value,
  onChange,
  min = 0,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  min?: number;
  suffix?: string;
}) => (
  <Field label={label} hint={hint}>
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="max-w-[140px]"
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
  </Field>
);

const EmbedSection = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-1 -mx-1">
    {children}
  </div>
);

// ---- Widget step ----
const WidgetStep = ({ settings }: StepCtx) => {
  const slug = settings?.slug;
  const url = slug
    ? getWidgetUrl(slug, {
        customWidgetDomain: (settings as any)?.custom_widget_domain,
        publicBaseUrl: (settings as any)?.public_base_url,
      })
    : null;
  const embed = url
    ? `<iframe src="${url}" style="border:0;width:100%;height:760px" loading="lazy"></iframe>`
    : null;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Je publieke reserveringspagina werkt direct. Plak de link op je website of social, of
        embed via iframe.
      </p>
      {url ? (
        <>
          <div>
            <Label className="text-sm">Publieke widget-URL</Label>
            <div className="flex gap-2 mt-1.5">
              <Input value={url} readOnly />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  toast.success("Link gekopieerd");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button asChild variant="outline">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open
                </a>
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-sm">Embed-snippet</Label>
            <div className="flex gap-2 mt-1.5">
              <Input value={embed!} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(embed!);
                  toast.success("Snippet gekopieerd");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-amber-700">
          Stel eerst een slug in onder Restaurantgegevens.
        </p>
      )}
    </div>
  );
};

// ---- Walk-ins + waitlist combined ----
const WalkinsWaitlistStep = ({ settings, patch }: StepCtx) => (
  <div className="space-y-1 divide-y divide-border">
    <ToggleRow
      label="Walk-ins toestaan"
      checked={!!settings.walkins_enabled}
      onChange={(v) => patch({ walkins_enabled: v })}
    />
    <ToggleRow
      label="AI Quick Seat tonen"
      description="Stelt de beste vrije tafel voor op basis van groepsgrootte."
      checked={!!settings.walkin_ai_quick_seat}
      onChange={(v) => patch({ walkin_ai_quick_seat: v })}
    />
    <ToggleRow
      label="Wachtlijst activeren"
      checked={!!settings.waitlist_enabled}
      onChange={(v) => patch({ waitlist_enabled: v })}
    />
    <ToggleRow
      label="Automatisch aanbieden bij vol tijdslot"
      checked={!!settings.waitlist_auto_offer_on_full}
      onChange={(v) => patch({ waitlist_auto_offer_on_full: v })}
    />
    <div className="pt-4 grid sm:grid-cols-2 gap-4">
      <NumberField
        label="Standaard walk-in duur"
        value={settings.walkin_default_minutes}
        onChange={(v) => patch({ walkin_default_minutes: v })}
        suffix="min"
      />
      <NumberField
        label="Reactietijd wachtlijst"
        value={settings.waitlist_response_window_minutes}
        onChange={(v) => patch({ waitlist_response_window_minutes: v })}
        suffix="min"
      />
    </div>
  </div>
);

// ---- AI / Voice step ----
const AiVoiceStep = ({ restaurantId }: StepCtx) => {
  const { data: keys } = useQuery({
    queryKey: ["agent-keys-count", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { count } = await supabase
        .from("agent_api_keys")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .is("revoked_at", null);
      return count ?? 0;
    },
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Koppel een Voice Agent (Vapi, Retell, ClickWise) zodat telefonische reserveringen
        veilig via TableWise lopen. AI mag alleen boeken na bevestigde beschikbaarheid.
      </p>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Actieve agent-keys</p>
            <p className="text-xs text-muted-foreground">
              {(keys ?? 0) === 0
                ? "Nog geen agent-key aangemaakt."
                : `${keys} actieve key(s).`}
            </p>
          </div>
          <Button asChild>
            <Link to="/app/voice-agent">Voice Agent openen</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
};

// ---- API & webhooks step ----
const ApiWebhooksStep = ({ restaurantId, settings, patch }: StepCtx) => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Koppel je eigen back-office of POS via webhooks en API-tokens.
    </p>
    <div>
      <Label className="text-sm">Webhook-URL</Label>
      <Input
        type="url"
        placeholder="https://jouw-systeem.example/webhooks/tablewise"
        defaultValue={settings.webhook_url ?? ""}
        onBlur={(e) => patch({ webhook_url: e.target.value || null })}
      />
    </div>
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link to="/app/instellingen/api">Beheer API-tokens</Link>
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          const { error } = await supabase.from("integration_events").insert({
            restaurant_id: restaurantId,
            event_type: "test_webhook",
            target: "webhook",
            payload: { source: "wizard_test", at: new Date().toISOString() },
          } as any);
          if (error) toast.error("Mislukt: " + error.message);
          else toast.success("Test-event in wachtrij");
        }}
      >
        <Send className="h-4 w-4 mr-2" />
        Stuur test-event
      </Button>
      <Button asChild variant="ghost">
        <Link to="/app/integraties/logs">Bekijk logs</Link>
      </Button>
    </div>
  </div>
);

// ---- Test reservation step ----
const TestReservationStep = ({ restaurantId }: StepCtx) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    msg: string;
    id?: string;
  }>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      const dateStr = date.toISOString().slice(0, 10);
      const start = new Date(date);
      start.setHours(19, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 90);

      const { data, error } = await supabase
        .from("reservations")
        .insert({
          restaurant_id: restaurantId,
          reservation_date: dateStr,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          party_size: 2,
          status: "pending",
          channel: "manager",
          source_label: "wizard_test",
          source_metadata: { test: true, source: "onboarding_wizard" },
          internal_notes: "Test-reservering vanuit setup-wizard",
        } as any)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      setResult({
        ok: true,
        msg: "Test-reservering succesvol aangemaakt voor morgen 19:00.",
        id: data?.id,
      });
      toast.success("Test geslaagd");
    } catch (e: any) {
      setResult({ ok: false, msg: e.message ?? "Onbekende fout" });
      toast.error("Test mislukt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Voer een complete test-reservering uit: validatie, beschikbaarheid en opslag.
        Resultaat verschijnt hieronder.
      </p>
      <Button onClick={run} disabled={busy} size="lg">
        <PlayCircle className="h-4 w-4 mr-2" />
        {busy ? "Bezig…" : "Test reservering uitvoeren"}
      </Button>
      {result && (
        <Card
          className={
            result.ok
              ? "p-4 border-emerald-500/30 bg-emerald-500/5"
              : "p-4 border-red-500/30 bg-red-500/5"
          }
        >
          <p className="text-sm font-medium">{result.ok ? "Geslaagd" : "Fout"}</p>
          <p className="text-sm text-muted-foreground mt-1">{result.msg}</p>
          {result.id && (
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <Link to={`/app/reserveringen?id=${result.id}`}>
                Open reservering <ExternalLink className="h-3 w-3 ml-1.5" />
              </Link>
            </Button>
          )}
        </Card>
      )}
      <Button asChild variant="outline">
        <Link to="/app/integraties/logs">Bekijk integratie-logs</Link>
      </Button>
    </div>
  );
};

const STEPS: Step[] = [
  {
    key: "welcome",
    title: "Welkom bij TableWise",
    icon: Sparkles,
    render: ({ goNext }) => (
      <div className="space-y-6">
        <p className="text-base text-muted-foreground leading-relaxed">
          We helpen je om je restaurant in 12 stappen klaar te zetten — van openingstijden
          tot AI Voice Agent en een test-reservering.
        </p>
        <div className="flex gap-3 pt-2">
          <Button onClick={goNext} size="lg">Setup starten</Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/app">Later overslaan</Link>
          </Button>
        </div>
      </div>
    ),
  },
  {
    key: "restaurant",
    title: "Restaurantgegevens",
    subtitle: "Naam, adres en contactgegevens — gebruikt in widget en bevestigingen.",
    icon: Building2,
    render: () => <EmbedSection><GeneralSettings /></EmbedSection>,
  },
  {
    key: "hours",
    title: "Openingstijden",
    subtitle: "Wanneer kunnen gasten in principe reserveren.",
    icon: Clock,
    render: () => <EmbedSection><OpeningHoursSettings /></EmbedSection>,
  },
  {
    key: "tables_zones",
    title: "Tafels en zones",
    subtitle: "Begin simpel — je kunt tafelcombinaties later verfijnen.",
    icon: LayoutGrid,
    render: () => <EmbedSection><ZonesTablesSettings /></EmbedSection>,
  },
  {
    key: "rules",
    title: "Reserveringsregels",
    subtitle: "Hoe makkelijk mogen gasten boeken en wanneer wil je controle houden.",
    icon: ListChecks,
    render: ({ settings, patch }) => (
      <div className="space-y-1 divide-y divide-border">
        <ToggleRow
          label="Automatisch bevestigen"
          checked={!!settings.auto_confirm}
          onChange={(v) => patch({ auto_confirm: v })}
        />
        <ToggleRow
          label="Opmerkingen en allergieën toestaan"
          checked={!!settings.allow_guest_notes}
          onChange={(v) => patch({ allow_guest_notes: v })}
        />
        <div className="pt-4 grid sm:grid-cols-2 gap-4">
          <NumberField
            label="Standaard reserveringsduur"
            value={settings.default_reservation_minutes}
            onChange={(v) => patch({ default_reservation_minutes: v })}
            suffix="min"
          />
          <NumberField
            label="Tijdslotinterval"
            value={settings.slot_duration_minutes}
            onChange={(v) => patch({ slot_duration_minutes: v })}
            suffix="min"
          />
          <NumberField
            label="Max online groepsgrootte"
            value={settings.max_party_size_online}
            onChange={(v) => patch({ max_party_size_online: v })}
            suffix="personen"
            min={1}
          />
          <NumberField
            label="Max vooruit reserveren"
            value={settings.booking_horizon_days}
            onChange={(v) => patch({ booking_horizon_days: v })}
            suffix="dagen"
          />
        </div>
      </div>
    ),
  },
  {
    key: "online_widget",
    title: "Online widget",
    subtitle: "De publieke pagina waar gasten zelf kunnen reserveren.",
    icon: Globe,
    render: (ctx) => <WidgetStep {...ctx} />,
  },
  {
    key: "walkins_waitlist",
    title: "Walk-ins en wachtlijst",
    subtitle: "Spontane gasten en het opvullen van vrijgekomen tafels.",
    icon: Users,
    render: (ctx) => <WalkinsWaitlistStep {...ctx} />,
  },
  {
    key: "noshow",
    title: "No-show preventie",
    subtitle: "Vriendelijke bevestigingen, reminders en makkelijke annulering.",
    icon: ShieldCheck,
    render: ({ settings, patch }) => (
      <div className="space-y-1 divide-y divide-border">
        <ToggleRow
          label="Automatische bevestiging"
          checked={!!settings.noshow_confirmation_enabled}
          onChange={(v) => patch({ noshow_confirmation_enabled: v })}
        />
        <ToggleRow
          label="Reminder 24 uur vooraf"
          checked={!!settings.noshow_reminder_24h_enabled}
          onChange={(v) => patch({ noshow_reminder_24h_enabled: v })}
        />
        <ToggleRow
          label="Reminder 2 uur vooraf"
          checked={!!settings.noshow_reminder_2h_enabled}
          onChange={(v) => patch({ noshow_reminder_2h_enabled: v })}
        />
        <ToggleRow
          label="Herbevestiging vragen"
          checked={!!settings.noshow_reconfirm_enabled}
          onChange={(v) => patch({ noshow_reconfirm_enabled: v })}
        />
        <ToggleRow
          label="Annuleren via gastlink"
          description="Maak afzeggen laagdrempelig — beter dan niet komen opdagen."
          checked={!!settings.noshow_guest_cancel_link_enabled}
          onChange={(v) => patch({ noshow_guest_cancel_link_enabled: v })}
        />
      </div>
    ),
  },
  {
    key: "messages",
    title: "Berichten en reminders",
    subtitle: "Welke berichten gaan automatisch naar de gast en wanneer.",
    icon: MessageSquare,
    render: () => <EmbedSection><MessagesSettings /></EmbedSection>,
  },
  {
    key: "ai_voice",
    title: "AI Host / Voice Agent",
    subtitle: "Telefonische reserveringen via een AI-agent (optioneel).",
    icon: Bot,
    render: (ctx) => <AiVoiceStep {...ctx} />,
  },
  {
    key: "clickwise",
    title: "ClickWise-integratie",
    subtitle: "Voor WhatsApp/SMS/email-communicatie en CRM-sync.",
    icon: Plug,
    render: () => <EmbedSection><IntegrationsSettings /></EmbedSection>,
  },
  {
    key: "api_webhooks",
    title: "API en webhooks",
    subtitle: "Voor eigen koppelingen — POS, BI, of een externe AI agent.",
    icon: KeyRound,
    render: (ctx) => <ApiWebhooksStep {...ctx} />,
  },
  {
    key: "test_reservation",
    title: "Test reservering",
    subtitle: "Check de complete flow voordat je live gaat.",
    icon: PlayCircle,
    render: (ctx) => <TestReservationStep {...ctx} />,
  },
  {
    key: "done",
    title: "Klaar om gasten te ontvangen",
    icon: PartyPopper,
    render: () => (
      <div className="space-y-6">
        <p className="text-base text-muted-foreground leading-relaxed">
          Je restaurant staat klaar. Alle instellingen blijven aanpasbaar via{" "}
          <Link to="/app/instellingen" className="underline">Instellingen</Link>.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Button asChild size="lg"><Link to="/app">Naar dashboard</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/app/floor">Floor Mode</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/app/instellingen">Instellingen</Link></Button>
        </div>
      </div>
    ),
  },
];

export default function OnboardingWizard() {
  const { current } = useRestaurant();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const queryClient = useQueryClient();

  const restaurantId = current?.restaurant_id;
  const { data: statuses } = useStepStatuses(restaurantId);

  const { data: settings } = useQuery({
    queryKey: ["restaurant-settings", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const patch = async (values: Record<string, any>) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from("restaurants")
      .update(values as any)
      .eq("id", restaurantId);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["restaurant-settings", restaurantId] });
    queryClient.invalidateQueries({ queryKey: ["onboarding-step-statuses", restaurantId] });
  };

  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const totalSteps = STEPS.length;

  // Progress = % completed (done) of the 12 real steps
  const completedCount = useMemo(() => {
    if (!statuses) return 0;
    return Object.values(statuses).filter((s) => s === "done").length;
  }, [statuses]);
  const progress = (completedCount / 12) * 100;

  const goNext = () => {
    if (stepIndex < totalSteps - 1) setStepIndex((i) => i + 1);
    else navigate("/app");
  };
  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  if (!restaurantId || !settings) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        Laden…
      </div>
    );
  }

  const currentStatus =
    step.key !== "welcome" && step.key !== "done" && statuses
      ? statuses[step.key as WizardStepKey]
      : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">
              {completedCount} van 12 stappen voltooid
            </span>
            <Link
              to="/app"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Later afmaken
            </Link>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* Steps overview */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-2">
              <ol className="space-y-0.5">
                {STEPS.map((s, i) => {
                  const isActive = i === stepIndex;
                  const status =
                    s.key !== "welcome" && s.key !== "done" && statuses
                      ? statuses[s.key as WizardStepKey]
                      : null;
                  return (
                    <li key={s.key}>
                      <button
                        onClick={() => setStepIndex(i)}
                        className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        {status ? (
                          <StepStatusDot status={status} />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                        )}
                        <span className="flex-1 truncate">
                          {s.key === "welcome" || s.key === "done"
                            ? s.title
                            : `${i}. ${s.title}`}
                        </span>
                        {status === "done" && !isActive && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </aside>

          <Card className="p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
                  {currentStatus && <StepStatusBadge status={currentStatus} />}
                </div>
                {step.subtitle && (
                  <p className="text-sm text-muted-foreground mt-1.5">{step.subtitle}</p>
                )}
              </div>
            </div>

            <Separator className="mb-6" />

            <div>
              {step.render({ restaurantId, settings, patch, goNext })}
            </div>

            {step.key !== "welcome" && step.key !== "done" && (
              <>
                <Separator className="my-6" />
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Vorige
                  </Button>
                  <Button onClick={goNext} size="lg">
                    Volgende
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
