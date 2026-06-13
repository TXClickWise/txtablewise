// ReservationStatusSwitcher — vrije statuswissel met audit en backward-confirm.
// Toont alle 7 levenscyclus-statussen als pillen; huidige is gemarkeerd, andere
// zijn aantikbaar. Voor "gevoelige" achterwaartse transities verschijnt eerst
// een bevestigingsdialog met een korte reden.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { reservations as resService, type ReservationStatus } from "@/services/reservations";
import { cn } from "@/lib/utils";

type Props = {
  reservationId: string;
  status: string;
  onChanged?: () => void;
};

const ALL: { key: ReservationStatus; label: string; cls: string }[] = [
  { key: "pending",   label: "Verwacht",    cls: "bg-status-pending text-white" },
  { key: "confirmed", label: "Bevestigd",   cls: "bg-status-confirmed text-white" },
  { key: "seated",    label: "Aan tafel",   cls: "bg-status-seated text-white" },
  { key: "completed", label: "Vertrokken",  cls: "bg-status-completed text-white" },
  { key: "no_show",   label: "No-show",     cls: "bg-status-noshow text-white" },
  { key: "cancelled", label: "Geannuleerd", cls: "bg-status-cancelled text-white" },
  { key: "hold",      label: "Tijdelijk",   cls: "bg-muted-foreground text-white" },
];

// "Gevoelige" overgangen: terugzetten vanaf een eindstatus of vanaf 'seated'.
// Hier vragen we altijd een reden om de audit-trail nuttig te houden.
function needsConfirm(from: string, to: string): boolean {
  if (from === to) return false;
  const endStates = ["completed", "cancelled", "no_show"];
  if (endStates.includes(from)) return true;
  if (from === "seated" && to !== "completed") return true;
  return false;
}

export function ReservationStatusSwitcher({ reservationId, status, onChanged }: Props) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<ReservationStatus | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async (next: ReservationStatus, withReason?: string) => {
    setBusy(true);
    const res = await resService.manage({
      action: "change_status",
      reservation_id: reservationId,
      new_status: next,
      cancellation_reason: withReason,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Status kon niet worden gewijzigd.");
      return;
    }
    toast.success(`Status bijgewerkt naar '${ALL.find((s) => s.key === next)?.label ?? next}'.`);
    qc.invalidateQueries();
    onChanged?.();
  };

  const onPick = (next: ReservationStatus) => {
    if (next === status) return;
    if (needsConfirm(status, next)) {
      setPending(next);
      setReason("");
    } else {
      void apply(next);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Wissel snel van status — handig om vergissingen direct terug te draaien.
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL.map((s) => {
          const active = s.key === status;
          return (
            <button
              key={s.key}
              type="button"
              disabled={busy || active}
              onClick={() => onPick(s.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold border transition-all",
                active
                  ? cn(s.cls, "border-transparent shadow-sm")
                  : "bg-card text-foreground border-border hover:bg-muted",
                busy && !active && "opacity-60 cursor-wait",
              )}
              aria-pressed={active}
            >
              {s.label}
              {active && <span className="ml-1 opacity-80">·</span>}
              {active && <span className="ml-1 text-[10px] uppercase tracking-wide">Nu</span>}
            </button>
          );
        })}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Status terugzetten naar '{ALL.find((s) => s.key === pending)?.label}'?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deze stap zet een eerder vastgelegde status terug. Voeg kort een reden
              toe zodat het team later kan terugzien waarom dit is gewijzigd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Bijv. per ongeluk op 'Aan tafel' getapt"
            rows={3}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!pending) return;
                const r = reason.trim();
                if (!r) {
                  toast.error("Geef kort een reden op.");
                  return;
                }
                await apply(pending, r);
                setPending(null);
              }}
            >
              {busy ? "Bezig…" : "Status terugzetten"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
