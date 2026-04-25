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

const WEEKDAYS = [
  { key: "mon", label: "Ma" },
  { key: "tue", label: "Di" },
  { key: "wed", label: "Wo" },
  { key: "thu", label: "Do" },
  { key: "fri", label: "Vr" },
  { key: "sat", label: "Za" },
  { key: "sun", label: "Zo" },
] as const;

type Shift = {
  id?: string;
  name: string;
  start_time: string;
  end_time: string;
  weekdays: string[];
  max_guests: number | null;
  is_active: boolean;
};

const empty: Shift = { name: "", start_time: "17:00", end_time: "22:00", weekdays: [], max_guests: null, is_active: true };

export default function ShiftsSettings() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!rid) return;
    const { data } = await supabase.from("shifts").select("*").eq("restaurant_id", rid).order("start_time");
    setShifts(
      (data ?? []).map((s: any) => ({
        ...s,
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5),
      }))
    );
    setLoading(false);
  };
  useEffect(() => { load(); }, [rid]);

  const update = (i: number, patch: Partial<Shift>) => setShifts((p) => p.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const toggleDay = (i: number, day: string) => {
    const s = shifts[i];
    update(i, { weekdays: s.weekdays.includes(day) ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day] });
  };

  const save = async (i: number) => {
    if (!rid) return;
    const s = shifts[i];
    if (!s.name) return toast.error("Naam vereist");
    const payload: any = { ...s, restaurant_id: rid };
    if (s.id) {
      const { error } = await supabase.from("shifts").update(payload).eq("id", s.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("shifts").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Opgeslagen");
    load();
  };

  const del = async (i: number) => {
    const s = shifts[i];
    if (s.id) {
      const { error } = await supabase.from("shifts").delete().eq("id", s.id);
      if (error) return toast.error(error.message);
    }
    setShifts((p) => p.filter((_, idx) => idx !== i));
    toast.success("Verwijderd");
  };

  if (loading) return <p className="text-muted-foreground text-sm">Laden…</p>;

  return (
    <div className="space-y-4">
      {shifts.length === 0 && (
        <p className="text-sm text-muted-foreground">Nog geen shifts. Voeg er één toe om reserveringen mogelijk te maken.</p>
      )}
      {shifts.map((s, i) => (
        <Card key={s.id ?? `new-${i}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base">{s.name || "Nieuwe shift"}</CardTitle>
            <div className="flex items-center gap-2">
              <Switch checked={s.is_active} onCheckedChange={(v) => update(i, { is_active: v })} />
              <Button variant="ghost" size="icon" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Naam</Label><Input value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Diner" /></div>
            <div className="space-y-1"><Label>Max gasten (optioneel)</Label><Input type="number" value={s.max_guests ?? ""} onChange={(e) => update(i, { max_guests: e.target.value ? parseInt(e.target.value) : null })} /></div>
            <div className="space-y-1"><Label>Start</Label><Input type="time" value={s.start_time} onChange={(e) => update(i, { start_time: e.target.value })} /></div>
            <div className="space-y-1"><Label>Eind</Label><Input type="time" value={s.end_time} onChange={(e) => update(i, { end_time: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Weekdagen</Label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS.map((d) => (
                  <button
                    type="button"
                    key={d.key}
                    onClick={() => toggleDay(i, d.key)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      s.weekdays.includes(d.key)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={() => save(i)}>Opslaan</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={() => setShifts((p) => [...p, { ...empty }])}>
        <Plus className="h-4 w-4 mr-2" /> Shift toevoegen
      </Button>
    </div>
  );
}
