import { Badge } from "@/components/ui/badge";
import type { ReviewStatus } from "@/services/reviews";

const META: Record<ReviewStatus, { label: string; cls: string }> = {
  pending:               { label: "In voorbereiding",        cls: "bg-muted text-foreground" },
  ready_to_send:         { label: "Klaar voor ClickWise",    cls: "bg-primary/15 text-primary" },
  sent:                  { label: "Klaargezet",              cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  responded:             { label: "Feedback ontvangen",      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  positive:              { label: "Positieve feedback",      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  neutral:               { label: "Neutrale feedback",       cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  negative:              { label: "Negatieve feedback",      cls: "bg-destructive/15 text-destructive" },
  follow_up_required:    { label: "Opvolging nodig",         cls: "bg-destructive/15 text-destructive" },
  google_review_invited: { label: "Google Review voorbereid",cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  skipped:               { label: "Overgeslagen",            cls: "bg-muted text-muted-foreground" },
  failed:                { label: "Mislukt",                 cls: "bg-destructive/15 text-destructive" },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const m = META[status] ?? META.pending;
  return <Badge variant="secondary" className={m.cls}>{m.label}</Badge>;
}
