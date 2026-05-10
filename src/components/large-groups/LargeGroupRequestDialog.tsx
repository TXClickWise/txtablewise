// LargeGroupRequestDialog — operator workflow voor formulier-aanvragen.
// Stappen:
//   1. Overzicht — operator kiest: Omzetten / Eerst overleggen / Afwijzen.
//   2a. Omzetten → datum/tijd/party_size + tafel(s) kiezen → book_reservation (manager-channel).
//   2b. Overleggen → kanaal + bericht → integration_event "guest_message_requested".
//   2c. Afwijzen → snelkeuze of custom + kanaal → integration_event.
// Alle berichten via ClickWise (integration_events). Geen directe WhatsApp/SMS.

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, CalendarPlus, MessageCircle, XCircle, Mail, MessageSquare,
  Users, Phone, Mailbox, CheckCircle2,
} from "lucide-react";

export type LargeGroupRequest = {
  id: string;
  restaurant_id: string;
  created_at: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  party_size: number;
  preferred_date: string | null;
  preferred_time: string | null;
  occasion: string | null;
  message: string | null;
  status: string;
};

type Step = "overview" | "convert" | "discuss" | "decline" | "channel-after-convert";
type Channel = "whatsapp" | "email" | "both";

type TableRow = {
  id: string;
  label: string;
  capacity_min: number;
  capacity_max: number;
  zones?: { name?: string } | null;
};
type ComboRow = {
  id: string;
  name: string;
  table_ids: string[];
  capacity_min: number;
  capacity_max: number;
};

const DECLINE_REASONS = [
  { key: "full", label: "Helaas vol op die datum",
    template: "Bedankt voor je aanvraag. Helaas zitten we op die datum/tijd helemaal vol. We denken graag mee over een ander moment — laat het ons weten." },
  { key: "size", label: "Groepsgrootte past niet",
    template: "Bedankt voor je aanvraag. Voor een groep van deze grootte hebben we helaas geen passende ruimte. We helpen je graag verder met een alternatief." },
  { key: "closed", label: "Gesloten op die dag",
    template: "Bedankt voor je aanvraag. Op de gevraagde datum zijn we gesloten. Stuur gerust een nieuw voorstel — we maken er graag iets moois van." },
  { key: "alt", label: "Liever ander tijdstip voorstellen",
    template: "Bedankt voor je aanvraag. Op het gevraagde tijdstip lukt het helaas niet, maar we hebben graag een alternatief voor je. Reageer gerust." },
];

const DISCUSS_TEMPLATE =
  "Hartelijk dank voor je groepsaanvraag. We willen graag even kort met je afstemmen om alles passend te maken. Wanneer komt het je uit dat we contact opnemen?";

const CONFIRM_TEMPLATE =
  "Goed nieuws — je groepsreservering staat genoteerd. Als er nog wensen zijn (menu, dieet, gelegenheid) horen we dat graag. Tot dan!";

export function LargeGroupRequestDialog({
  request,
  open,
  onOpenChange,
}: {
  request: LargeGroupRequest | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("overview");

  // convert state
  const [convDate, setConvDate] = useState("");
  const [convTime, setConvTime] = useState("19:00");
  const [convParty, setConvParty] = useState(2);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [pickedTables, setPickedTables] = useState<string[]>([]);
  const [pickedCombo, setPickedCombo] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);

  // message state (used for discuss / decline / confirm)
  const [channel, setChannel] = useState<Channel>("both");
  const [messageText, setMessageText] = useState("");
  const [declineKey, setDeclineKey] = useState<string>("full");

  const [busy, setBusy] = useState(false);
  const [createdReservationId, setCreatedReservationId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !request) return;
    setStep("overview");
    setConvDate(request.preferred_date ?? format(new Date(), "yyyy-MM-dd"));
    setConvTime((request.preferred_time ?? "19:00").slice(0, 5));
    setConvParty(request.party_size);
    setPickedTables([]);
    setPickedCombo(null);
    setChannel(request.contact_phone && request.contact_email ? "both" : request.contact_phone ? "whatsapp" : "email");
    setMessageText("");
    setDeclineKey("full");
    setCreatedReservationId(null);
  }, [open, request?.id]);

  // Load tables & combinations when entering convert step
  useEffect(() => {
    if (step !== "convert" || !request) return;
    setLoadingTables(true);
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from("tables")
          .select("id, label, capacity_min, capacity_max, zones(name)")
          .eq("restaurant_id", request.restaurant_id).eq("is_active", true).order("label"),
        supabase.from("table_combinations")
          .select("id, name, table_ids, capacity_min, capacity_max")
          .eq("restaurant_id", request.restaurant_id).eq("is_active", true)
          .order("capacity_max", { ascending: true }),
      ]);
      setTables((t ?? []) as unknown as TableRow[]);
      setCombos((c ?? []) as unknown as ComboRow[]);
      setLoadingTables(false);
    })();
  }, [step, request?.id]);

  if (!request) return null;

  const guestParts = request.contact_name.trim().split(/\s+/);
  const firstName = guestParts[0] ?? "Gast";
  const lastName = guestParts.slice(1).join(" ");

  const totalSelectedCapacity = useMemo(() => {
    if (pickedCombo) {
      const c = combos.find((x) => x.id === pickedCombo);
      return c?.capacity_max ?? 0;
    }
    return tables.filter((t) => pickedTables.includes(t.id))
      .reduce((s, t) => s + t.capacity_max, 0);
  }, [pickedCombo, pickedTables, tables, combos]);

  const updateRequestStatus = async (status: "in_progress" | "confirmed" | "declined") => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("large_group_requests")
      .update({ status: status as never, assigned_to: user?.id ?? null })
      .eq("id", request.id);
  };

  const sendGuestMessage = async (params: {
    kind: "custom"; channelPref: Channel; message: string;
    reservationId?: string | null; reason?: string;
  }) => {
    await supabase.from("integration_events").insert({
      restaurant_id: request.restaurant_id,
      event_type: "guest_message_requested",
      entity_type: params.reservationId ? "reservation" : "large_group_request",
      entity_id: params.reservationId ?? request.id,
      payload: {
        kind: params.kind,
        message: params.message,
        channel_preference: params.channelPref,
        contact_name: request.contact_name,
        contact_email: request.contact_email,
        contact_phone: request.contact_phone,
        large_group_request_id: request.id,
        reservation_id: params.reservationId ?? null,
        reason: params.reason ?? null,
      },
      metadata: { source: "large_group_request_dialog" },
    });
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["large-group-requests"] });
    qc.invalidateQueries({ queryKey: ["large-group-reservations"] });
    qc.invalidateQueries({ queryKey: ["reservations-day"] });
    qc.invalidateQueries({ queryKey: ["today-reservations"] });
  };

  // ---------- Actions ----------
  const handleConvert = async () => {
    if (!convDate || !convTime || convParty < 1) {
      toast.error("Vul datum, tijd en aantal gasten in.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("book_reservation", {
      body: {
        restaurant_id: request.restaurant_id,
        date: convDate,
        time: convTime,
        party_size: convParty,
        guest: {
          first_name: firstName,
          last_name: lastName || undefined,
          email: request.contact_email || `groep+${request.id.slice(0, 8)}@placeholder.local`,
          phone: request.contact_phone || undefined,
        },
        special_requests: request.message || undefined,
        occasion: request.occasion || undefined,
        channel: "manager",
        source_metadata: { source_channel: "manual_phone", large_group_request_id: request.id },
      },
    });
    if (error || (data as { error?: string })?.error) {
      setBusy(false);
      toast.error("Reservering aanmaken mislukt", {
        description: (data as { error?: string })?.error || error?.message,
      });
      return;
    }
    const newReservationId = (data as { reservation?: { id: string } })?.reservation?.id ?? null;

    // Override table assignment if operator picked specific tables/combo
    if (newReservationId) {
      const tableIds: string[] = pickedCombo
        ? (combos.find((c) => c.id === pickedCombo)?.table_ids ?? [])
        : pickedTables;

      if (tableIds.length > 0) {
        await supabase.from("reservation_tables").delete().eq("reservation_id", newReservationId);
        const rows = tableIds.map((tid) => ({ reservation_id: newReservationId, table_id: tid }));
        const { error: rtErr } = await supabase.from("reservation_tables").insert(rows);
        if (rtErr) {
          toast.error("Tafel toewijzen mislukt", { description: rtErr.message });
        }
        if (pickedCombo) {
          await supabase.from("reservations")
            .update({ table_combination_id: pickedCombo })
            .eq("id", newReservationId);
        }
      }
    }

    await updateRequestStatus("confirmed");
    setBusy(false);
    setCreatedReservationId(newReservationId);
    setMessageText(CONFIRM_TEMPLATE);
    setStep("channel-after-convert");
    refresh();
    toast.success("Reservering aangemaakt.");
  };

  const handleSendConfirmation = async () => {
    setBusy(true);
    await sendGuestMessage({
      kind: "custom", channelPref: channel,
      message: messageText || CONFIRM_TEMPLATE,
      reservationId: createdReservationId,
    });
    setBusy(false);
    toast.success("Bevestiging staat klaar voor verzending via ClickWise.");
    refresh();
    onOpenChange(false);
  };

  const handleDiscuss = async () => {
    setBusy(true);
    await sendGuestMessage({
      kind: "custom", channelPref: channel,
      message: messageText || DISCUSS_TEMPLATE,
    });
    await updateRequestStatus("in_progress");
    setBusy(false);
    toast.success("Bericht klaargezet — je kunt nu in overleg met de gast.");
    refresh();
    onOpenChange(false);
  };

  const handleDecline = async () => {
    setBusy(true);
    const reason = DECLINE_REASONS.find((r) => r.key === declineKey);
    await sendGuestMessage({
      kind: "custom", channelPref: channel,
      message: messageText || reason?.template || "",
      reason: reason?.label,
    });
    await updateRequestStatus("declined");
    setBusy(false);
    toast.success("Aanvraag afgewezen — gast krijgt netjes bericht.");
    refresh();
    onOpenChange(false);
  };

  // ---------- Render ----------
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            {step !== "overview" && (
              <Button
                size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => setStep("overview")} disabled={busy}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === "overview" && "Groepsaanvraag"}
            {step === "convert" && "Omzetten naar reservering"}
            {step === "channel-after-convert" && "Bevestiging versturen"}
            {step === "discuss" && "Eerst overleggen met gast"}
            {step === "decline" && "Aanvraag afwijzen"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Always show the request summary at top */}
          <RequestSummary request={request} />

          {step === "overview" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Wat wil je doen met deze aanvraag?</p>
              <ActionTile
                icon={<CalendarPlus className="h-5 w-5 text-success" />}
                title="Omzetten naar reservering"
                desc="Plaats op een tafel of combinatie. Daarna kies je hoe je de gast bevestigt."
                onClick={() => setStep("convert")}
              />
              <ActionTile
                icon={<MessageCircle className="h-5 w-5 text-primary" />}
                title="Eerst overleggen"
                desc="Stuur een bericht via WhatsApp en/of e-mail om af te stemmen."
                onClick={() => { setMessageText(DISCUSS_TEMPLATE); setStep("discuss"); }}
              />
              <ActionTile
                icon={<XCircle className="h-5 w-5 text-destructive" />}
                title="Afwijzen"
                desc="Geef een reden — gast krijgt netjes bericht."
                onClick={() => {
                  setDeclineKey("full");
                  setMessageText(DECLINE_REASONS[0].template);
                  setStep("decline");
                }}
              />
            </div>
          )}

          {step === "convert" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Datum">
                  <Input type="date" value={convDate} onChange={(e) => setConvDate(e.target.value)} />
                </Field>
                <Field label="Tijd">
                  <Input type="time" step={300} value={convTime} onChange={(e) => setConvTime(e.target.value)} />
                </Field>
                <Field label="Aantal">
                  <Input type="number" min={1} max={200} value={convParty}
                    onChange={(e) => setConvParty(Math.max(1, Number(e.target.value) || 1))} />
                </Field>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Tafelcombinatie (optioneel)</Label>
                {loadingTables ? (
                  <p className="text-sm text-muted-foreground">Laden…</p>
                ) : combos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Geen combinaties ingesteld.</p>
                ) : (
                  <div className="space-y-1.5">
                    {combos.map((c) => {
                      const active = pickedCombo === c.id;
                      const fits = convParty >= c.capacity_min && convParty <= c.capacity_max;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setPickedCombo(active ? null : c.id);
                            setPickedTables([]);
                          }}
                          className={cn(
                            "w-full text-left rounded-lg border p-3 transition-colors",
                            active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.capacity_min}–{c.capacity_max} pers.
                              {!fits && <span className="ml-2 text-warning">past niet</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Of losse tafels (meerdere mogelijk)</Label>
                {loadingTables ? null : tables.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Geen tafels gevonden.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {tables.map((t) => {
                      const active = pickedTables.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setPickedCombo(null);
                            setPickedTables((prev) =>
                              prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]);
                          }}
                          className={cn(
                            "text-left rounded-lg border p-2.5 transition-colors",
                            active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                          )}
                        >
                          <div className="font-medium text-sm">{t.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.zones?.name ? `${t.zones.name} · ` : ""}{t.capacity_min}–{t.capacity_max}p
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {(pickedTables.length > 0 || pickedCombo) && (
                  <p className="text-xs text-muted-foreground">
                    Capaciteit gekozen: {totalSelectedCapacity}p · Gasten: {convParty}p
                    {totalSelectedCapacity < convParty && <span className="text-warning"> · te krap</span>}
                  </p>
                )}
                {pickedTables.length === 0 && !pickedCombo && (
                  <p className="text-xs text-muted-foreground">
                    Niets gekozen? Dan wijst TableWise automatisch een passende tafel toe.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "channel-after-convert" && (
            <ChannelMessage
              request={request}
              channel={channel} setChannel={setChannel}
              message={messageText} setMessage={setMessageText}
              showSuccess
            />
          )}

          {step === "discuss" && (
            <ChannelMessage
              request={request}
              channel={channel} setChannel={setChannel}
              message={messageText} setMessage={setMessageText}
            />
          )}

          {step === "decline" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Reden</Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {DECLINE_REASONS.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => { setDeclineKey(r.key); setMessageText(r.template); }}
                      className={cn(
                        "text-left rounded-lg border p-2.5 transition-colors",
                        declineKey === r.key ? "border-destructive bg-destructive/5" : "border-border hover:border-destructive/40",
                      )}
                    >
                      <div className="font-medium text-sm">{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <ChannelMessage
                request={request}
                channel={channel} setChannel={setChannel}
                message={messageText} setMessage={setMessageText}
              />
            </div>
          )}
        </div>

        <SheetFooter className="px-5 py-3 border-t bg-background">
          {step === "overview" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Sluiten</Button>
          )}
          {step === "convert" && (
            <Button onClick={handleConvert} disabled={busy} className="min-w-40">
              {busy ? "Bezig…" : "Reservering aanmaken"}
            </Button>
          )}
          {step === "channel-after-convert" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Geen bericht — sluiten
              </Button>
              <Button onClick={handleSendConfirmation} disabled={busy} className="min-w-40">
                {busy ? "Bezig…" : "Bevestiging versturen"}
              </Button>
            </>
          )}
          {step === "discuss" && (
            <Button onClick={handleDiscuss} disabled={busy} className="min-w-40">
              {busy ? "Bezig…" : "Bericht klaarzetten"}
            </Button>
          )}
          {step === "decline" && (
            <Button variant="destructive" onClick={handleDecline} disabled={busy} className="min-w-40">
              {busy ? "Bezig…" : "Afwijzen & bericht sturen"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Subcomponents ----------

function RequestSummary({ request }: { request: LargeGroupRequest }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{request.contact_name}</span>
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" /> {request.party_size}p
          </Badge>
          {request.occasion && <Badge variant="outline">{request.occasion}</Badge>}
        </div>
        <div className="text-muted-foreground">
          {request.preferred_date && format(new Date(request.preferred_date), "EEE d MMM", { locale: nl })}
          {request.preferred_time && ` · ${request.preferred_time.slice(0, 5)}`}
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
          {request.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{request.contact_phone}</span>}
          {request.contact_email && <span className="inline-flex items-center gap-1"><Mailbox className="h-3 w-3" />{request.contact_email}</span>}
        </div>
        {request.message && (
          <div className="italic bg-muted/40 rounded px-2 py-1.5 text-xs">"{request.message}"</div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionTile({ icon, title, desc, onClick }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 transition-colors flex items-start gap-3"
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ChannelMessage({
  request, channel, setChannel, message, setMessage, showSuccess,
}: {
  request: LargeGroupRequest;
  channel: Channel; setChannel: (c: Channel) => void;
  message: string; setMessage: (m: string) => void;
  showSuccess?: boolean;
}) {
  const hasPhone = !!request.contact_phone;
  const hasEmail = !!request.contact_email;
  return (
    <div className="space-y-3">
      {showSuccess && (
        <div className="flex items-center gap-2 text-sm text-success bg-success/10 border border-success/20 rounded-md px-3 py-2">
          <CheckCircle2 className="h-4 w-4" />
          Reservering staat genoteerd. Stuur nu de bevestiging.
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-sm">Kanaal</Label>
        <div className="grid grid-cols-3 gap-1.5">
          <ChannelButton active={channel === "whatsapp"} disabled={!hasPhone}
            onClick={() => setChannel("whatsapp")}
            icon={<MessageSquare className="h-4 w-4" />} label="WhatsApp" />
          <ChannelButton active={channel === "email"} disabled={!hasEmail}
            onClick={() => setChannel("email")}
            icon={<Mail className="h-4 w-4" />} label="E-mail" />
          <ChannelButton active={channel === "both"} disabled={!hasPhone || !hasEmail}
            onClick={() => setChannel("both")}
            icon={<MessageCircle className="h-4 w-4" />} label="Beide" />
        </div>
        {!hasPhone && !hasEmail && (
          <p className="text-xs text-warning">Geen contactgegevens — geen bericht mogelijk.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Bericht</Label>
        <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Wordt klaargezet via ClickWise — verzending volgt het ingestelde kanaal.
        </p>
      </div>
    </div>
  );
}

function ChannelButton({ active, disabled, onClick, icon, label }: {
  active: boolean; disabled?: boolean; onClick: () => void;
  icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border p-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors",
        active && !disabled ? "border-primary bg-primary/5 text-primary" : "border-border",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {icon} {label}
    </button>
  );
}
