import { LayoutDashboard, CalendarDays, Map, Users, Settings, BookOpen } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { title: "Vandaag", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Reserveringen", url: "/app/reserveringen", icon: BookOpen },
  { title: "Tafelplan", url: "/app/tafelplan", icon: Map },
  { title: "Gasten", url: "/app/gasten", icon: Users },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays },
  { title: "Instellingen", url: "/app/instellingen", icon: Settings },
];

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
        <SidebarGroup>
          <SidebarGroupLabel>Operatie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.end
                  ? location.pathname === item.url
                  : location.pathname.startsWith(item.url);
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
