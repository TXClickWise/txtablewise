import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Store, Search, MoreVertical, Eye, ArrowRightLeft, ToggleLeft, ToggleRight, Plus, ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  plan: "trial" | "basic" | "pro";
  is_live: boolean;
  created_at: string;
};

type EnrichedRow = RestaurantRow & {
  owner_email: string | null;
  table_count: number;
  reservations_7d: number;
};

export default function AdminRestaurantsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setAdminOverride } = useRestaurant();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [liveFilter, setLiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "created" | "reservations">("created");
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmLive, setConfirmLive] = useState<EnrichedRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-restaurants"],
    queryFn: async (): Promise<EnrichedRow[]> => {
      const { data: rests, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, plan, is_live, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (rests ?? []) as RestaurantRow[];
      const ids = list.map((r) => r.id);
      if (ids.length === 0) return [];

      // Owners
      const { data: owners } = await supabase
        .from("restaurant_members")
        .select("restaurant_id, user_id")
        .in("restaurant_id", ids)
        .eq("role", "owner");
      const ownerUserIds = Array.from(new Set((owners ?? []).map((o) => o.user_id)));
      const { data: profiles } = ownerUserIds.length
        ? await supabase.from("profiles").select("user_id, display_name").in("user_id", ownerUserIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
      const ownerMap = new Map<string, string | null>();
      for (const o of owners ?? []) {
        if (!ownerMap.has(o.restaurant_id)) {
          ownerMap.set(o.restaurant_id, profileMap.get(o.user_id) ?? null);
        }
      }

      // Tables count
      const tableCounts = new Map<string, number>();
      await Promise.all(
        ids.map(async (rid) => {
          const { count } = await supabase
            .from("tables")
            .select("id", { count: "exact", head: true })
            .eq("restaurant_id", rid)
            .eq("is_active", true);
          tableCounts.set(rid, count ?? 0);
        })
      );

      // Reservations 7d
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const resCounts = new Map<string, number>();
      await Promise.all(
        ids.map(async (rid) => {
          const { count } = await supabase
            .from("reservations")
            .select("id", { count: "exact", head: true })
            .eq("restaurant_id", rid)
            .gte("created_at", since);
          resCounts.set(rid, count ?? 0);
        })
      );

      return list.map((r) => ({
        ...r,
        owner_email: ownerMap.get(r.id) ?? null,
        table_count: tableCounts.get(r.id) ?? 0,
        reservations_7d: resCounts.get(r.id) ?? 0,
      }));
    },
  });

  const kpis = useMemo(() => {
    return {
      total: rows.length,
      live: rows.filter((r) => r.is_live).length,
      trial: rows.filter((r) => r.plan === "trial").length,
      activeWeek: rows.filter((r) => r.reservations_7d > 0).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
    }
    if (planFilter !== "all") list = list.filter((r) => r.plan === planFilter);
    if (liveFilter !== "all") list = list.filter((r) => (liveFilter === "live" ? r.is_live : !r.is_live));
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "reservations") return b.reservations_7d - a.reservations_7d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [rows, search, planFilter, liveFilter, sortBy]);

  const togglePlan = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: "trial" | "basic" | "pro" }) => {
      const { error } = await supabase.from("restaurants").update({ plan }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan bijgewerkt");
      qc.invalidateQueries({ queryKey: ["admin-restaurants"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleLive = useMutation({
    mutationFn: async ({ id, makeLive }: { id: string; makeLive: boolean }) => {
      const { error } = await supabase
        .from("restaurants")
        .update({ is_live: makeLive, marked_live_at: makeLive ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.makeLive ? "Restaurant is nu live" : "Live-status uitgezet");
      qc.invalidateQueries({ queryKey: ["admin-restaurants"] });
      setConfirmLive(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleWorkAs = (id: string) => {
    setAdminOverride(id);
    toast.success("Je werkt nu in de context van dit restaurant");
    navigate("/app");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            Restaurants
          </h1>
          <p className="text-sm text-muted-foreground">Beheer alle klanten van het platform.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nieuw restaurant
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Totaal" value={kpis.total} />
        <KpiCard label="Live" value={kpis.live} accent="emerald" />
        <KpiCard label="Trial" value={kpis.trial} accent="amber" />
        <KpiCard label="Actief deze week" value={kpis.activeWeek} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alle restaurants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek op naam of slug…"
                className="pl-9"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle plannen</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={liveFilter} onValueChange={setLiveFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="not_live">Niet live</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Sorteer: aangemaakt</SelectItem>
                <SelectItem value="name">Sorteer: naam</SelectItem>
                <SelectItem value="reservations">Sorteer: reserveringen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Geen restaurants gevonden.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Eigenaar</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Tafels</TableHead>
                    <TableHead className="text-right">Res (7d)</TableHead>
                    <TableHead>Aangemaakt</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <button
                          onClick={() => navigate(`/app/admin/restaurants/${r.id}`)}
                          className="text-left hover:underline"
                        >
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">/{r.slug}</div>
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.owner_email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.plan === "pro" ? "default" : "secondary"} className="capitalize">
                          {r.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.is_live ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Live</Badge>
                        ) : (
                          <Badge variant="outline">Niet live</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.table_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.reservations_7d}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: nl })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => navigate(`/app/admin/restaurants/${r.id}`)}>
                              <Eye className="h-4 w-4 mr-2" /> Bekijk details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleWorkAs(r.id)}>
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> Werk als dit restaurant
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/r/${r.slug}`, "_blank")}>
                              <ExternalLink className="h-4 w-4 mr-2" /> Open widget
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setConfirmLive(r)}>
                              {r.is_live ? <ToggleLeft className="h-4 w-4 mr-2" /> : <ToggleRight className="h-4 w-4 mr-2" />}
                              {r.is_live ? "Markeer als niet-live" : "Markeer als live"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Plan wijzigen</DropdownMenuLabel>
                            {(["trial", "basic", "pro"] as const).map((p) => (
                              <DropdownMenuItem
                                key={p}
                                disabled={r.plan === p}
                                onClick={() => togglePlan.mutate({ id: r.id, plan: p })}
                              >
                                <span className="capitalize">{p}</span>
                                {r.plan === p && <span className="ml-auto text-xs text-muted-foreground">huidig</span>}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRestaurantSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => {
        qc.invalidateQueries({ queryKey: ["admin-restaurants"] });
        navigate(`/app/admin/restaurants/${id}`);
      }} />

      <AlertDialog open={!!confirmLive} onOpenChange={(o) => !o && setConfirmLive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmLive?.is_live ? "Live-status uitzetten?" : "Markeren als live?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmLive?.is_live
                ? `${confirmLive?.name} verschijnt niet meer als live restaurant.`
                : `${confirmLive?.name} wordt gemarkeerd als live klant.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmLive && toggleLive.mutate({ id: confirmLive.id, makeLive: !confirmLive.is_live })}>
              Bevestig
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "amber" }) {
  const tone =
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "amber" ? "text-amber-600 dark:text-amber-400"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-3xl font-display mt-1 ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CreateRestaurantSheet({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [plan, setPlan] = useState<"trial" | "basic" | "pro">("trial");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");
  const [submitting, setSubmitting] = useState(false);

  const slugFromName = (n: string) =>
    n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Naam en slug zijn verplicht");
      return;
    }
    setSubmitting(true);
    try {
      // Look up owner user (if exists) by email via profiles? profiles has display_name only.
      // We can't easily resolve email->user_id from client. Create restaurant standalone if no owner found.
      let ownerUserId: string | null = null;
      if (ownerEmail.trim()) {
        // Try to find by display_name match (best-effort) — otherwise skip.
        // Without an email column on profiles we cannot reliably match; leave null.
      }

      // Direct insert (system admin policy allows)
      const { data: created, error } = await supabase
        .from("restaurants")
        .insert({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          timezone,
          plan,
          plan_started_at: new Date().toISOString(),
          trial_ends_at: plan === "trial" ? new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString() : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (ownerUserId) {
        await supabase.from("restaurant_members").insert({
          restaurant_id: created.id,
          user_id: ownerUserId,
          role: "owner",
        });
      } else if (ownerEmail.trim()) {
        toast.info("Restaurant aangemaakt. Eigenaar moet nog handmatig worden gekoppeld.");
      }
      toast.success("Restaurant aangemaakt");
      onCreated(created.id);
      onOpenChange(false);
      setName(""); setSlug(""); setOwnerEmail(""); setPlan("trial");
    } catch (e: any) {
      toast.error(e.message ?? "Aanmaken mislukt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nieuw restaurant</SheetTitle>
          <SheetDescription>Maak een nieuwe klantomgeving aan.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Naam</Label>
            <Input value={name} onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === slugFromName(name)) setSlug(slugFromName(e.target.value));
            }} placeholder="Restaurant De Hoek" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="de-hoek" />
            <p className="text-xs text-muted-foreground mt-1">Wordt gebruikt in /r/{slug || "slug"}</p>
          </div>
          <div>
            <Label>Eigenaar e-mail (optioneel)</Label>
            <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="eigenaar@restaurant.nl" type="email" />
            <p className="text-xs text-muted-foreground mt-1">Eigenaar moet later handmatig worden gekoppeld via Team-instellingen.</p>
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v: any) => setPlan(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial (14 dagen)</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tijdzone</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Aanmaken…" : "Aanmaken"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
