// Datumrange + snelle periodeknoppen voor rapportages.
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type DateRange, type RangePreset, getReportingDateRange } from "@/services/reporting";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today",     label: "Vandaag" },
  { key: "yesterday", label: "Gisteren" },
  { key: "week",      label: "Deze week" },
  { key: "last_week", label: "Vorige week" },
  { key: "month",     label: "Deze maand" },
  { key: "custom",    label: "Aangepast" },
];

export function ReportDateRangePicker({
  preset, range, onChange,
}: { preset: RangePreset; range: DateRange; onChange: (preset: RangePreset, range: DateRange) => void }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"}
            onClick={() => onChange(p.key, p.key === "custom" ? range : getReportingDateRange(p.key))}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Van</Label>
          <Input type="date" value={range.from} className="w-[160px]"
            onChange={(e) => onChange("custom", { ...range, from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">T/m</Label>
          <Input type="date" value={range.to} className="w-[160px]"
            onChange={(e) => onChange("custom", { ...range, to: e.target.value })} />
        </div>
        <div className="text-xs text-muted-foreground pb-2">
          {format(new Date(range.from), "d MMM", { locale: nl })} – {format(new Date(range.to), "d MMM yyyy", { locale: nl })}
        </div>
      </div>
    </div>
  );
}
