// ClickWise integratie — instellingen, mappings, event queue en payload preview.
// Geen echte API-calls vanuit de frontend; alle uitgaande synchronisatie loopt later via een
// veilige edge function. Deze pagina structureert configuratie en geeft heldere previews.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Plug, ShieldAlert, RefreshCw, Eye, Send, Tag as TagIcon, Database,
  Workflow, ListChecks, Lock, FileText, FlaskConical, ChevronRight,
} from "lucide-react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  getClickWiseSettings, updateClickWiseSettings,
  listIntegrationEvents, getEventStats,
  markEventProcessed, markEventSkipped, prepareRetry,
  buildSamplePayload, CONTACT_MAPPING,
  DEFAULT_TAG_MAPPING, DEFAULT_CUSTOM_FIELDS, DEFAULT_WORKFLOWS,
  checkClickWiseReadiness, enableClickWiseLiveMode, disableClickWiseLiveMode,
  processIntegrationEvent, processPendingClickWiseEvents,
  type ClickWiseSettings, type IntegrationEventRow, type EventFilter,
  type ClickWiseReadiness,
} from "@/services/clickwise";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MODE_META: Record<string, { label: string; cls: string }> = {
  prepared: { label: "Voorbereid",     cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  test:     { label: "Testmodus",      cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  live:     { label: "Verbonden",      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  error:    { label: "Fout",           cls: "bg-destructive/15 text-destructive" },
  disabled: { label: "Uitgeschakeld",  cls: "bg-muted text-muted-foreground" },
};

const EVENT_FILTERS: { v: EventFilter; l: string }[] = [
  { v: "all", l: "Alle" },
  { v: "pending", l: "Pending" },
  { v: "processing", l: "Processing" },
  { v: "sent", l: "Verwerkt" },
  { v: "failed", l: "Mislukt" },
  { v: "skipped", l: "Overgeslagen" },
  { v: "reservations", l: "Reserveringen" },
  { v: "guests", l: "Gasten" },
  { v: "reviews", l: "Reviews" },
  { v: "waitlist", l: "Wachtlijst" },
  { v: "large_group", l: "Grote groepen" },
];

const ClickWiseIntegrationPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const restaurantName = current?.restaurants?.name ?? "Restaurant";

  const [settings, setSettings] = useState<ClickWiseSettings | null>(null);
  const [events, setEvents] = useState<IntegrationEventRow[]>([]);
  const [stats, setStats] = useState<{ pending: number; processing: number; sent: number; failed: number; skipped: number; total: number } | null>(null);
  const [filter, setFilter] = useState<EventFilter>("all");
  const [loading, setLoading] = useState(true);
  const [openEvent, setOpenEvent] = useState<IntegrationEventRow | null>(null);
  const [previewEvent, setPreviewEvent] = useState<string | null>(null);

  const [tagMap, setTagMap] = useState(DEFAULT_TAG_MAPPING);
  const [fields, setFields] = useState(DEFAULT_CUSTOM_FIELDS);
  const [workflows, setWorkflows] = useState(DEFAULT_WORKFLOWS);
  const [readiness, setReadiness] = useState<ClickWiseReadiness | null>(null);
  const [processing, setProcessing] = useState(false);

  const refresh = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [s, list, st] = await Promise.all([
        getClickWiseSettings(restaurantId),
        listIntegrationEvents(restaurantId, filter),
        getEventStats(restaurantId),
      ]);
      setSettings(s);
      setEvents(list);
      setStats(st);

      // Merge stored mappings with defaults
      if (s.tag_mapping && Object.keys(s.tag_mapping).length) {
        setTagMap({ ...DEFAULT_TAG_MAPPING, ...(s.tag_mapping as typeof DEFAULT_TAG_MAPPING) });
      }
      if (s.custom_field_mapping && Object.keys(s.custom_field_mapping).length) {
        setFields(DEFAULT_CUSTOM_FIELDS.map((f) => {
          const stored = (s.custom_field_mapping as Record<string, { clickWise?: string; enabled?: boolean }>)[f.tableWise];
          return stored ? { ...f, clickWise: stored.clickWise ?? f.clickWise, enabled: stored.enabled ?? f.enabled } : f;
        }));
      }
      if (s.workflow_mapping && Object.keys(s.workflow_mapping).length) {
        setWorkflows(DEFAULT_WORKFLOWS.map((w) => {
          const stored = (s.workflow_mapping as Record<string, { workflowName?: string; enabled?: boolean }>)[w.event];
          return stored ? { ...w, workflowName: stored.workflowName ?? w.workflowName, enabled: stored.enabled ?? w.enabled } : w;
        }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Onbekende fout";
      toast.error("Kon ClickWise instellingen niet laden: " + msg);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [restaurantId, filter]);
  useEffect(() => {
    if (!restaurantId) return;
    checkClickWiseReadiness(restaurantId).then(setReadiness).catch(() => setReadiness(null));
  }, [restaurantId, settings?.connection_mode, settings?.contact_sync_enabled, settings?.workflow_mapping]);

  const sampleEventTypes = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_WORKFLOWS.forEach((w) => set.add(w.event));
    return Array.from(set);
  }, []);

  if (!restaurantId) {
    return <div className="p-6 text-muted-foreground">Selecteer eerst een restaurant.</div>;
  }
  if (!settings) {
    return <div className="p-6 text-muted-foreground">ClickWise instellingen laden…</div>;
  }

  const mode = settings.connection_mode;
  const meta = MODE_META[mode] ?? MODE_META.prepared;

  // ---------- Save handlers ----------
  const saveSettings = async (patch: Partial<ClickWiseSettings>) => {
    const r = await updateClickWiseSettings(restaurantId, patch);
    if (!r.ok) return toast.error(r.error || "Kon instellingen niet opslaan.");
    setSettings({ ...settings, ...patch });
    toast.success("Instellingen opgeslagen.");
  };

  const saveTagMapping = async () => {
    await saveSettings({ tag_mapping: tagMap });
  };
  const saveFieldMapping = async () => {
    const map: Record<string, { clickWise: string; enabled: boolean }> = {};
    fields.forEach((f) => { map[f.tableWise] = { clickWise: f.clickWise, enabled: f.enabled }; });
    await saveSettings({ custom_field_mapping: map });
  };
  const saveWorkflowMapping = async () => {
    const map: Record<string, { workflowName: string; enabled: boolean }> = {};
    workflows.forEach((w) => { map[w.event] = { workflowName: w.workflowName, enabled: w.enabled }; });
    await saveSettings({ workflow_mapping: map });
  };

  // ---------- Event actions ----------
  const handleProcessed = async (id: string) => {
    if (mode === "live") return toast.error("Niet beschikbaar in live modus.");
    const r = await markEventProcessed(id); if (!r.ok) return toast.error(r.error!);
    toast.success("Event gemarkeerd als verwerkt."); refresh();
  };
  const handleSkip = async (id: string) => {
    const r = await markEventSkipped(id, "Handmatig overgeslagen"); if (!r.ok) return toast.error(r.error!);
    toast.success("Event overgeslagen."); refresh();
  };
  const handleRetry = async (id: string) => {
    const r = await prepareRetry(id); if (!r.ok) return toast.error(r.error!);
    toast.success("Retry voorbereid."); refresh();
  };

  // ---------- Live processor actions ----------
  const handleProcessNow = async (id: string) => {
    setProcessing(true);
    try {
      const r = await processIntegrationEvent(id);
      toast.success(r.live_mode ? "Event verwerkt via ClickWise." : "Event verwerkt in testmodus.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kon event niet verwerken.");
    } finally { setProcessing(false); }
  };
  const handleProcessPending = async () => {
    if (!restaurantId) return;
    setProcessing(true);
    try {
      const r = await processPendingClickWiseEvents(restaurantId, 10);
      toast.success(`${r.processed} events verwerkt (${r.live_mode ? "live" : "testmodus"}).`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kon batch niet verwerken.");
    } finally { setProcessing(false); }
  };
  const handleEnableLive = async () => {
    if (!restaurantId) return;
    const r = await enableClickWiseLiveMode(restaurantId);
    if (!r.ok) return toast.error(r.error);
    toast.success("Live mode geactiveerd.");
    refresh();
  };
  const handleDisableLive = async () => {
    if (!restaurantId) return;
    const r = await disableClickWiseLiveMode(restaurantId);
    if (!r.ok) return toast.error(r.error || "Kon live mode niet uitschakelen.");
    toast.success("Live mode uitgeschakeld — terug in testmodus.");
    refresh();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-display font-semibold">ClickWise</h1>
        <p className="text-sm text-muted-foreground">
          ClickWise wordt gebruikt voor CRM, WhatsApp, SMS, e-mail, workflows, reminders, reviews en AI-agents.
          TableWise levert de reserveringsdata en events aan.
        </p>
      </header>

      {/* Connection status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4" /> Verbindingsstatus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className={meta.cls}>{meta.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {mode === "prepared" || mode === "test"
                ? "Geen echte berichten worden verstuurd. Events worden alleen voorbereid en gelogd."
                : mode === "live"
                ? "Live verbinding actief — events worden via de gateway verzonden."
                : "Verbinding niet actief."}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="loc">ClickWise location ID</Label>
              <Input id="loc" placeholder="loc_..." defaultValue={settings.location_id ?? ""}
                onBlur={(e) => e.target.value !== (settings.location_id ?? "") && saveSettings({ location_id: e.target.value || null })} />
            </div>
            <div>
              <Label htmlFor="api">API base URL</Label>
              <Input id="api" placeholder="https://services.leadconnectorhq.com" defaultValue={settings.api_base_url ?? ""}
                onBlur={(e) => e.target.value !== (settings.api_base_url ?? "") && saveSettings({ api_base_url: e.target.value || null })} />
            </div>
            <div className="flex items-end justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" /> Sandbox</div>
                <p className="text-xs text-muted-foreground">Geen echte berichten</p>
              </div>
              <Switch checked={settings.sandbox_mode} onCheckedChange={(v) => saveSettings({ sandbox_mode: v })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live readiness & live mode */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Live readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Live mode verstuurt echte events naar ClickWise. Activeer dit alleen nadat mapping,
            privacyinstellingen en workflows getest zijn.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ReadinessRow ok={!!readiness?.secrets_present} label="Server-side API-secrets aanwezig" />
            <ReadinessRow ok={!!readiness?.location_configured} label="Location ID geconfigureerd" />
            <ReadinessRow ok={!!settings.contact_sync_enabled} label="Contact sync ingeschakeld" />
            <ReadinessRow ok={!!readiness?.can_go_live} label="Klaar voor live mode" />
          </div>
          {readiness && readiness.issues.length > 0 && (
            <ul className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
              {readiness.issues.map((i) => (
                <li key={i} className="text-muted-foreground">• {i}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {mode === "live" ? (
              <Button variant="outline" onClick={handleDisableLive}>
                Live mode uitschakelen
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!readiness?.can_go_live}>
                    Live mode activeren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Live mode activeren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Live mode kan echte ClickWise-workflows starten en berichten naar gasten
                      laten verzenden. Weet je zeker dat je dit wilt activeren?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEnableLive}>Live mode activeren</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" onClick={handleProcessPending} disabled={processing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${processing ? "animate-spin" : ""}`} />
              Verwerk pending events
            </Button>
          </div>
          {!readiness?.secrets_present && (
            <p className="text-xs text-muted-foreground">
              ClickWise live koppeling kan pas worden geactiveerd nadat API-secrets veilig
              server-side zijn ingesteld.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="contact">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="contact"><Database className="h-4 w-4 mr-1" /> Contact sync</TabsTrigger>
          <TabsTrigger value="tags"><TagIcon className="h-4 w-4 mr-1" /> Tags</TabsTrigger>
          <TabsTrigger value="fields"><FileText className="h-4 w-4 mr-1" /> Custom fields</TabsTrigger>
          <TabsTrigger value="workflows"><Workflow className="h-4 w-4 mr-1" /> Workflows</TabsTrigger>
          <TabsTrigger value="queue"><ListChecks className="h-4 w-4 mr-1" /> Event queue</TabsTrigger>
          <TabsTrigger value="templates"><Eye className="h-4 w-4 mr-1" /> Payload preview</TabsTrigger>
          <TabsTrigger value="privacy"><Lock className="h-4 w-4 mr-1" /> Privacy</TabsTrigger>
        </TabsList>

        {/* Contact sync */}
        <TabsContent value="contact" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact sync — TableWise gasten ↔ ClickWise contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Contact sync inschakelen (voorbereid)</div>
                  <p className="text-xs text-muted-foreground">
                    Bij nieuwe of bijgewerkte gasten worden contact-events voorbereid. Echte sync gebeurt later via de gateway.
                  </p>
                </div>
                <Switch checked={settings.contact_sync_enabled}
                  onCheckedChange={(v) => saveSettings({ contact_sync_enabled: v })} />
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr><th className="text-left p-2">TableWise</th><th className="text-left p-2">ClickWise</th><th className="text-left p-2">Voorbeeld</th></tr>
                  </thead>
                  <tbody>
                    {CONTACT_MAPPING.map((m) => (
                      <tr key={m.tableWise} className="border-t">
                        <td className="p-2 font-mono text-xs">{m.tableWise}</td>
                        <td className="p-2">{m.clickWise}</td>
                        <td className="p-2 text-muted-foreground">{m.sample}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPreviewEvent("guest.created")}>
                  <Eye className="h-4 w-4 mr-1" /> Test payload bekijken
                </Button>
                <Button variant="outline" disabled title="Echte sync vereist een veilige API-configuratie">
                  <Send className="h-4 w-4 mr-1" /> Sync voorbereiden
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Hospitality-notities worden niet zomaar overschreven. Marketing opt-in wordt alleen gesynced als deze expliciet op true staat.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tag mapping</CardTitle>
                <Button size="sm" onClick={saveTagMapping}>Opslaan</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(tagMap).map(([key, t]) => (
                <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{key}</div>
                  </div>
                  <Input value={t.tag} onChange={(e) =>
                    setTagMap({ ...tagMap, [key]: { ...t, tag: e.target.value } })}
                    className="max-w-[240px]" />
                  <Switch checked={t.enabled}
                    onCheckedChange={(v) => setTagMap({ ...tagMap, [key]: { ...t, enabled: v } })} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Gebruik gastvriendelijke labels — geen stigmatiserende termen.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom fields */}
        <TabsContent value="fields" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Custom field mapping</CardTitle>
                <Button size="sm" onClick={saveFieldMapping}>Opslaan</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {["Reservering", "Gast", "Wachtlijst", "Review"].map((g) => (
                <div key={g} className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{g}</div>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">TableWise veld</th>
                          <th className="text-left p-2">ClickWise custom field</th>
                          <th className="text-left p-2">Voorbeeld</th>
                          <th className="text-right p-2">Actief</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.filter((f) => f.group === g).map((f) => (
                          <tr key={f.tableWise} className="border-t">
                            <td className="p-2 font-mono text-xs">{f.tableWise}</td>
                            <td className="p-2">
                              <Input value={f.clickWise} onChange={(e) =>
                                setFields(fields.map((x) => x.tableWise === f.tableWise ? { ...x, clickWise: e.target.value } : x))}
                                className="h-9" />
                            </td>
                            <td className="p-2 text-muted-foreground">{f.sample}</td>
                            <td className="p-2 text-right">
                              <Switch checked={f.enabled} onCheckedChange={(v) =>
                                setFields(fields.map((x) => x.tableWise === f.tableWise ? { ...x, enabled: v } : x))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflows */}
        <TabsContent value="workflows" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Workflow trigger mapping</CardTitle>
                <Button size="sm" onClick={saveWorkflowMapping}>Opslaan</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from(new Set(workflows.map((w) => w.group))).map((g) => (
                <div key={g} className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{g}</div>
                  {workflows.filter((w) => w.group === g).map((w) => (
                    <div key={w.event} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                      <div className="flex-1 min-w-[180px]">
                        <div className="text-sm font-medium">{w.label}</div>
                        <div className="text-xs text-muted-foreground font-mono">{w.event}</div>
                      </div>
                      <Input value={w.workflowName} onChange={(e) =>
                        setWorkflows(workflows.map((x) => x.event === w.event ? { ...x, workflowName: e.target.value } : x))}
                        className="max-w-[300px]" />
                      <Button size="sm" variant="ghost" onClick={() => setPreviewEvent(w.event)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Test
                      </Button>
                      <Switch checked={w.enabled} onCheckedChange={(v) =>
                        setWorkflows(workflows.map((x) => x.event === w.event ? { ...x, enabled: v } : x))} />
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event queue */}
        <TabsContent value="queue" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { l: "Pending",     v: stats?.pending ?? 0 },
              { l: "Processing",  v: stats?.processing ?? 0 },
              { l: "Verwerkt",    v: stats?.sent ?? 0 },
              { l: "Mislukt",     v: stats?.failed ?? 0 },
              { l: "Overgeslagen",v: stats?.skipped ?? 0 },
              { l: "Totaal",      v: stats?.total ?? 0 },
            ].map((s) => (
              <Card key={s.l}><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{s.l}</div>
                <div className="text-xl font-semibold">{s.v}</div>
              </CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">Event queue</CardTitle>
                <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Vernieuwen
                </Button>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as EventFilter)} className="mt-2">
                <TabsList className="flex flex-wrap h-auto bg-transparent p-0 gap-1">
                  {EVENT_FILTERS.map((f) => (
                    <TabsTrigger key={f.v} value={f.v} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      {f.l}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Geen events met deze filter.</p>
              ) : events.map((e) => {
                const evMode = (e.metadata as Record<string, unknown> | null)?.mode as string | undefined;
                return (
                  <button key={e.id} onClick={() => setOpenEvent(e)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-accent transition flex items-start gap-3 min-h-12">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs">{e.event_type}</span>
                        <EventStatusBadge status={e.status} />
                        {evMode === "live" && (
                          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">live</Badge>
                        )}
                        {evMode === "test" && (
                          <Badge variant="outline" className="text-xs">test</Badge>
                        )}
                        {(e.retry_count > 0 || e.attempts > 0) && (
                          <Badge variant="outline" className="text-xs">
                            {e.retry_count > 0 ? `retry ${e.retry_count}` : `${e.attempts} poging${e.attempts === 1 ? "" : "en"}`}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(e.created_at), "d MMM HH:mm", { locale: nl })}
                        {e.target ? ` · ${e.target}` : ""}
                      </div>
                      {e.status === "failed" && e.last_error && (
                        <div className="text-xs text-destructive truncate">{e.last_error}</div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payload preview */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payload preview per event type</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Klik op een event om de JSON-payload te bekijken die ClickWise later ontvangt.
              </p>
              <div className="flex flex-wrap gap-2">
                {sampleEventTypes.map((t) => (
                  <Button key={t} size="sm" variant="outline" onClick={() => setPreviewEvent(t)}>
                    {t}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy */}
        <TabsContent value="privacy" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Privacy & dataselectie</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { k: "share_internal_notes",  l: "Interne notities meesturen", note: "Standaard uit. Interne notities zijn alleen voor het team." },
                { k: "share_no_show_count",   l: "No-show count meesturen",    note: "Voor risicobeoordeling — wordt nooit publiek gedeeld." },
                { k: "share_visit_count",     l: "Aantal bezoeken meesturen",  note: "Voor herkenning van terugkerende gasten." },
                { k: "share_allergies",       l: "Allergieën meesturen",       note: "Belangrijk voor service en veiligheid." },
              ].map((opt) => (
                <div key={opt.k} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">{opt.l}</div>
                    <p className="text-xs text-muted-foreground">{opt.note}</p>
                  </div>
                  <Switch checked={!!settings.privacy_options?.[opt.k]}
                    onCheckedChange={(v) => saveSettings({ privacy_options: { ...settings.privacy_options, [opt.k]: v } })} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Gevoelige data wordt alleen gedeeld met ClickWise als jij daar expliciet voor kiest.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event detail sheet */}
      <Sheet open={!!openEvent} onOpenChange={(o) => !o && setOpenEvent(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle className="font-display">Integration event</SheetTitle></SheetHeader>
          {openEvent && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm">{openEvent.event_type}</span>
                <EventStatusBadge status={openEvent.status} />
                {openEvent.target && <Badge variant="outline">{openEvent.target}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info l="Aangemaakt" v={format(new Date(openEvent.created_at), "d MMM HH:mm:ss", { locale: nl })} />
                <Info l="Verwerkt" v={openEvent.processed_at ? format(new Date(openEvent.processed_at), "d MMM HH:mm:ss", { locale: nl }) : "—"} />
                <Info l="Pogingen" v={openEvent.attempts.toString()} />
                <Info l="Retries" v={openEvent.retry_count.toString()} />
                <Info l="Volgende retry" v={openEvent.next_retry_at ? format(new Date(openEvent.next_retry_at), "d MMM HH:mm", { locale: nl }) : "—"} />
                <Info l="Workflow" v={openEvent.clickwise_workflow_id ?? "—"} />
              </div>
              {openEvent.last_error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {openEvent.last_error}
                </div>
              )}
              <div>
                <Label>Payload</Label>
                <pre className="mt-1 rounded-lg bg-muted/50 p-3 text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(openEvent.payload, null, 2)}
                </pre>
              </div>
              <div className="flex flex-wrap gap-2">
                {openEvent.status !== "sent" && (
                  <Button onClick={() => handleProcessNow(openEvent.id)} disabled={processing}>
                    <Send className="h-4 w-4 mr-1" />
                    {mode === "live" ? "Nu verwerken (live)" : "Nu verwerken (testmodus)"}
                  </Button>
                )}
                {openEvent.status === "sent" && (
                  <p className="text-xs text-muted-foreground w-full">
                    Dit event is al verwerkt. Opnieuw versturen kan dubbele communicatie
                    veroorzaken — gebruik retry alleen bij vastgestelde fout.
                  </p>
                )}
                {openEvent.status === "failed" && (
                  <Button variant="outline" onClick={() => handleRetry(openEvent.id)}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Retry voorbereiden
                  </Button>
                )}
                {(mode === "test" || mode === "prepared") && openEvent.status !== "sent" && (
                  <Button variant="outline" onClick={() => handleProcessed(openEvent.id)}>
                    Markeer verwerkt (test)
                  </Button>
                )}
                {openEvent.status !== "skipped" && openEvent.status !== "sent" && (
                  <Button variant="ghost" onClick={() => handleSkip(openEvent.id)}>
                    Overslaan
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sample payload sheet */}
      <Sheet open={!!previewEvent} onOpenChange={(o) => !o && setPreviewEvent(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle className="font-display">Test payload</SheetTitle></SheetHeader>
          {previewEvent && (
            <div className="space-y-3 mt-4">
              <div className="font-mono text-sm">{previewEvent}</div>
              <pre className="rounded-lg bg-muted/50 p-3 text-xs overflow-x-auto max-h-[70vh]">
                {JSON.stringify(buildSamplePayload(previewEvent, restaurantName), null, 2)}
              </pre>
              <p className="text-xs text-muted-foreground">
                Deze payload wordt later via een veilige edge function naar ClickWise verstuurd. Op dit moment wordt er
                niets daadwerkelijk verzonden.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

function ReadinessRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2 text-sm">
      <span
        className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
        aria-hidden
      />
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded bg-muted/40 p-2">
      <div className="text-muted-foreground">{l}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const map: Record<string, { l: string; cls: string }> = {
    pending:    { l: "Pending",     cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    processing: { l: "Processing",  cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
    sent:       { l: "Verwerkt",    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    failed:     { l: "Mislukt",     cls: "bg-destructive/15 text-destructive" },
    skipped:    { l: "Overgeslagen",cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? map.pending;
  return <Badge variant="secondary" className={m.cls}>{m.l}</Badge>;
}

export default ClickWiseIntegrationPage;
