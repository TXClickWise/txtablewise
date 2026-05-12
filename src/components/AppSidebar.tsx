import {
  LayoutDashboard, CalendarDays, Users, Settings, MessageSquare,
  Hand, ListChecks, BarChart3, Plug, Tablet, ShieldCheck, Bot,
  Database, FileText, CreditCard, Shield, Crown, GraduationCap, Store,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PendingBadge } from "@/components/PendingBadge";
import { usePendingLargeGroups } from "@/hooks/usePendingLargeGroups";

type Role = "owner" | "manager" | "host" | "staff";
type Item = { title: string; url: string; icon: typeof LayoutDashboard; end?: boolean; advanced?: boolean; roles?: Role[] };

// Operationele schermen (Vandaag, Agenda, Vloer, Wachtlijst, Gasten) zitten
// nu in de OperationTabBar bovenaan — niet meer in de sidebar.
// Snelkoppelingen voor de meest gebruikte schermen blijven hier wel staan.

const quickAccess: Item[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true, roles: ["owner","manager","host","staff"] },
  { title: "Grote groepen", url: "/app/gasten?tab=grote-groepen", icon: Users, roles: ["owner","manager","host"] },
];

const hospitality: Item[] = [
  { title: "Gastcommunicatie", url: "/app/gastcommunicatie", icon: MessageSquare, roles: ["owner","manager"] },
];

const beheer: Item[] = [
  { title: "Rapportages", url: "/app/rapportages", icon: BarChart3, roles: ["owner","manager"] },
];

// Sub-items onder "Instellingen". Snelle toegang tot de meest bezochte secties.
const settingsSubItems: { title: string; url: string }[] = [
  { title: "AI Host & Voice", url: "/app/instellingen/ai-voice" },
  { title: "Koppelingen", url: "/app/instellingen/integraties" },
  { title: "Reserveringen", url: "/app/instellingen/reserveringen" },
  { title: "Tafels & zones", url: "/app/instellingen/zones" },
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

function Group({ label, items, collapsed, pathname, search, accent, onNavigate, canSeeAdvanced, role, badges }: { label: string; items: Item[]; collapsed: boolean; pathname: string; search: string; accent?: boolean; onNavigate?: () => void; canSeeAdvanced: boolean; role: Role | null; badges?: Record<string, number> }) {
  const visible = items.filter((i) => (!i.advanced || canSeeAdvanced) && (!i.roles || (role && i.roles.includes(role))));
  if (visible.length === 0) return null;
  const currentFull = pathname + search;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className={cn("text-sidebar-foreground/70", accent && "text-sidebar-primary flex items-center gap-1.5")}>
        {accent && <Shield className="h-3 w-3" />} {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => {
            const hasQuery = item.url.includes("?");
            const active = hasQuery
              ? currentFull === item.url || currentFull.startsWith(item.url + "&")
              : item.end
                ? pathname === item.url
                : pathname.startsWith(item.url);
            const badgeCount = badges?.[item.url] ?? 0;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active}>
                  <NavLink to={item.url} end={item.end} onClick={onNavigate} className="relative">
                    <span className="relative inline-flex shrink-0">
                      <item.icon className="h-4 w-4" />
                      {collapsed && badgeCount > 0 && <PendingBadge count={badgeCount} variant="dot" />}
                    </span>
                    {!collapsed && (
                      <span className="flex items-center gap-1.5">
                        {item.title}
                        {item.advanced && <span className="text-[9px] uppercase tracking-wide text-sidebar-foreground/60">adv</span>}
                      </span>
                    )}
                    {!collapsed && badgeCount > 0 && <PendingBadge count={badgeCount} variant="sidebar" />}
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
  const { count: pendingLargeGroups } = usePendingLargeGroups();
  const quickAccessBadges = { "/app/gasten?tab=grote-groepen": pendingLargeGroups };
    <Sidebar collapsible="icon" className="glass-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn("px-2 py-2", collapsed && "px-0 text-center")}>
          <div className="font-display text-lg text-sidebar-primary leading-tight flex items-center gap-1.5">
            {collapsed ? "TX" : "TX TableWise"}
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
          const settingsActive = location.pathname.startsWith("/app/instellingen");
          const canBeheer = role === "owner" || role === "manager";
          return (
            <>
              <Group label="Snel naar" items={quickAccess} collapsed={collapsed} pathname={location.pathname} search={location.search} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              <Group label="Hospitality" items={hospitality} collapsed={collapsed} pathname={location.pathname} search={location.search} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              <Group label="Beheer" items={beheer} collapsed={collapsed} pathname={location.pathname} search={location.search} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              {canBeheer && (
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={settingsActive}>
                          <NavLink to="/app/instellingen" end onClick={handleNavigate}>
                            <Settings className="h-4 w-4 shrink-0" />
                            {!collapsed && <span>Instellingen</span>}
                          </NavLink>
                        </SidebarMenuButton>
                        {!collapsed && (
                          <SidebarMenuSub>
                            {settingsSubItems.map((s) => {
                              const active = location.pathname === s.url;
                              return (
                                <SidebarMenuSubItem key={s.url}>
                                  <SidebarMenuSubButton asChild isActive={active}>
                                    <NavLink to={s.url} onClick={handleNavigate}>
                                      <span>{s.title}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
              {isSystemAdmin && (
                <Group label="Admin" items={admin} collapsed={collapsed} pathname={location.pathname} search={location.search} accent onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              )}
            </>
          );
        })()}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border gap-1">
        {!collapsed && (
          <div className="px-2 pt-2 text-xs text-sidebar-foreground/80 truncate">{user?.email}</div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={signOut}
          className={cn(
            "w-full justify-start border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground hover:border-sidebar-primary",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? "↩" : "Uitloggen"}
        </Button>
        {!collapsed && (
          <div className="px-2 pt-2 pb-1 text-[10px] leading-snug text-sidebar-foreground/60 text-center">
            Created with <span className="text-destructive">❤</span> on Texel by{" "}
            <a
              href="https://clickwise.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-primary hover:underline"
            >
              ClickWise
            </a>{" "}
            &amp; Jeroen
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
