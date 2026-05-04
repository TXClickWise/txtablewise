import {
  LayoutDashboard, CalendarDays, Users, Settings, MessageSquare,
  Hand, ListChecks, BarChart3, Plug, Tablet, ShieldCheck, Bot,
  Database, FileText, CreditCard, Shield, Crown, GraduationCap, Store,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = "owner" | "manager" | "host" | "staff";
type Item = { title: string; url: string; icon: typeof LayoutDashboard; end?: boolean; advanced?: boolean; roles?: Role[] };

const operatie: Item[] = [
  { title: "Vandaag", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays },
  { title: "Vloer", url: "/app/vloer", icon: Tablet },
  { title: "Walk-ins", url: "/app/walk-ins", icon: Hand },
  { title: "Wachtlijst", url: "/app/wachtlijst", icon: ListChecks },
];

const gasten: Item[] = [
  { title: "Gasten", url: "/app/gasten", icon: Users },
];

const hospitality: Item[] = [
  { title: "Gastcommunicatie", url: "/app/gastcommunicatie", icon: MessageSquare, roles: ["owner","manager"] },
  { title: "AI Host & Voice", url: "/app/ai-voice", icon: Bot, roles: ["owner","manager"] },
];

const beheer: Item[] = [
  { title: "Rapportages", url: "/app/rapportages", icon: BarChart3, roles: ["owner","manager"] },
  { title: "Koppelingen", url: "/app/koppelingen", icon: Plug, roles: ["owner","manager"] },
  { title: "Instellingen", url: "/app/instellingen", icon: Settings, roles: ["owner","manager"] },
];

// System admin only
const admin: Item[] = [
  { title: "Restaurants", url: "/app/admin/restaurants", icon: Store },
  { title: "Plan-aanvragen", url: "/app/admin/plan-requests", icon: Crown },
  { title: "Integratiebeheer", url: "/app/admin/integraties", icon: Database },
  { title: "Integratie-logs", url: "/app/admin/logs", icon: FileText },
  { title: "ClickWise beheer", url: "/app/admin/clickwise", icon: Plug },
  { title: "POS-beheer", url: "/app/admin/pos", icon: CreditCard },
  { title: "Voice Agent debug", url: "/app/admin/voice-agent", icon: Bot },
  { title: "ClickWise Voice setup", url: "/app/admin/clickwise-voice-setup", icon: GraduationCap },
  { title: "Pilot readiness", url: "/app/admin/pilot-readiness", icon: ShieldCheck },
];

function Group({ label, items, collapsed, pathname, accent, onNavigate, canSeeAdvanced, role }: { label: string; items: Item[]; collapsed: boolean; pathname: string; accent?: boolean; onNavigate?: () => void; canSeeAdvanced: boolean; role: Role | null }) {
  const visible = items.filter((i) => (!i.advanced || canSeeAdvanced) && (!i.roles || (role && i.roles.includes(role))));
  if (visible.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className={cn(accent && "text-primary flex items-center gap-1.5")}>
        {accent && <Shield className="h-3 w-3" />} {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => {
            const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active}>
                  <NavLink to={item.url} end={item.end} onClick={onNavigate}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <span className="flex items-center gap-1.5">
                        {item.title}
                        {item.advanced && <span className="text-[9px] uppercase tracking-wide text-muted-foreground">adv</span>}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  // In mobile/tablet (sheet) modus is de sidebar altijd volledig zichtbaar,
  // dus negeer de "collapsed" desktop-state — anders krijg je alleen iconen
  // in een uitgeklapte sheet.
  const collapsed = !isMobile && state === "collapsed";
  const { signOut, user } = useAuth();
  const { current } = useRestaurant();
  const { isSystemAdmin } = useIsSystemAdmin();
  const { canSeeAdvanced } = useAdvancedMode();
  const location = useLocation();

  const handleNavigate = isMobile ? () => setOpenMobile(false) : undefined;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn("px-2 py-2", collapsed && "px-0 text-center")}>
          <div className="font-display text-lg text-sidebar-primary leading-tight flex items-center gap-1.5">
            {collapsed ? "TW" : "TableWise"}
            {!collapsed && isSystemAdmin && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/40 text-primary">
                ADMIN
              </Badge>
            )}
          </div>
          {!collapsed && current && (
            <div className="text-xs text-sidebar-foreground/60 truncate">{current.restaurants.name}</div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {(() => {
          const role = (current?.role as Role | undefined) ?? null;
          return (
            <>
              <Group label="Operatie" items={operatie} collapsed={collapsed} pathname={location.pathname} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              <Group label="Gasten" items={gasten} collapsed={collapsed} pathname={location.pathname} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              <Group label="Hospitality" items={hospitality} collapsed={collapsed} pathname={location.pathname} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              <Group label="Beheer" items={beheer} collapsed={collapsed} pathname={location.pathname} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              {isSystemAdmin && (
                <Group label="Admin" items={admin} collapsed={collapsed} pathname={location.pathname} accent onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              )}
            </>
          );
        })()}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 py-2 text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className={cn("w-full justify-start", collapsed && "justify-center")}>
          {collapsed ? "↩" : "Uitloggen"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
