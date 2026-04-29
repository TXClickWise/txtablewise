// Single source of truth voor abonnementen, feature gating en limieten.
// Gebruik via usePlan() hook of <FeatureGate />.

export type SubscriptionPlan = "trial" | "basic" | "pro";

export type FeatureKey =
  | "reservations"
  | "floor_plan"
  | "walkins"
  | "waitlist"
  | "noshow_basic"
  | "noshow_advanced"
  | "guests_crm"
  | "voice_agent_single"
  | "voice_agent_multi"
  | "pos_basic"
  | "pos_advanced"
  | "clickwise_whatsapp"
  | "clickwise_full"
  | "reviews_aftercare"
  | "reporting_basic"
  | "reporting_export"
  | "api_test"
  | "api_full"
  | "multi_location";

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  priceLabel: string;
  badge?: string;
  features: Record<FeatureKey, boolean>;
  limits: {
    reservationsPerMonth: number | null; // null = onbeperkt
    locations: number | null;
    voiceAgents: number;
  };
}

const noFeatures = (): Record<FeatureKey, boolean> => ({
  reservations: false,
  floor_plan: false,
  walkins: false,
  waitlist: false,
  noshow_basic: false,
  noshow_advanced: false,
  guests_crm: false,
  voice_agent_single: false,
  voice_agent_multi: false,
  pos_basic: false,
  pos_advanced: false,
  clickwise_whatsapp: false,
  clickwise_full: false,
  reviews_aftercare: false,
  reporting_basic: false,
  reporting_export: false,
  api_test: false,
  api_full: false,
  multi_location: false,
});

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  trial: {
    id: "trial",
    name: "Free Trial",
    tagline: "14 dagen alles uitproberen",
    priceLabel: "Gratis · 14 dagen",
    features: {
      ...noFeatures(),
      reservations: true,
      floor_plan: true,
      walkins: true,
      waitlist: true,
      noshow_basic: true,
      guests_crm: true,
      reporting_basic: true,
      api_test: true,
    },
    limits: { reservationsPerMonth: 50, locations: 1, voiceAgents: 0 },
  },
  basic: {
    id: "basic",
    name: "Basic",
    tagline: "Alles voor de dagelijkse vloer",
    priceLabel: "Op aanvraag",
    features: {
      ...noFeatures(),
      reservations: true,
      floor_plan: true,
      walkins: true,
      waitlist: true,
      noshow_basic: true,
      noshow_advanced: true,
      guests_crm: true,
      voice_agent_single: true,
      pos_basic: true,
      clickwise_whatsapp: true,
      reviews_aftercare: true,
      reporting_basic: true,
    },
    limits: { reservationsPerMonth: null, locations: 1, voiceAgents: 1 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Volledige automatisering en multi-locatie",
    priceLabel: "Op aanvraag",
    badge: "Aanbevolen",
    features: {
      ...noFeatures(),
      reservations: true,
      floor_plan: true,
      walkins: true,
      waitlist: true,
      noshow_basic: true,
      noshow_advanced: true,
      guests_crm: true,
      voice_agent_single: true,
      voice_agent_multi: true,
      pos_basic: true,
      pos_advanced: true,
      clickwise_whatsapp: true,
      clickwise_full: true,
      reviews_aftercare: true,
      reporting_basic: true,
      reporting_export: true,
      api_test: true,
      api_full: true,
      multi_location: true,
    },
    limits: { reservationsPerMonth: null, locations: null, voiceAgents: 99 },
  },
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  reservations: "Reserveringen",
  floor_plan: "Tafelplan & Floor mode",
  walkins: "Walk-ins",
  waitlist: "Wachtlijst",
  noshow_basic: "No-show basis",
  noshow_advanced: "No-show preventie (reconfirm + flow)",
  guests_crm: "Gastenbeheer / CRM",
  voice_agent_single: "AI voice agent (1 agent)",
  voice_agent_multi: "Meerdere voice agents",
  pos_basic: "POS verkoopdata",
  pos_advanced: "POS artikelen + AI-koppeling",
  clickwise_whatsapp: "WhatsApp via TableWise",
  clickwise_full: "ClickWise volledig (telefonie + WA + SMS)",
  reviews_aftercare: "Reviews & aftercare",
  reporting_basic: "Rapportages",
  reporting_export: "Rapportage-export",
  api_test: "API testmode",
  api_full: "API & webhooks (live)",
  multi_location: "Meerdere locaties",
};

export const FEATURE_ROWS: { key: FeatureKey; label: string }[] = (
  Object.keys(FEATURE_LABELS) as FeatureKey[]
).map((k) => ({ key: k, label: FEATURE_LABELS[k] }));

export function hasFeature(plan: SubscriptionPlan | null | undefined, key: FeatureKey): boolean {
  if (!plan) return false;
  return PLANS[plan].features[key] === true;
}

export function planRank(plan: SubscriptionPlan): number {
  return { trial: 0, basic: 1, pro: 2 }[plan];
}

/** Eerste plan dat de feature aanbiedt (voor upsell-copy) */
export function requiredPlanFor(key: FeatureKey): SubscriptionPlan {
  if (PLANS.basic.features[key]) return "basic";
  return "pro";
}

export function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  const ms = end - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
