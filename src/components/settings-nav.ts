import {
  Settings as SettingsIcon,
  Clock,
  CalendarRange,
  LayoutGrid,
  Users,
  MessageSquare,
  Bot,
  Plug,
  KeyRound,
  UserCog,
  Crown,
  Globe,
  Rocket,
  Wine,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export type SettingsItem = {
  to: string;
  /** Translation key under `app:settingsNav.*` */
  labelKey: string;
  /** Fallback Dutch label used when no translation hook is active. */
  label: string;
  icon: typeof SettingsIcon;
  end?: boolean;
  ownerOnly?: boolean;
  /** Alleen tonen wanneer Advanced Mode aan staat (of system admin). */
  advanced?: boolean;
};

export const SETTINGS_ITEMS: SettingsItem[] = [
  { to: "/app/instellingen", labelKey: "general", label: "Algemeen", icon: SettingsIcon, end: true },
  { to: "/app/instellingen/openingstijden", labelKey: "hours", label: "Openingstijden", icon: Clock },
  { to: "/app/instellingen/reserveringen", labelKey: "reservations", label: "Reserveringen", icon: CalendarRange },
  { to: "/app/instellingen/widget", labelKey: "widget", label: "Online reserveren", icon: Globe },
  { to: "/app/instellingen/zones", labelKey: "zones", label: "Tafels & zones", icon: LayoutGrid },
  { to: "/app/instellingen/gasten", labelKey: "guests", label: "Gasten", icon: Users },
  { to: "/app/instellingen/berichten", labelKey: "messages", label: "Berichten", icon: MessageSquare },
  { to: "/app/instellingen/pre-orders", labelKey: "preOrders", label: "Drankjes vooraf", icon: Wine },
  // Verborgen achter Advanced Mode — bereikbaar via "Koppelingen" in zijbalk
  { to: "/app/instellingen/ai-voice", labelKey: "aiVoice", label: "AI & Voice", icon: Bot, advanced: true },
  { to: "/app/instellingen/integraties", labelKey: "integrations", label: "Integraties (geavanceerd)", icon: Plug, advanced: true },
  { to: "/app/instellingen/api", labelKey: "api", label: "API & webhooks", icon: KeyRound, advanced: true },
  { to: "/app/instellingen/gebruikers", labelKey: "users", label: "Gebruikers & rollen", icon: UserCog },
  { to: "/app/instellingen/abonnement", labelKey: "subscription", label: "Abonnement", icon: Crown },
  { to: "/app/instellingen/pilot-launch", labelKey: "pilotLaunch", label: "Pilot lancering", icon: Rocket, ownerOnly: true },
];

/** Translated settings items (operator-UI). */
export function useSettingsItems(): SettingsItem[] {
  const { t } = useTranslation("app");
  return useMemo(
    () => SETTINGS_ITEMS.map((i) => ({ ...i, label: t(`settingsNav.${i.labelKey}`, { defaultValue: i.label }) })),
    [t],
  );
}
