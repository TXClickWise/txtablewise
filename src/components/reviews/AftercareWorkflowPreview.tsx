// Workflow preview — geen echte verzending; toont aftercare flow visueel.
import { CheckCircle2, MessageCircle, Star, AlertOctagon, Repeat, Clock } from "lucide-react";

const STEPS = [
  { i: CheckCircle2, t: "Bezoek afgerond",            note: "Trigger voor aftercare", state: "Voorbereid" },
  { i: MessageCircle, t: "Bedankbericht klaarzetten", note: "Template wordt later via ClickWise verstuurd", state: "Via ClickWise later" },
  { i: Clock,        t: "Tevredenheidsvraag",         note: "Heel goed · Goed · Matig · Niet goed", state: "Via ClickWise later" },
  { i: Star,         t: "Positief → Google Review",   note: "Uitnodiging voorbereid bij score 4 of 5", state: "Voorbereid" },
  { i: AlertOctagon, t: "Negatief → manager opvolging", note: "Persoonlijke opvolging eerst, geen publieke route", state: "Voorbereid" },
  { i: Repeat,       t: "Terugkomactie / winback",    note: "Komt later via ClickWise workflows",     state: "Nog niet actief" },
];

export function AftercareWorkflowPreview() {
  return (
    <ol className="space-y-2">
      {STEPS.map((s, idx) => (
        <li key={s.t} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <s.i className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{idx + 1}. {s.t}</div>
            <div className="text-xs text-muted-foreground">{s.note}</div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground self-center">
            {s.state}
          </span>
        </li>
      ))}
    </ol>
  );
}
