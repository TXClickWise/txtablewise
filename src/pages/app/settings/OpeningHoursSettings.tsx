import { useEffect, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const WEEKDAYS = [
  { key: "mon", label: "Maandag" },
  { key: "tue", label: "Dinsdag" },
  { key: "wed", label: "Woensdag" },
  { key: "thu", label: "Donderdag" },
  { key: "fri", label: "Vrijdag" },
  { key: "sat", label: "Zaterdag" },
  { key: "sun", label: "Zondag" },
] as const;

type Row = {
  weekday: typeof WEEKDAYS[number]["key"];
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export default function OpeningHoursSettings() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [rows, setRows] = useState<Row[]>(
    WEEKDAYS.map((w) => ({ weekday: w.key, open_time: "17:00", close_time: "23:00", is_closed: false }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rid) return;
    (async () => {
      const { data } = await supabase.from("opening_hours").select("*").eq("restaurant_id", rid);
      if (data && data.length) {
        setRows(WEEKDAYS.map((w) => {
          const found = data.find((d: any) => d.weekday === w.key);
          return found
            ? { weekday: w.key, open_time: found.open_time.slice(0, 5), close_time: found.close_time.slice(0, 5), is_closed: found.is_closed }
            : { weekday: w.key, open_time: "17:00", close_time: "23:00", is_closed: true };
        }));
      }
      setLoading(false);
    })();
  }, [rid]);

  const update = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const onSave = async () => {
    if (!rid) return;
    setSaving(true);
    await supabase.from("opening_hours").delete().eq("restaurant_id", rid);
    const { error } = await supabase.from("opening_hours").insert(
      rows.map((r) => ({
        restaurant_id: rid,
        weekday: r.weekday,
        open_time: r.open_time,
        close_time: r.close_time,
        is_closed: r.is_closed,
      }))
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Openingstijden opgeslagen");
  };

  if (loading) return <p className="text-muted-foreground text-sm">Laden…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Openingstijden</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.weekday} className="grid grid-cols-12 gap-3 items-center py-2 border-b border-border last:border-b-0">
              <div className="col-span-3 font-medium">{WEEKDAYS[i].label}</div>
              <div className="col-span-3 flex items-center gap-2">
                <Switch checked={!r.is_closed} onCheckedChange={(v) => update(i, { is_closed: !v })} />
                <span className="text-xs text-muted-foreground">{r.is_closed ? "Gesloten" : "Open"}</span>
              </div>
              <div className="col-span-3">
                <Input type="time" disabled={r.is_closed} value={r.open_time} onChange={(e) => update(i, { open_time: e.target.value })} />
              </div>
              <div className="col-span-3">
                <Input type="time" disabled={r.is_closed} value={r.close_time} onChange={(e) => update(i, { close_time: e.target.value })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
      </div>
    </div>
  );
}
