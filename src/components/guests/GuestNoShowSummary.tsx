import { BellRing } from "lucide-react";
import type { Guest } from "@/services/guests";

export function GuestNoShowSummary({ guest }: { guest: Guest }) {
  if ((guest.no_show_count ?? 0) === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Geen eerdere no-shows of late annuleringen geregistreerd.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-warning">
        <BellRing className="h-4 w-4" />
        Extra bevestiging aanbevolen
      </div>
      <p className="text-sm">
        {guest.no_show_count} {guest.no_show_count === 1 ? "no-show" : "no-shows"} geregistreerd.
      </p>
      <p className="text-xs text-muted-foreground">
        Deze informatie is bedoeld om reserveringen zorgvuldiger op te volgen.
      </p>
    </div>
  );
}
