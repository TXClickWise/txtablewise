import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { toast } from "sonner";

type Props = {
  reservationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STATUSES = ["pending", "confirmed", "seated", "finished", "completed", "cancelled", "no_show", "hold"];

export function ReservationDetailDialog({ reservationId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    status: "pending", party_size: 2, internal_notes: "", special_requests: "", reservation_date: "", start_time_local: "",
  });

  useEffect(() => {
    if (!open || !reservationId) return;
    setLoading(true);
    (async () => {
      const { data: r } = await supabase.from("reservations")
        .select("*, guests(*), reservation_tables(table_id, tables(label))")
        .eq("id", reservationId).maybeSingle();
      setData(r);
      if (r) {
        const start = new Date(r.start_time);
        setForm({
          status: r.status,
          party_size: r.party_size,
          internal_notes: r.internal_notes ?? "",
          special_requests: r.special_requests ?? "",
          reservation_date: r.reservation_date,
          start_time_local: format(start, "HH:mm"),
        });
      }
      setLoading(false);
    })();
  }, [open, reservationId]);

  const save = async () => {
    if (!reservationId || !data) return;
    setSaving(true);
    // recompute start/end if time changed
    const [h, m] = form.start_time_local.split(":").map(Number);
    const newStart = new Date(data.start_time);
    newStart.setHours(h, m, 0, 0);
    const oldStart = new Date(data.start_time);
    const oldEnd = new Date(data.end_time);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    const patch: any = {
      status: form.status,
      party_size: form.party_size,
      internal_notes: form.internal_notes || null,
      special_requests: form.special_requests || null,
      reservation_date: form.reservation_date,
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    };
    const { error } = await supabase.from("reservations").update(patch).eq("id", reservationId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reservering bijgewerkt");
    qc.invalidateQueries({ queryKey: ["reservations-day"] });
    qc.invalidateQueries({ queryKey: ["today-reservations"] });
    qc.invalidateQueries({ queryKey: ["agenda-day"] });
    onOpenChange(false);
  };

  const cancelRes = async () => {
    if (!reservationId) return;
    if (!confirm("Reservering annuleren?")) return;
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", reservationId);
    if (error) return toast.error(error.message);
    toast.success("Geannuleerd");
    qc.invalidateQueries({ queryKey: ["reservations-day"] });
    qc.invalidateQueries({ queryKey: ["today-reservations"] });
    qc.invalidateQueries({ queryKey: ["agenda-day"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Reservering</DialogTitle>
        </DialogHeader>
        {loading || !data ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Laden…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={form.status as any} />
              <ChannelBadge channel={data.channel} />
              {data.confirmation_code && (
                <span className="font-mono text-xs text-muted-foreground ml-auto">{data.confirmation_code}</span>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="font-medium">{data.guests?.first_name} {data.guests?.last_name ?? ""}</div>
              <div className="text-sm text-muted-foreground">{data.guests?.email}</div>
              {data.guests?.phone && <div className="text-sm text-muted-foreground">{data.guests.phone}</div>}
              {data.reservation_tables?.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Tafel: {data.reservation_tables.map((rt: any) => rt.tables?.label).join(", ")}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={form.reservation_date} onChange={(e) => setForm({ ...form, reservation_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tijd</Label>
                <Input type="time" value={form.start_time_local} onChange={(e) => setForm({ ...form, start_time_local: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Personen</Label>
                <Input type="number" min={1} value={form.party_size} onChange={(e) => setForm({ ...form, party_size: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {data.special_requests && (
              <div className="space-y-1">
                <Label className="text-xs">Wens van gast</Label>
                <Textarea rows={2} value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Interne notitie</Label>
              <Textarea rows={3} placeholder="Niet zichtbaar voor gast" value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
            </div>

            <p className="text-xs text-muted-foreground">
              Aangemaakt {format(new Date(data.created_at), "d MMM yyyy HH:mm", { locale: nl })}
            </p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={cancelRes}>
            Annuleer reservering
          </Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? "Opslaan…" : "Opslaan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
