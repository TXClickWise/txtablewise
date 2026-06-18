import {
  LayoutDashboard, CalendarDays, Users, Settings, MessageSquare,
  Hand, ListChecks, BarChart3, Plug, Tablet, ShieldCheck, Bot,
  Database, FileText, CreditCard, Shield, Crown, GraduationCap, Store, Rocket,
  ChevronDown,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSettingsItems } from "@/components/settings-nav";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { useCollapsibleGroup } from "@/hooks/useCollapsibleGroup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PendingBadge } from "@/components/PendingBadge";
import { usePendingLargeGroups } from "@/hooks/usePendingLargeGroups";
import { usePendingGuestChanges } from "@/hooks/usePendingGuestChanges";

type Role = "owner" | "manager" | "host" | "staff";
type Item = { title: string; titleKey?: string; url: string; icon: typeof LayoutDashboard; end?: boolean; advanced?: boolean; roles?: Role[] };

const quickAccess: Item[] = [
  { title: "Dashboard", titleKey: "nav.dashboard", url: "/app", icon: LayoutDashboard, end: true, roles: ["owner","manager","host","staff"] },
  { title: "Grote groepen", titleKey: "nav.largeGroups", url: "/app/gasten?tab=grote-groepen", icon: Users, roles: ["owner","manager","host"] },
];

const hospitality: Item[] = [
  { title: "Gastcommunicatie", titleKey: "nav.guestComm", url: "/app/gastcommunicatie", icon: MessageSquare, roles: ["owner","manager"] },
];

const beheer: Item[] = [
  { title: "Rapportages", titleKey: "nav.reports", url: "/app/rapportages", icon: BarChart3, roles: ["owner","manager"] },
];

// System admin only
const admin: Item[] = [
  { title: "Restaurants", titleKey: "admin.restaurants", url: "/app/admin/restaurants", icon: Store },
  { title: "Plan-aanvragen", titleKey: "admin.planRequests", url: "/app/admin/plan-requests", icon: Crown },
  { title: "Integratiebeheer", titleKey: "admin.integrations", url: "/app/admin/integraties", icon: Database },
  { title: "Integratie-logs", titleKey: "admin.logs", url: "/app/admin/logs", icon: FileText },
  { title: "ClickWise beheer", titleKey: "admin.clickwise", url: "/app/admin/clickwise", icon: Plug },
  { title: "POS-beheer", url: "/app/admin/pos", icon: CreditCard },
  { title: "Voice Agent debug", url: "/app/admin/voice-agent", icon: Bot },
  { title: "ClickWise Voice setup", url: "/app/admin/clickwise-voice-setup", icon: GraduationCap },
  { title: "ClickWise provisioning", url: "/app/admin/clickwise-provisioning", icon: Rocket },
  { title: "Pilot readiness", url: "/app/admin/pilot-readiness", icon: ShieldCheck },
];

function Group({
  label, items, collapsed, pathname, search, accent, onNavigate, canSeeAdvanced, role, badges, storageKey,
}: {
  label: string; items: Item[]; collapsed: boolean; pathname: string; search: string;
  accent?: boolean; onNavigate?: () => void; canSeeAdvanced: boolean; role: Role | null;
  badges?: Record<string, number>; storageKey: string;
}) {
  const visible = items.filter((i) => (!i.advanced || canSeeAdvanced) && (!i.roles || (role && i.roles.includes(role))));
  const { open, setOpen } = useCollapsibleGroup(`sidebar.${storageKey}`, true);
  if (visible.length === 0) return null;
  const currentFull = pathname + search;

  const menu = (
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
  );

  // In icon-only modus geen collapsible-header (geen ruimte).
  if (collapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>{menu}</SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={cn(
              "group/lbl cursor-pointer select-none flex items-center justify-between w-full text-sidebar-foreground/70 hover:text-sidebar-foreground",
              accent && "text-sidebar-primary",
            )}
          >
            <span className="flex items-center gap-1.5">
              {accent && <Shield className="h-3 w-3" />} {label}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform opacity-70",
                !open && "-rotate-90",
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>{menu}</SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const { signOut, user } = useAuth();
  const { current } = useRestaurant();
  const { isSystemAdmin } = useIsSystemAdmin();
  const { canSeeAdvanced } = useAdvancedMode();
  const location = useLocation();

  const handleNavigate = isMobile ? () => setOpenMobile(false) : undefined;
  const { count: pendingLargeGroups } = usePendingLargeGroups();
  const { count: pendingGuestChanges } = usePendingGuestChanges();
  const quickAccessBadges = {
    "/app/gasten?tab=grote-groepen": pendingLargeGroups,
    "/app": pendingGuestChanges,
  };

  return (
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
          
          const canBeheer = role === "owner" || role === "manager";
          return (
            <>
              <Group storageKey="snel" label="Snel naar" items={quickAccess} collapsed={collapsed} pathname={location.pathname} search={location.search} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} badges={quickAccessBadges} />
              <Group storageKey="hospitality" label="Hospitality" items={hospitality} collapsed={collapsed} pathname={location.pathname} search={location.search} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              <Group storageKey="beheer" label="Beheer" items={beheer} collapsed={collapsed} pathname={location.pathname} search={location.search} onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
              {canBeheer && (
                <SettingsCollapsibleGroup
                  collapsed={collapsed}
                  pathname={location.pathname}
                  onNavigate={handleNavigate}
                  isOwner={role === "owner"}
                />
              )}
              {isSystemAdmin && (
                <Group storageKey="admin" label="Admin" items={admin} collapsed={collapsed} pathname={location.pathname} search={location.search} accent onNavigate={handleNavigate} canSeeAdvanced={canSeeAdvanced} role={role} />
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
          <div className="px-2 pt-2 pb-1 text-xs leading-snug text-sidebar-foreground/85 text-center whitespace-nowrap">
            Created with <span className="text-destructive">❤</span> on Texel by{" "}
            <a
              href="https://clickwise.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sidebar-primary font-semibold hover:underline"
            >
              ClickWise
            </a>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function SettingsCollapsibleGroup({
  collapsed, pathname, onNavigate, isOwner,
}: {
  collapsed: boolean; pathname: string; onNavigate?: () => void; isOwner: boolean;
}) {
  const settingsActive = pathname.startsWith("/app/instellingen");
  const { open, setOpen } = useCollapsibleGroup("sidebar.settings", settingsActive);
  const { canSeeAdvanced } = useAdvancedMode();
  const items = SETTINGS_ITEMS
    .filter((i) => !i.ownerOnly || isOwner)
    .filter((i) => !i.advanced || canSeeAdvanced);

  if (collapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={settingsActive}>
                <NavLink to="/app/instellingen" end onClick={onNavigate}>
                  <Settings className="h-4 w-4 shrink-0" />
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <Collapsible open={open} onOpenChange={setOpen}>
          <SidebarMenu>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton isActive={settingsActive && pathname === "/app/instellingen"}>
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>Instellingen</span>
                  <ChevronDown
                    className={cn(
                      "ml-auto h-3.5 w-3.5 transition-transform opacity-70",
                      !open && "-rotate-90",
                    )}
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {items.map((item) => {
                    const active = item.end
                      ? pathname === item.to
                      : pathname.startsWith(item.to);
                    const Icon = item.icon;
                    return (
                      <SidebarMenuSubItem key={item.to}>
                        <SidebarMenuSubButton asChild isActive={active}>
                          <NavLink to={item.to} end={item.end} onClick={onNavigate}>
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </SidebarMenu>
        </Collapsible>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
