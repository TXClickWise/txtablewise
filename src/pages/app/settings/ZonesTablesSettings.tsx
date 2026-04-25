import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Zone = { id: string; name: string; sort_order: number; is_active: boolean };
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
  const [loading, setLoading] = useState(true);
  const [newZone, setNewZone] = useState("");
  const [newTable, setNewTable] = useState<TableRow>({
    zone_id: null, label: "", capacity_min: 2, capacity_max: 4, shape: "round", combinable: true, is_active: true,
  });

  const load = async () => {
    if (!rid) return;
    const [{ data: z }, { data: t }] = await Promise.all([
      supabase.from("zones").select("*").eq("restaurant_id", rid).order("sort_order"),
      supabase.from("tables").select("*").eq("restaurant_id", rid).order("label"),
    ]);
    setZones(z ?? []);
    setTables((t ?? []) as TableRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [rid]);

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
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Zones</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {zones.length === 0 && <p className="text-sm text-muted-foreground">Nog geen zones.</p>}
          {zones.map((z) => (
            <div key={z.id} className="flex gap-2 items-center">
              <Input
                defaultValue={z.name}
                onBlur={(e) => e.target.value !== z.name && renameZone(z.id, e.target.value)}
              />
              <Button variant="ghost" size="icon" onClick={() => delZone(z.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
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
            {tables.map((t) => (
              <div key={t.id} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-2" value={t.label} onChange={(e) => updateTable(t.id!, { label: e.target.value })} />
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
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={t.combinable} onCheckedChange={(v) => updateTable(t.id!, { combinable: v })} />
                  <span className="text-xs text-muted-foreground">Combineer</span>
                </div>
                <Button variant="ghost" size="icon" className="col-span-1" onClick={() => delTable(t.id!)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
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
    </div>
  );
}
