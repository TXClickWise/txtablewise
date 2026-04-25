// Interne feedback registratie — kort, gastvrij, met automatische status op basis van rating.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { recordGuestFeedback, classifyRating } from "@/services/reviews";

type Props = {
  reviewId: string;
  onSaved: () => void;
};

const RATING_LABELS = ["Heel slecht", "Slecht", "Matig", "Goed", "Heel goed"];

export function FeedbackForm({ reviewId, onSaved }: Props) {
  const [rating, setRating] = useState<number>(5);
  const [text, setText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [saving, setSaving] = useState(false);

  const cls = classifyRating(rating);
  const guidance =
    cls === "positive"
      ? "Bij positieve feedback kun je daarna een Google Review uitnodiging voorbereiden."
      : cls === "neutral"
      ? "Neem deze feedback mee om de gastbeleving verder te verbeteren."
      : "Deze feedback vraagt om persoonlijke opvolging voordat je om een publieke review vraagt.";

  const submit = async () => {
    setSaving(true);
    const r = await recordGuestFeedback(reviewId, {
      rating,
      feedbackText: text.trim() || undefined,
      internalNote: internalNote.trim() || undefined,
      followUpRequired: followUp || cls === "negative",
    });
    setSaving(false);
    if (!r.ok) return toast.error(r.error || "De feedback kon niet worden opgeslagen.");
    toast.success("Deze feedback is opgeslagen.");
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Score</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`min-h-11 px-4 rounded-md border text-sm transition ${
                rating === n
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-input hover:bg-accent"
              }`}
            >
              {n} · {RATING_LABELS[n - 1]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{guidance}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fb-text">Feedback van de gast (optioneel)</Label>
        <Textarea id="fb-text" rows={3} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Korte samenvatting van wat de gast aangaf…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fb-internal">Interne notitie (optioneel)</Label>
        <Textarea id="fb-internal" rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)}
          placeholder="Voor het team — niet zichtbaar voor de gast." />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Persoonlijke opvolging nodig</div>
          <p className="text-xs text-muted-foreground">Manager neemt contact op met de gast.</p>
        </div>
        <Switch checked={followUp || cls === "negative"} disabled={cls === "negative"}
          onCheckedChange={setFollowUp} />
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving} className="min-h-11">
          {saving ? "Opslaan…" : "Feedback opslaan"}
        </Button>
      </div>
    </div>
  );
}
