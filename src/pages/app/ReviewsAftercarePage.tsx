// Reviews & aftercare — overzicht, filters, detail, templates en workflow preview.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Sparkles, Star, AlertOctagon, MessageSquare, ThumbsUp, ThumbsDown,
  ChevronRight, Filter, RefreshCw,
} from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getReviewRequests, getAftercareDashboardStats,
  prepareGoogleReviewInvite, skipReviewRequest, markReviewFollowUpCompleted,
  type ReviewWithReservation, type ReviewFilter, type AftercareStats,
} from "@/services/reviews";
import { ReviewStatusBadge } from "@/components/reviews/ReviewStatusBadge";
import { FeedbackForm } from "@/components/reviews/FeedbackForm";
import { AftercareTemplatePreview } from "@/components/reviews/AftercareTemplatePreview";
import { AftercareWorkflowPreview } from "@/components/reviews/AftercareWorkflowPreview";

const FILTERS: { v: ReviewFilter; l: string }[] = [
  { v: "all",            l: "Alle" },
  { v: "ready_to_send",  l: "Klaar voor ClickWise" },
  { v: "responded",      l: "Feedback ontvangen" },
  { v: "positive",       l: "Positief" },
  { v: "neutral",        l: "Neutraal" },
  { v: "negative",       l: "Negatief" },
  { v: "follow_up",      l: "Opvolging nodig" },
  { v: "google_invited", l: "Google Review voorbereid" },
  { v: "skipped",        l: "Overgeslagen" },
];

const ReviewsAftercarePage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const restaurantName = current?.restaurants?.name ?? "ons restaurant";

  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [items, setItems] = useState<ReviewWithReservation[]>([]);
  const [stats, setStats] = useState<AftercareStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        getReviewRequests(restaurantId, filter),
        getAftercareDashboardStats(restaurantId),
      ]);
      setItems(list);
      setStats(s);
    } catch (e) {
      toast.error("Kon de reviews niet laden.");
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [restaurantId, filter]);

  const open = useMemo(() => items.find((i) => i.id === openId) ?? null, [items, openId]);

  if (!restaurantId) {
    return <div className="p-6 text-muted-foreground">Selecteer eerst een restaurant.</div>;
  }

  const kpiCards = [
    { l: "Klaar voor reviewverzoek",   v: stats?.ready ?? 0,         icon: Sparkles },
    { l: "Feedback ontvangen",          v: stats?.responded ?? 0,     icon: MessageSquare },
    { l: "Positieve feedback",          v: stats?.positive ?? 0,      icon: ThumbsUp },
    { l: "Interne opvolging nodig",     v: stats?.followUp ?? 0,      icon: AlertOctagon },
    { l: "Google Review voorbereid",    v: stats?.googleInvited ?? 0, icon: Star },
    { l: "Gemiddelde score",            v: stats?.averageScore ?? "—", icon: ThumbsUp },
  ];

  const handleGoogle = async (id: string) => {
    const r = await prepareGoogleReviewInvite(id);
    if (!r.ok) return toast.error(r.error || "Kon de uitnodiging niet voorbereiden.");
    toast.success("Google Review uitnodiging voorbereid.");
    refresh();
  };
  const handleSkip = async (id: string) => {
    const r = await skipReviewRequest(id);
    if (!r.ok) return toast.error(r.error || "Kon niet worden overgeslagen.");
    toast.success("Aftercare overgeslagen.");
    refresh();
  };
  const handleResolve = async (id: string) => {
    const r = await markReviewFollowUpCompleted(id);
    if (!r.ok) return toast.error(r.error || "Kon niet worden afgerond.");
    toast.success("Opvolging afgerond.");
    refresh();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-display font-semibold">Reviews & aftercare</h1>
        <p className="text-sm text-muted-foreground">
          Houd contact ná het bezoek. Tevreden gasten naar Google, ontevreden gasten naar de manager — niet andersom.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((k) => (
          <Card key={k.l}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{k.l}</div>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold mt-1">{k.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Reviewverzoeken
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Vernieuwen
            </Button>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as ReviewFilter)} className="mt-2">
            <TabsList className="flex flex-wrap h-auto bg-transparent p-0 gap-1">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.v} value={f.v} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {f.l}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Reviewverzoeken laden…</p>
          ) : items.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <p className="text-sm font-medium">Er staan nog geen reviewverzoeken klaar.</p>
              <p className="text-xs text-muted-foreground">
                Reviewverzoeken worden voorbereid nadat een bezoek is afgerond.
              </p>
            </div>
          ) : (
            items.map((it) => {
              const guestName = `${it.reservations?.guests?.first_name ?? ""} ${it.reservations?.guests?.last_name ?? ""}`.trim() || "Gast";
              const visitDate = it.reservations?.start_time
                ? format(new Date(it.reservations.start_time), "d MMM · HH:mm", { locale: nl })
                : "—";
              return (
                <button
                  key={it.id}
                  onClick={() => setOpenId(it.id)}
                  className="w-full text-left rounded-lg border p-3 hover:bg-accent transition flex items-start gap-3 min-h-14"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{guestName}</span>
                      <span className="text-xs text-muted-foreground">{visitDate}</span>
                      {it.reservations?.party_size && (
                        <Badge variant="outline" className="text-xs">{it.reservations.party_size} pers.</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ReviewStatusBadge status={it.status} />
                      {it.satisfaction && (
                        <span className="text-xs text-muted-foreground">Score {it.satisfaction}/5</span>
                      )}
                      {it.manager_follow_up_required && (
                        <Badge variant="secondary" className="bg-destructive/15 text-destructive text-xs">Opvolging nodig</Badge>
                      )}
                      {it.google_review_requested && (
                        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">Google Review voorbereid</Badge>
                      )}
                    </div>
                    {it.feedback_text && (
                      <p className="text-xs text-muted-foreground italic line-clamp-1">"{it.feedback_text}"</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Aftercare workflow</CardTitle></CardHeader>
          <CardContent><AftercareWorkflowPreview /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
          <CardContent><AftercareTemplatePreview restaurantName={restaurantName} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Rapportagepreview</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
          <Stat label="Reviewverzoeken klaar"       v={stats?.ready ?? 0} />
          <Stat label="Feedback ontvangen"           v={stats?.responded ?? 0} />
          <Stat label="Positieve feedback"           v={stats?.positive ?? 0} />
          <Stat label="Neutrale feedback"            v={stats?.neutral ?? 0} />
          <Stat label="Negatieve feedback"           v={stats?.negative ?? 0} />
          <Stat label="Opvolging nodig"              v={stats?.followUp ?? 0} />
          <Stat label="Google Review uitnodigingen"  v={stats?.googleInvited ?? 0} />
          <Stat label="Overgeslagen"                 v={stats?.skipped ?? 0} />
          <Stat label="Gemiddelde tevredenheid"      v={stats?.averageScore ?? "—"} />
        </CardContent>
      </Card>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Reviewverzoek</SheetTitle>
          </SheetHeader>
          {open && (
            <div className="space-y-4 mt-4">
              <div className="space-y-1">
                <div className="font-medium">
                  {`${open.reservations?.guests?.first_name ?? ""} ${open.reservations?.guests?.last_name ?? ""}`.trim() || "Gast"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {open.reservations?.start_time && format(new Date(open.reservations.start_time), "EEEE d MMM · HH:mm", { locale: nl })}
                  {open.reservations?.party_size ? ` · ${open.reservations.party_size} pers.` : ""}
                </div>
                <div className="pt-1"><ReviewStatusBadge status={open.status} /></div>
              </div>

              {open.feedback_text && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm italic">"{open.feedback_text}"</div>
              )}
              {open.internal_note && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Interne notitie</div>
                  <p className="text-sm">{open.internal_note}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(open.satisfaction ?? 0) >= 4 && !open.google_review_requested && (
                  <Button onClick={() => handleGoogle(open.id)} className="min-h-11">
                    <Star className="h-4 w-4 mr-1" /> Google Review uitnodiging voorbereiden
                  </Button>
                )}
                {open.manager_follow_up_required && open.follow_up_status !== "resolved" && (
                  <Button variant="outline" onClick={() => handleResolve(open.id)} className="min-h-11">
                    <ThumbsDown className="h-4 w-4 mr-1" /> Markeer als opgevolgd
                  </Button>
                )}
                {open.status !== "skipped" && !open.responded_at && (
                  <Button variant="ghost" onClick={() => handleSkip(open.id)} className="min-h-11">
                    Overslaan
                  </Button>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Feedback registreren
                </div>
                <FeedbackForm reviewId={open.id} onSaved={refresh} />
              </div>

              <p className="text-[11px] text-muted-foreground">
                Geen echte berichten zijn verstuurd — verzending loopt later via ClickWise-workflows.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{v}</div>
    </div>
  );
}

export default ReviewsAftercarePage;
