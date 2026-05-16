import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  restaurantId?: string;
  align?: "start" | "center" | "end";
  buttonClassName?: string;
  format?: "short" | "long";
};

export function ReservationDatePicker({
  value,
  onChange,
  restaurantId,
  align = "end",
  buttonClassName,
  format: fmt = "short",
}: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(value);

  const fromStr = format(startOfMonth(month), "yyyy-MM-dd");
  const toStr = format(endOfMonth(month), "yyyy-MM-dd");

  const { data: datesWithReservations = [] } = useQuery({
    queryKey: ["reservation-dates", restaurantId, fromStr],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("reservation_date")
        .eq("restaurant_id", restaurantId!)
        .gte("reservation_date", fromStr)
        .lte("reservation_date", toStr)
        .neq("status", "cancelled");
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.reservation_date && set.add(r.reservation_date));
      return Array.from(set).map((s) => parseISO(s));
    },
  });

  const label = useMemo(
    () => format(value, fmt === "long" ? "d MMMM yyyy" : "d MMM yyyy", { locale: nl }),
    [value, fmt],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9", buttonClassName)}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={value}
          month={month}
          onMonthChange={setMonth}
          onSelect={(d) => {
            if (d) {
              onChange(d);
              setOpen(false);
            }
          }}
          locale={nl}
          initialFocus
          modifiers={{ hasReservations: datesWithReservations }}
          modifiersClassNames={{ hasReservations: "tw-has-reservations" }}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
