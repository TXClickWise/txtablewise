import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Plus, Trash2, Pencil, Combine, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

type TableRow = {
  id: string;
  label: string;
  zone_id: string | null;
  capacity_min: number;
  capacity_max: number;
};
type ZoneRow = { id: string; name: string };
type Combination = {
  id: string;
  restaurant_id: string;
  name: string;
  table_ids: string[];
  capacity_min: number;
  capacity_max: number;
  is_active: boolean;
};

type FormState = {
  id?: string;
  name: string;
  table_ids: string[];
  capacity_min: number;
  capacity_max: number;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  table_ids: [],
  capacity_min: 2,
  capacity_max: 4,
  is_active: true,
};

export function TableCombinationsManager({ restaurantId }: { restaurantId: string }) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [combos, setCombos] = useState<Combination[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: z }, { data: c }] = await Promise.all([
      supabase.from("tables").select("id, label, zone_id, capacity_min, capacity_max")
        .eq("restaurant_id", restaurantId).eq("is_active", true).order("label"),
      supabase.from("zones").select("id, name").eq("restaurant_id", restaurantId).order("sort_order"),
      supabase.from("table_combinations").select("*")
        .eq("restaurant_id", restaurantId).order("name"),
    ]);
    setTables((t ?? []) as TableRow[]);
    setZones((z ?? []) as ZoneRow[]);
    setCombos((c ?? []) as Combination[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const tableLabel = (id: string) => tables.find((t) => t.id === id)?.label ?? "?";
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Geen zone";

  const startNew = () => { setForm(emptyForm); setOpen(true); };
  const startEdit = (c: Combination) => {
    setForm({
      id: c.id,
      name: c.name,
      table_ids: c.table_ids,
      capacity_min: c.capacity_min,
      capacity_max: c.capacity_max,
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const totalCapacity = form.table_ids.reduce(
    (sum, id) => sum + (tables.find((t) => t.id === id)?.capacity_max ?? 0),
    0,
  );

  const validate = (): string | null => {
    if (!form.name.trim()) return "Naam is verplicht";
    if (form.table_ids.length < 2) return "Selecteer minimaal 2 tafels";
    if (form.capacity_min < 1) return "Min. personen ≥ 1";
    if (form.capacity_max < form.capacity_min) return "Max ≥ min";
    if (totalCapacity > 0 && form.capacity_max > totalCapacity) {
      return `Max kan niet hoger zijn dan som van tafelcapaciteiten (${totalCapacity})`;
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      table_ids: form.table_ids,
      capacity_min: form.capacity_min,
      capacity_max: form.capacity_max,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("table_combinations").update(payload).eq("id", form.id)
      : await supabase.from("table_combinations").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Combinatie bijgewerkt" : "Combinatie aangemaakt");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Combinatie verwijderen?")) return;
    const { error } = await supabase.from("table_combinations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const toggleTable = (id: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      table_ids: checked ? [...f.table_ids, id] : f.table_ids.filter((x) => x !== id),
    }));
  };

  const toggleActive = async (c: Combination) => {
    const { error } = await supabase.from("table_combinations")
      .update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Combine className="h-4 w-4" /> Tafelcombinaties
          </CardTitle>
          <CardDescription>
            Definieer welke tafels samen één grotere tafel vormen voor groepen.
          </CardDescription>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button onClick={startNew} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nieuwe combinatie
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{form.id ? "Combinatie bewerken" : "Nieuwe combinatie"}</SheetTitle>
              <SheetDescription>
                Selecteer 2 of meer tafels en geef de capaciteit op.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 py-5">
              <div className="space-y-2">
                <Label>Naam</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="bv. Bankzijde groot"
                />
              </div>
              <div className="space-y-2">
                <Label>Tafels in combinatie</Label>
                {tables.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen tafels — voeg eerst tafels toe.</p>
                ) : (
                  <div className="rounded-md border border-border max-h-72 overflow-y-auto divide-y divide-border">
                    {tables.map((t) => {
                      const checked = form.table_ids.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleTable(t.id, !!v)}
                          />
                          <div className="flex-1 min-w-0 text-sm">
                            <span className="font-medium">{t.label}</span>
                            <span className="text-muted-foreground"> · {zoneName(t.zone_id)} · {t.capacity_min}-{t.capacity_max}p</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Som van capaciteiten: <strong>{totalCapacity}</strong> personen
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min. personen</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.capacity_min}
                    onChange={(e) => setForm({ ...form, capacity_min: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max. personen</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.capacity_max}
                    onChange={(e) => setForm({ ...form, capacity_max: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Actief</p>
                  <p className="text-xs text-muted-foreground">Alleen actieve combinaties worden ingezet.</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
            <SheetFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annuleren</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Opslaan…" : "Opslaan"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : combos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen tafelcombinaties. Maak er één aan voor groepen die meerdere tafels nodig hebben.
          </p>
        ) : (
          <div className="space-y-2">
            {combos.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{c.name}</p>
                    {!c.is_active && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        inactief
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.table_ids.map(tableLabel).join(" + ")} · {c.capacity_min}–{c.capacity_max} personen
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                  <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
