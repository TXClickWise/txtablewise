// POS Integraties — POS-ready structuur, Loyverse als aanbevolen starter, demo-flow.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Receipt, Link as LinkIcon, FileSpreadsheet, Webhook, AlertCircle, CheckCircle2, X, RefreshCw, Unlink, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";
import {
  POS_PROVIDERS, POS_FIELD_MAPPING,
  listPOSReceipts, suggestReservationMatches, matchReceiptToReservation, ignoreReceipt, getRevenuePreview,
  listPOSEvents, selectProvider, formatEuro,
  connectLoyverseWithToken, getLoyverseStatus, syncLoyverseNow, disconnectLoyverse, countLoyverseItems, type LoyverseConnectionStatus,
  type POSReceipt, type RevenuePreview,
} from "@/services/pos";
import { POSReceiptForm } from "@/components/pos/POSReceiptForm";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
    "Aanbevolen starter-POS": { v: "default", label: "Aanbevolen starter-POS" },
    "Demo-ready":              { v: "secondary", label: "Demo-ready" },
    "Voorbereid":              { v: "outline", label: "Voorbereid" },
    "Toekomstig":              { v: "outline", label: "Toekomstig" },
  };
  const cfg = map[status] ?? { v: "outline" as const, label: status };
  return <Badge variant={cfg.v} className="text-[10px]">{cfg.label}</Badge>;
}

const POSIntegrationPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;

  const [receipts, setReceipts] = useState<POSReceipt[]>([]);
  const [revenue, setRevenue] = useState<RevenuePreview | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; event_type: string; status: string; created_at: string }>>([]);
  const [reload, setReload] = useState(0);
  const [loyverse, setLoyverse] = useState<LoyverseConnectionStatus>(null);
  const [loyverseBusy, setLoyverseBusy] = useState<null | "connect" | "sync" | "disconnect">(null);
  const [loyverseItemCount, setLoyverseItemCount] = useState<number>(0);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenHelpOpen, setTokenHelpOpen] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    listPOSReceipts(restaurantId).then(setReceipts);
    getRevenuePreview(restaurantId).then(setRevenue);
    listPOSEvents(restaurantId).then((e) => setEvents(e));
    getLoyverseStatus(restaurantId).then(setLoyverse).catch(() => setLoyverse(null));
    countLoyverseItems(restaurantId).then(setLoyverseItemCount).catch(() => setLoyverseItemCount(0));
  }, [restaurantId, reload]);

  async function handleLoyverseConnect() {
    if (!restaurantId) return;
    const token = tokenInput.trim();
    if (token.length < 10) {
      toast.error("Token lijkt ongeldig", { description: "Plak de volledige access token uit Loyverse." });
      return;
    }
    setLoyverseBusy("connect");
    try {
      const result = await connectLoyverseWithToken(restaurantId, token);
      const items = result?.imported_items ?? 0;
      const receipts = result?.imported_receipts ?? 0;
      toast.success("Loyverse gekoppeld", {
        description: `${items} producten en ${receipts} bonnen geïmporteerd${result?.sync_error ? " (met waarschuwing)" : ""}.`,
      });
      setTokenDialogOpen(false);
      setTokenInput("");
      setReload((x) => x + 1);
    } catch (e) {
      toast.error("Koppelen mislukt", { description: (e as Error).message });
    } finally {
      setLoyverseBusy(null);
    }
  }
  async function handleLoyverseSync() {
    if (!restaurantId) return;
    setLoyverseBusy("sync");
    try {
      const r = await syncLoyverseNow(restaurantId);
      toast.success("Synchronisatie klaar", {
        description: `${r.imported_items} producten, ${r.imported_receipts} nieuwe bonnen (${r.skipped} overgeslagen)`,
      });
      setReload((x) => x + 1);
    } catch (e) {
      toast.error("Sync mislukt", { description: (e as Error).message });
    } finally { setLoyverseBusy(null); }
  }
  async function handleLoyverseDisconnect() {
    if (!restaurantId) return;
    if (!confirm("Loyverse koppeling verbreken?")) return;
    setLoyverseBusy("disconnect");
    try {
      await disconnectLoyverse(restaurantId);
      toast.success("Loyverse ontkoppeld");
      setReload((x) => x + 1);
    } catch (e) {
      toast.error("Ontkoppelen mislukt", { description: (e as Error).message });
    } finally { setLoyverseBusy(null); }
  }

  const unmatched = useMemo(() => receipts.filter((r) => r.matching_status === "unmatched"), [receipts]);
  const matched = useMemo(() => receipts.filter((r) => r.matching_status === "matched"), [receipts]);

  if (!restaurantId) return <div className="p-6">Restaurant laden…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl">POS Integraties</h1>
        <p className="text-muted-foreground max-w-3xl">
          POS-integraties maken het later mogelijk om omzetdata aan reserveringen, tafels en gasten te koppelen.
          TableWise blijft POS-provider-agnostic. Loyverse is de eerste starter-/demo-optie.
        </p>
      </header>

      {/* Sectie 1 — POS-overzicht */}
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Verbonden POS</div><div className="font-display text-lg">{loyverse?.status === "connected" ? "Loyverse" : "Niet gekoppeld"}</div><div className="text-[10px] text-muted-foreground">{loyverse?.status === "connected" ? (loyverse.display_name ?? "Live") : "Demo-ready"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gematchte bonnen</div><div className="font-display text-2xl">{matched.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Niet-gematchte bonnen</div><div className="font-display text-2xl">{unmatched.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Omzet vandaag (demo)</div><div className="font-display text-2xl">{revenue ? formatEuro(revenue.todayCents) : "—"}</div></CardContent></Card>
      </section>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="mapping">Data mapping</TabsTrigger>
          <TabsTrigger value="matching">Matching</TabsTrigger>
          <TabsTrigger value="demo">Demo bon</TabsTrigger>
          <TabsTrigger value="preorder">Pre-order mapping</TabsTrigger>
          <TabsTrigger value="import">Import & middleware</TabsTrigger>
          <TabsTrigger value="logs">Sync & logs</TabsTrigger>
          <TabsTrigger value="reports">Rapportagepreview</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        {/* Providers — Loyverse prominent */}
        <TabsContent value="providers" className="space-y-4">
          <Card className="border-primary/40 bg-primary/[0.03]">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Loyverse POS
                    <Badge variant="secondary" className="text-xs"><Sparkles className="mr-1 h-3 w-3" /> Aanbevolen starter-POS</Badge>
                    {loyverse?.status === "connected" && <Badge variant="default" className="text-xs">Gekoppeld</Badge>}
                    {loyverse?.status === "pending" && <Badge variant="outline" className="text-xs">In afwachting</Badge>}
                  </CardTitle>
                  <CardDescription className="mt-1 max-w-2xl">
                    Loyverse heeft een gratis POS-basis die nuttig kan zijn voor kleine horeca. Koppel je Loyverse-account
                    om bonnen automatisch te importeren en te matchen aan reserveringen.
                  </CardDescription>
                  {loyverse?.status === "connected" && (
                    <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                      {loyverse.display_name && <div>Account: <strong>{loyverse.display_name}</strong></div>}
                      <div>Laatste sync: {loyverse.last_synced_at ? format(new Date(loyverse.last_synced_at), "d MMM HH:mm", { locale: nl }) : "—"}</div>
                      <div>Producten gesynchroniseerd: <strong>{loyverseItemCount}</strong></div>
                      {loyverse.last_error && <div className="text-destructive">Fout: {loyverse.last_error}</div>}
                    </div>
                  )}
                </div>
                <Badge variant="outline">{loyverse?.status === "connected" ? "Live" : "Demo-ready"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {loyverse?.status !== "active" ? (
                <Button size="sm" onClick={() => setTokenDialogOpen(true)} disabled={loyverseBusy === "connect"}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Koppel met Loyverse
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={handleLoyverseSync} disabled={loyverseBusy === "sync"}>
                    {loyverseBusy === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Synchroniseer nu
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleLoyverseDisconnect} disabled={loyverseBusy === "disconnect"}>
                    <Unlink className="mr-2 h-4 w-4" /> Ontkoppel
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => { selectProvider(restaurantId, "loyverse"); toast.success("Loyverse gekozen als provider"); setReload((r) => r + 1); }}>Mapping voorbereiden</Button>
              <Button size="sm" variant="ghost" onClick={() => toast("Demo-flow", { description: "Maak een demo-bon aan op het tabblad ‘Demo bon’." })}>Demo bekijken</Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {POS_PROVIDERS.filter((p) => p.key !== "loyverse").map((p) => (
              <Card key={p.key}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{p.label}</CardTitle>
                    <StatusBadge status={p.status} />
                  </div>
                  <CardDescription className="text-xs line-clamp-3">{p.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="sm" variant="outline" onClick={() => { selectProvider(restaurantId, p.key); toast.success(`${p.label} voorbereid`); }}>
                    Voorbereiden
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Mapping */}
        <TabsContent value="mapping" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">POS-data mapping</CardTitle><CardDescription>Generieke POS-velden mappen naar TableWise.</CardDescription></CardHeader>
            <CardContent>
              <div className="rounded border overflow-hidden text-sm">
                <div className="grid grid-cols-3 gap-2 bg-muted/40 px-3 py-2 text-xs font-medium">
                  <div>POS veld</div><div>TableWise locatie</div><div>Toelichting</div>
                </div>
                {POS_FIELD_MAPPING.map((m) => (
                  <div key={m.pos} className="grid grid-cols-3 gap-2 px-3 py-1.5 border-t text-xs">
                    <code className="font-mono">{m.pos}</code>
                    <code className="font-mono text-muted-foreground">{m.tablewise}</code>
                    <div className="text-muted-foreground">{m.note ?? "—"}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matching */}
        <TabsContent value="matching" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Niet-gematchte bonnen</CardTitle><CardDescription>Geen automatische definitieve match zonder bevestiging.</CardDescription></CardHeader>
            <CardContent>
              {unmatched.length === 0 ? (
                <p className="text-sm text-muted-foreground">Alle bonnen zijn gematcht of er zijn nog geen bonnen.</p>
              ) : (
                <ScrollArea className="max-h-[480px]">
                  <ul className="space-y-2">
                    {unmatched.map((r) => <UnmatchedRow key={r.id} receipt={r} onChanged={() => setReload((x) => x + 1)} />)}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demo */}
        <TabsContent value="demo" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Simuleer POS-bon</CardTitle>
              <CardDescription>Maak demo-/handmatige POS-data aan om de flow te tonen aan medewerkers of investeerders.</CardDescription>
            </CardHeader>
            <CardContent>
              <POSReceiptForm restaurantId={restaurantId} onCreated={() => setReload((x) => x + 1)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pre-order POS mapping */}
        <TabsContent value="preorder" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Pre-order ↔ POS mapping</CardTitle>
              <CardDescription>Pre-orders kunnen later aan POS-producten worden gekoppeld. Voor MVP blijven ze operationele hospitality-notities.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded border p-3 text-sm text-muted-foreground">
                Mapping wordt actief zodra er een POS-koppeling is. Velden voorbereid: <code className="font-mono">pos_provider</code>, <code className="font-mono">external_product_id</code>.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import & middleware */}
        <TabsContent value="import" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meer koppelingen op komst</CardTitle>
              <CardDescription>
                We bouwen extra POS- en middleware-koppelingen op basis van wat onze pilotrestaurants nodig hebben.
                Voor nu kun je bonnen handmatig invoeren of via Loyverse synchroniseren.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> CSV-import van bonnen</li>
                <li className="flex items-center gap-2"><Webhook className="h-4 w-4" /> Make / Zapier / n8n webhooks</li>
                <li className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Provider-agnostische custom API</li>
              </ul>
              <Button asChild variant="outline" size="sm">
                <a href="mailto:support@txtablewise.nl?subject=POS-koppeling%20aanvraag">
                  Laat ons weten welke koppeling je nodig hebt
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync & logs */}
        <TabsContent value="logs" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">POS sync status & logs</CardTitle></CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen POS-events.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        {e.status === "processed" ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                        <code className="font-mono">{e.event_type}</code>
                      </div>
                      <div className="text-muted-foreground">{format(new Date(e.created_at), "d MMM HH:mm", { locale: nl })} · {e.status}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="space-y-3">
          <p className="text-xs text-muted-foreground">Gebaseerd op gekoppelde demo/handmatige POS-data. Wordt actief zodra POS-data wordt gekoppeld.</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Omzet vandaag</div><div className="font-display text-2xl">{revenue ? formatEuro(revenue.todayCents) : "—"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gem. besteding per couvert</div><div className="font-display text-2xl">{revenue?.avgPerCover ? formatEuro(revenue.avgPerCover) : "—"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gematcht</div><div className="font-display text-2xl">{matched.length}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pre-order omzet</div><div className="font-display text-2xl">—</div><div className="text-[10px] text-muted-foreground">Volgt zodra prijzen bekend zijn</div></CardContent></Card>
          </div>
          {revenue && revenue.perChannel.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Omzet per kanaal</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {revenue.perChannel.map((c) => (
                    <li key={c.channel} className="flex justify-between border-b py-1 last:border-0">
                      <span className="capitalize">{c.channel}</span><span className="font-mono">{formatEuro(c.cents)} ({c.count})</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Privacy */}
        <TabsContent value="privacy" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Privacy en datagebruik</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>POS-data kan gevoelig zijn. TableWise gaat hier zorgvuldig mee om:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Omzetdata is alleen zichtbaar voor eigenaar/manager-rollen.</li>
                <li>Host- en staff-rollen zien geen euro-bedragen.</li>
                <li>Geen ‘hoge waarde’ of ‘lage waarde’ labels in operationele UI.</li>
                <li>Omzet wordt gebruikt voor inzichten, niet voor ongastvrije behandeling.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Loyverse Access Token Dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={(o) => { setTokenDialogOpen(o); if (!o) { setTokenInput(""); setShowToken(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Koppel met Loyverse</DialogTitle>
            <DialogDescription>
              Plak je persoonlijke Loyverse access token. We testen direct of hij geldig is.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setTokenHelpOpen((v) => !v)}
              className="text-xs text-primary hover:underline text-left"
            >
              {tokenHelpOpen ? "▾" : "▸"} Hoe vind ik mijn access token in Loyverse?
            </button>
            {tokenHelpOpen && (
              <ol className="text-xs text-muted-foreground space-y-1 pl-4 list-decimal">
                <li>Open je Loyverse Back Office.</li>
                <li>Ga naar <strong>Instellingen → Access tokens</strong>.</li>
                <li>Klik <strong>+ Nieuwe token toevoegen</strong>, geef hem een naam (bijv. "TableWise").</li>
                <li>Kopieer de getoonde token-waarde.</li>
                <li>Plak die hieronder en klik op Verbinden.</li>
                <li>
                  <a
                    href="https://r.loyverse.com/dashboard/#/integrations"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open Loyverse integraties <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              </ol>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="loyverse-token" className="text-xs">Access token</Label>
              <div className="flex gap-2">
                <Input
                  id="loyverse-token"
                  type={showToken ? "text" : "password"}
                  placeholder="3878ee588caa…"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="button" size="icon" variant="outline" onClick={() => setShowToken((v) => !v)} aria-label={showToken ? "Verbergen" : "Tonen"}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Token wordt veilig versleuteld opgeslagen en alleen server-side gebruikt om bonnen op te halen.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenDialogOpen(false)} disabled={loyverseBusy === "connect"}>
              Annuleer
            </Button>
            <Button onClick={handleLoyverseConnect} disabled={loyverseBusy === "connect" || tokenInput.trim().length < 10}>
              {loyverseBusy === "connect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
              Verbinden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function UnmatchedRow({ receipt, onChanged }: { receipt: POSReceipt; onChanged: () => void }) {
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof suggestReservationMatches>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { suggestReservationMatches(receipt).then(setSuggestions); }, [receipt]);

  async function doMatch(rid: string) {
    setLoading(true);
    try { await matchReceiptToReservation(receipt, rid); toast.success("Bon gekoppeld"); onChanged(); }
    catch (e) { toast.error("Koppelen mislukt", { description: (e as Error).message }); }
    finally { setLoading(false); }
  }
  async function doIgnore() {
    try { await ignoreReceipt(receipt); toast("Bon genegeerd"); onChanged(); }
    catch (e) { toast.error("Negeren mislukt", { description: (e as Error).message }); }
  }

  return (
    <li className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{formatEuro(receipt.total_cents)} <span className="text-muted-foreground text-xs">· {receipt.guest_count ?? "?"} couverts · {receipt.payment_status}</span></div>
          <div className="text-[10px] text-muted-foreground">{receipt.provider} · {receipt.receipt_created_at ? format(new Date(receipt.receipt_created_at), "d MMM HH:mm", { locale: nl }) : "—"}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={doIgnore}><X className="h-3.5 w-3.5 mr-1" /> Negeer</Button>
      </div>
      {suggestions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Geen reserveringssuggesties op deze datum.</p>
      ) : (
        <ul className="space-y-1">
          {suggestions.slice(0, 3).map((s) => (
            <li key={s.reservationId} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1.5 text-xs">
              <div>
                <span className="font-medium">{format(new Date(s.start_time), "HH:mm", { locale: nl })}</span> · {s.party_size} pers
                <Badge variant="outline" className="ml-2 text-[10px]">{s.score}</Badge>
                <span className="ml-2 text-muted-foreground">{s.reason}</span>
              </div>
              <Button size="sm" disabled={loading} onClick={() => doMatch(s.reservationId)}>Koppel</Button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default POSIntegrationPage;
