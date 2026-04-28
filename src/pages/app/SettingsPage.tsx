import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

type Item = {
  to: string;
  label: string;
  icon: typeof SettingsIcon;
  end?: boolean;
};
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Basis",
    items: [
      { to: "/app/instellingen", label: "Algemeen", icon: SettingsIcon, end: true },
      { to: "/app/instellingen/openingstijden", label: "Openingstijden", icon: Clock },
    ],
  },
  {
    label: "Operatie",
    items: [
      { to: "/app/instellingen/reserveringen", label: "Reserveringen", icon: CalendarRange },
      { to: "/app/instellingen/widget", label: "Online reserveren", icon: Globe },
      { to: "/app/instellingen/zones", label: "Tafels & zones", icon: LayoutGrid },
    ],
  },
  {
    label: "Gasten & communicatie",
    items: [
      { to: "/app/instellingen/gasten", label: "Gasten", icon: Users },
      { to: "/app/instellingen/berichten", label: "Berichten", icon: MessageSquare },
      { to: "/app/instellingen/ai-voice", label: "AI & Voice", icon: Bot },
    ],
  },
  {
    label: "Techniek",
    items: [
      { to: "/app/instellingen/integraties", label: "Integraties", icon: Plug },
      { to: "/app/instellingen/api", label: "API & webhooks", icon: KeyRound },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/app/instellingen/gebruikers", label: "Gebruikers & rollen", icon: UserCog },
      { to: "/app/instellingen/abonnement", label: "Abonnement", icon: Crown },
    ],
  },
];

const SettingsPage = () => {
  const location = useLocation();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl">Instellingen</h1>
        <p className="text-muted-foreground">Beheer je restaurant configuratie</p>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar nav */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          {/* Mobile: horizontal scroll fallback */}
          <div className="lg:hidden -mx-4 px-4 overflow-x-auto pb-2 mb-2">
            <div className="flex gap-1 min-w-max">
              {GROUPS.flatMap((g) => g.items).map((item) => {
                const active = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Desktop: grouped vertical nav */}
          <nav className="hidden lg:block space-y-5">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-2">
                  {g.label}
                </p>
                <ul className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = item.end
                      ? location.pathname === item.to
                      : location.pathname.startsWith(item.to);
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                            active
                              ? "bg-accent text-foreground font-medium"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default SettingsPage;
