import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { format } from "date-fns";
import { Copy, Download, Globe, Smartphone, Monitor, Image as ImageIcon, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getWidgetBaseUrl } from "@/lib/widgetUrl";
import { usePlan } from "@/hooks/usePlan";
import { Sparkles, Lock } from "lucide-react";
import { LogoUploader } from "@/components/branding/LogoUploader";
import { AdvancedSection } from "@/components/AdvancedSection";

type RestaurantBrand = {
  id: string;
  slug: string;
  name: string;
  brand_primary: string | null;
  logo_url: string | null;
  public_base_url: string | null;
  custom_widget_domain: string | null;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const WidgetSettings = () => {
  const { current } = useRestaurant();
  const { plan } = usePlan();
  const isPro = plan === "pro";
  const restaurant = current?.restaurants;
  const [brand, setBrand] = useState<RestaurantBrand | null>(null);
  const [customDomain, setCustomDomain] = useState<string>("");
  const [savingDomain, setSavingDomain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state for restaurant brand
  const [brandPrimary, setBrandPrimary] = useState<string>("#3B82F6");
  const [logoUrl, setLogoUrl] = useState<string>("");

  // Local form state for widget defaults (URL params)
  const [defaultParty, setDefaultParty] = useState<number>(2);
  const [defaultDate, setDefaultDate] = useState<string>(""); // yyyy-MM-dd or ""
  const [defaultTime, setDefaultTime] = useState<string>(""); // HH:mm or ""
  const [language, setLanguage] = useState<"nl" | "en">("nl");
  const [showTableWiseLogo, setShowTableWiseLogo] = useState<boolean>(true);

  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, slug, name, brand_primary, logo_url, public_base_url, custom_widget_domain")
        .eq("id", restaurant.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Kon restaurantgegevens niet laden");
        setLoading(false);
        return;
      }
      setBrand(data as RestaurantBrand);
      if (data.brand_primary && HEX_RE.test(data.brand_primary)) setBrandPrimary(data.brand_primary);
      setLogoUrl(data.logo_url ?? "");
      setCustomDomain((data as any).custom_widget_domain ?? "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [restaurant?.id]);

  const origin = getWidgetBaseUrl({
    customWidgetDomain: brand?.custom_widget_domain,
    publicBaseUrl: brand?.public_base_url,
  });
  const slug = brand?.slug ?? "";

  const widgetUrl = useMemo(() => {
    if (!slug) return "";
    const url = new URL(`${origin}/r/${slug}`);
    if (defaultParty && defaultParty !== 2) url.searchParams.set("party", String(defaultParty));
    if (defaultDate) url.searchParams.set("date", defaultDate);
    if (defaultTime) url.searchParams.set("time", defaultTime);
    if (language && language !== "nl") url.searchParams.set("lang", language);
    if (!showTableWiseLogo) url.searchParams.set("hide_logo", "1");
    return url.toString();
  }, [origin, slug, defaultParty, defaultDate, defaultTime, language, showTableWiseLogo]);

  const embedSnippet = useMemo(() => {
    if (!widgetUrl) return "";
    return `<iframe src="${widgetUrl}" loading="lazy" title="Reserveer bij ${brand?.name ?? "ons"}" style="width:100%;min-height:760px;border:0;display:block;" allow="payment"></iframe>`;
  }, [widgetUrl, brand?.name]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} gekopieerd`);
    } catch {
      toast.error("Kopiëren mislukt");
    }
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-reserveer-${slug}.png`;
    a.click();
  };

  const saveBrand = async () => {
    if (!brand) return;
    if (brandPrimary && !HEX_RE.test(brandPrimary)) {
      toast.error("Ongeldige hex-kleur (gebruik bv. #3B82F6)");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({
        brand_primary: brandPrimary || null,
        logo_url: logoUrl.trim() ? logoUrl.trim() : null,
      })
      .eq("id", brand.id);
    setSaving(false);
    if (error) {
      toast.error("Opslaan mislukt");
      return;
    }
    toast.success("Branding opgeslagen");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!brand) {
    return <p className="text-muted-foreground">Geen restaurant geselecteerd.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl">Online reserveren</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Deel je reserveringswidget op je website, in mails of via een QR-code. Gasten boeken direct in jouw eigen omgeving.
        </p>
      </div>

      {/* White-label custom domein (Pro-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Eigen domein (white-label)
            {!isPro && <span className="ml-2 text-xs font-normal rounded-full bg-primary/10 text-primary px-2 py-0.5">Pro</span>}
          </CardTitle>
          <CardDescription>
            {isPro
              ? "Koppel je eigen (sub-)domein aan je reserveringswidget voor een volledig professionele uitstraling."
              : "Beschikbaar op het Pro-plan: gebruik je eigen (sub-)domein voor je reserveringswidget."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPro ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="custom-domain">Custom widget-domein</Label>
                <Input
                  id="custom-domain"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="reserveer.mijnrestaurant.nl"
                />
                <p className="text-xs text-muted-foreground">
                  Voeg een CNAME-record toe in je DNS dat verwijst naar <code className="font-mono">txtablewise.nl</code>.
                </p>
              </div>
              {brand?.custom_widget_domain && (
                <div className="text-xs inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  DNS-verificatie nog niet actief
                </div>
              )}
              <Button
                disabled={savingDomain}
                onClick={async () => {
                  if (!brand) return;
                  setSavingDomain(true);
                  const value = customDomain.trim() ? customDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "") : null;
                  const { error } = await supabase
                    .from("restaurants")
                    .update({ custom_widget_domain: value } as any)
                    .eq("id", brand.id);
                  setSavingDomain(false);
                  if (error) { toast.error("Opslaan mislukt"); return; }
                  setBrand({ ...brand, custom_widget_domain: value });
                  toast.success(value ? "Eigen domein opgeslagen" : "Eigen domein verwijderd");
                }}
              >
                {savingDomain && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Opslaan
              </Button>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 flex items-start gap-3">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm">
                  <strong>Eigen domein beschikbaar op het Pro-plan.</strong> Gebruik je eigen (sub-)domein voor een volledig professionele uitstraling.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/app/instellingen/abonnement">Bekijk Pro-plan</a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT: configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Branding</CardTitle>
              <CardDescription>Kleur en logo zoals gasten ze zien in de widget.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-primary">Hoofdkleur</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand-primary"
                    type="color"
                    value={HEX_RE.test(brandPrimary) ? brandPrimary : "#3B82F6"}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    className="h-10 w-14 rounded-md border border-border bg-background cursor-pointer"
                    aria-label="Hoofdkleur kiezen"
                  />
                  <Input
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    placeholder="#3B82F6"
                    className="font-mono w-36"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Wordt toegepast op knoppen, accenten en focus.</p>
              </div>

              <LogoUploader
                restaurantId={brand.id}
                value={logoUrl}
                onChange={setLogoUrl}
              />

              <Button onClick={saveBrand} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Branding opslaan
              </Button>
            </CardContent>
          </Card>

          <AdvancedSection
            title="Voorgevulde waarden in de link (optioneel)"
            description="Standaard aantal personen, datum, tijd of taal. Gasten kunnen alles nog wijzigen."
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aantal personen</Label>
                <Select value={String(defaultParty)} onValueChange={(v) => setDefaultParty(parseInt(v, 10))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taal</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as "nl" | "en")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nl">Nederlands</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Standaard datum</Label>
                <Input type="date" value={defaultDate} onChange={(e) => setDefaultDate(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDefaultDate(format(new Date(), "yyyy-MM-dd"))}>Vandaag</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDefaultDate(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"))}>Morgen</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDefaultDate("")}>Wis</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Standaard tijd</Label>
                <Input type="time" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} />
                <p className="text-xs text-muted-foreground">Optioneel — wordt voorgeselecteerd als beschikbaar.</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <Label htmlFor="show-tw-logo" className="text-sm">Toon "powered by TX TableWise"</Label>
                <p className="text-xs text-muted-foreground">Subtiel onderaan de header.</p>
              </div>
              <Switch id="show-tw-logo" checked={showTableWiseLogo} onCheckedChange={setShowTableWiseLogo} />
            </div>
          </AdvancedSection>
        </div>

        {/* RIGHT: distribution */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Directe boekingslink</CardTitle>
              <CardDescription>Plak in mails, social media-bio of Google-bedrijfsprofiel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={widgetUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(widgetUrl, "Link")} aria-label="Kopieer link">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild aria-label="Open in nieuw tabblad">
                  <a href={widgetUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Embed op je website</CardTitle>
              <CardDescription>Kopieer deze code en plak hem in je website-builder of HTML.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                readOnly
                value={embedSnippet}
                className="w-full h-32 rounded-md border border-border bg-muted/30 p-3 font-mono text-xs"
              />
              <Button variant="outline" onClick={() => copy(embedSnippet, "Embed-code")} className="gap-2">
                <Copy className="h-4 w-4" /> Kopieer embed-code
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">QR-code</CardTitle>
              <CardDescription>Voor menukaarten, kassabon, tafelstandaard of flyer.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div ref={qrRef} className="bg-card p-3 rounded-md border border-border">
                  {widgetUrl && (
                    <QRCodeCanvas
                      value={widgetUrl}
                      size={160}
                      level="M"
                      includeMargin={false}
                    />
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left">
                  <p className="text-sm text-muted-foreground break-all">{widgetUrl}</p>
                  <Button variant="outline" onClick={downloadQr} className="gap-2">
                    <Download className="h-4 w-4" /> Download PNG
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PREVIEW */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live preview</CardTitle>
          <CardDescription>Zo ziet jouw widget eruit voor gasten — met de huidige instellingen.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="mobile" className="w-full">
            <TabsList>
              <TabsTrigger value="mobile" className="gap-2"><Smartphone className="h-4 w-4" /> Mobiel</TabsTrigger>
              <TabsTrigger value="desktop" className="gap-2"><Monitor className="h-4 w-4" /> Desktop</TabsTrigger>
            </TabsList>
            <TabsContent value="mobile" className="mt-4">
              <div className="flex justify-center">
                <div className="rounded-[2rem] border-8 border-foreground/80 overflow-hidden bg-background shadow-xl" style={{ width: 391, height: 700 }}>
                  {widgetUrl && (
                    <iframe key={`m-${widgetUrl}`} src={widgetUrl} title="Mobiele preview" className="w-full h-full border-0" />
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="desktop" className="mt-4">
              <div className="rounded-md border border-border overflow-hidden bg-background" style={{ height: 720 }}>
                {widgetUrl && (
                  <iframe key={`d-${widgetUrl}`} src={widgetUrl} title="Desktop preview" className="w-full h-full border-0" />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default WidgetSettings;
