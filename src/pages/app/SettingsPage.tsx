import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/app/instellingen", label: "Algemeen", end: true },
  { to: "/app/instellingen/openingstijden", label: "Openingstijden" },
  { to: "/app/instellingen/shifts", label: "Shifts" },
  { to: "/app/instellingen/zones", label: "Zones & tafels" },
  { to: "/app/instellingen/sluitingen", label: "Sluitingen" },
];

const SettingsPage = () => {
  const location = useLocation();
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl">Instellingen</h1>
        <p className="text-muted-foreground">Beheer je restaurant configuratie</p>
      </div>
      <nav className="flex gap-1 border-b border-border overflow-x-auto -mx-2 px-2">
        {tabs.map((t) => {
          const active = t.end
            ? location.pathname === t.to
            : location.pathname.startsWith(t.to);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
};
export default SettingsPage;
