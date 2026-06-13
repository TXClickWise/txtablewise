import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Settings2, ChevronDown } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { FloorPlanEditor } from "@/components/floor-plan/FloorPlanEditor";
import { TableCombinationsManager } from "@/components/floor-plan/TableCombinationsManager";

const WEEKDAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Ma" },
  { key: "tue", label: "Di" },
  { key: "wed", label: "Wo" },
  { key: "thu", label: "Do" },
  { key: "fri", label: "Vr" },
  { key: "sat", label: "Za" },
  { key: "sun", label: "Zo" },
];

type Zone = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  bookable_online: boolean;
  fill_priority: number;
  fill_threshold_pct: number;
  min_party_size: number;
  max_party_size: number;
  active_weekdays: string[];
  active_time_from: string | null;
  active_time_to: string | null;
  weather_dependent: boolean;
  weather_min_temp_c: number | null;
  weather_blocks_on_precipitation: boolean;
  is_terrace: boolean;
};
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
  const [fillStrategyEnabled, setFillStrategyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newZone, setNewZone] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [newTable, setNewTable] = useState<TableRow>({
    zone_id: null, label: "", capacity_min: 2, capacity_max: 4, shape: "round", combinable: true, is_active: true,
  });

  const persistZoneOrder = async (ordered: Zone[]) => {
    const results = await Promise.all(
      ordered.map((z, i) =>
        supabase.from("zones").update({ sort_order: i, fill_priority: i }).eq("id", z.id),
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
    const renumbered = next.map((z, i) => ({ ...z, sort_order: i, fill_priority: i }));
    setZones(renumbered);
    persistZoneOrder(renumbered);
  };

  const load = async () => {
    if (!rid) return;
    const [{ data: z }, { data: t }, { data: c }, { data: r }] = await Promise.all([
      supabase.from("zones").select("*").eq("restaurant_id", rid).order("fill_priority").order("sort_order"),
      supabase.from("tables").select("*").eq("restaurant_id", rid).order("label"),
      supabase.from("table_combinations").select("id, name, table_ids, is_active").eq("restaurant_id", rid),
      supabase.from("restaurants").select("fill_strategy_enabled").eq("id", rid).maybeSingle(),
    ]);
    setZones((z ?? []) as Zone[]);
    setTables((t ?? []) as TableRow[]);
    setCombos((c ?? []) as any);
    setFillStrategyEnabled(!!r?.fill_strategy_enabled);
    setLoading(false);
  };
  useEffect(() => { load(); }, [rid]);

  const combosForTable = (tableId: string) =>
    combos.filter((c) => c.is_active && c.table_ids.includes(tableId));

  const addZone = async () => {
    if (!rid || !newZone.trim()) return;
    const { error } = await supabase.from("zones").insert({
      restaurant_id: rid, name: newZone.trim(), sort_order: zones.length, fill_priority: zones.length,
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
  const updateZone = async (id: string, patch: Partial<Zone>) => {
    setZones((p) => p.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    const { error } = await supabase.from("zones").update(patch as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };
  const toggleBookableOnline = async (id: string, value: boolean) => {
    await updateZone(id, { bookable_online: value });
    toast.success(value ? "Zone zichtbaar in online widget" : "Zone verborgen in online widget");
  };
  const toggleFillStrategy = async (value: boolean) => {
    setFillStrategyEnabled(value);
    const { error } = await supabase.from("restaurants").update({ fill_strategy_enabled: value }).eq("id", rid!);
    if (error) {
      toast.error(error.message);
      setFillStrategyEnabled(!value);
    } else {
      toast.success(value ? "Vul-strategie geactiveerd" : "Vul-strategie uitgeschakeld");
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
        <CardHeader>
          <CardTitle className="font-display text-lg">Vul-strategie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-3">
            <Switch checked={fillStrategyEnabled} onCheckedChange={toggleFillStrategy} id="fill-strategy" />
            <div className="flex-1">
              <Label htmlFor="fill-strategy" className="text-sm font-medium cursor-pointer">
                Vul het restaurant in zone-volgorde
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong>Aan:</strong> online reserveringen, AI-voice en walk-in suggesties volgen de volgorde hieronder, met drempels en condities per zone.
                Sleep zones om de volgorde te bepalen. Per zone kan je condities instellen onder "Vul-regels".
                <br />
                <strong>Uit:</strong> het systeem kiest gewoon de eerstvolgende geschikte (combinatie van) tafel(s), zonder zone-volgorde of drempels.
                Combinaties van tafels uit verschillende zones (cross-zone) blijven altijd toegestaan — zet ze handmatig op of uit in de combinaties-sectie hieronder.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                onDragStart={(e) => { setDragIndex(idx); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dropIndex !== idx) setDropIndex(idx); }}
                onDragLeave={() => { if (dropIndex === idx) setDropIndex(null); }}
                onDrop={(e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== idx) reorderZones(dragIndex, idx); setDragIndex(null); setDropIndex(null); }}
                onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                className={cn(
                  "rounded-md transition-colors border border-transparent",
                  isDragging && "opacity-50",
                  showDropAbove && "border-t-2 border-t-primary",
                  showDropBelow && "border-b-2 border-b-primary",
                )}
              >
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    aria-label={`Sleep zone ${z.name}`}
                    className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-2 text-muted-foreground hover:text-foreground"
                    onPointerDown={() => setDragIndex(idx)}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground font-mono w-6 text-center">{idx + 1}</span>
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
                      Online
                    </Label>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => delZone(z.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>

                <Collapsible className="px-2 pb-2">
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1">
                    <Settings2 className="h-3 w-3" /> Vul-regels <ChevronDown className="h-3 w-3" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2 pl-2 border-l-2 border-border">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Vul tot (%)</Label>
                        <Input
                          type="number" min={10} max={100}
                          defaultValue={z.fill_threshold_pct}
                          onBlur={(e) => {
                            const v = Math.max(10, Math.min(100, parseInt(e.target.value) || 70));
                            if (v !== z.fill_threshold_pct) updateZone(z.id, { fill_threshold_pct: v });
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">Boven dit % opent de volgende zone.</p>
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Switch
                          id={`terrace-${z.id}`}
                          checked={z.is_terrace}
                          onCheckedChange={(v) => updateZone(z.id, { is_terrace: v })}
                        />
                        <Label htmlFor={`terrace-${z.id}`} className="text-xs cursor-pointer">
                          Dit is een terras
                        </Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Min. groep</Label>
                        <Input
                          type="number" min={1} max={50}
                          defaultValue={z.min_party_size}
                          onBlur={(e) => {
                            const v = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                            if (v !== z.min_party_size) updateZone(z.id, { min_party_size: v });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max. groep</Label>
                        <Input
                          type="number" min={1} max={50}
                          defaultValue={z.max_party_size}
                          onBlur={(e) => {
                            const v = Math.max(1, Math.min(50, parseInt(e.target.value) || 50));
                            if (v !== z.max_party_size) updateZone(z.id, { max_party_size: v });
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Actieve dagen</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {WEEKDAYS.map((d) => {
                          const on = (z.active_weekdays ?? []).includes(d.key);
                          return (
                            <button
                              key={d.key}
                              type="button"
                              className={cn(
                                "px-2 h-7 rounded text-xs border transition-colors",
                                on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground",
                              )}
                              onClick={() => {
                                const next = on
                                  ? (z.active_weekdays ?? []).filter((x) => x !== d.key)
                                  : [...(z.active_weekdays ?? []), d.key];
                                updateZone(z.id, { active_weekdays: next });
                              }}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Actief vanaf</Label>
                        <Input
                          type="time"
                          defaultValue={z.active_time_from?.slice(0, 5) ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value || null;
                            updateZone(z.id, { active_time_from: v });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Actief tot</Label>
                        <Input
                          type="time"
                          defaultValue={z.active_time_to?.slice(0, 5) ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value || null;
                            updateZone(z.id, { active_time_to: v });
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`weather-${z.id}`}
                          checked={z.weather_dependent}
                          onCheckedChange={(v) => updateZone(z.id, { weather_dependent: v })}
                        />
                        <Label htmlFor={`weather-${z.id}`} className="text-xs cursor-pointer">
                          Weer-afhankelijk (typisch terras)
                        </Label>
                      </div>
                      {z.weather_dependent && (
                        <div className="grid grid-cols-2 gap-3 pl-6">
                          <div>
                            <Label className="text-xs">Min. temperatuur (°C)</Label>
                            <Input
                              type="number"
                              defaultValue={z.weather_min_temp_c ?? 16}
                              onBlur={(e) => {
                                const v = e.target.value === "" ? null : parseFloat(e.target.value);
                                updateZone(z.id, { weather_min_temp_c: v });
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <Switch
                              id={`precip-${z.id}`}
                              checked={z.weather_blocks_on_precipitation}
                              onCheckedChange={(v) => updateZone(z.id, { weather_blocks_on_precipitation: v })}
                            />
                            <Label htmlFor={`precip-${z.id}`} className="text-xs cursor-pointer">
                              Blokkeer bij regen
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground pt-1">
            Sleep om de vul-volgorde te wijzigen. Zones zonder "Online" zijn verborgen in de gast-widget — medewerkers
            kunnen er nog steeds handmatig op plaatsen.
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
              const inactive = !t.is_active;
              return (
              <div key={t.id} className="space-y-1">
                <div className={cn("grid grid-cols-12 gap-2 items-center transition-opacity", inactive && "opacity-60")}>
                  <div className="col-span-2 flex items-center gap-1">
                    <Input value={t.label} onChange={(e) => updateTable(t.id!, { label: e.target.value })} />
                    {inactive && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                        Uit
                      </span>
                    )}
                  </div>
                  <Select value={t.zone_id ?? "none"} onValueChange={(v) => updateTable(t.id!, { zone_id: v === "none" ? null : v })}>
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen zone</SelectItem>
                      {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="col-span-2 flex items-center gap-1">
                    <Input type="number" value={t.capacity_min} onChange={(e) => updateTable(t.id!, { capacity_min: parseInt(e.target.value) || 1 })} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="number" value={t.capacity_max} onChange={(e) => updateTable(t.id!, { capacity_max: parseInt(e.target.value) || 1 })} />
                  </div>
                  <Select value={t.shape} onValueChange={(v) => updateTable(t.id!, { shape: v })}>
                    <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round">Rond</SelectItem>
                      <SelectItem value="square">Vierkant</SelectItem>
                      <SelectItem value="rect">Rechthoek</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="col-span-2 flex items-center justify-center gap-2" title="Uit = tafel is tijdelijk niet beschikbaar voor reserveringen of walk-ins. Blijft zichtbaar op de plattegrond.">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={async (v) => {
                        await updateTable(t.id!, { is_active: v });
                        toast.success(v ? `Tafel ${t.label} is weer beschikbaar.` : `Tafel ${t.label} staat op niet-beschikbaar.`);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{t.is_active ? "Aan" : "Uit"}</span>
                  </div>
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
