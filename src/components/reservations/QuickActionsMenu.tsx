import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, MoveRight, Armchair, UserCircle, MessageSquare, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoveReservationSheet } from "./MoveReservationSheet";
import { AssignTableSheet } from "./AssignTableSheet";
import { requestGuestMessage } from "@/services/reservationMessages";
import { toast } from "sonner";
import type { CardReservation } from "./ReservationCard";

export function QuickActionsMenu({
  reservation,
  restaurantId,
  reservationDate,
  guestId,
  onEdit,
}: {
  reservation: CardReservation;
  restaurantId: string;
  reservationDate: string; // YYYY-MM-DD
  guestId?: string | null;
  onEdit: (id: string) => void;
}) {
  const nav = useNavigate();
  const [moveOpen, setMoveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentTableIds = (reservation.reservation_tables ?? [])
    .map((rt: any) => rt?.table_id).filter(Boolean) as string[];

  const sendMessage = async () => {
    setBusy(true);
    const res = await requestGuestMessage({
      restaurantId,
      reservationId: reservation.id,
      guestId: guestId ?? null,
      kind: "custom",
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Berichtverzoek doorgestuurd naar ClickWise.");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label="Meer acties">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => onEdit(reservation.id)}>
            <Pencil className="h-4 w-4 mr-2" /> Wijzigen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>
            <MoveRight className="h-4 w-4 mr-2" /> Verplaatsen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAssignOpen(true)}>
            <Armchair className="h-4 w-4 mr-2" /> Tafel toewijzen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {guestId && (
            <DropdownMenuItem onClick={() => nav(`/app/gasten?focus=${guestId}`)}>
              <UserCircle className="h-4 w-4 mr-2" /> Gastprofiel openen
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={busy} onClick={sendMessage}>
            <MessageSquare className="h-4 w-4 mr-2" /> Bericht sturen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MoveReservationSheet
        reservationId={reservation.id}
        initialDate={reservationDate}
        initialTime={format(new Date(reservation.start_time), "HH:mm")}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />
      <AssignTableSheet
        reservationId={reservation.id}
        restaurantId={restaurantId}
        partySize={reservation.party_size}
        currentTableIds={currentTableIds}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </>
  );
}
