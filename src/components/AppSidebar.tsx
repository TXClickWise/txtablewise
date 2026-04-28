import {
  LayoutDashboard, CalendarDays, Map, Users, Settings, BookOpen,
  Hand, ListChecks, UsersRound, BellOff, Wine, Star, Bot, BarChart3, Plug, Tablet, ShieldCheck, Phone,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { title: string; url: string; icon: typeof LayoutDashboard; end?: boolean };

const operatie: Item[] = [
  { title: "Vandaag", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Reserveringen", url: "/app/reserveringen", icon: BookOpen },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays },
  { title: "Tafelplan", url: "/app/tafelplan", icon: Map },
  { title: "Floor Mode", url: "/app/floor", icon: Tablet },
  { title: "Walk-ins", url: "/app/walk-ins", icon: Hand },
  { title: "Wachtlijst", url: "/app/wachtlijst", icon: ListChecks },
];

const gasten: Item[] = [
  { title: "Gasten", url: "/app/gasten", icon: Users },
  { title: "Grote groepen", url: "/app/grote-groepen", icon: UsersRound },
];

const hospitality: Item[] = [
  { title: "No-show preventie", url: "/app/no-show", icon: BellOff },
  { title: "Drankjes vooraf", url: "/app/drankjes", icon: Wine },
  { title: "Reviews & aftercare", url: "/app/reviews", icon: Star },
  { title: "AI Host", url: "/app/ai-host", icon: Bot },
  { title: "Voice Agent", url: "/app/voice-agent", icon: Phone },
];

const beheer: Item[] = [
  { title: "Rapportages", url: "/app/rapportages", icon: BarChart3 },
  { title: "Integraties", url: "/app/integraties", icon: Plug },
  { title: "Integratie-logs", url: "/app/integraties/logs", icon: Plug },
  { title: "Pilot readiness", url: "/app/pilot-readiness", icon: ShieldCheck },
  { title: "Instellingen", url: "/app/instellingen", icon: Settings },
];

function Group({ label, items, collapsed, pathname }: { label: string; items: Item[]; collapsed: boolean; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active}>
                  <NavLink to={item.url} end={item.end}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const { current } = useRestaurant();
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn("px-2 py-2", collapsed && "px-0 text-center")}>
          <div className="font-display text-lg text-sidebar-primary leading-tight">
            {collapsed ? "TW" : "TableWise"}
          </div>
          {!collapsed && current && (
            <div className="text-xs text-sidebar-foreground/60 truncate">{current.restaurants.name}</div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <Group label="Operatie" items={operatie} collapsed={collapsed} pathname={location.pathname} />
        <Group label="Gasten" items={gasten} collapsed={collapsed} pathname={location.pathname} />
        <Group label="Hospitality" items={hospitality} collapsed={collapsed} pathname={location.pathname} />
        <Group label="Beheer" items={beheer} collapsed={collapsed} pathname={location.pathname} />
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
