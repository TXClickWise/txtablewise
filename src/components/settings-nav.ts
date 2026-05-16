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

export type SettingsItem = {
  to: string;
  label: string;
  icon: typeof SettingsIcon;
  end?: boolean;
  ownerOnly?: boolean;
  /** Alleen tonen wanneer Advanced Mode aan staat (of system admin). */
  advanced?: boolean;
};

export const SETTINGS_ITEMS: SettingsItem[] = [
  { to: "/app/instellingen", label: "Algemeen", icon: SettingsIcon, end: true },
  { to: "/app/instellingen/openingstijden", label: "Openingstijden", icon: Clock },
  { to: "/app/instellingen/reserveringen", label: "Reserveringen", icon: CalendarRange },
  { to: "/app/instellingen/widget", label: "Online reserveren", icon: Globe },
  { to: "/app/instellingen/zones", label: "Tafels & zones", icon: LayoutGrid },
  { to: "/app/instellingen/gasten", label: "Gasten", icon: Users },
  { to: "/app/instellingen/berichten", label: "Berichten", icon: MessageSquare },
  { to: "/app/instellingen/pre-orders", label: "Drankjes vooraf", icon: Wine },
  // Verborgen achter Advanced Mode — bereikbaar via "Koppelingen" in zijbalk
  { to: "/app/instellingen/ai-voice", label: "AI & Voice", icon: Bot, advanced: true },
  { to: "/app/instellingen/integraties", label: "Integraties (geavanceerd)", icon: Plug, advanced: true },
  { to: "/app/instellingen/api", label: "API & webhooks", icon: KeyRound, advanced: true },
  { to: "/app/instellingen/gebruikers", label: "Gebruikers & rollen", icon: UserCog },
  { to: "/app/instellingen/abonnement", label: "Abonnement", icon: Crown },
  { to: "/app/instellingen/pilot-launch", label: "Pilot lancering", icon: Rocket, ownerOnly: true },
];
