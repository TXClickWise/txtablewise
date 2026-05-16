import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, ExternalLink, Clock } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type Props = { reservationId: string };

type CallLog = {
  id: string;
  provider: string | null;
  outcome: string | null;
  caller_phone: string | null;
  duration_seconds: number | null;
  cost_cents: number | null;
  transcript_url: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function ReservationCallLogSection({ reservationId }: Props) {
  const { data: logs } = useQuery({
    queryKey: ["reservation-call-logs", reservationId],
    enabled: !!reservationId,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_call_logs")
        .select("id, provider, outcome, caller_phone, duration_seconds, cost_cents, transcript_url, summary, metadata, created_at")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false });
      return (data ?? []) as CallLog[];
    },
  });

  if (!logs || logs.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Telefoongesprek{logs.length > 1 ? `ken (${logs.length})` : ""}</h3>
      </div>
      <div className="space-y-3">
        {logs.map((log) => {
          const transcript = (log.metadata as any)?.transcript as string | undefined;
          const recordingUrl = (log.metadata as any)?.recording_url as string | undefined;
          return (
            <div key={log.id} className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(log.created_at), "d MMM HH:mm", { locale: nl })}</span>
                {log.caller_phone && <span>· {log.caller_phone}</span>}
                {log.duration_seconds != null && (
                  <span>· {Math.floor(log.duration_seconds / 60)}m {log.duration_seconds % 60}s</span>
                )}
                {log.outcome && (
                  <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{log.outcome}</span>
                )}
                {log.cost_cents != null && (
                  <span>· €{(log.cost_cents / 100).toFixed(2)}</span>
                )}
              </div>
              {log.summary && (
                <p className="text-sm text-foreground bg-muted/40 rounded p-2 leading-relaxed">
                  {log.summary}
                </p>
              )}
              {transcript && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Volledig transcript
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans bg-muted/40 rounded p-2 max-h-64 overflow-y-auto">
                    {transcript}
                  </pre>
                </details>
              )}
              <div className="flex gap-3 text-xs">
                {recordingUrl && (
                  <a href={recordingUrl} target="_blank" rel="noopener" className="text-primary inline-flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Opname beluisteren
                  </a>
                )}
                {log.transcript_url && (
                  <a href={log.transcript_url} target="_blank" rel="noopener" className="text-primary inline-flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Transcript-bestand
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
