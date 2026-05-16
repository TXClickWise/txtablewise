import { useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuCheckboxItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type StatusFilter =
  | "all" | "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";

export type SignalFilter = null | "walk_in" | "large_group" | "allergy" | "preorder" | "approval";

export type TimeBand = "all" | "morning" | "lunch" | "afternoon" | "dinner" | "late";
export type RiskFilter = "all" | "low" | "medium" | "high";

export const STATUS_CHIPS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all",       label: "Alle" },
  { key: "pending",   label: "Verwacht" },
  { key: "confirmed", label: "Bevestigd" },
  { key: "seated",    label: "Aan tafel" },
  { key: "completed", label: "Vertrokken" },
  { key: "cancelled", label: "Geannuleerd" },
  { key: "no_show",   label: "No-show" },
];

const TIMEBANDS: Array<{ key: TimeBand; label: string; range?: [number, number] }> = [
  { key: "all", label: "Hele dag" },
  { key: "morning", label: "Ochtend (tot 11)", range: [0, 11] },
  { key: "lunch", label: "Lunch (11-15)", range: [11, 15] },
  { key: "afternoon", label: "Middag (15-17)", range: [15, 17] },
  { key: "dinner", label: "Diner (17-22)", range: [17, 22] },
  { key: "late", label: "Laat (22+)", range: [22, 30] },
];

export function timeBandRange(band: TimeBand): [number, number] | null {
  return TIMEBANDS.find((t) => t.key === band)?.range ?? null;
}

const CHANNELS = [
  "online", "walk_in", "phone", "ai_voice", "manual", "whatsapp",
  "external_platform", "google_link", "instagram_link", "qr_code",
];

const CHANNEL_LABEL: Record<string, string> = {
  online: "Online",
  walk_in: "Walk-in",
  phone: "Telefoon",
  ai_voice: "AI Voice",
  manual: "Handmatig",
  whatsapp: "WhatsApp",
  external_platform: "Extern platform",
  google_link: "Google",
  instagram_link: "Instagram",
  qr_code: "QR-code",
};

export type FilterState = {
  search: string;
  status: StatusFilter;
  signal: SignalFilter;
  timeBand: TimeBand;
  channels: string[];
  partySize: [number, number];
  risk: RiskFilter;
};

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: "all",
  signal: null,
  timeBand: "all",
  channels: [],
  partySize: [1, 20],
  risk: "all",
};

type Counts = {
  walk_in: number; large_group: number; allergy: number;
  preorder: number; approval: number;
};

export function ReservationFilterBar({
  filters,
  onChange,
  counts,
  onClear,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  counts: Counts;
  onClear: () => void;
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const activeBadges = useMemo(() => {
    const arr: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.status !== "all") {
      arr.push({ key: "status", label: STATUS_CHIPS.find((s) => s.key === filters.status)!.label, clear: () => set({ status: "all" }) });
    }
    if (filters.signal) {
      const lbl: Record<NonNullable<SignalFilter>, string> = {
        walk_in: "Walk-ins", large_group: "Grote groep", allergy: "Allergie",
        preorder: "Drankje klaarzetten", approval: "Goedkeuring",
      };
      arr.push({ key: "signal", label: lbl[filters.signal], clear: () => set({ signal: null }) });
    }
    if (filters.timeBand !== "all") {
      arr.push({ key: "tb", label: TIMEBANDS.find((t) => t.key === filters.timeBand)!.label, clear: () => set({ timeBand: "all" }) });
    }
    filters.channels.forEach((c) => {
      arr.push({ key: `c-${c}`, label: CHANNEL_LABEL[c] ?? c, clear: () => set({ channels: filters.channels.filter((x) => x !== c) }) });
    });
    if (filters.partySize[0] !== 1 || filters.partySize[1] !== 20) {
      arr.push({ key: "ps", label: `${filters.partySize[0]}–${filters.partySize[1]} pers.`, clear: () => set({ partySize: [1, 20] }) });
    }
    if (filters.risk !== "all") {
      arr.push({ key: "risk", label: `Risico: ${filters.risk}`, clear: () => set({ risk: "all" }) });
    }
    if (filters.search) {
      arr.push({ key: "q", label: `"${filters.search}"`, clear: () => set({ search: "" }) });
    }
    return arr;
  }, [filters]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, e-mail, telefoon, tafel, notitie of code…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="pl-9 h-11"
          />
        </div>

        {/* Advanced filters dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeBadges.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeBadges.length}</Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
            <DropdownMenuLabel>Tijdvak</DropdownMenuLabel>
            {TIMEBANDS.map((tb) => (
              <DropdownMenuCheckboxItem
                key={tb.key}
                checked={filters.timeBand === tb.key}
                onCheckedChange={() => set({ timeBand: tb.key })}
              >
                {tb.label}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Bron</DropdownMenuLabel>
            {CHANNELS.map((c) => (
              <DropdownMenuCheckboxItem
                key={c}
                checked={filters.channels.includes(c)}
                onCheckedChange={(v) => set({
                  channels: v
                    ? [...filters.channels, c]
                    : filters.channels.filter((x) => x !== c),
                })}
              >
                {CHANNEL_LABEL[c] ?? c}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>No-show risico</DropdownMenuLabel>
            {(["all", "low", "medium", "high"] as RiskFilter[]).map((r) => (
              <DropdownMenuCheckboxItem
                key={r}
                checked={filters.risk === r}
                onCheckedChange={() => set({ risk: r })}
              >
                {r === "all" ? "Alle" : r === "low" ? "Laag" : r === "medium" ? "Middel" : "Hoog"}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Personen ({filters.partySize[0]}–{filters.partySize[1]})</DropdownMenuLabel>
            <div className="px-3 py-2">
              <Slider
                min={1}
                max={20}
                step={1}
                value={filters.partySize}
                onValueChange={(v) => set({ partySize: [v[0], v[1]] as [number, number] })}
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status chips */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => set({ status: c.key })}
            className={cn(
              "px-3 h-9 rounded-full border text-sm transition-colors",
              filters.status === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Signal chips */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 mr-1">
          <Filter className="h-3 w-3" /> Signalen
        </span>
        {([
          ["walk_in", "Walk-ins", counts.walk_in],
          ["large_group", "Grote groep", counts.large_group],
          ["allergy", "Allergie", counts.allergy],
          ["preorder", "Drankje klaarzetten", counts.preorder],
          ["approval", "Goedkeuring nodig", counts.approval],
        ] as const).map(([k, label, count]) => {
          const active = filters.signal === k;
          return (
            <button
              key={k}
              onClick={() => set({ signal: active ? null : (k as SignalFilter) })}
              className={cn(
                "px-2.5 h-8 rounded-full border text-xs transition-colors inline-flex items-center gap-1.5",
                active
                  ? "bg-warning/15 border-warning/40 text-warning"
                  : "bg-background border-border hover:border-warning/40",
                count === 0 && "opacity-50",
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 text-[10px] leading-4",
                  active ? "bg-warning/30" : "bg-muted",
                )}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter badges */}
      {activeBadges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {activeBadges.map((b) => (
            <Badge key={b.key} variant="secondary" className="gap-1 pr-1">
              {b.label}
              <button onClick={b.clear} className="ml-0.5 rounded hover:bg-background/60 p-0.5" aria-label="Verwijder filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-7" onClick={onClear}>
            <X className="h-3 w-3 mr-1" /> Wis alles
          </Button>
        </div>
      )}
    </div>
  );
}
