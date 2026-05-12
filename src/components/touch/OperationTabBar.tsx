import { NavLink } from "react-router-dom";
import { CalendarDays, LayoutDashboard, Tablet, ListChecks, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/app", label: "Vandaag", icon: LayoutDashboard, end: true },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/app/vloer", label: "Vloer", icon: Tablet },
  { to: "/app/wachtlijst", label: "Wachtlijst", icon: ListChecks },
  { to: "/app/gasten", label: "Gasten", icon: Users },
];

/**
 * Operationele tabbar bovenaan de drie kernschermen.
 * Sticky, 48px hoog, alle tabs zichtbaar op tablet, scrollbaar op mobiel.
 */
export function OperationTabBar() {
  return (
    <nav
      aria-label="Operationele navigatie"
      className="flex-1 overflow-x-auto -mx-2"
    >
      <div className="flex items-center gap-1 px-2 min-w-max">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-display font-semibold transition-all whitespace-nowrap",
                isActive
                  ? "bg-accent text-accent-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Routes waarop de tabbar zichtbaar moet zijn. */
export function isOperationalRoute(pathname: string): boolean {
  if (pathname === "/app") return true;
  return [
    "/app/agenda",
    "/app/vloer",
    "/app/wachtlijst",
    "/app/gasten",
  ].some((p) => pathname === p || pathname.startsWith(p + "/"));
}
