import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Save, Trash2, RotateCcw, Grid3x3, Square, Circle, RectangleHorizontal } from "lucide-react";

type Zone = { id: string; name: string };
type Table = {
  id: string;
  zone_id: string | null;
  label: string;
  capacity_min: number;
  capacity_max: number;
  shape: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
};

const CANVAS_W = 900;
const CANVAS_H = 560;
const GRID = 10;

const snap = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type DragState =
  | { type: "move"; id: string; offsetX: number; offsetY: number }
  | { type: "resize"; id: string; startW: number; startH: number; startX: number; startY: number }
  | null;

export function FloorPlanEditor({ restaurantId }: { restaurantId: string }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, true>>({});
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);

  const load = useCallback(async () => {
    const [{ data: z }, { data: t }] = await Promise.all([
      supabase.from("zones").select("id, name").eq("restaurant_id", restaurantId).eq("is_active", true).order("sort_order"),
      supabase.from("tables").select("*").eq("restaurant_id", restaurantId).eq("is_active", true).order("label"),
    ]);
    setZones((z ?? []) as Zone[]);
    setTables((t ?? []) as Table[]);
    if (!zoneId && z && z.length > 0) setZoneId(z[0].id);
  }, [restaurantId, zoneId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => tables.filter((t) => t.zone_id === zoneId), [tables, zoneId]);
  const selected = useMemo(() => tables.find((t) => t.id === selectedId) ?? null, [tables, selectedId]);

  const updateLocal = (id: string, patch: Partial<Table>) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  // Pointer handlers
  const onPointerDownTable = (e: React.PointerEvent, t: Table) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedId(t.id);
    const rect = canvasRef.current!.getBoundingClientRect();
    dragRef.current = {
      type: "move",
      id: t.id,
      offsetX: e.clientX - rect.left - t.pos_x,
      offsetY: e.clientY - rect.top - t.pos_y,
    };
  };

  const onPointerDownResize = (e: React.PointerEvent, t: Table) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      type: "resize",
      id: t.id,
      startW: t.width,
      startH: t.height,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const t = tables.find((x) => x.id === drag.id);
    if (!t) return;
    const rect = canvasRef.current!.getBoundingClientRect();

    if (drag.type === "move") {
      const x = snap(clamp(e.clientX - rect.left - drag.offsetX, 0, CANVAS_W - t.width));
      const y = snap(clamp(e.clientY - rect.top - drag.offsetY, 0, CANVAS_H - t.height));
      updateLocal(t.id, { pos_x: x, pos_y: y });
    } else {
      const w = snap(clamp(drag.startW + (e.clientX - drag.startX), 40, CANVAS_W - t.pos_x));
      const h = snap(clamp(drag.startH + (e.clientY - drag.startY), 40, CANVAS_H - t.pos_y));
      updateLocal(t.id, { width: w, height: h });
    }
  };

  const onPointerUp = () => { dragRef.current = null; };

  const saveAll = async () => {
    const ids = Object.keys(dirty);
    if (ids.length === 0) return;
    setSaving(true);
    const updates = tables.filter((t) => dirty[t.id]).map((t) =>
      supabase.from("tables").update({
        pos_x: t.pos_x, pos_y: t.pos_y, width: t.width, height: t.height, shape: t.shape, zone_id: t.zone_id,
      }).eq("id", t.id),
    );
    const results = await Promise.all(updates);
    setSaving(false);
    const errors = results.filter((r) => r.error);
    if (errors.length) {
      toast.error(`${errors.length} tafel(s) niet opgeslagen`);
    } else {
      toast.success(`${ids.length} tafel(s) opgeslagen`);
      setDirty({});
    }
  };

  const resetLocal = () => { load(); setDirty({}); };

  const autoArrange = () => {
    // Eenvoudige raster-layout voor de huidige zone — nuttig na seed-data zonder coördinaten.
    const cols = 5;
    const cellW = 130;
    const cellH = 130;
    const padX = 30;
    const padY = 30;
    visible.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      updateLocal(t.id, {
        pos_x: snap(padX + col * cellW),
        pos_y: snap(padY + row * cellH),
        width: 90,
        height: 90,
      });
    });
    toast.info("Tafels in raster geplaatst — vergeet niet op te slaan.");
  };

  if (!zoneId && zones.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Voeg eerst een zone toe in het tabblad "Lijst".</p>
        </CardContent>
      </Card>
    );
  }

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="font-display text-lg">Plattegrond</CardTitle>
              <CardDescription>
                Sleep tafels naar hun fysieke positie. Hoekje rechtsonder = formaat aanpassen.
                Wijzigingen verschijnen direct in Floor Mode na opslaan.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowGrid((g) => !g)}>
                <Grid3x3 className="h-4 w-4 mr-1" /> Raster
              </Button>
              <Button variant="ghost" size="sm" onClick={autoArrange}>Auto-raster</Button>
              <Button variant="outline" size="sm" onClick={resetLocal} disabled={dirtyCount === 0}>
                <RotateCcw className="h-4 w-4 mr-1" /> Herstel
              </Button>
              <Button size="sm" onClick={saveAll} disabled={dirtyCount === 0 || saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Opslaan…" : dirtyCount > 0 ? `Opslaan (${dirtyCount})` : "Opgeslagen"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {zones.length > 1 && (
            <Tabs value={zoneId ?? ""} onValueChange={(v) => { setZoneId(v); setSelectedId(null); }}>
              <TabsList>
                {zones.map((z) => <TabsTrigger key={z.id} value={z.id}>{z.name}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          )}

          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerDown={() => setSelectedId(null)}
            className={cn(
              "relative rounded-lg border border-border bg-muted/20 overflow-auto select-none touch-none",
            )}
            style={{
              width: "100%",
              maxWidth: CANVAS_W,
              height: CANVAS_H,
              backgroundImage: showGrid
                ? `linear-gradient(to right, hsl(var(--border) / 0.4) 1px, transparent 1px),
                   linear-gradient(to bottom, hsl(var(--border) / 0.4) 1px, transparent 1px)`
                : undefined,
              backgroundSize: showGrid ? `${GRID}px ${GRID}px` : undefined,
            }}
          >
            <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
              {visible.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Geen tafels in deze zone — voeg ze toe via tabblad "Lijst".
                </div>
              )}
              {visible.map((t) => {
                const isSelected = t.id === selectedId;
                const isRound = t.shape === "round";
                return (
                  <div
                    key={t.id}
                    onPointerDown={(e) => onPointerDownTable(e, t)}
                    className={cn(
                      "absolute flex flex-col items-center justify-center border-2 cursor-grab active:cursor-grabbing transition-shadow",
                      isRound ? "rounded-full" : "rounded-md",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-lg ring-2 ring-primary/30"
                        : "border-border bg-card hover:border-primary/50",
                    )}
                    style={{ left: t.pos_x, top: t.pos_y, width: t.width, height: t.height }}
                  >
                    <div className="font-display text-sm pointer-events-none">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground pointer-events-none">
                      {t.capacity_min}-{t.capacity_max}p
                    </div>
                    {isSelected && (
                      <div
                        onPointerDown={(e) => onPointerDownResize(e, t)}
                        className="absolute -bottom-1 -right-1 h-4 w-4 rounded-sm bg-primary border-2 border-background cursor-se-resize"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Canvas {CANVAS_W}×{CANVAS_H}px · raster {GRID}px · {visible.length} tafel(s) in zone
          </p>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Tafel {selected.label}</CardTitle>
            <CardDescription>Eigenschappen van de geselecteerde tafel.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vorm</Label>
              <Select value={selected.shape} onValueChange={(v) => updateLocal(selected.id, { shape: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round"><Circle className="h-3 w-3 inline mr-2" />Rond</SelectItem>
                  <SelectItem value="square"><Square className="h-3 w-3 inline mr-2" />Vierkant</SelectItem>
                  <SelectItem value="rect"><RectangleHorizontal className="h-3 w-3 inline mr-2" />Rechthoek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zone</Label>
              <Select
                value={selected.zone_id ?? "none"}
                onValueChange={(v) => updateLocal(selected.id, { zone_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen zone</SelectItem>
                  {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Breedte (px)</Label>
              <Input
                type="number" min={40} max={CANVAS_W} step={GRID}
                value={selected.width}
                onChange={(e) => updateLocal(selected.id, { width: snap(parseInt(e.target.value) || 80) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hoogte (px)</Label>
              <Input
                type="number" min={40} max={CANVAS_H} step={GRID}
                value={selected.height}
                onChange={(e) => updateLocal(selected.id, { height: snap(parseInt(e.target.value) || 80) })}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
