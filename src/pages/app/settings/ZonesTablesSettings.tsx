import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { FloorPlanEditor } from "@/components/floor-plan/FloorPlanEditor";
import { TableCombinationsManager } from "@/components/floor-plan/TableCombinationsManager";

type Zone = { id: string; name: string; sort_order: number; is_active: boolean; bookable_online: boolean };
type TableRow = {
  id?: string;
  zone_id: string | null;
  label: string;
  capacity_min: number;
  capacity_max: number;
  shape: string;
  combinable: boolean;
  is_active: boolean;
};

export default function ZonesTablesSettings() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [combos, setCombos] = useState<{ id: string; name: string; table_ids: string[]; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newZone, setNewZone] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [newTable, setNewTable] = useState<TableRow>({
    zone_id: null, label: "", capacity_min: 2, capacity_max: 4, shape: "round", combinable: true, is_active: true,
  });

  const persistZoneOrder = async (ordered: Zone[]) => {
    const updates = ordered
      .map((z, i) => ({ id: z.id, sort_order: i }))
      .filter((u, i) => ordered[i].sort_order !== i);
    if (updates.length === 0) return;
    // Optimistic UI is al toegepast; persist één voor één.
    const results = await Promise.all(
      updates.map((u) =>
        supabase.from("zones").update({ sort_order: u.sort_order }).eq("id", u.id),
      ),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      toast.error(firstErr.message);
      load();
    }
  };

  const reorderZones = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= zones.length || to >= zones.length) return;
    const next = [...zones];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const renumbered = next.map((z, i) => ({ ...z, sort_order: i }));
    setZones(renumbered);
    persistZoneOrder(renumbered);
  };

  const load = async () => {
    if (!rid) return;
    const [{ data: z }, { data: t }, { data: c }] = await Promise.all([
      supabase.from("zones").select("*").eq("restaurant_id", rid).order("sort_order"),
      supabase.from("tables").select("*").eq("restaurant_id", rid).order("label"),
      supabase.from("table_combinations").select("id, name, table_ids, is_active").eq("restaurant_id", rid),
    ]);
    setZones(z ?? []);
    setTables((t ?? []) as TableRow[]);
    setCombos((c ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [rid]);

  const combosForTable = (tableId: string) =>
    combos.filter((c) => c.is_active && c.table_ids.includes(tableId));

  const addZone = async () => {
    if (!rid || !newZone.trim()) return;
    const { error } = await supabase.from("zones").insert({
      restaurant_id: rid, name: newZone.trim(), sort_order: zones.length,
    });
    if (error) return toast.error(error.message);
    setNewZone(""); load();
  };
  const delZone = async (id: string) => {
    const { error } = await supabase.from("zones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const renameZone = async (id: string, name: string) => {
    await supabase.from("zones").update({ name }).eq("id", id);
  };
  const toggleBookableOnline = async (id: string, value: boolean) => {
    setZones((p) => p.map((z) => (z.id === id ? { ...z, bookable_online: value } : z)));
    const { error } = await supabase.from("zones").update({ bookable_online: value }).eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success(value ? "Zone zichtbaar in online widget" : "Zone verborgen in online widget");
    }
  };

  const addTable = async () => {
    if (!rid || !newTable.label.trim()) return toast.error("Label vereist");
    const { error } = await supabase.from("tables").insert({ ...newTable, restaurant_id: rid });
    if (error) return toast.error(error.message);
    setNewTable({ ...newTable, label: "" });
    load();
  };
  const updateTable = async (id: string, patch: Partial<TableRow>) => {
    const { error } = await supabase.from("tables").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    setTables((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const delTable = async (id: string) => {
    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTables((p) => p.filter((t) => t.id !== id));
  };

  if (loading) return <p className="text-muted-foreground text-sm">Laden…</p>;

  return (
    <Tabs defaultValue="list" className="space-y-4">
      <TabsList>
        <TabsTrigger value="list">Lijst</TabsTrigger>
        <TabsTrigger value="plan">Plattegrond</TabsTrigger>
      </TabsList>

      <TabsContent value="plan" className="space-y-4">
        {rid && <FloorPlanEditor restaurantId={rid} />}
      </TabsContent>

      <TabsContent value="list" className="space-y-6">
      <Card>

        <CardHeader><CardTitle className="font-display text-lg">Zones</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {zones.length === 0 && <p className="text-sm text-muted-foreground">Nog geen zones.</p>}
          {zones.map((z, idx) => {
            const isDragging = dragIndex === idx;
            const showDropAbove = dropIndex === idx && dragIndex !== null && dragIndex > idx;
            const showDropBelow = dropIndex === idx && dragIndex !== null && dragIndex < idx;
            return (
              <div
                key={z.id}
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropIndex !== idx) setDropIndex(idx);
                }}
                onDragLeave={() => {
                  if (dropIndex === idx) setDropIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== idx) reorderZones(dragIndex, idx);
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={cn(
                  "flex gap-2 items-center rounded-md transition-colors",
                  isDragging && "opacity-50",
                  showDropAbove && "border-t-2 border-primary",
                  showDropBelow && "border-b-2 border-primary",
                )}
              >
                <button
                  type="button"
                  aria-label={`Sleep zone ${z.name} om te herordenen`}
                  className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-2 text-muted-foreground hover:text-foreground"
                  onPointerDown={(e) => {
                    // Stel dragIndex meteen in zodat touch ook werkt waar de browser het ondersteunt.
                    setDragIndex(idx);
                  }}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <Input
                  defaultValue={z.name}
                  onBlur={(e) => e.target.value !== z.name && renameZone(z.id, e.target.value)}
                />
                <div className="flex items-center gap-2 shrink-0 px-2">
                  <Switch
                    id={`online-${z.id}`}
                    checked={z.bookable_online}
                    onCheckedChange={(v) => toggleBookableOnline(z.id, v)}
                  />
                  <Label htmlFor={`online-${z.id}`} className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                    Online reserveren
                  </Label>
                </div>
                <Button variant="ghost" size="icon" onClick={() => delZone(z.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground pt-1">
            Zones zonder "Online reserveren" zijn verborgen in de gast-widget. Medewerkers kunnen er nog steeds handmatig walk-ins en reserveringen op plaatsen.
          </p>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Input placeholder="Nieuwe zone (bv. Terras)" value={newZone} onChange={(e) => setNewZone(e.target.value)} />
            <Button onClick={addZone}><Plus className="h-4 w-4 mr-1" /> Toevoegen</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Tafels</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {tables.length === 0 && <p className="text-sm text-muted-foreground">Nog geen tafels.</p>}
          <div className="space-y-2">
            {tables.map((t) => {
              const inCombos = combosForTable(t.id!);
              return (
              <div key={t.id} className="space-y-1">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-2" value={t.label} onChange={(e) => updateTable(t.id!, { label: e.target.value })} />
                  <Select value={t.zone_id ?? "none"} onValueChange={(v) => updateTable(t.id!, { zone_id: v === "none" ? null : v })}>
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen zone</SelectItem>
                      {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="col-span-3 flex items-center gap-1">
                    <Input type="number" value={t.capacity_min} onChange={(e) => updateTable(t.id!, { capacity_min: parseInt(e.target.value) || 1 })} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="number" value={t.capacity_max} onChange={(e) => updateTable(t.id!, { capacity_max: parseInt(e.target.value) || 1 })} />
                  </div>
                  <Select value={t.shape} onValueChange={(v) => updateTable(t.id!, { shape: v })}>
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round">Rond</SelectItem>
                      <SelectItem value="square">Vierkant</SelectItem>
                      <SelectItem value="rect">Rechthoek</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => delTable(t.id!)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {inCombos.length > 0 && (
                  <p className="text-[11px] text-muted-foreground pl-1">
                    Onderdeel van: {inCombos.map((c) => c.name).join(", ")}
                  </p>
                )}
              </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Nieuwe tafel</Label>
            <div className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-2" placeholder="T1" value={newTable.label} onChange={(e) => setNewTable({ ...newTable, label: e.target.value })} />
              <Select value={newTable.zone_id ?? "none"} onValueChange={(v) => setNewTable({ ...newTable, zone_id: v === "none" ? null : v })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen zone</SelectItem>
                  {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="col-span-2 flex items-center gap-1">
                <Input type="number" value={newTable.capacity_min} onChange={(e) => setNewTable({ ...newTable, capacity_min: parseInt(e.target.value) || 1 })} />
                <span className="text-muted-foreground">–</span>
                <Input type="number" value={newTable.capacity_max} onChange={(e) => setNewTable({ ...newTable, capacity_max: parseInt(e.target.value) || 1 })} />
              </div>
              <Select value={newTable.shape} onValueChange={(v) => setNewTable({ ...newTable, shape: v })}>
                <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">Rond</SelectItem>
                  <SelectItem value="square">Vierkant</SelectItem>
                  <SelectItem value="rect">Rechthoek</SelectItem>
                </SelectContent>
              </Select>
              <Button className="col-span-3" onClick={addTable}><Plus className="h-4 w-4 mr-1" /> Toevoegen</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {rid && <TableCombinationsManager restaurantId={rid} />}
      </TabsContent>
    </Tabs>
  );
}
