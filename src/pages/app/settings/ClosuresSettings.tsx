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
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type Closure = {
  id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  is_full_day: boolean;
  reason: string | null;
};

export default function ClosuresSettings() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const [items, setItems] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");
  const [draft, setDraft] = useState({
    start_date: today, end_date: today, is_full_day: true,
    start_time: "12:00", end_time: "23:00", reason: "",
  });

  const load = async () => {
    if (!rid) return;
    const { data } = await supabase.from("closures").select("*").eq("restaurant_id", rid).order("start_date", { ascending: false });
    setItems((data ?? []) as Closure[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [rid]);

  const add = async () => {
    if (!rid) return;
    const payload: any = {
      restaurant_id: rid,
      start_date: draft.start_date,
      end_date: draft.end_date,
      is_full_day: draft.is_full_day,
      reason: draft.reason || null,
      start_time: draft.is_full_day ? null : draft.start_time,
      end_time: draft.is_full_day ? null : draft.end_time,
    };
    const { error } = await supabase.from("closures").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Sluiting toegevoegd");
    setDraft({ ...draft, reason: "" });
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("closures").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((p) => p.filter((c) => c.id !== id));
  };

  if (loading) return <p className="text-muted-foreground text-sm">Laden…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Nieuwe sluiting</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Van</Label><Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} /></div>
          <div className="space-y-1"><Label>T/m</Label><Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} /></div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Switch checked={draft.is_full_day} onCheckedChange={(v) => setDraft({ ...draft, is_full_day: v })} />
            <span className="text-sm">Hele dag</span>
          </div>
          {!draft.is_full_day && (
            <>
              <div className="space-y-1"><Label>Start tijd</Label><Input type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} /></div>
              <div className="space-y-1"><Label>Eind tijd</Label><Input type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} /></div>
            </>
          )}
          <div className="space-y-1 sm:col-span-2"><Label>Reden (optioneel)</Label><Input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="Vakantie, privéfeest, …" /></div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Toevoegen</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Geplande sluitingen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Geen sluitingen ingepland.</p>}
          {items.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
              <div className="text-sm">
                <div className="font-medium">
                  {format(new Date(c.start_date), "d MMM yyyy", { locale: nl })}
                  {c.start_date !== c.end_date && ` – ${format(new Date(c.end_date), "d MMM yyyy", { locale: nl })}`}
                  {!c.is_full_day && c.start_time && ` · ${c.start_time.slice(0, 5)}–${c.end_time?.slice(0, 5)}`}
                </div>
                {c.reason && <div className="text-xs text-muted-foreground">{c.reason}</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
