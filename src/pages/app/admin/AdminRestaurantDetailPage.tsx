import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRightLeft, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { usePilotReadiness } from "@/hooks/usePilotReadiness";
import { format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminRestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setAdminOverride } = useRestaurant();

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["admin-restaurant", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["admin-restaurant-members", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: m } = await supabase
        .from("restaurant_members")
        .select("user_id, role, created_at")
        .eq("restaurant_id", id!);
      const userIds = (m ?? []).map((x) => x.user_id);
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : { data: [] };
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.display_name]));
      return (m ?? []).map((x) => ({ ...x, name: map.get(x.user_id) ?? "Onbekend" }));
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-restaurant-stats", id],
    enabled: !!id,
    queryFn: async () => {
      const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [
        { count: resTotal },
        { count: res7d },
        { count: guestTotal },
        { count: tableTotal },
        { count: zoneTotal },
        { data: latest },
      ] = await Promise.all([
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("restaurant_id", id!),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("restaurant_id", id!).gte("created_at", since7),
        supabase.from("guests").select("id", { count: "exact", head: true }).eq("restaurant_id", id!),
        supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", id!).eq("is_active", true),
        supabase.from("zones").select("id", { count: "exact", head: true }).eq("restaurant_id", id!).eq("is_active", true),
        supabase.from("reservations").select("start_time").eq("restaurant_id", id!).order("start_time", { ascending: false }).limit(1),
      ]);
      return {
        resTotal: resTotal ?? 0,
        res7d: res7d ?? 0,
        guestTotal: guestTotal ?? 0,
        tableTotal: tableTotal ?? 0,
        zoneTotal: zoneTotal ?? 0,
        latestReservation: latest?.[0]?.start_time ?? null,
      };
    },
  });

  const { data: integrations } = useQuery({
    queryKey: ["admin-restaurant-integrations", id],
    enabled: !!id,
    queryFn: async () => {
      const [cw, voice, pos] = await Promise.all([
        supabase.from("clickwise_settings").select("connection_mode").eq("restaurant_id", id!).maybeSingle(),
        supabase.from("agent_api_keys").select("id, revoked_at").eq("restaurant_id", id!).is("revoked_at", null),
        supabase.from("pos_connections").select("id, provider, status").eq("restaurant_id", id!),
      ]);
      return {
        clickwise: cw.data?.connection_mode ?? "disabled",
        voice: (voice.data ?? []).length,
        pos: pos.data ?? [],
      };
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["admin-restaurant-audit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("id, action, entity, created_at, actor_label")
        .eq("restaurant_id", id!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const readiness = usePilotReadiness(id);

  if (isLoading) return <div className="p-6 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!restaurant) return <div className="p-6 text-muted-foreground">Restaurant niet gevonden.</div>;

  const handleWorkAs = () => {
    setAdminOverride(restaurant.id);
    toast.success("Je werkt nu in de context van dit restaurant");
    navigate("/app");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/app/admin/restaurants")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Terug naar overzicht
      </Button>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl">{restaurant.name}</h1>
              <Badge variant={restaurant.plan === "pro" ? "default" : "secondary"} className="capitalize">{restaurant.plan}</Badge>
              {restaurant.is_live ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Live</Badge>
              ) : (
                <Badge variant="outline">Niet live</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">/{restaurant.slug} · {restaurant.timezone}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aangemaakt {formatDistanceToNow(new Date(restaurant.created_at), { addSuffix: true, locale: nl })}
              {restaurant.marked_live_at && ` · Live sinds ${format(new Date(restaurant.marked_live_at), "d MMM yyyy", { locale: nl })}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(`/r/${restaurant.slug}`, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Open widget
            </Button>
            <Button onClick={handleWorkAs}>
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Werk als dit restaurant
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Algemeen</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row label="E-mail" value={restaurant.email} />
            <Row label="Telefoon" value={restaurant.phone} />
            <Row label="Adres" value={[restaurant.address_line1, restaurant.postal_code, restaurant.city].filter(Boolean).join(", ") || null} />
            <Row label="Plan" value={restaurant.plan} />
            <Row label="Plan type" value={restaurant.plan_type} />
            <Row label="Live status" value={restaurant.is_live ? "Live" : "Niet live"} />
            <Row label="Trial eindigt" value={restaurant.trial_ends_at ? format(new Date(restaurant.trial_ends_at), "d MMM yyyy", { locale: nl }) : null} />
          </CardContent>
        </Card>

        <PlatformBaseUrlCard
          restaurantId={restaurant.id}
          initial={(restaurant as any).public_base_url ?? ""}
        />

        <Card>
          <CardHeader><CardTitle className="text-base">Statistieken</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Reserveringen totaal" value={stats?.resTotal ?? 0} />
            <Stat label="Deze week" value={stats?.res7d ?? 0} />
            <Stat label="Gasten" value={stats?.guestTotal ?? 0} />
            <Stat label="Actieve tafels" value={stats?.tableTotal ?? 0} />
            <Stat label="Actieve zones" value={stats?.zoneTotal ?? 0} />
            <Stat label="Laatste reservering" value={stats?.latestReservation ? format(new Date(stats.latestReservation), "d MMM", { locale: nl }) : "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Team
              <Badge variant="outline">{members.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {members.length === 0 && <p className="text-muted-foreground">Geen teamleden.</p>}
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between border-b border-border last:border-0 pb-2">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">Toegevoegd {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: nl })}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{m.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Integraties</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="ClickWise" value={integrations?.clickwise ?? "—"} />
            <Row label="Voice AI" value={(integrations?.voice ?? 0) > 0 ? `${integrations?.voice} actieve key(s)` : "Geen keys"} />
            <Row label="POS" value={integrations?.pos.length ? integrations.pos.map((p: any) => `${p.provider} (${p.status})`).join(", ") : "Geen koppeling"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Configuratie-gezondheid</CardTitle></CardHeader>
          <CardContent>
            {readiness.isLoading ? (
              <Skeleton className="h-32" />
            ) : !readiness.data ? (
              <p className="text-sm text-muted-foreground">Geen data.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {readiness.data.items.map((it) => (
                  <div key={it.key} className="flex items-start gap-2 text-sm">
                    {it.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className={`h-4 w-4 shrink-0 mt-0.5 ${it.required ? "text-destructive" : "text-muted-foreground"}`} />
                    )}
                    <div>
                      <div>{it.label}</div>
                      {!it.ok && it.hint && <div className="text-xs text-muted-foreground">{it.hint}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recente activiteit</CardTitle></CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen activiteit.</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {audit.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between border-b border-border last:border-0 pb-1.5">
                    <div>
                      <span className="font-medium">{a.action}</span>
                      <span className="text-muted-foreground"> · {a.entity}</span>
                      {a.actor_label && <span className="text-xs text-muted-foreground"> ({a.actor_label})</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: nl })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right truncate">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-display tabular-nums">{value}</div>
    </div>
  );
}
