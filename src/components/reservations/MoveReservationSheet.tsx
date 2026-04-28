import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reservations as resService } from "@/services/reservations";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function MoveReservationSheet({
  reservationId,
  initialDate,
  initialTime,
  open,
  onOpenChange,
}: {
  reservationId: string | null;
  initialDate: string;
  initialTime: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(initialDate);
      setTime(initialTime);
    }
  }, [open, initialDate, initialTime]);

  const move = async () => {
    if (!reservationId) return;
    setBusy(true);
    const res = await resService.update(reservationId, {
      reservation_date: date,
      start_time_local: time,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "Verplaatsen niet gelukt.");
    toast.success("Reservering verplaatst.");
    qc.invalidateQueries();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="sm:max-w-md sm:mx-auto sm:rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Reservering verplaatsen</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-xs">Datum</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tijd</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={move} disabled={busy}>{busy ? "Bezig…" : "Verplaatsen"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// helper for callers that already have a reservation row
export function deriveLocalParts(startTimeIso: string, dateStr: string) {
  return { date: dateStr, time: format(new Date(startTimeIso), "HH:mm") };
}
