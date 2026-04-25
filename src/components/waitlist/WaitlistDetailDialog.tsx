import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, XCircle, Send, ArrowRight, Search, MessageSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  cancelWaitlistEntry,
  convertWaitlistToReservation,
  createWaitlistNotificationEvent,
  suggestSlotsForEntry,
  type WaitlistEntry,
} from "@/services/waitlist";
import { WaitlistStatusBadge } from "./WaitlistStatusBadge";

type Props = {
  entry: WaitlistEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (entry: WaitlistEntry) => void;
};

export function WaitlistDetailDialog({ entry, open, onOpenChange, onEdit }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showSlots, setShowSlots] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showMessagePreview, setShowMessagePreview] = useState(false);

  if (!entry) return null;

  const isFinal = ["converted", "cancelled", "expired"].includes(entry.status);
  const slots = suggestSlotsForEntry(entry);

  const refresh = () => qc.invalidateQueries({ queryKey: ["waitlist"] });

  const doCancel = async () => {
    setBusy(true);
    const r = await cancelWaitlistEntry(entry.id);
    setBusy(false);
    setConfirmCancel(false);
    if (!r.ok) return toast.error(r.error || "Annuleren mislukt.");
    toast.success("Wachtlijstitem geannuleerd.");
    refresh();
    onOpenChange(false);
  };

  const doNotify = async () => {
    setBusy(true);
    const r = await createWaitlistNotificationEvent(entry.id, {
      time: entry.desired_time_from?.slice(0, 5) || "",
      party_size: entry.party_size,
      date: entry.desired_date,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error || "Niet gelukt.");
    toast.success("Bericht voorbereid voor ClickWise.");
    refresh();
  };

  const doConvert = async (date: string, time: string) => {
    setBusy(true);
    const r = await convertWaitlistToReservation({ entryId: entry.id, date, time });
    setBusy(false);
    if (!r.ok) return toast.error(r.error || "Conversie mislukt.");
    toast.success("Wachtlijstitem omgezet naar reservering.");
    refresh();
    qc.invalidateQueries({ queryKey: ["reservations"] });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {entry.first_name} {entry.last_name || ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <WaitlistStatusBadge status={entry.status} />
              <Badge variant="outline">{entry.party_size} pers.</Badge>
              <Badge variant="outline">{entry.desired_date}</Badge>
              <Badge variant="outline">
                {entry.desired_time_from?.slice(0, 5)}–{entry.desired_time_to?.slice(0, 5)}
              </Badge>
            </div>

            <div className="text-sm space-y-1">
              {entry.phone && <p>📞 {entry.phone}</p>}
              {entry.email && <p>✉️ {entry.email}</p>}
              {!entry.phone && !entry.email && (
                <p className="text-xs text-muted-foreground">
                  Er zijn geen contactgegevens bekend. Voeg een telefoonnummer of e-mailadres toe om
                  de gast te kunnen benaderen.
                </p>
              )}
              {entry.notes && (
                <div className="rounded-md bg-muted/40 p-3 text-sm mt-2">{entry.notes}</div>
              )}
            </div>

            {!isFinal && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(entry)} disabled={busy}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Bewerken
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowSlots((s) => !s)} disabled={busy}>
                    <Search className="mr-1.5 h-4 w-4" /> Match zoeken
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowMessagePreview(true)} disabled={busy}>
                    <MessageSquare className="mr-1.5 h-4 w-4" /> Bericht voorbereiden
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmCancel(true)} disabled={busy}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Annuleren
                  </Button>
                </div>

                {showSlots && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm font-medium">Voorgestelde tijdslots</p>
                    <p className="text-xs text-muted-foreground">
                      Beschikbaarheid wordt vlak vóór conversie opnieuw gecontroleerd.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {slots.map((s) => (
                        <Button
                          key={s.time} size="sm" variant="secondary"
                          onClick={() => doConvert(s.date, s.time)} disabled={busy}
                        >
                          {s.time}
                          <ArrowRight className="ml-1.5 h-3 w-3" />
                        </Button>
                      ))}
                      {slots.length === 0 && (
                        <p className="text-sm text-muted-foreground">Geen passende tijden binnen voorkeur.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wachtlijstitem annuleren?</AlertDialogTitle>
            <AlertDialogDescription>
              De gast wordt van de wachtlijst verwijderd. Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Terug</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel} disabled={busy}>Ja, annuleren</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showMessagePreview} onOpenChange={setShowMessagePreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bericht voorbereiden</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Dit bericht wordt later via ClickWise (WhatsApp, SMS of e-mail) verstuurd. Nu wordt
              alleen het verzoek voorbereid — er gaat nog niets de deur uit.
            </p>
            <blockquote className="rounded-md border-l-2 border-primary bg-muted/30 px-4 py-3 text-sm italic">
              Goed nieuws! Er is mogelijk een tafel vrijgekomen rond {entry.desired_time_from?.slice(0, 5)}{" "}
              voor {entry.party_size} personen. Wil je deze plek reserveren?
            </blockquote>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessagePreview(false)}>Annuleren</Button>
            <Button onClick={async () => { await doNotify(); setShowMessagePreview(false); }} disabled={busy}>
              <Send className="mr-1.5 h-4 w-4" /> Voorbereiden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
