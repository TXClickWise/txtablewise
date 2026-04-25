import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Clock, MapPin, Phone, Mail } from "lucide-react";
import { ChannelBadge } from "@/components/ChannelBadge";
import { WaitlistStatusBadge } from "./WaitlistStatusBadge";
import type { WaitlistEntry } from "@/services/waitlist";

type Props = {
  entry: WaitlistEntry;
  zoneName?: string | null;
  onOpen: (entry: WaitlistEntry) => void;
};

export function WaitlistCard({ entry, zoneName, onOpen }: Props) {
  const time = `${entry.desired_time_from?.slice(0, 5)}–${entry.desired_time_to?.slice(0, 5)}`;
  return (
    <Card
      className="p-4 cursor-pointer transition-smooth hover:border-primary/40 hover:shadow-soft"
      onClick={() => onOpen(entry)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base truncate">
              {entry.first_name} {entry.last_name || ""}
            </h3>
            <WaitlistStatusBadge status={entry.status} />
            <ChannelBadge channel={entry.channel} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {entry.party_size} pers.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {time}
            </span>
            {zoneName && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {zoneName}
              </span>
            )}
            {entry.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {entry.phone}
              </span>
            )}
            {entry.email && (
              <span className="inline-flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5" /> {entry.email}
              </span>
            )}
          </div>
          {entry.notes && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{entry.notes}</p>
          )}
        </div>
        <Button variant="outline" size="sm" className="shrink-0">
          Openen
        </Button>
      </div>
    </Card>
  );
}
