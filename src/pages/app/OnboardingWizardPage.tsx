import { useState, ReactNode, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Building2,
  MapPin,
  Clock,
  CalendarRange,
  LayoutGrid,
  Table2,
  ListChecks,
  Users,
  UsersRound,
  ShieldCheck,
  Hourglass,
  Wine,
  Plug,
  PartyPopper,
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
import ShiftsSettings from "@/pages/app/settings/ShiftsSettings";
import ZonesTablesSettings from "@/pages/app/settings/ZonesTablesSettings";
import IntegrationsSettings from "@/pages/app/settings/IntegrationsSettings";

type Step = {
  key: string;
  title: string;
  subtitle?: string;
  icon: typeof Sparkles;
  render: (ctx: StepCtx) => ReactNode;
};

type StepCtx = {
  restaurantId: string;
  settings: any;
  patch: (values: Record<string, any>) => Promise<void>;
  goNext: () => void;
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

const STEPS: Step[] = [
  {
    key: "welcome",
    title: "Welkom bij TableWise",
    icon: Sparkles,
    render: ({ goNext }) => (
      <div className="space-y-6">
        <p className="text-base text-muted-foreground leading-relaxed">
          We helpen je om je restaurant klaar te zetten voor slimme reserveringen,
          walk-ins, tafelbeheer, no-show preventie en gastcommunicatie via ClickWise.
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            "Restaurantgegevens",
            "Openingstijden",
            "Tafels en zones",
            "Reserveringsregels",
            "Walk-ins",
            "Grote groepen",
            "No-show preventie",
            "Wachtlijst",
            "Drankjes vooraf",
            "Integraties",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={goNext} size="lg">
            Setup starten
          </Button>
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
    subtitle: "Deze gegevens gebruiken we voor je reserveringswidget en bevestigingen.",
    icon: Building2,
    render: () => (
      <EmbedSection>
        <GeneralSettings />
      </EmbedSection>
    ),
  },
  {
    key: "location",
    title: "Locatie",
    subtitle: "Start met één locatie. Multi-location komt in een latere fase.",
    icon: MapPin,
    render: () => (
      <EmbedSection>
        <GeneralSettings />
      </EmbedSection>
    ),
  },
  {
    key: "hours",
    title: "Openingstijden",
    subtitle:
      "Deze tijden bepalen wanneer gasten in principe kunnen reserveren. Shifts en uitzonderingen kun je hierna instellen.",
    icon: Clock,
    render: () => (
      <EmbedSection>
        <OpeningHoursSettings />
      </EmbedSection>
    ),
  },
  {
    key: "shifts",
    title: "Shifts",
    subtitle:
      "Shifts helpen om lunch, diner en terras apart te beheren. Later gebruiken we dit ook voor capaciteits-pacing.",
    icon: CalendarRange,
    render: () => (
      <EmbedSection>
        <ShiftsSettings />
      </EmbedSection>
    ),
  },
  {
    key: "zones",
    title: "Zones",
    subtitle: "Zones maken je tafelplan overzichtelijker. Denk aan binnen, terras, bar of serre.",
    icon: LayoutGrid,
    render: () => (
      <EmbedSection>
        <ZonesTablesSettings />
      </EmbedSection>
    ),
  },
  {
    key: "tables",
    title: "Tafels",
    subtitle:
      "Begin simpel. Je kunt tafelcombinaties en een visuele plattegrond later verder verfijnen.",
    icon: Table2,
    render: () => (
      <EmbedSection>
        <ZonesTablesSettings />
      </EmbedSection>
    ),
  },
  {
    key: "rules",
    title: "Reserveringsregels",
    subtitle:
      "Deze regels bepalen hoe makkelijk gasten kunnen reserveren en wanneer je zelf controle wilt houden.",
    icon: ListChecks,
    render: ({ settings, patch }) => (
      <div className="space-y-1 divide-y divide-border">
        <ToggleRow
          label="Automatisch bevestigen"
          description="Reserveringen worden direct bevestigd zonder handmatige actie."
          checked={!!settings.auto_confirm}
          onChange={(v) => patch({ auto_confirm: v })}
        />
        <ToggleRow
          label="Zonevoorkeur toestaan"
          description="Gasten mogen aangeven of ze binnen of op het terras willen zitten."
          checked={!!settings.allow_zone_preference}
          onChange={(v) => patch({ allow_zone_preference: v })}
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
            label="Minimaal vooraf reserveren"
            value={settings.booking_lead_time_minutes}
            onChange={(v) => patch({ booking_lead_time_minutes: v })}
            suffix="min"
          />
          <NumberField
            label="Maximaal vooruit reserveren"
            value={settings.booking_horizon_days}
            onChange={(v) => patch({ booking_horizon_days: v })}
            suffix="dagen"
          />
          <NumberField
            label="Max online groepsgrootte"
            value={settings.max_party_size_online}
            onChange={(v) => patch({ max_party_size_online: v })}
            suffix="personen"
            min={1}
          />
          <NumberField
            label="Handmatige goedkeuring vanaf"
            hint="Optioneel. Laat leeg als je geen drempel wilt."
            value={settings.manual_approval_from_party_size}
            onChange={(v) => patch({ manual_approval_from_party_size: v })}
            suffix="personen"
          />
        </div>
      </div>
    ),
  },
  {
    key: "walkins",
    title: "Walk-ins",
    subtitle:
      "Walk-ins zijn gasten die spontaan binnenkomen. Met Floor Mode kun je ze straks in seconden plaatsen.",
    icon: Users,
    render: ({ settings, patch }) => (
      <div className="space-y-1 divide-y divide-border">
        <ToggleRow
          label="Walk-ins toestaan"
          checked={!!settings.walkins_enabled}
          onChange={(v) => patch({ walkins_enabled: v })}
        />
        <ToggleRow
          label="Snelle groepsgrootteknoppen tonen"
          description="Toon 1, 2, 4, 6, 8 als snelkoppelingen in Floor Mode."
          checked={!!settings.walkin_quick_buttons}
          onChange={(v) => patch({ walkin_quick_buttons: v })}
        />
        <ToggleRow
          label="AI Quick Seat tonen"
          description="Stelt de beste vrije tafel voor op basis van groepsgrootte en bezetting."
          checked={!!settings.walkin_ai_quick_seat}
          onChange={(v) => patch({ walkin_ai_quick_seat: v })}
        />
        <div className="pt-4">
          <NumberField
            label="Standaard walk-in verblijfsduur"
            value={settings.walkin_default_minutes}
            onChange={(v) => patch({ walkin_default_minutes: v })}
            suffix="min"
          />
        </div>
      </div>
    ),
  },
  {
    key: "large-groups",
    title: "Grote groepen",
    subtitle:
      "Grotere groepen vragen vaak meer voorbereiding. Stel automatisch extra tijd of goedkeuring in.",
    icon: UsersRound,
    render: ({ settings, patch }) => (
      <div className="grid sm:grid-cols-2 gap-4">
        <NumberField
          label="Grote groep vanaf"
          value={settings.large_group_threshold}
          onChange={(v) => patch({ large_group_threshold: v })}
          suffix="personen"
        />
        <NumberField
          label="Extra verblijfsduur"
          value={settings.large_group_extra_minutes}
          onChange={(v) => patch({ large_group_extra_minutes: v })}
          suffix="min"
        />
        <NumberField
          label="Handmatige goedkeuring vanaf"
          value={settings.large_group_manual_approval_from}
          onChange={(v) => patch({ large_group_manual_approval_from: v })}
          suffix="personen"
        />
        <NumberField
          label="Aanbetaling aanbevolen vanaf"
          value={settings.large_group_deposit_recommended_from}
          onChange={(v) => patch({ large_group_deposit_recommended_from: v })}
          suffix="personen"
        />
        <NumberField
          label="Automatisch boeken tot"
          value={settings.large_group_auto_book_max}
          onChange={(v) => patch({ large_group_auto_book_max: v })}
          suffix="personen"
        />
        <NumberField
          label="Standaard groepsduur"
          value={settings.large_group_minutes}
          onChange={(v) => patch({ large_group_minutes: v })}
          suffix="min"
        />
      </div>
    ),
  },
  {
    key: "noshow",
    title: "No-show preventie",
    subtitle:
      "Voorkom lege tafels met vriendelijke bevestigingen, reminders en makkelijke annulering.",
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
          description="Gast bevestigt nogmaals via een korte link."
          checked={!!settings.noshow_reconfirm_enabled}
          onChange={(v) => patch({ noshow_reconfirm_enabled: v })}
        />
        <ToggleRow
          label="Annuleren via gastlink"
          description="Maak het laagdrempelig om af te zeggen — beter dan niet komen opdagen."
          checked={!!settings.noshow_guest_cancel_link_enabled}
          onChange={(v) => patch({ noshow_guest_cancel_link_enabled: v })}
        />
        <ToggleRow
          label="Aanbetalingregels voorbereiden"
          description="Nog niet actief — beschikbaar in een latere fase."
          checked={!!settings.noshow_deposit_rules_prepared}
          onChange={(v) => patch({ noshow_deposit_rules_prepared: v })}
        />
        <ToggleRow
          label="Vaste gasten uitzonderen voorbereiden"
          checked={!!settings.noshow_exempt_regulars_prepared}
          onChange={(v) => patch({ noshow_exempt_regulars_prepared: v })}
        />
      </div>
    ),
  },
  {
    key: "waitlist",
    title: "Wachtlijst",
    subtitle:
      "Met een wachtlijst vul je vrijgekomen tafels snel opnieuw bij annuleringen of no-shows.",
    icon: Hourglass,
    render: ({ settings, patch }) => (
      <div className="space-y-1 divide-y divide-border">
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
        <ToggleRow
          label="Voorkeurstijden toestaan"
          checked={!!settings.waitlist_allow_preferred_times}
          onChange={(v) => patch({ waitlist_allow_preferred_times: v })}
        />
        <ToggleRow
          label="ClickWise bericht voorbereiden"
          checked={!!settings.waitlist_clickwise_message_prepared}
          onChange={(v) => patch({ waitlist_clickwise_message_prepared: v })}
        />
        <div className="pt-4">
          <NumberField
            label="Reactietijd voor aangeboden plek"
            value={settings.waitlist_response_window_minutes}
            onChange={(v) => patch({ waitlist_response_window_minutes: v })}
            suffix="min"
          />
        </div>
      </div>
    ),
  },
  {
    key: "preorders",
    title: "Drankjes vooraf",
    subtitle:
      "Laat gasten alvast iets feestelijks klaarzetten. Voor MVP wordt dit als notitie opgeslagen.",
    icon: Wine,
    render: ({ settings, patch }) => (
      <div className="space-y-1 divide-y divide-border">
        <ToggleRow
          label="Drankjes vooraf toestaan"
          checked={!!settings.preorders_enabled}
          onChange={(v) => patch({ preorders_enabled: v })}
        />
        <ToggleRow
          label="Betaling vereist"
          description="Aanbevolen uit voor MVP — geen actieve betaalflow."
          checked={!!settings.preorders_payment_required}
          onChange={(v) => patch({ preorders_payment_required: v })}
        />
        <ToggleRow
          label="Vrije tekst toestaan"
          description="Gast kan een eigen wens toevoegen."
          checked={!!settings.preorders_allow_free_text}
          onChange={(v) => patch({ preorders_allow_free_text: v })}
        />
        <div className="pt-4 text-sm text-muted-foreground">
          Standaard opties (Prosecco, alcoholvrije cocktail, fles huiswijn, speciaalbier,
          cocktail van de maand) kun je later aanvullen via Drankjes.
        </div>
      </div>
    ),
  },
  {
    key: "integrations",
    title: "Integraties voorbereiden",
    subtitle:
      "ClickWise voor CRM, communicatie en AI-agents. Loyverse als aanbevolen starter-POS.",
    icon: Plug,
    render: () => (
      <EmbedSection>
        <IntegrationsSettings />
      </EmbedSection>
    ),
  },
  {
    key: "done",
    title: "Klaar om gasten te ontvangen",
    icon: PartyPopper,
    render: () => (
      <div className="space-y-6">
        <p className="text-base text-muted-foreground leading-relaxed">
          Je restaurant staat klaar. Je kunt nu reserveringen ontvangen, walk-ins
          plaatsen en je tafelplan beheren. Alle instellingen blijven later
          aanpasbaar via <Link to="/app/instellingen" className="underline">Instellingen</Link>.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Button asChild size="lg">
            <Link to="/app">Naar dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/app/floor">Floor Mode openen</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/app/instellingen">Instellingen</Link>
          </Button>
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
  };

  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const totalSteps = STEPS.length;
  const progress = useMemo(() => ((stepIndex + 1) / totalSteps) * 100, [stepIndex, totalSteps]);

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

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Progress header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">
              Stap {stepIndex + 1} van {totalSteps} — {step.title}
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

        <Card className="p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-xl bg-primary/10 p-3">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
              {step.subtitle && (
                <p className="text-sm text-muted-foreground mt-1.5">{step.subtitle}</p>
              )}
            </div>
          </div>

          <Separator className="mb-6" />

          <div>
            {step.render({
              restaurantId,
              settings,
              patch,
              goNext,
            })}
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

        {/* Step dots */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStepIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === stepIndex
                  ? "w-6 bg-primary"
                  : i < stepIndex
                  ? "w-2 bg-primary/50"
                  : "w-2 bg-muted-foreground/20"
              }`}
              aria-label={`Naar stap ${i + 1}: ${s.title}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
