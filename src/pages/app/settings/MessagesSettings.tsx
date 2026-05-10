import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

const LOCALES = [
  { code: "nl", label: "Nederlands" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
] as const;

const TEMPLATE_KEYS = [
  { key: "reservation-confirmation", label: "Reservering bevestigd" },
  { key: "reservation-reminder", label: "Reservering — herinnering" },
  { key: "reservation-cancellation", label: "Reservering — geannuleerd" },
  { key: "large-group-approved", label: "Groep — bevestigd" },
  { key: "large-group-rejected", label: "Groep — afgewezen" },
  { key: "large-group-message", label: "Groep — custom bericht" },
] as const;

interface TplRow {
  subject: string;
  heading: string;
  body_intro: string;
  body_outro: string;
  signature: string;
  is_ai_generated: boolean;
  is_edited: boolean;
}

function TemplateEditor({
  restaurantId,
  templateKey,
  label,
}: {
  restaurantId: string;
  templateKey: string;
  label: string;
}) {
  const qc = useQueryClient();
  const [translating, setTranslating] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["email-templates", restaurantId, templateKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_email_templates")
        .select("locale, subject, heading, body_intro, body_outro, signature, is_ai_generated, is_edited")
        .eq("restaurant_id", restaurantId)
        .eq("template_key", templateKey);
      if (error) throw error;
      return data || [];
    },
  });

  const byLocale: Record<string, TplRow | undefined> = {};
  for (const r of rows as any[]) byLocale[r.locale] = r;

  const save = useMutation({
    mutationFn: async ({ locale, patch }: { locale: string; patch: Partial<TplRow> }) => {
      const existing = byLocale[locale] || {
        subject: "", heading: "", body_intro: "", body_outro: "", signature: "",
        is_ai_generated: false, is_edited: false,
      };
      const { error } = await supabase
        .from("restaurant_email_templates")
        .upsert({
          restaurant_id: restaurantId,
          template_key: templateKey,
          locale,
          subject: existing.subject,
          heading: existing.heading,
          body_intro: existing.body_intro,
          body_outro: existing.body_outro,
          signature: existing.signature,
          ...patch,
          is_edited: true,
        }, { onConflict: "restaurant_id,template_key,locale" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates", restaurantId, templateKey] }),
    onError: (e: any) => toast.error("Opslaan mislukt: " + e.message),
  });

  const onTranslate = async () => {
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-email-templates", {
        body: { restaurantId, templateKey, targetLocales: ["en", "de", "fr"] },
      });
      if (error) throw error;
      const results = (data as any)?.results || {};
      const ok = Object.values(results).filter((r: any) => r.status === "translated").length;
      const skipped = Object.entries(results).filter(([, r]: any) => r.status === "skipped");
      toast.success(`${ok} vertaling${ok === 1 ? "" : "en"} gemaakt`);
      if (skipped.length > 0) {
        toast.info(`${skipped.length} overgeslagen (handmatig bewerkt of ongeldig)`);
      }
      qc.invalidateQueries({ queryKey: ["email-templates", restaurantId, templateKey] });
    } catch (e: any) {
      toast.error("Vertalen mislukt: " + e.message);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-display text-lg">{label}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Bewerk de Nederlandse tekst en laat AI hem vertalen, of pas elke taal handmatig aan.
            Beschikbare placeholders: <code>{`{{restaurantName}}`}</code>, <code>{`{{guestName}}`}</code>, <code>{`{{dateLabel}}`}</code>, <code>{`{{timeLabel}}`}</code>, <code>{`{{partySize}}`}</code>.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onTranslate} disabled={translating}>
          {translating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Vertaal met AI
        </Button>
      </div>

      <Tabs defaultValue="nl">
        <TabsList>
          {LOCALES.map((l) => {
            const row = byLocale[l.code];
            return (
              <TabsTrigger key={l.code} value={l.code} className="gap-2">
                {l.label}
                {row?.is_edited ? <Badge variant="secondary" className="text-[10px]">Bewerkt</Badge> :
                  row?.is_ai_generated ? <Badge variant="outline" className="text-[10px]">AI</Badge> :
                  !row ? <Badge variant="outline" className="text-[10px]">Standaard</Badge> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {LOCALES.map((l) => {
          const row = byLocale[l.code];
          return (
            <TabsContent key={l.code} value={l.code} className="space-y-3 mt-4">
              <LocaleFields
                row={row}
                onSave={(field, val) => save.mutate({ locale: l.code, patch: { [field]: val } as any })}
              />
              <p className="text-xs text-muted-foreground">
                {row ? "" : "Nog niet opgeslagen — standaardtekst wordt gebruikt."}
              </p>
            </TabsContent>
          );
        })}
      </Tabs>
    </Card>
  );
}

function LocaleFields({
  row,
  onSave,
}: {
  row: TplRow | undefined;
  onSave: (field: keyof TplRow, val: string) => void;
}) {
  const [local, setLocal] = useState({
    subject: row?.subject || "",
    heading: row?.heading || "",
    body_intro: row?.body_intro || "",
    body_outro: row?.body_outro || "",
    signature: row?.signature || "",
  });
  // Reset local when row changes (e.g. after AI translation)
  const rowKey = `${row?.subject}|${row?.heading}|${row?.body_intro}|${row?.body_outro}|${row?.signature}`;
  const [seenKey, setSeenKey] = useState(rowKey);
  if (rowKey !== seenKey) {
    setSeenKey(rowKey);
    setLocal({
      subject: row?.subject || "",
      heading: row?.heading || "",
      body_intro: row?.body_intro || "",
      body_outro: row?.body_outro || "",
      signature: row?.signature || "",
    });
  }

  const onBlur = (field: keyof TplRow) => {
    const val = (local as any)[field];
    const orig = (row?.[field] as string) || "";
    if (val !== orig) onSave(field, val);
  };

  return (
    <>
      <div>
        <Label className="text-xs">Onderwerp</Label>
        <Input value={local.subject}
          onChange={(e) => setLocal({ ...local, subject: e.target.value })}
          onBlur={() => onBlur("subject")} />
      </div>
      <div>
        <Label className="text-xs">Kop</Label>
        <Input value={local.heading}
          onChange={(e) => setLocal({ ...local, heading: e.target.value })}
          onBlur={() => onBlur("heading")} />
      </div>
      <div>
        <Label className="text-xs">Intro</Label>
        <Textarea rows={3} value={local.body_intro}
          onChange={(e) => setLocal({ ...local, body_intro: e.target.value })}
          onBlur={() => onBlur("body_intro")} />
      </div>
      <div>
        <Label className="text-xs">Afsluiting</Label>
        <Textarea rows={3} value={local.body_outro}
          onChange={(e) => setLocal({ ...local, body_outro: e.target.value })}
          onBlur={() => onBlur("body_outro")} />
      </div>
      <div>
        <Label className="text-xs">Ondertekening</Label>
        <Input value={local.signature}
          onChange={(e) => setLocal({ ...local, signature: e.target.value })}
          onBlur={() => onBlur("signature")} />
      </div>
    </>
  );
}

export default function MessagesSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;
  const qc = useQueryClient();

  const { data: r } = useQuery({
    queryKey: ["restaurant-settings", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const patch = async (values: Record<string, any>) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from("restaurants")
      .update(values as any)
      .eq("id", restaurantId);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["restaurant-settings", restaurantId] });
    qc.invalidateQueries({ queryKey: ["onboarding-step-statuses", restaurantId] });
  };

  if (!r || !restaurantId) return <div className="text-muted-foreground p-4">Laden…</div>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-display text-xl mb-2">Standaardtaal voor gasten</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Wanneer een gast geen specifieke taal kiest in het reserveringsformulier, gebruiken we deze taal voor e-mails en de manage-pagina.
        </p>
        <div className="max-w-xs">
          <Select
            value={r.default_locale || "nl"}
            onValueChange={(v) => patch({ default_locale: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl mb-2">E-mail aan gasten</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Gasten ontvangen bevestigingen, herinneringen en groepsberichten van <strong>{r.name}</strong>. Antwoorden komen rechtstreeks in jullie inbox.
        </p>
        <div className="py-3">
          <Label className="text-sm">Reply-to inbox van het restaurant</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">
            Wanneer een gast op een TableWise-mail antwoordt, komt het bericht hier binnen.
          </p>
          <Input
            type="email"
            placeholder="reserveringen@jouwrestaurant.nl"
            defaultValue={r.guest_reply_to_email ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && !/^\S+@\S+\.\S+$/.test(v)) {
                toast.error("Vul een geldig e-mailadres in");
                return;
              }
              patch({ guest_reply_to_email: v || null });
            }}
          />
        </div>
      </Card>

      <div>
        <h2 className="font-display text-xl mb-2">E-mailteksten per taal</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Pas de standaardtekst van elke e-mail aan en laat AI hem automatisch vertalen naar Engels, Duits en Frans.
        </p>
        <div className="space-y-4">
          {TEMPLATE_KEYS.map((t) => (
            <TemplateEditor
              key={t.key}
              restaurantId={restaurantId}
              templateKey={t.key}
              label={t.label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
