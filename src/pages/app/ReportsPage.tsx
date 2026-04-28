// Rapportages — horeca-gerichte KPI's, kanalen, no-show, wachtlijst, walk-ins,
// grote groepen, pre-orders, reviews, gasten, POS-omzet en pacing met insight cards.
// Rolbewust: omzetkaarten alleen voor owner/manager.
import { useEffect, useMemo, useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportDateRangePicker } from "@/components/reports/ReportDateRangePicker";
import {
  ReportKpiCard, ReportSection, InsightCardItem, EmptyState,
  ExportReadyButton, StatusDistributionList, SimpleBarChart,
} from "@/components/reports/ReportPrimitives";
import {
  type DateRange, type RangePreset, getReportingDateRange, isValidRange,
  getReservationMetrics, getChannelMetrics, getNoShowMetrics, getWaitlistMetrics,
  getWalkInMetrics, getLargeGroupMetrics, getPreOrderMetrics, getReviewMetrics,
  getGuestMetrics, getPOSRevenueMetrics, getPacingMetrics, buildInsightCards, formatEuro,
  getHourlyOccupancy, getTopSeatingMetrics, getReminderMetrics, getAIPerformanceMetrics,
  formatDuration,
} from "@/services/reporting";

const CHANNEL_LABELS: Record<string, string> = {
  online: "Website widget", phone: "Telefoon", walk_in: "Walk-in", ai_host: "AI Host",
  manager: "Handmatig", clickwise: "ClickWise", import: "Import", whatsapp: "WhatsApp",
  instagram: "Instagram", google: "Google", qr_table: "QR aan tafel",
  walkin_qr: "QR walk-in", partner: "Partner", returning_guest: "Terugkerende gast",
  onbekend: "Onbekend",
};

type AllMetrics = {
  reservations: Awaited<ReturnType<typeof getReservationMetrics>>;
  channels: Awaited<ReturnType<typeof getChannelMetrics>>;
  noShow: Awaited<ReturnType<typeof getNoShowMetrics>>;
  waitlist: Awaited<ReturnType<typeof getWaitlistMetrics>>;
  walkIn: Awaited<ReturnType<typeof getWalkInMetrics>>;
  largeGroup: Awaited<ReturnType<typeof getLargeGroupMetrics>>;
  preOrder: Awaited<ReturnType<typeof getPreOrderMetrics>>;
  reviews: Awaited<ReturnType<typeof getReviewMetrics>>;
  guests: Awaited<ReturnType<typeof getGuestMetrics>>;
  pos: Awaited<ReturnType<typeof getPOSRevenueMetrics>>;
  pacing: Awaited<ReturnType<typeof getPacingMetrics>>;
};

const ReportsPage = () => {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const role = current?.role;
  const canSeeRevenue = role === "owner" || role === "manager";

  const [preset, setPreset] = useState<RangePreset>("week");
  const [range, setRange] = useState<DateRange>(getReportingDateRange("week"));
  const [data, setData] = useState<AllMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !isValidRange(range)) return;
    setLoading(true); setError(null);
    Promise.all([
      getReservationMetrics(restaurantId, range),
      getChannelMetrics(restaurantId, range),
      getNoShowMetrics(restaurantId, range),
      getWaitlistMetrics(restaurantId, range),
      getWalkInMetrics(restaurantId, range),
      getLargeGroupMetrics(restaurantId, range),
      getPreOrderMetrics(restaurantId, range),
      getReviewMetrics(restaurantId, range),
      getGuestMetrics(restaurantId, range),
      getPOSRevenueMetrics(restaurantId, range),
      getPacingMetrics(restaurantId, range),
    ]).then(([reservations, channels, noShow, waitlist, walkIn, largeGroup, preOrder, reviews, guests, pos, pacing]) => {
      setData({ reservations, channels, noShow, waitlist, walkIn, largeGroup, preOrder, reviews, guests, pos, pacing });
    }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [restaurantId, range]);

  const insights = useMemo(() => data ? buildInsightCards({
    channel: data.channels, noShow: data.noShow, waitlist: data.waitlist,
    walkIn: { total: data.walkIn.total }, largeGroup: { total: data.largeGroup.total, awaitingApproval: data.largeGroup.awaitingApproval },
    pacing: data.pacing,
  }) : [], [data]);

  if (!restaurantId) return <div className="p-6">Restaurant laden…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl">Rapportages</h1>
        <p className="text-muted-foreground max-w-3xl">
          Wat gebeurde er, waar bleven tafels leeg, welke kanalen werken en waar kun je morgen beter op sturen?
          Data kan onvolledig zijn zolang integraties nog niet actief zijn.
        </p>
      </header>

      <ReportDateRangePicker preset={preset} range={range}
        onChange={(p, r) => { setPreset(p); setRange(r); }} />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">De rapportage kon niet worden geladen: {error}</CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 animate-pulse h-24" /></Card>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPI overview */}
          <ReportSection title="Vandaag in één oogopslag" status="live" action={<ExportReadyButton />}>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <ReportKpiCard label="Reserveringen" value={data.reservations.total} hint="Totaal in periode" />
              <ReportKpiCard label="Bevestigd" value={data.reservations.byStatus.confirmed ?? 0} />
              <ReportKpiCard label="Covers" value={data.reservations.covers} hint="Excl. annulering/no-show" />
              <ReportKpiCard label="Gem. groepsgrootte" value={data.reservations.averagePartySize || "—"} />
              <ReportKpiCard label="Walk-ins" value={data.walkIn.total} hint={`${data.walkIn.covers} covers`} />
              <ReportKpiCard label="Grote groepen" value={data.largeGroup.total} hint={`${data.largeGroup.awaitingApproval} wachten op goedkeuring`} />
              <ReportKpiCard label="No-shows" value={data.noShow.noShows} hint={`${data.noShow.noShowPct}% van totaal`} />
              <ReportKpiCard label="Wachtlijstconversie" value={`${data.waitlist.conversionPct}%`} hint={`${data.waitlist.converted} omgezet`} />
            </div>
          </ReportSection>

          {/* Insights */}
          {insights.length > 0 && (
            <ReportSection title="Inzichten" description="Op basis van de huidige periode. Geen aannames zonder data.">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {insights.map((i) => <InsightCardItem key={i.id} title={i.title} body={i.body} tone={i.tone} />)}
              </div>
            </ReportSection>
          )}

          {/* Reservations & covers */}
          <ReportSection title="Reserveringen & covers" status="live"
            description="Aantallen per dag en statusverdeling.">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Reserveringen per dag</CardTitle></CardHeader>
                <CardContent>
                  {data.reservations.perDay.length === 0
                    ? <p className="text-sm text-muted-foreground">Geen reserveringen in deze periode.</p>
                    : <SimpleBarChart data={data.reservations.perDay.map((d) => ({ label: d.date.slice(5), value: d.reservations }))} />
                  }
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Covers per dag</CardTitle></CardHeader>
                <CardContent>
                  {data.reservations.perDay.length === 0
                    ? <p className="text-sm text-muted-foreground">Geen covers in deze periode.</p>
                    : <SimpleBarChart data={data.reservations.perDay.map((d) => ({ label: d.date.slice(5), value: d.covers }))} />
                  }
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Statusverdeling</CardTitle></CardHeader>
                <CardContent><StatusDistributionList data={data.reservations.byStatus} /></CardContent>
              </Card>
            </div>
          </ReportSection>

          {/* Channels */}
          <ReportSection title="Kanalen" status="live"
            description="Welke reserveringskanalen leveren wat op?">
            {data.channels.length === 0
              ? <EmptyState title="Nog geen kanaaldata" message="Er is nog onvoldoende data voor deze rapportage." />
              : (
                <Card><CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs">
                        <tr>
                          <th className="text-left px-3 py-2">Kanaal</th>
                          <th className="text-right px-3 py-2">Reserveringen</th>
                          <th className="text-right px-3 py-2">Covers</th>
                          <th className="text-right px-3 py-2">Gem. groep</th>
                          <th className="text-right px-3 py-2">No-show %</th>
                          <th className="text-right px-3 py-2">Voltooid</th>
                          <th className="text-right px-3 py-2">Geannuleerd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.channels.map((c) => (
                          <tr key={c.channel} className="border-t">
                            <td className="px-3 py-2">{CHANNEL_LABELS[c.channel] ?? c.channel}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.reservations}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.covers}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.avgPartySize || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.noShowPct}%</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.completed}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.cancelled}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
              )}
          </ReportSection>

          {/* No-show */}
          <ReportSection title="No-show & annuleringen" status="live"
            description="No-shows zijn reserveringen waarbij de gast niet is verschenen en dit door het team is gemarkeerd.">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ReportKpiCard label="No-shows" value={data.noShow.noShows} hint={`${data.noShow.noShowPct}% van totaal`} />
              <ReportKpiCard label="Annuleringen" value={data.noShow.cancelled} />
              <ReportKpiCard label="Herbevestigingen open" value={data.noShow.reconfirmationOpen} />
              <ReportKpiCard label="Herbevestigd door gast" value={data.noShow.reconfirmationConfirmed} />
              <ReportKpiCard label="No-shows grote groepen" value={data.noShow.largeGroupNoShows} />
            </div>
          </ReportSection>

          {/* Waitlist */}
          <ReportSection title="Wachtlijst & last-minute opvulling" status="live">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ReportKpiCard label="Actief op wachtlijst" value={data.waitlist.active} />
              <ReportKpiCard label="Matches" value={data.waitlist.matched} />
              <ReportKpiCard label="Geconverteerd" value={data.waitlist.converted} hint="Naar reservering" />
              <ReportKpiCard label="Conversie" value={`${data.waitlist.conversionPct}%`} />
            </div>
          </ReportSection>

          {/* Walk-in */}
          <ReportSection title="Walk-ins" status="live"
            description="Helpt bepalen hoeveel tafels je vrijhoudt voor passanten.">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ReportKpiCard label="Walk-ins" value={data.walkIn.total} />
              <ReportKpiCard label="Walk-in covers" value={data.walkIn.covers} />
              <ReportKpiCard label="Gem. groep" value={data.walkIn.avgPartySize || "—"} />
            </div>
            {data.walkIn.perDay.length > 0 && (
              <Card><CardContent className="p-4">
                <SimpleBarChart data={data.walkIn.perDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} />
              </CardContent></Card>
            )}
          </ReportSection>

          {/* Large groups */}
          <ReportSection title="Grote groepen" status="live"
            description="Grote groepen leveren veel covers op, maar vragen vaker handmatige opvolging.">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ReportKpiCard label="Aantal groepen" value={data.largeGroup.total} />
              <ReportKpiCard label="Covers" value={data.largeGroup.covers} />
              <ReportKpiCard label="Gem. groepsgrootte" value={data.largeGroup.avgPartySize || "—"} />
              <ReportKpiCard label="Wachten op goedkeuring" value={data.largeGroup.awaitingApproval} />
              <ReportKpiCard label="Goedgekeurd" value={data.largeGroup.approved} />
              <ReportKpiCard label="Afgewezen" value={data.largeGroup.declined} />
              <ReportKpiCard label="Geannuleerd" value={data.largeGroup.cancelled} />
              <ReportKpiCard label="No-shows" value={data.largeGroup.noShows} />
            </div>
          </ReportSection>

          {/* Pre-orders */}
          <ReportSection title="Drankjes & extra's vooraf" status="live"
            description="Geschatte extra omzet op basis van ingestelde prijzen. Nog geen volledige POS-validatie.">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ReportKpiCard label="Pre-orders" value={data.preOrder.total} />
              <ReportKpiCard label="Geschatte omzet" value={formatEuro(data.preOrder.estimatedRevenueCents)} status="incomplete" />
              <ReportKpiCard label="Klaargezet" value={data.preOrder.byStatus.prepared ?? 0} />
              <ReportKpiCard label="Geserveerd" value={data.preOrder.byStatus.served ?? 0} />
            </div>
            {data.preOrder.topItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Populairste items</CardTitle></CardHeader>
                <CardContent><SimpleBarChart data={data.preOrder.topItems.map((i) => ({ label: i.name, value: i.qty }))} /></CardContent>
              </Card>
            )}
          </ReportSection>

          {/* Reviews */}
          <ReportSection title="Reviews & aftercare" status="live"
            description="Helpt om serviceherstel en reviews beter op te volgen.">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ReportKpiCard label="Verzoeken klaar" value={data.reviews.requestsReady} />
              <ReportKpiCard label="Feedback ontvangen" value={data.reviews.responses} />
              <ReportKpiCard label="Positief" value={data.reviews.positive} />
              <ReportKpiCard label="Negatief / opvolging" value={data.reviews.followUpRequired} />
              <ReportKpiCard label="Google Review uitnodigingen" value={data.reviews.googleInvited} status="prepared" />
              <ReportKpiCard label="Gem. tevredenheid" value={data.reviews.averageSatisfaction || "—"} hint="Schaal 1–5" />
            </div>
          </ReportSection>

          {/* Guests / CRM */}
          <ReportSection title="Gasten & CRM" status="live">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ReportKpiCard label="Nieuwe gasten" value={data.guests.newGuests} />
              <ReportKpiCard label="Terugkerende gasten" value={data.guests.returning} />
              <ReportKpiCard label="VIP-gasten" value={data.guests.vip} />
              <ReportKpiCard label="Met allergieën / dieet" value={data.guests.withAllergies} />
              <ReportKpiCard label="Marketing opt-in" value={data.guests.marketingOptIn} status="clickwise_ready" />
            </div>
          </ReportSection>

          {/* POS revenue — role-aware */}
          <ReportSection
            title="Omzetinzichten"
            status="demo"
            description="Gebaseerd op gekoppelde demo/handmatige POS-data zolang er nog geen live POS-koppeling actief is."
            action={<ExportReadyButton />}
          >
            {!canSeeRevenue ? (
              <EmptyState title="Niet beschikbaar voor deze rol"
                message="Omzetdata is alleen zichtbaar voor managers en eigenaren." />
            ) : !data.pos.hasData ? (
              <EmptyState title="Nog geen POS-data" message="Er is nog geen POS-data gekoppeld. Maak een demo-bon aan via POS-integraties om de flow te zien." />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <ReportKpiCard label="Gekoppelde omzet" value={formatEuro(data.pos.totalCents)} status="demo" />
                  <ReportKpiCard label="Gem. per couvert" value={formatEuro(data.pos.avgPerCoverCents)} />
                  <ReportKpiCard label="Gem. per reservering" value={formatEuro(data.pos.avgPerReservationCents)} />
                  <ReportKpiCard label="Niet-gematchte bonnen" value={data.pos.unmatchedCount} />
                  <ReportKpiCard label="Walk-in omzet" value={formatEuro(data.pos.walkInRevenueCents)} />
                  <ReportKpiCard label="Grote groep omzet" value={formatEuro(data.pos.largeGroupRevenueCents)} />
                </div>
                {data.pos.perChannel.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Omzet per kanaal</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5 text-sm">
                        {data.pos.perChannel.map((c) => (
                          <li key={c.channel} className="flex items-center justify-between border-b py-1.5 last:border-0">
                            <span>{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                            <span className="tabular-nums">{formatEuro(c.cents)} <span className="text-muted-foreground text-xs">({c.count})</span></span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </ReportSection>

          {/* Pacing */}
          <ReportSection title="Drukte & pacing" status="live"
            description="Welke tijdslots zijn structureel druk?">
            {data.pacing.length === 0 ? (
              <EmptyState title="Nog geen pacing-data" message="Geen reserveringen om drukte te berekenen." />
            ) : (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Covers per tijdslot</CardTitle>
                  <CardDescription className="text-xs">Op basis van starttijd, gegroepeerd per half uur.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SimpleBarChart data={data.pacing.map((s) => ({ label: s.slot, value: s.covers }))} />
                </CardContent>
              </Card>
            )}
          </ReportSection>

          <p className="text-xs text-muted-foreground text-center pt-4">
            Cijfers updaten zodra integraties (POS, ClickWise) live zijn. Demo/handmatige data is duidelijk gelabeld.
          </p>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
