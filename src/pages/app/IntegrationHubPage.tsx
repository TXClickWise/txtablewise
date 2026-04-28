import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Plug, Webhook, Bot, KeyRound, FlaskConical, Plus, Trash2, Send, Eye, EyeOff, Phone } from "lucide-react";
import {
  WEBHOOK_EVENTS, listWebhookEndpoints, createWebhookEndpoint, updateWebhookEndpoint,
  deleteWebhookEndpoint, testWebhook, testAvailability, testBook,
  type WebhookEndpoint, type WebhookEvent,
} from "@/services/integrations";

const today = () => new Date().toISOString().slice(0, 10);

function maskSecret(s: string | null) {
  if (!s) return "—";
  if (s.length <= 8) return "••••";
  return s.slice(0, 4) + "•".repeat(Math.max(0, s.length - 8)) + s.slice(-4);
}

export default function IntegrationHubPage() {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [creating, setCreating] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);

  // Live test state
  const [availForm, setAvailForm] = useState({ date: today(), party_size: 2 });
  const [availResult, setAvailResult] = useState<unknown>(null);
  const [bookForm, setBookForm] = useState({ date: today(), time: "19:00", party_size: 2, first_name: "Test", last_name: "Hub", phone: "+31600000000", email: "" });
  const [bookResult, setBookResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    try { setEndpoints(await listWebhookEndpoints(rid)); }
    catch (e) { toast.error("Webhooks laden mislukt: " + (e instanceof Error ? e.message : "?")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  const agentApiUrl = useMemo(() => {
    const projectId = (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/agent_api`;
  }, []);

  if (!rid) return <div className="p-6 text-muted-foreground">Selecteer eerst een restaurant.</div>;

  const handleSaveEndpoint = async (e: WebhookEndpoint, isNew: boolean) => {
    try {
      if (isNew) {
        await createWebhookEndpoint({
          restaurant_id: rid,
          label: e.label,
          url: e.url,
          secret: e.secret,
          events: e.events,
        });
        toast.success("Webhook toegevoegd");
      } else {
        await updateWebhookEndpoint(e.id, {
          label: e.label, url: e.url, secret: e.secret, events: e.events, is_active: e.is_active,
        });
        toast.success("Webhook opgeslagen");
      }
      setEditing(null); setCreating(false);
      load();
    } catch (err) {
      toast.error("Opslaan mislukt: " + (err instanceof Error ? err.message : "?"));
    }
  };

  const handleTestWebhook = async (id: string) => {
    setBusy(true);
    const r = await testWebhook(id);
    setBusy(false);
    if (r.ok) toast.success(`Webhook test geslaagd (HTTP ${r.status})`);
    else toast.error(`Webhook test mislukt: ${r.error ?? `HTTP ${r.status ?? "?"}`}`);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Webhook verwijderen?")) return;
    try { await deleteWebhookEndpoint(id); toast.success("Verwijderd"); load(); }
    catch (e) { toast.error("Verwijderen mislukt: " + (e instanceof Error ? e.message : "?")); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Integratiehub"
        description="Beheer API-sleutels, webhooks en test live je koppelingen met externe systemen."
        badge={
          <Badge variant="outline" className="gap-1.5">
            <Plug className="h-3 w-3 text-primary" /> Open platform
          </Badge>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-3 w-3 mr-1" />Webhooks</TabsTrigger>
          <TabsTrigger value="keys"><KeyRound className="h-3 w-3 mr-1" />API-sleutels</TabsTrigger>
          <TabsTrigger value="voice"><Bot className="h-3 w-3 mr-1" />Voice Agent</TabsTrigger>
          <TabsTrigger value="public"><Plug className="h-3 w-3 mr-1" />Publieke API</TabsTrigger>
          <TabsTrigger value="test"><FlaskConical className="h-3 w-3 mr-1" />Live test</TabsTrigger>
        </TabsList>

        {/* PUBLIEKE API */}
        <TabsContent value="public" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">TableWise Public API</CardTitle>
              <CardDescription>
                Eén schone laag voor ClickWise, voice-agents, WhatsApp/SMS-bots en CRM's.
                Gebruikt dezelfde reserveringen als de app — geen tweede systeem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted/40 p-3 text-sm font-mono break-all">
                {`https://${(import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public_api`}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <div className="font-semibold text-sm mb-1">POST /availability</div>
                  <div className="text-xs text-muted-foreground">Slot-check vóór boeken. Retourneert alternatieven.</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="font-semibold text-sm mb-1">POST /reservations</div>
                  <div className="text-xs text-muted-foreground">Maakt reservering + retourneert reservationCode + manage-link.</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="font-semibold text-sm mb-1">PATCH /reservations/&#123;id&#125;</div>
                  <div className="text-xs text-muted-foreground">Wijzigt datum/tijd/personen/notities. Conflict-check inbegrepen.</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="font-semibold text-sm mb-1">DELETE /reservations/&#123;id&#125;</div>
                  <div className="text-xs text-muted-foreground">Annuleert. Optionele <code>?reason=</code>.</div>
                </div>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <div className="font-semibold mb-2">Authenticatie</div>
                <div className="font-mono text-xs bg-muted/40 p-2 rounded">
                  X-TableWise-Api-Key: tw_live_...
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Hergebruik dezelfde sleutels als de Voice Agent. Beheer in tab "API-sleutels".
                </div>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <div className="font-semibold mb-2">Foutformaat</div>
                <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto">{`{
  "error": {
    "code": "TW_409_TIMESLOT_UNAVAILABLE",
    "message": "Dit tijdslot is niet meer beschikbaar.",
    "field": "localTime",
    "suggestedFix": "Probeer een ander tijdstip of vraag /availability op."
  }
}`}</pre>
                <div className="text-xs text-muted-foreground mt-2">
                  Volledige codetabel: zie <code>docs/PUBLIC_API_ERROR_CODES.md</code> in het project.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader><CardTitle className="text-base">ClickWise</CardTitle>
                <CardDescription>CRM, communicatie en automation-laag.</CardDescription></CardHeader>
              <CardContent className="flex justify-between items-center">
                <Badge variant="outline">Configuratie & mappings</Badge>
                <Button size="sm" asChild><Link to="/app/integraties/clickwise">Beheren</Link></Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">AI Voice Agent</CardTitle>
                <CardDescription>Telefonische reserveringen via Vapi, Retell of ClickWise.</CardDescription></CardHeader>
              <CardContent className="flex justify-between items-center">
                <Badge variant="outline">Sleutels + provider-config</Badge>
                <Button size="sm" asChild><Link to="/app/voice-agent">Openen</Link></Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Webhooks</CardTitle>
                <CardDescription>{endpoints.length} actieve {endpoints.length === 1 ? "endpoint" : "endpoints"}.</CardDescription></CardHeader>
              <CardContent className="flex justify-between items-center">
                <Badge variant={endpoints.some((e) => e.is_active) ? "default" : "outline"}>
                  {endpoints.some((e) => e.is_active) ? "Actief" : "Niet ingesteld"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="h-3 w-3 mr-1" />Nieuw</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">POS</CardTitle>
                <CardDescription>Omzet per reservering, tafel en gast.</CardDescription></CardHeader>
              <CardContent className="flex justify-between items-center">
                <Badge variant="outline">Demo-ready</Badge>
                <Button size="sm" asChild><Link to="/app/integraties/pos">Beheren</Link></Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* WEBHOOKS */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Stuur reserverings- en gastevents naar ClickWise, n8n, Make of je eigen CRM.</p>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Nieuwe webhook</Button>
          </div>
          {loading ? <p className="text-muted-foreground text-sm">Laden…</p> : endpoints.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nog geen webhooks. Voeg er één toe om events naar je CRM/automation te sturen.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <Card key={ep.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{ep.label}</span>
                          <Badge variant={ep.is_active ? "default" : "outline"} className="text-xs">{ep.is_active ? "Actief" : "Uit"}</Badge>
                          {ep.last_test_status && (
                            <Badge variant={ep.last_test_status === "ok" ? "default" : "destructive"} className="text-xs">
                              Laatste test: {ep.last_test_status}{ep.last_test_response_code ? ` (${ep.last_test_response_code})` : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground truncate">{ep.url}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Events: {ep.events.includes("*") ? "alle" : ep.events.join(", ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Secret: {revealId === ep.id ? (ep.secret || "—") : maskSecret(ep.secret)}
                          <Button size="icon" variant="ghost" className="h-5 w-5 ml-1" onClick={() => setRevealId(revealId === ep.id ? null : ep.id)}>
                            {revealId === ep.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => handleTestWebhook(ep.id)}>
                          <Send className="h-3 w-3 mr-1" />Test
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(ep)}>Bewerken</Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(ep.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {ep.last_test_response_body && (
                      <pre className="text-xs bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                        {ep.last_test_response_body.slice(0, 500)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* KEYS — verwijst naar Voice Agent pagina (single source of truth) */}
        <TabsContent value="keys" className="space-y-3">
          <Card><CardContent className="py-6 space-y-3">
            <p className="text-sm">
              API-sleutels worden centraal beheerd op de Voice Agent pagina — daar genereer je sleutels die zowel
              voor voice-agents als voor andere AI-/CRM-koppelingen werken.
            </p>
            <Button asChild><Link to="/app/voice-agent">Naar API-sleutels</Link></Button>
          </CardContent></Card>
        </TabsContent>

        {/* VOICE AGENT */}
        <TabsContent value="voice" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Velden die de Voice Agent moet verzamelen</CardTitle>
              <CardDescription>Aanbevolen volgorde voor stabiele AI-flows. Alleen velden met * zijn echt verplicht.</CardDescription></CardHeader>
            <CardContent>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li><strong>date</strong>* — formaat YYYY-MM-DD</li>
                <li><strong>time</strong>* — formaat HH:MM (24u)</li>
                <li><strong>party_size</strong>* — getal 1-50</li>
                <li><strong>guest.first_name</strong>* — voornaam</li>
                <li><strong>guest.last_name</strong> — achternaam (aanbevolen)</li>
                <li><strong>guest.phone</strong> — telefoonnummer (E.164, bv. +31612345678)</li>
                <li><strong>guest.email</strong> — optioneel; placeholder wordt gegenereerd indien leeg</li>
                <li><strong>special_requests</strong> — optioneel</li>
              </ol>
              <div className="mt-4 text-xs font-mono bg-muted/40 rounded p-3 break-all">
                Endpoint: POST {agentApiUrl}/book_reservation<br />
                Header: X-Agent-Api-Key: &lt;jouw sleutel&gt;
              </div>
            </CardContent>
          </Card>
          <Button variant="outline" asChild><Link to="/app/help/voice-agent">Volledige handleiding & prompts</Link></Button>
        </TabsContent>

        {/* LIVE TEST */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Test beschikbaarheid</CardTitle>
              <CardDescription>Roept dezelfde availability-engine aan als de voice-agent.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div><Label>Datum</Label><Input type="date" value={availForm.date} onChange={(e) => setAvailForm({ ...availForm, date: e.target.value })} /></div>
                <div><Label>Aantal personen</Label><Input type="number" min={1} max={50} value={availForm.party_size} onChange={(e) => setAvailForm({ ...availForm, party_size: Number(e.target.value) || 1 })} /></div>
                <div className="flex items-end">
                  <Button disabled={busy} onClick={async () => { setBusy(true); setAvailResult(await testAvailability(rid, availForm.date, availForm.party_size)); setBusy(false); }}>
                    {busy ? "Bezig…" : "Test beschikbaarheid"}
                  </Button>
                </div>
              </div>
              {availResult != null && <pre className="text-xs bg-muted/40 rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(availResult, null, 2)}</pre>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Test reservering aanmaken</CardTitle>
              <CardDescription>Schrijft een echte reservering met markering <code className="text-xs">source_metadata.test = true</code>.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div><Label>Datum</Label><Input type="date" value={bookForm.date} onChange={(e) => setBookForm({ ...bookForm, date: e.target.value })} /></div>
                <div><Label>Tijd</Label><Input type="time" value={bookForm.time} onChange={(e) => setBookForm({ ...bookForm, time: e.target.value })} /></div>
                <div><Label>Personen</Label><Input type="number" min={1} max={50} value={bookForm.party_size} onChange={(e) => setBookForm({ ...bookForm, party_size: Number(e.target.value) || 1 })} /></div>
                <div><Label>Voornaam</Label><Input value={bookForm.first_name} onChange={(e) => setBookForm({ ...bookForm, first_name: e.target.value })} /></div>
                <div><Label>Achternaam</Label><Input value={bookForm.last_name} onChange={(e) => setBookForm({ ...bookForm, last_name: e.target.value })} /></div>
                <div><Label>Telefoon</Label><Input value={bookForm.phone} onChange={(e) => setBookForm({ ...bookForm, phone: e.target.value })} /></div>
              </div>
              <Button disabled={busy} onClick={async () => {
                setBusy(true);
                setBookResult(await testBook(rid, {
                  date: bookForm.date, time: bookForm.time, party_size: bookForm.party_size,
                  guest: { first_name: bookForm.first_name, last_name: bookForm.last_name, phone: bookForm.phone, email: bookForm.email || undefined },
                  special_requests: "Integratie-test reservering",
                }));
                setBusy(false);
              }}>{busy ? "Bezig…" : "Test reservering"}</Button>
              {bookResult != null && <pre className="text-xs bg-muted/40 rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(bookResult, null, 2)}</pre>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EndpointSheet
        open={creating || !!editing}
        endpoint={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={handleSaveEndpoint}
      />
    </div>
  );
}

function EndpointSheet({ open, endpoint, onClose, onSave }: {
  open: boolean; endpoint: WebhookEndpoint | null;
  onClose: () => void;
  onSave: (e: WebhookEndpoint, isNew: boolean) => void;
}) {
  const isNew = !endpoint;
  const [draft, setDraft] = useState<WebhookEndpoint>(() => endpoint ?? ({
    id: "", restaurant_id: "", label: "", url: "", secret: "", events: ["*"],
    is_active: true, last_test_at: null, last_test_status: null, last_test_response_code: null,
    last_test_response_body: null, created_at: "", updated_at: "",
  } as WebhookEndpoint));

  useEffect(() => {
    if (endpoint) setDraft(endpoint);
    else setDraft({
      id: "", restaurant_id: "", label: "", url: "", secret: "", events: ["*"],
      is_active: true, last_test_at: null, last_test_status: null, last_test_response_code: null,
      last_test_response_body: null, created_at: "", updated_at: "",
    } as WebhookEndpoint);
  }, [endpoint, open]);

  const allEvents = draft.events.includes("*");
  const toggleEvent = (ev: WebhookEvent, on: boolean) => {
    const cur = draft.events.filter((e) => e !== "*");
    if (on) setDraft({ ...draft, events: [...cur, ev] });
    else setDraft({ ...draft, events: cur.filter((e) => e !== ev) });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{isNew ? "Nieuwe webhook" : "Webhook bewerken"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div><Label>Naam</Label><Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="bv. ClickWise productie" /></div>
          <div><Label>URL</Label><Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://hooks.example.com/..." /></div>
          <div>
            <Label>Secret (optioneel — voor HMAC signing)</Label>
            <Input type="password" value={draft.secret ?? ""} onChange={(e) => setDraft({ ...draft, secret: e.target.value })} placeholder="willekeurige string" />
            <p className="text-xs text-muted-foreground mt-1">Wordt verstuurd als <code>X-TableWise-Signature: sha256=...</code></p>
          </div>
          <div>
            <Label>Events</Label>
            <div className="flex items-center gap-2 mt-1">
              <Checkbox checked={allEvents} onCheckedChange={(v) => setDraft({ ...draft, events: v ? ["*"] : [] })} id="ev-all" />
              <label htmlFor="ev-all" className="text-sm">Alle events</label>
            </div>
            {!allEvents && (
              <div className="grid grid-cols-1 gap-1 mt-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <div key={ev.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`ev-${ev.value}`}
                      checked={draft.events.includes(ev.value)}
                      onCheckedChange={(v) => toggleEvent(ev.value, !!v)}
                    />
                    <label htmlFor={`ev-${ev.value}`} className="text-sm">
                      {ev.label} <span className="text-muted-foreground">({ev.value})</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!isNew && (
            <div className="flex items-center gap-3">
              <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
              <span className="text-sm">{draft.is_active ? "Actief" : "Uit"}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Annuleren</Button>
            <Button onClick={() => onSave(draft, isNew)} disabled={!draft.label || !draft.url}>
              {isNew ? "Toevoegen" : "Opslaan"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
