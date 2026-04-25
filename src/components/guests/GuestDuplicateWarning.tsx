import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Guest } from "@/services/guests";

type Props = {
  candidates: Guest[];
  onUseExisting: (g: Guest) => void;
  onIgnore: () => void;
};

export function GuestDuplicateWarning({ candidates, onUseExisting, onIgnore }: Props) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-warning">
        <AlertCircle className="h-4 w-4" />
        Mogelijk bestaat deze gast al
      </div>
      <ul className="space-y-1.5">
        {candidates.slice(0, 3).map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-2 text-sm bg-background rounded px-2 py-1.5">
            <div className="min-w-0">
              <div className="font-medium truncate">
                {g.first_name} {g.last_name ?? ""}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {g.email ?? ""}{g.email && g.phone ? " · " : ""}{g.phone ?? ""}
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
              onClick={() => onUseExisting(g)}>
              Gebruiken
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onIgnore}>
          Toch nieuwe gast aanmaken
        </Button>
      </div>
    </div>
  );
}
