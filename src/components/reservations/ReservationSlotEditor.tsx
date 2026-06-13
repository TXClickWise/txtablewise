// ReservationSlotEditor — inline UI om snel tafel + tijd + duur aan te passen
// vanuit de detail-sheet. Roept dezelfde manage_reservation edge-fn aan als
// de drag-and-drop in de tijdlijn (één pad, één audit-trail).
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { reservations as resService } from "@/services/reservations";
import { cn } from "@/lib/utils";

type Props = {
  reservationId: string;
  restaurantId: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  currentTableIds: string[];
  partySize: number;
  onSaved?: () => void;
  onCancel?: () => void;
};

const DURATION_PRESETS = [60, 90, 120, 150, 180];

export function ReservationSlotEditor({
  reservationId, restaurantId, startTime, endTime, currentTableIds, partySize,
  onSaved, onCancel,
}: Props) {
  const qc = useQueryClient();

  const start = new Date(startTime);
  const end = new Date(endTime);
  const initialDate = format(start, "yyyy-MM-dd");
  const initialTime = format(start, "HH:mm");
  const initialDuration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(initialDuration);
  const [tableId, setTableId] = useState<string>(currentTableIds[0] ?? "");
  const [busy, setBusy] = useState(false);

  const { data: tables = [] } = useQuery({
    queryKey: ["slot-editor-tables", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("tables")
        .select("id, label, capacity_min, capacity_max, is_active, zone_id, zones(name, sort_order)")
        .eq("restaurant_id", restaurantId)
        .order("label");
      return data ?? [];
    },
  });

  // Group by zone for select
  const grouped = useMemo(() => {
    const groups = new Map<string, { name: string; sortOrder: number; tables: any[] }>();
    for (const t of tables as any[]) {
      const key = t.zone_id ?? "_none";
      if (!groups.has(key)) {
        groups.set(key, {
          name: t.zones?.name ?? "Overig",
          sortOrder: t.zone_id ? (t.zones?.sort_order ?? 9999) : 1e6,
          tables: [],
        });
      }
      groups.get(key)!.tables.push(t);
    }
    return Array.from(groups.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [tables]);

  // Reset state when reservation changes
  useEffect(() => {
    setDate(initialDate);
    setTime(initialTime);
    setDuration(initialDuration);
    setTableId(currentTableIds[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const save = async () => {
    if (!date || !time) {
      toast.error("Datum en tijd zijn verplicht.");
      return;
    }
    setBusy(true);
    // manage_reservation accepteert start_time_local in 'HH:mm' formaat
    // en herberekent end_time op basis van duration_minutes als die wordt meegegeven.
    // We sturen alleen wat gewijzigd is.
    const payload: Parameters<typeof resService.update>[1] = {};
    if (date !== initialDate) payload.reservation_date = date;
    if (time !== initialTime || duration !== initialDuration) {
      payload.start_time_local = time;
    }
    if (tableId && !currentTableIds.includes(tableId)) {
      payload.table_id = tableId;
    } else if (!tableId && currentTableIds.length > 0) {
      payload.table_id = null;
    }

    // Duur is geen native veld in update — sturen via direct supabase update voor end_time
    // wanneer alleen duur wijzigt zonder andere wijziging.
    const onlyDurationChange = duration !== initialDuration
      && date === initialDate
      && time === initialTime
      && Object.keys(payload).length === 0;

    let res: { ok: boolean; error?: string } = { ok: true };
    if (Object.keys(payload).length > 0) {
      res = await resService.update(reservationId, payload);
    }
    // Pas end_time bij als duur is gewijzigd (manage_reservation neemt de bestaande
    // duur niet automatisch over, dus we updaten end_time hier expliciet).
    if (res.ok && duration !== initialDuration) {
      const baseDate = date !== initialDate ? date : initialDate;
      const baseTime = time !== initialTime ? time : initialTime;
      const newStart = new Date(`${baseDate}T${baseTime}:00`);
      const newEnd = new Date(newStart.getTime() + duration * 60000);
      const { error } = await supabase.from("reservations")
        .update({ end_time: newEnd.toISOString() })
        .eq("id", reservationId);
      if (error) res = { ok: false, error: error.message };
    }

    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Wijziging is niet opgeslagen.");
      return;
    }
    toast.success(onlyDurationChange ? "Duur bijgewerkt." : "Reservering verplaatst.");
    qc.invalidateQueries();
    onSaved?.();
  };

  const dirty =
    date !== initialDate
    || time !== initialTime
    || duration !== initialDuration
    || tableId !== (currentTableIds[0] ?? "");

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Datum</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Starttijd</Label>
          <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Duur</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDuration(m)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                duration === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted",
              )}
            >
              {m} min
            </button>
          ))}
          <Input
            type="number"
            value={duration}
            min={15}
            step={15}
            onChange={(e) => setDuration(Math.max(15, parseInt(e.target.value || "0", 10) || 0))}
            className="h-7 w-20 text-xs"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Tafel</Label>
        <Select value={tableId} onValueChange={setTableId}>
          <SelectTrigger>
            <SelectValue placeholder="Kies een tafel" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {grouped.map((g) => (
              <SelectGroup key={g.name}>
                <SelectLabel>{g.name}</SelectLabel>
                {g.tables.map((t: any) => {
                  const fits = partySize >= t.capacity_min && partySize <= t.capacity_max;
                  return (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      disabled={!t.is_active}
                    >
                      Tafel {t.label} · {t.capacity_min}–{t.capacity_max}p
                      {!fits && <span className="ml-1 text-warning"> (krap voor {partySize}p)</span>}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {currentTableIds.length > 1 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Let op: deze reservering staat nu op {currentTableIds.length} tafels.
            Bij opslaan worden ze vervangen door de gekozen tafel.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Annuleren
          </Button>
        )}
        <Button type="button" size="sm" onClick={save} disabled={busy || !dirty}>
          {busy ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </div>
  );
}
