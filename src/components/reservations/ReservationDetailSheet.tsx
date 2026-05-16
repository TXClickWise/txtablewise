// ReservationDetailSheet — uitgebreid zijpaneel met 4 tabs.
// Bevat samenvatting + status-quick-actions (zelfde service als Dialog),
// gastprofiel, activiteit-tijdlijn en integratie-logs.
// Voor zwaardere edits opent het de bestaande ReservationDetailDialog.
import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import {
  CheckCircle2, UserCheck, XCircle, AlertOctagon, Pencil, ExternalLink,
  Clock, Bell, History, Plug, Phone,
} from "lucide-react";
import { reservations as resService } from "@/services/reservations";
import { ReservationStatusQuickBar } from "./ReservationStatusQuickBar";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Props = {
  reservationId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenFullEditor: (id: string) => void;
};

const RISK_BADGE: Record<string, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

export function ReservationDetailSheet({ reservationId, open, onOpenChange, onOpenFullEditor }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reservation-detail", reservationId],
    enabled: !!reservationId && open,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select(`
          *,
          guests(*),
          reservation_tables(table_id, tables(label, zones(name)))
        `)
        .eq("id", reservationId!).maybeSingle();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["reservation-history", reservationId],
    enabled: !!reservationId && open,
    queryFn: async () => {
      const { data } = await supabase.from("reservation_status_history")
        .select("id, old_status, new_status, changed_by_type, reason, created_at")
        .eq("reservation_id", reservationId!).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["reservation-reminders", reservationId],
    enabled: !!reservationId && open,
    queryFn: async () => {
      const { data } = await supabase.from("reservation_reminders")
        .select("id, reminder_type, channel, status, scheduled_for, sent_at, error_message")
        .eq("reservation_id", reservationId!).order("scheduled_for", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: agentCall } = useQuery({
    queryKey: ["reservation-agent-call", reservationId],
    enabled: !!reservationId && open,
    queryFn: async () => {
      const { data } = await supabase.from("agent_call_logs")
        .select("id, provider, agent_id, outcome, duration_seconds, summary, transcript_url, caller_phone, created_at")
        .eq("reservation_id", reservationId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: integrationLogs = [] } = useQuery({
    queryKey: ["reservation-integration-logs", reservationId],
    enabled: !!reservationId && open,
    queryFn: async () => {
      const { data } = await supabase.from("integration_logs")
        .select("id, source, action, status, error_code, possible_cause, http_status, latency_ms, created_at")
        .eq("reservation_id", reservationId!).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const status = data?.status as string | undefined;
  const canSeat = status === "confirmed" || status === "pending";
  const canComplete = status === "seated";
  const canNoShow = status === "confirmed" || status === "pending";
  const canCancel = status && ["pending", "confirmed", "seated", "hold"].includes(status);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["reservation-detail", reservationId] });
    qc.invalidateQueries({ queryKey: ["reservation-history", reservationId] });
    qc.invalidateQueries({ queryKey: ["reservations-day"] });
    qc.invalidateQueries({ queryKey: ["reservations-week"] });
    qc.invalidateQueries({ queryKey: ["agenda-day"] });
  };

  const run = async (kind: "seated" | "completed" | "cancel" | "no_show") => {
    if (!reservationId) return;
    setBusy(true);
    let res;
    switch (kind) {
      case "seated":    res = await resService.markSeated(reservationId); break;
      case "completed": res = await resService.markCompleted(reservationId); break;
      case "cancel":    res = await resService.cancel(reservationId); break;
      case "no_show":   res = await resService.markNoShow(reservationId); break;
    }
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "Actie mislukt.");
    const messages: Record<string, string> = {
      seated: "Gast staat op 'aangekomen'.",
      completed: "Bezoek afgerond.",
      cancel: "Geannuleerd. De tafel komt weer beschikbaar.",
      no_show: "Gemarkeerd als no-show.",
    };
    toast.success(messages[kind]);
    refresh();
  };

  const guest = data?.guests as any;
  const display = data ? {
    first_name: (data as any).guest_first_name ?? guest?.first_name ?? null,
    last_name:  (data as any).guest_last_name  ?? guest?.last_name  ?? null,
    email:      (data as any).guest_email      ?? guest?.email      ?? null,
    phone:      (data as any).guest_phone      ?? guest?.phone      ?? null,
  } : null;
  const tableLabels = useMemo(() => (
    (data?.reservation_tables as any[] ?? [])
      .map((rt) => rt?.tables?.label).filter(Boolean).join(", ")
  ), [data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="font-display text-xl">Reservering</SheetTitle>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="p-6 text-sm text-muted-foreground">Laden…</div>
        ) : (
          <>
            <div className="p-4 border-b border-border space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={data.status === "finished" ? "completed" : data.status} />
                <ChannelBadge channel={data.channel as never} />
                {data.no_show_risk && data.no_show_risk !== "low" && (
                  <Badge className={cn("border-0", RISK_BADGE[data.no_show_risk])}>
                    No-show risico: {data.no_show_risk}
                  </Badge>
                )}
                {data.confirmation_code && (
                  <span className="font-mono text-xs text-muted-foreground ml-auto">
                    {data.confirmation_code}
                  </span>
                )}
              </div>
              <div>
                <div className="font-display text-lg">
                  {display?.first_name ?? "Gast"} {display?.last_name ?? ""}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(data.start_time), "EEE d MMM yyyy · HH:mm", { locale: nl })}{" "}
                  · {data.party_size} pers.
                  {tableLabels && <> · Tafel {tableLabels}</>}
                </div>
              </div>

              {/* Quick status actions — uniform overal, met duidelijke header */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status wijzigen
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { onOpenFullEditor(data.id); onOpenChange(false); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Bewerk details
                  </Button>
                </div>
                <ReservationStatusQuickBar
                  reservationId={data.id}
                  status={data.status}
                  size="md"
                  onChanged={refresh}
                />
              </div>
            </div>

            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 grid grid-cols-4">
                <TabsTrigger value="overview">Overzicht</TabsTrigger>
                <TabsTrigger value="guest">Gast</TabsTrigger>
                <TabsTrigger value="activity">Activiteit</TabsTrigger>
                <TabsTrigger value="integrations">Integraties</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                <Block title="Notities">
                  {data.special_requests && (
                    <div><span className="text-muted-foreground text-xs">Wens van gast: </span>{data.special_requests}</div>
                  )}
                  {data.internal_notes && (
                    <div><span className="text-muted-foreground text-xs">Intern: </span>{data.internal_notes}</div>
                  )}
                  {data.dietary_notes && (
                    <div><span className="text-muted-foreground text-xs">Dieet: </span>{data.dietary_notes}</div>
                  )}
                  {!data.special_requests && !data.internal_notes && !data.dietary_notes && (
                    <p className="text-sm text-muted-foreground">Geen notities.</p>
                  )}
                </Block>

                <Block title="Tags">
                  {(data.no_show_risk_factors as any[])?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(data.no_show_risk_factors as any[]).map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {typeof f === "string" ? f : f.label ?? JSON.stringify(f)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Geen risico-signalen.</p>
                  )}
                </Block>

                <Block title="Pre-orders">
                  <p className="text-sm text-muted-foreground">
                    Beheer pre-orders in de volledige editor.
                  </p>
                </Block>

                {data.external_reference && (
                  <Block title="Externe referentie">
                    <code className="text-xs">{data.external_reference}</code>
                  </Block>
                )}
              </TabsContent>

              {/* Guest */}
              <TabsContent value="guest" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
                {guest ? (
                  <>
                    <Block title="Contact">
                      <div>{display?.email ?? "—"}</div>
                      <div>{display?.phone ?? "—"}</div>
                    </Block>
                    <Block title="Geschiedenis">
                      <div className="grid grid-cols-3 gap-3">
                        <Stat label="Bezoeken" value={guest.visit_count ?? guest.total_visits ?? 0} />
                        <Stat label="No-shows" value={guest.no_show_count ?? 0} tone={guest.no_show_count > 0 ? "warning" : "default"} />
                        <Stat label="VIP" value={guest.is_vip ? "Ja" : "Nee"} />
                      </div>
                      {guest.last_visit_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Laatste bezoek: {format(new Date(guest.last_visit_at), "d MMM yyyy", { locale: nl })}
                        </p>
                      )}
                    </Block>
                    {guest.allergies && (
                      <Block title="Allergieën"><span className="text-warning">{guest.allergies}</span></Block>
                    )}
                    {guest.hospitality_notes && (
                      <Block title="Hospitality-notitie">{guest.hospitality_notes}</Block>
                    )}
                    {guest.tags?.length > 0 && (
                      <Block title="Tags">
                        <div className="flex flex-wrap gap-1">
                          {guest.tags.map((t: string) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </Block>
                    )}
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/app/gasten?focus=${guest.id}`}>
                        <ExternalLink className="h-4 w-4 mr-2" /> Volledig gastprofiel openen
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Geen gast gekoppeld.</p>
                )}
              </TabsContent>

              {/* Activity */}
              <TabsContent value="activity" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <History className="h-4 w-4" /> Statushistorie
                  </h3>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nog geen statuswijzigingen.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {history.map((h: any) => (
                        <li key={h.id} className="flex items-start gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <div>
                              <span className="text-muted-foreground">{h.old_status ?? "(nieuw)"} → </span>
                              <span className="font-medium">{h.new_status}</span>
                              <span className="text-xs text-muted-foreground ml-2">door {h.changed_by_type}</span>
                            </div>
                            {h.reason && <div className="text-xs text-muted-foreground">{h.reason}</div>}
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(h.created_at), "d MMM HH:mm", { locale: nl })}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Bell className="h-4 w-4" /> Reminders
                  </h3>
                  {reminders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Geen reminders gepland.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {reminders.map((r: any) => (
                        <li key={r.id} className="text-sm flex items-center justify-between">
                          <div>
                            <div className="font-medium">{r.reminder_type}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(r.scheduled_for), "d MMM HH:mm", { locale: nl })} · {r.channel}
                            </div>
                            {r.error_message && (
                              <div className="text-xs text-destructive">{r.error_message}</div>
                            )}
                          </div>
                          <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                            {r.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              {/* Integrations */}
              <TabsContent value="integrations" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                {agentCall && (
                  <Block title={<span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" /> AI Voice call</span>}>
                    <div className="text-sm space-y-1">
                      <div><span className="text-muted-foreground">Provider: </span>{agentCall.provider ?? "—"}</div>
                      <div><span className="text-muted-foreground">Resultaat: </span>{agentCall.outcome ?? "—"}</div>
                      {agentCall.duration_seconds != null && (
                        <div><span className="text-muted-foreground">Duur: </span>{agentCall.duration_seconds}s</div>
                      )}
                      {agentCall.summary && <p className="text-xs italic">{agentCall.summary}</p>}
                      {agentCall.transcript_url && (
                        <a href={agentCall.transcript_url} target="_blank" rel="noreferrer" className="text-primary text-xs inline-flex items-center gap-1">
                          Transcript <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </Block>
                )}

                <div>
                  <h3 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Plug className="h-4 w-4" /> Integratie-logs
                  </h3>
                  {integrationLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Geen integratie-events gekoppeld.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {integrationLogs.map((l: any) => (
                        <li key={l.id} className="text-sm border border-border rounded-md p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{l.source} · {l.action}</span>
                            <Badge variant={l.status === "success" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                              {l.status}
                            </Badge>
                          </div>
                          {l.error_code && (
                            <div className="text-xs text-destructive mt-0.5">{l.error_code} — {l.possible_cause}</div>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {format(new Date(l.created_at), "d MMM HH:mm", { locale: nl })}
                            {l.latency_ms != null && <> · {l.latency_ms}ms</>}
                            {l.http_status && <> · HTTP {l.http_status}</>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link to="/app/integraties/logs">
                      <ExternalLink className="h-3 w-3 mr-1" /> Alle logs
                    </Link>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Block({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "warning" }) {
  return (
    <div className={cn("rounded-md bg-muted/40 p-2 text-center")}>
      <div className={cn("font-display text-lg", tone === "warning" && "text-warning")}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
