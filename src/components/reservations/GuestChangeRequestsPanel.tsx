import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { AlertCircle, ArrowRight, Check, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Row = {
  id: string;
  reservation_id: string;
  reason_code: string | null;
  current_reservation_date: string | null;
  current_start_time: string | null;
  current_party_size: number | null;
  desired_reservation_date: string | null;
  desired_time: string | null;
  desired_party_size: number | null;
  message: string | null;
  guest_name: string | null;
  guest_email: string | null;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  large_party_needs_staff: "Grote groep — handmatige goedkeuring",
  auto_apply_disabled: "Automatisch toepassen staat uit",
};

export function GuestChangeRequestsPanel({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{ row: Row; action: "approve" | "reject" } | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["guest-change-requests-new", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_change_requests")
        .select("id, reservation_id, reason_code, current_reservation_date, current_start_time, current_party_size, desired_reservation_date, desired_time, desired_party_size, message, guest_name, guest_email, created_at")
        .eq("restaurant_id", restaurantId)
        .eq("status", "new")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`gcr-panel:${restaurantId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "guest_change_requests", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["guest-change-requests-new", restaurantId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc]);

  if (rows.length === 0) return null;

  async function submit() {
    if (!pendingAction) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("review_guest_change", {
        body: {
          request_id: pendingAction.row.id,
          action: pendingAction.action,
          reviewer_note: reviewerNote || undefined,
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Onbekende fout";
        toast.error(msg === "no_table_available"
          ? "Geen tafel beschikbaar op de gewenste tijd."
          : `Niet gelukt: ${msg}`);
      } else {
        toast.success(pendingAction.action === "approve" ? "Wijziging goedgekeurd." : "Wijziging afgewezen.");
        qc.invalidateQueries({ queryKey: ["guest-change-requests-new", restaurantId] });
        qc.invalidateQueries({ queryKey: ["pending-guest-changes", restaurantId] });
        qc.invalidateQueries({ queryKey: ["reservations-today"] });
        setPendingAction(null);
        setReviewerNote("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SectionCard
        title={`Wijzigingsverzoeken van gasten (${rows.length})`}
        icon={<AlertCircle />}
      >
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium">{r.guest_name || "Gast"}</div>
                  {r.reason_code && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {REASON_LABELS[r.reason_code] ?? r.reason_code}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "d MMM HH:mm", { locale: nl })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm">
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Huidig</div>
                  <div>{r.current_reservation_date ? format(new Date(r.current_reservation_date), "EEEE d MMMM", { locale: nl }) : "—"}</div>
                  <div>{r.current_start_time ? format(new Date(r.current_start_time), "HH:mm") : "—"} · {r.current_party_size} pers.</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto hidden sm:block" />
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gewenst</div>
                  <div>{r.desired_reservation_date ? format(new Date(r.desired_reservation_date), "EEEE d MMMM", { locale: nl }) : "—"}</div>
                  <div>{r.desired_time || "—"} · {r.desired_party_size} pers.</div>
                </div>
              </div>

              {r.message && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-md p-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="italic">"{r.message}"</span>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => { setPendingAction({ row: r, action: "approve" }); setReviewerNote(""); }}>
                  <Check className="h-4 w-4 mr-1" /> Goedkeuren
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setPendingAction({ row: r, action: "reject" }); setReviewerNote(""); }}>
                  <X className="h-4 w-4 mr-1" /> Afwijzen
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <Dialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.action === "approve" ? "Wijziging goedkeuren" : "Wijziging afwijzen"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.action === "approve"
                ? "We voeren de wijziging door en sturen de gast een bevestiging."
                : "Geef een korte reden mee. Die wordt opgenomen in de mail naar de gast."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={pendingAction?.action === "approve" ? "Optionele interne notitie" : "Reden voor de gast (bv. 'helaas vol op die tijd')"}
            value={reviewerNote}
            onChange={(e) => setReviewerNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={submitting}>Annuleren</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Bezig…" : pendingAction?.action === "approve" ? "Goedkeuren" : "Afwijzen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
