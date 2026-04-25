// Aftercare sectie binnen ReservationDetailDialog. Toont status of nodigt uit om aan te maken.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Star, MessageSquare, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  createReviewRequestForReservation, getReviewByReservation,
  prepareGoogleReviewInvite, skipReviewRequest, type ReviewRequest,
} from "@/services/reviews";
import { ReviewStatusBadge } from "@/components/reviews/ReviewStatusBadge";
import { FeedbackForm } from "@/components/reviews/FeedbackForm";

type Props = {
  reservationId: string;
  reservationStatus: string;
};

const COMPLETED = ["completed", "finished"];

export function ReservationAftercareSection({ reservationId, reservationStatus }: Props) {
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setReview(await getReviewByReservation(reservationId));
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [reservationId]);

  if (!COMPLETED.includes(reservationStatus)) {
    return (
      <div className="rounded-lg border border-dashed p-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" /> Aftercare
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Aftercare start nadat het bezoek is afgerond.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="rounded-lg border p-3 text-xs text-muted-foreground">Aftercare laden…</div>;
  }

  const create = async () => {
    setCreating(true);
    const r = await createReviewRequestForReservation(reservationId);
    setCreating(false);
    if (!r.ok) return toast.error(r.error || "Kon aftercare niet voorbereiden.");
    toast.success(r.created ? "Reviewverzoek voorbereid." : "Er was al een reviewverzoek.");
    refresh();
  };

  if (!review) {
    return (
      <div className="rounded-lg border p-3 space-y-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Aftercare
        </div>
        <p className="text-xs text-muted-foreground">
          Bereid een bedankbericht en tevredenheidsvraag voor — verzending loopt later via ClickWise.
        </p>
        <Button size="sm" onClick={create} disabled={creating} className="min-h-10">
          {creating ? "Voorbereiden…" : "Reviewverzoek voorbereiden"}
        </Button>
      </div>
    );
  }

  const handleGoogle = async () => {
    const r = await prepareGoogleReviewInvite(review.id);
    if (!r.ok) return toast.error(r.error || "Kon de uitnodiging niet voorbereiden.");
    toast.success("Google Review uitnodiging voorbereid.");
    refresh();
  };

  const handleSkip = async () => {
    const r = await skipReviewRequest(review.id);
    if (!r.ok) return toast.error(r.error || "Kon niet worden overgeslagen.");
    toast.success("Aftercare overgeslagen.");
    refresh();
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Aftercare
        </div>
        <ReviewStatusBadge status={review.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-muted/40 p-2">
          <div className="text-muted-foreground">Feedback ontvangen</div>
          <div className="font-medium">{review.responded_at ? "Ja" : "Nog niet"}</div>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <div className="text-muted-foreground">Score</div>
          <div className="font-medium">{review.satisfaction ?? "—"}</div>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <div className="text-muted-foreground">Google Review</div>
          <div className="font-medium">{review.google_review_requested ? "Voorbereid" : "Nog niet"}</div>
        </div>
        <div className="rounded bg-muted/40 p-2">
          <div className="text-muted-foreground">Opvolging nodig</div>
          <div className="font-medium">{review.manager_follow_up_required ? "Ja" : "Nee"}</div>
        </div>
      </div>

      {review.feedback_text && (
        <p className="text-xs text-muted-foreground italic">"{review.feedback_text}"</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="min-h-10" onClick={() => setShowForm((v) => !v)}>
          <MessageSquare className="h-4 w-4 mr-1" />
          {review.responded_at ? "Feedback bijwerken" : "Feedback registreren"}
          <ChevronRight className={`h-4 w-4 ml-1 transition ${showForm ? "rotate-90" : ""}`} />
        </Button>
        {(review.satisfaction ?? 0) >= 4 && !review.google_review_requested && (
          <Button size="sm" className="min-h-10" onClick={handleGoogle}>
            <Star className="h-4 w-4 mr-1" /> Google Review uitnodiging voorbereiden
          </Button>
        )}
        {review.status !== "skipped" && !review.responded_at && (
          <Button size="sm" variant="ghost" className="min-h-10 ml-auto" onClick={handleSkip}>
            Overslaan
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-md border p-3 bg-muted/20">
          <FeedbackForm
            reviewId={review.id}
            onSaved={() => { setShowForm(false); refresh(); }}
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Bij positieve feedback kun je de gast uitnodigen om een Google Review te plaatsen.
        Bij matige of negatieve feedback kan het team eerst persoonlijk opvolgen.
      </p>
    </div>
  );
}
