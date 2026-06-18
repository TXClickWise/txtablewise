// Gastenpagina — hospitality CRM met KPIs, filters, lijst en detailpanel.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Search, Plus, Mail, Phone, RefreshCw, Users, Crown, AlertTriangle, UserPlus, MailCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/touch/StateViews";
import { GuestBadges } from "@/components/guests/GuestBadges";
import { GuestFormSheet } from "@/components/guests/GuestFormSheet";
import { GuestNotesSection } from "@/components/guests/GuestNotesSection";
import { GuestReservationHistory } from "@/components/guests/GuestReservationHistory";
import { GuestNoShowSummary } from "@/components/guests/GuestNoShowSummary";
import { GuestClickWisePreview } from "@/components/guests/GuestClickWisePreview";
import { GuestPOSPanel } from "@/components/pos/GuestPOSPanel";
import { ReservationDetailDialog } from "@/components/ReservationDetailDialog";
import {
  deleteGuests, getClickWiseGuestMappingPreview, getGuest, getGuestKpis, getReservationHistory,
  listGuests, type DeleteGuestsResult, type Guest, type GuestFilter,
} from "@/services/guests";

const FILTERS: { value: GuestFilter; label: string }[] = [
  { value: "all",         label: "Alle" },
  { value: "returning",   label: "Terugkerend" },
  { value: "new",         label: "Nieuw" },
  { value: "vip",         label: "VIP" },
  { value: "allergy",     label: "Allergie" },
  { value: "no_show",     label: "No-show historie" },
  { value: "marketing",   label: "Marketing opt-in" },
  { value: "whatsapp",    label: "WhatsApp" },
  { value: "email",       label: "E-mail" },
];

const GuestsPage = () => {
  const { t } = useTranslation("app");
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const role = current?.role;
  const readOnly = role === "host" || role === "staff";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState<string | null>(null);

  // Bulk-selectie voor verwijderen
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blockedResult, setBlockedResult] = useState<DeleteGuestsResult["blocked"] | null>(null);

  const { data: kpis } = useQuery({
    queryKey: ["guest-kpis", restaurantId],
    enabled: !!restaurantId,
    queryFn: () => getGuestKpis(restaurantId!),
  });

  const { data: guests = [], isLoading, refetch } = useQuery({
    queryKey: ["guests-list", restaurantId, search, filter],
    enabled: !!restaurantId,
    queryFn: () => listGuests(restaurantId!, { search, filter }),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["guests-list"] });
    qc.invalidateQueries({ queryKey: ["guest-kpis"] });
    qc.invalidateQueries({ queryKey: ["guest", selectedId] });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allOnPageSelected = guests.length > 0 && guests.every((g) => selectedIds.has(g.id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(guests.map((g) => g.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSelected = async (ids: string[]) => {
    setDeleting(true);
    try {
      const res = await deleteGuests(ids);
      if (res.deleted.length > 0) {
        toast.success(
          res.deleted.length === 1
            ? "Gast verwijderd."
            : `${res.deleted.length} gasten verwijderd.`,
        );
      }
      if (res.blocked.length > 0) {
        setBlockedResult(res.blocked);
      } else {
        setConfirmOpen(false);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        res.deleted.forEach((id) => next.delete(id));
        return next;
      });
      // Sluit detail-sheet als de geopende gast weg is
      if (selectedId && res.deleted.includes(selectedId)) setSelectedId(null);
      refreshAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Verwijderen mislukt.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (!restaurantId) {
    return <div className="p-6 text-muted-foreground">Selecteer eerst een restaurant.</div>;
  }

  return (
    <div className="px-3 lg:px-4 py-3 space-y-5">
      <PageHeader
        title={t("guests.title")}
        description="Bewaar alleen informatie die helpt om gasten beter te ontvangen."
        actions={
          <>
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => refetch()} disabled={isLoading} aria-label={t("common.tryAgain")}>
              <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
            {!readOnly && (
              <Button size="lg" className="h-11" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> {t("guests.newGuest")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Totaal gasten"        value={kpis?.total ?? "—"}          icon={<Users className="h-5 w-5" />} tone="premium" />
        <KpiCard label="Terugkerend"          value={kpis?.returning ?? "—"}      icon={<Users className="h-5 w-5" />} accent="primary" />
        <KpiCard label="VIP"                  value={kpis?.vip ?? "—"}            icon={<Crown className="h-5 w-5" />} accent="warning" />
        <KpiCard label="Allergie"             value={kpis?.allergy ?? "—"}        icon={<AlertTriangle className="h-5 w-5" />} />
        <KpiCard label="Nieuw deze maand"     value={kpis?.newThisMonth ?? "—"}   icon={<UserPlus className="h-5 w-5" />} accent="success" />
        <KpiCard label="Marketing opt-in"     value={kpis?.marketingOptIn ?? "—"} icon={<MailCheck className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base font-display">{guests.length} profielen</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Zoek op naam, telefoon of e-mail…"
                value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as GuestFilter)}>
            <TabsList className="flex flex-wrap h-auto justify-start">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="text-xs">{f.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {!readOnly && guests.length > 0 && (
            <div className="flex items-center gap-3 py-2 border-b mb-1 -mt-1">
              <Checkbox
                checked={allOnPageSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Alles selecteren"
              />
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0
                  ? `${selectedIds.size} geselecteerd`
                  : "Selecteer gasten om te verwijderen"}
              </span>
              {selectedIds.size > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={clearSelection}>Wis selectie</Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setBlockedResult(null); setConfirmOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Verwijderen ({selectedIds.size})
                  </Button>
                </div>
              )}
            </div>
          )}
          {isLoading ? (
            <LoadingState label="Gasten laden…" />
          ) : guests.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="Nog geen gastprofielen"
              description="Voeg een eerste gast toe of laat reserveringen automatisch profielen aanmaken."
              action={
                readOnly ? undefined : (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Gast toevoegen
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y">
              {guests.map((g) => {
                const checked = selectedIds.has(g.id);
                return (
                  <li key={g.id} className="flex items-center gap-2">
                    {!readOnly && (
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSelect(g.id)}
                        aria-label="Selecteer gast"
                        className="ml-1"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedId(g.id)}
                      className="flex-1 text-left py-3 flex items-center gap-3 hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-display text-sm shrink-0">
                        {(g.first_name?.[0] ?? g.last_name?.[0] ?? "G").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {g.first_name ?? ""} {g.last_name ?? ""}
                            {!g.first_name && !g.last_name && "Onbekende gast"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {g.email ?? ""}{g.email && g.phone ? " · " : ""}{g.phone ?? ""}
                        </div>
                        <GuestBadges guest={g} max={4} className="mt-1" />
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <div>{g.total_visits ?? 0} bezoeken</div>
                        {g.last_visit_at && (
                          <div>laatste {format(new Date(g.last_visit_at), "d MMM", { locale: nl })}</div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <GuestDetailSheet
        guestId={selectedId}
        restaurantId={restaurantId}
        readOnly={readOnly}
        onOpenEdit={(g) => setEditing(g)}
        onOpenReservation={(id) => setReservationOpen(id)}
        onClose={() => setSelectedId(null)}
        onDelete={(id) => { setBlockedResult(null); setSelectedIds(new Set([id])); setConfirmOpen(true); }}
      />

      {!readOnly && (
        <>
          {/* Create */}
          <GuestFormSheet
            open={createOpen} onOpenChange={setCreateOpen}
            restaurantId={restaurantId}
            onSaved={() => { refreshAll(); }}
            onUseExisting={(g) => { setSelectedId(g.id); }}
          />
          {/* Edit */}
          <GuestFormSheet
            open={!!editing} onOpenChange={(o) => !o && setEditing(null)}
            restaurantId={restaurantId}
            guest={editing}
            onSaved={() => { refreshAll(); setEditing(null); }}
          />
        </>
      )}

      <ReservationDetailDialog
        reservationId={reservationOpen}
        open={!!reservationOpen}
        onOpenChange={(o) => !o && setReservationOpen(null)}
      />

      {/* Verwijder-bevestiging + geblokkeerde uitleg */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => { if (!o) { setConfirmOpen(false); setBlockedResult(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockedResult
                ? "Sommige gasten konden niet verwijderd worden"
                : `${selectedIds.size} gast${selectedIds.size === 1 ? "" : "en"} verwijderen?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {blockedResult ? (
                <div className="space-y-2">
                  <p>
                    Deze gasten hebben nog actieve of toekomstige reserveringen. Annuleer eerst de
                    openstaande reservering(en) en verwijder daarna opnieuw.
                  </p>
                  <ul className="text-sm border rounded-md divide-y">
                    {blockedResult.map((b) => (
                      <li key={b.guest_id} className="flex justify-between gap-3 px-3 py-2">
                        <span className="truncate">{b.name || "Onbekende gast"}</span>
                        <span className="text-muted-foreground shrink-0">
                          {b.active_reservations} actieve reservering{b.active_reservations === 1 ? "" : "en"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <span>
                  Persoonsgegevens en notities worden definitief gewist. Historische reserveringen
                  blijven bestaan (zonder naam-koppeling) zodat rapportages kloppen.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {blockedResult ? (
              <AlertDialogAction onClick={() => { setConfirmOpen(false); setBlockedResult(null); }}>
                Begrepen
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleDeleteSelected(Array.from(selectedIds)); }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Verwijderen…" : "Definitief verwijderen"}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function GuestDetailSheet({
  guestId, restaurantId, onClose, onOpenEdit, onOpenReservation, onDelete, readOnly = false,
}: {
  guestId: string | null;
  restaurantId: string;
  onClose: () => void;
  onOpenEdit: (g: Guest) => void;
  onOpenReservation: (id: string) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!guestId) { setGuest(null); return; }
    setLoading(true);
    getGuest(guestId).then(setGuest).finally(() => setLoading(false));
  }, [guestId]);

  // Load history once for ClickWise preview
  const [largeGroupCount, setLargeGroupCount] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<string | null>(null);
  useEffect(() => {
    if (!guestId) return;
    getReservationHistory(guestId).then((rs) => {
      setLargeGroupCount(rs.filter((r) => r.party_size >= 9).length);
      const past = rs.filter((r) => new Date(r.start_time as string) < new Date());
      const future = rs.filter((r) => new Date(r.start_time as string) >= new Date());
      setLastDate(past[0]?.reservation_date as string ?? null);
      setNextDate(future[future.length - 1]?.reservation_date as string ?? null);
    });
  }, [guestId]);

  const preview = useMemo(() => guest
    ? getClickWiseGuestMappingPreview(guest, { last: lastDate, next: nextDate, largeGroups: largeGroupCount })
    : null, [guest, lastDate, nextDate, largeGroupCount]);

  return (
    <Sheet open={!!guestId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            {guest ? `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim() || "Gast" : "Gast"}
          </SheetTitle>
        </SheetHeader>

        {loading || !guest ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Laden…</p>
        ) : (
          <div className="space-y-5 mt-4">
            <GuestBadges guest={guest} largeGroupCount={largeGroupCount} />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Gastgegevens</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                  <div className="text-muted-foreground">E-mail</div>
                  <div className="truncate">{guest.email ?? "—"}</div>
                  <div className="text-muted-foreground">Telefoon</div>
                  <div>{guest.phone ?? "—"}</div>
                  <div className="text-muted-foreground">Voorkeurkanaal</div>
                  <div>{guest.preferred_channel ?? "—"}</div>
                  <div className="text-muted-foreground">Taal</div>
                  <div>{guest.language ?? "nl"}</div>
                  <div className="text-muted-foreground">Marketing toegestaan</div>
                  <div>{guest.marketing_consent ? "Ja" : "Nee"}</div>
                </div>
                <div className="flex gap-2 pt-2 flex-wrap">
                  {guest.email && <Button variant="outline" size="sm" asChild><a href={`mailto:${guest.email}`}><Mail className="h-3.5 w-3.5 mr-1" /> Mail</a></Button>}
                  {guest.phone && <Button variant="outline" size="sm" asChild><a href={`tel:${guest.phone}`}><Phone className="h-3.5 w-3.5 mr-1" /> Bel</a></Button>}
                  {!readOnly && (
                    <>
                      <Button size="sm" className="ml-auto" onClick={() => onOpenEdit(guest)}>Wijzigen</Button>
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(guest.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Verwijderen
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Hospitality profiel</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm space-y-2">
                {guest.allergies && (
                  <div className="rounded bg-destructive/10 border border-destructive/20 px-2 py-1.5 text-destructive text-sm">
                    <span className="font-medium">Allergie:</span> {guest.allergies}
                  </div>
                )}
                {guest.dietary_preferences && (
                  <div><span className="text-muted-foreground">Dieet:</span> {guest.dietary_preferences}</div>
                )}
                {guest.seating_preferences && (
                  <div><span className="text-muted-foreground">Zitvoorkeur:</span> {guest.seating_preferences}</div>
                )}
                {guest.hospitality_notes && (
                  <div className="text-muted-foreground italic">"{guest.hospitality_notes}"</div>
                )}
                {!guest.allergies && !guest.dietary_preferences && !guest.seating_preferences && !guest.hospitality_notes && (
                  <p className="text-muted-foreground">Nog geen voorkeuren of notities ingesteld.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">No-show & annuleringen</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <GuestNoShowSummary guest={guest} />
              </CardContent>
            </Card>

            <GuestReservationHistory guestId={guest.id} onOpenReservation={onOpenReservation} />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Notities</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <GuestNotesSection restaurantId={restaurantId} guestId={guest.id} readOnly={readOnly} />
              </CardContent>
            </Card>

            {preview && <GuestClickWisePreview preview={preview} />}

            <GuestPOSPanel restaurantId={restaurantId} guestId={guest.id} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default GuestsPage;
