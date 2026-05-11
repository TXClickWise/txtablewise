// Drankjes vooraf — beheer pagina (CRUD voor pre_order_items + overzicht reserveringen met pre-orders).
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Wine, Sparkles, Pencil, Archive, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  archiveItem, createItem, formatPrice, listItems, getReadyListForToday,
  PRE_ORDER_CATEGORIES, seedStandardItems, updateItem, setShowInWidget,
  type PreOrderItem, type ReadyListEntry,
} from "@/services/preOrders";
import { PreOrderStatusBadge } from "@/components/pre-orders/PreOrderStatusBadge";
import { PreOrderReadyList } from "@/components/pre-orders/PreOrderReadyList";

type FormState = {
  name: string;
  description: string;
  category: string;
  price_cents: string;
  is_active: boolean;
  requires_payment: boolean;
  sort_order: number;
  show_in_widget: boolean;
};

const EMPTY: FormState = {
  name: "", description: "", category: "Aperitief", price_cents: "",
  is_active: true, requires_payment: false, sort_order: 100, show_in_widget: true,
};

type SourceFilter = "guest" | "loyverse" | "all";

const PreOrderDrinksPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;

  const [items, setItems] = useState<PreOrderItem[]>([]);
  const [today, setToday] = useState<ReadyListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PreOrderItem | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<SourceFilter>("guest");

  const refresh = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [its, ready] = await Promise.all([
        listItems(restaurantId, { includeInactive: true }),
        getReadyListForToday(restaurantId, format(new Date(), "yyyy-MM-dd")),
      ]);
      setItems(its);
      setToday(ready);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [restaurantId]);

  const counts = useMemo(() => ({
    widget: items.filter((i) => i.show_in_widget && i.is_active && !i.deleted_at).length,
    loyverse: items.filter((i) => i.pos_provider === "loyverse").length,
  }), [items]);

  const filtered = useMemo(() => items.filter((i) => {
    if (filterActive === "active" && !i.is_active) return false;
    if (filterActive === "inactive" && i.is_active) return false;
    if (filterCategory !== "all" && i.category !== filterCategory) return false;
    if (filterSource === "guest" && !i.show_in_widget) return false;
    if (filterSource === "loyverse" && i.pos_provider !== "loyverse") return false;
    return true;
  }), [items, filterActive, filterCategory, filterSource]);

  const openNew = () => {
    setEditing(null); setForm(EMPTY); setOpenForm(true);
  };
  const openEdit = (it: PreOrderItem) => {
    setEditing(it);
    setForm({
      name: it.name,
      description: it.description ?? "",
      category: it.category ?? "Overig",
      price_cents: it.price_cents != null ? String(it.price_cents) : "",
      is_active: it.is_active,
      requires_payment: it.requires_payment,
      sort_order: it.sort_order,
      show_in_widget: it.show_in_widget,
    });
    setOpenForm(true);
  };

  const toggleWidget = async (it: PreOrderItem) => {
    if (!restaurantId) return;
    try {
      await setShowInWidget(restaurantId, it.id, !it.show_in_widget);
      setItems((prev) => prev.map((p) => p.id === it.id ? { ...p, show_in_widget: !it.show_in_widget } : p));
      toast.success(it.show_in_widget ? "Item verborgen voor gasten." : "Item zichtbaar in gast-widget.");
    } catch {
      toast.error("Kon zichtbaarheid niet aanpassen.");
    }
  };

  const save = async () => {
    if (!restaurantId) return;
    if (!form.name.trim()) return toast.error("Vul een naam in voor dit item.");
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        price_cents: form.price_cents ? Math.max(0, parseInt(form.price_cents) || 0) : null,
        is_active: form.is_active,
        requires_payment: form.requires_payment,
        sort_order: form.sort_order,
        show_in_widget: form.show_in_widget,
      };
      if (editing) await updateItem(restaurantId, editing.id, payload);
      else await createItem(restaurantId, payload);
      toast.success(editing ? "Item bijgewerkt." : "Item toegevoegd.");
      setOpenForm(false);
      await refresh();
    } catch {
      toast.error("Item kon niet worden opgeslagen. Probeer het opnieuw.");
    } finally { setBusy(false); }
  };

  const archive = async (it: PreOrderItem) => {
    if (!restaurantId) return;
    if (!confirm(`Item "${it.name}" archiveren?`)) return;
    try { await archiveItem(restaurantId, it.id); await refresh(); toast.success("Item gearchiveerd."); }
    catch { toast.error("Archiveren mislukt."); }
  };

  const seed = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const n = await seedStandardItems(restaurantId);
      if (n > 0) toast.success(`${n} standaard items toegevoegd.`);
      else toast.info("Standaard items waren al aanwezig.");
      await refresh();
    } catch { toast.error("Kon standaard items niet toevoegen."); }
    finally { setBusy(false); }
  };

  if (!restaurantId) {
    return <div className="p-6 text-muted-foreground">Selecteer eerst een restaurant.</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl flex items-center gap-2">
            <Wine className="h-6 w-6 text-primary" /> Drankjes vooraf
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Laat gasten alvast iets klaarzetten bij aankomst. In deze MVP wordt dit als duidelijke notitie bij de
            reservering opgeslagen. Betaling en POS-koppeling kunnen later worden toegevoegd.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="lg" className="h-11" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Drankoptie toevoegen
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base font-display">Items</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {counts.widget} zichtbaar voor gasten
                    {counts.loyverse > 0 && <> · {counts.loyverse} uit Loyverse</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={filterSource} onValueChange={(v) => setFilterSource(v as SourceFilter)}>
                    <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">Gast-selectie</SelectItem>
                      <SelectItem value="loyverse">Uit Loyverse</SelectItem>
                      <SelectItem value="all">Alles</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterActive} onValueChange={(v) => setFilterActive(v as typeof filterActive)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Alleen actief</SelectItem>
                      <SelectItem value="inactive">Inactief</SelectItem>
                      <SelectItem value="all">Alles</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle categorieën</SelectItem>
                      {PRE_ORDER_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Laden…</p>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Er zijn nog geen drankjes of extra's ingesteld.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Drankoptie toevoegen</Button>
                    <Button onClick={seed} disabled={busy}>
                      <Sparkles className="h-4 w-4 mr-1" /> Standaardopties toevoegen
                    </Button>
                  </div>
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((it) => (
                    <li key={it.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{it.name}</span>
                          {!it.is_active && <span className="text-[11px] text-muted-foreground border rounded px-1">Inactief</span>}
                          {it.pos_provider === "loyverse" && (
                            <span className="text-[11px] text-primary border border-primary/30 rounded px-1">Loyverse</span>
                          )}
                          {it.show_in_widget ? (
                            <span className="text-[11px] text-success border border-success/30 rounded px-1">In widget</span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground border rounded px-1">Verborgen</span>
                          )}
                          {it.requires_payment && (
                            <span className="text-[11px] text-warning border border-warning/30 rounded px-1">
                              Betaling voorbereid
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {it.category ?? "Overig"}
                          {it.description && <> · {it.description}</>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        {formatPrice(it.price_cents) && (
                          <span className="text-sm tabular-nums">{formatPrice(it.price_cents)}</span>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => toggleWidget(it)}
                          title={it.show_in_widget ? "Verbergen voor gasten" : "Tonen in gast-widget"}
                        >
                          {it.show_in_widget ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(it)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => archive(it)}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Reserveringen vandaag met klaarzet-items</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
              ) : today.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Geen reserveringen met drankjes vooraf vandaag.
                </p>
              ) : (
                <ul className="divide-y">
                  {today.map((e) => (
                    <li key={e.preOrder.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm">
                          <span className="font-mono text-muted-foreground">
                            {format(new Date(e.startTime), "HH:mm")}
                          </span>
                          {" · "}
                          <span className="font-medium">{e.guestName}</span>
                          <span className="text-muted-foreground"> · {e.partySize}p</span>
                        </div>
                        <div className="text-sm">
                          {e.preOrder.quantity}× {e.preOrder.item_name}
                          {e.tableLabels.length > 0 && (
                            <span className="text-muted-foreground"> · Tafel {e.tableLabels.join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <PreOrderStatusBadge status={e.preOrder.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <PreOrderReadyList restaurantId={restaurantId} compact windowMinutes={120} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">POS-koppeling</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 pt-0">
              <p>Pre-orders kunnen later aan Loyverse of een ander POS-systeem worden gekoppeld.</p>
              <p>Voor MVP wordt er nog niet online afgerekend.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Item wijzigen" : "Nieuw item"}</DialogTitle>
            <DialogDescription>Prijs is optioneel. Voor MVP wordt er nog niet online afgerekend.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Naam</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Omschrijving</Label>
              <Textarea rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRE_ORDER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prijs (cent)</Label>
                <Input type="number" min={0} placeholder="optioneel"
                  value={form.price_cents}
                  onChange={(e) => setForm({ ...form, price_cents: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Volgorde</Label>
              <Input type="number" value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label>Actief</Label>
                <p className="text-xs text-muted-foreground">Inactieve items verschijnen niet in keuzelijsten.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Tonen in gast-widget</Label>
                <p className="text-xs text-muted-foreground">Bepaalt of gasten dit item zien tijdens reserveren. Items uit Loyverse staan standaard uit.</p>
              </div>
              <Switch checked={form.show_in_widget} onCheckedChange={(v) => setForm({ ...form, show_in_widget: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Aanbetaling vereist</Label>
                <p className="text-xs text-muted-foreground">Markeert dit item als betaal-vereist in het datamodel. Aanbetalingen worden later geactiveerd via de Aanbetalingen-module.</p>
              </div>
              <Switch checked={form.requires_payment}
                onCheckedChange={(v) => setForm({ ...form, requires_payment: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenForm(false)}>Annuleren</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreOrderDrinksPage;
