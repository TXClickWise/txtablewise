import { useMemo } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { ReservationCard, type CardReservation } from "@/components/reservations/ReservationCard";

const BANDS: Array<{ key: string; label: string; from: number; to: number }> = [
  { key: "morning", label: "Ochtend", from: 0, to: 11 },
  { key: "lunch", label: "Lunch", from: 11, to: 15 },
  { key: "afternoon", label: "Middag", from: 15, to: 17 },
  { key: "dinner", label: "Diner", from: 17, to: 22 },
  { key: "late", label: "Laat", from: 22, to: 30 },
];

export function DayView({
  date,
  reservations,
  onOpen,
  largeGroupThreshold,
}: {
  date: Date;
  reservations: CardReservation[];
  onOpen: (id: string) => void;
  largeGroupThreshold?: number;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, CardReservation[]> = {};
    for (const r of reservations) {
      const h = new Date(r.start_time).getHours();
      const band = BANDS.find((b) => h >= b.from && h < b.to) ?? BANDS[BANDS.length - 1];
      (map[band.key] ||= []).push(r);
    }
    return map;
  }, [reservations]);

  const visibleBands = BANDS.filter((b) => (grouped[b.key]?.length ?? 0) > 0);

  if (visibleBands.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Geen reserveringen voor {format(date, "EEEE d MMMM", { locale: nl })}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visibleBands.map((b) => (
        <section key={b.key}>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-display text-lg">{b.label}</h2>
            <span className="text-xs text-muted-foreground">
              {grouped[b.key].length} {grouped[b.key].length === 1 ? "reservering" : "reserveringen"} ·{" "}
              {grouped[b.key].reduce((s, r) => s + r.party_size, 0)} pers.
            </span>
          </div>
          <div className="space-y-2">
            {grouped[b.key].map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onOpen={onOpen}
                largeGroupThreshold={largeGroupThreshold}
                invalidateKeys={["reservations-day", "reservations-week"]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
