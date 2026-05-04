import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Phone, MessageCircle, MessageSquare, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ChannelKey = "voice" | "whatsapp" | "sms" | "webchat";
const CHANNELS: { key: ChannelKey; label: string; Icon: typeof Phone }[] = [
  { key: "voice", label: "Voice AI", Icon: Phone },
  { key: "whatsapp", label: "WhatsApp AI", Icon: MessageCircle },
  { key: "sms", label: "SMS AI", Icon: MessageSquare },
  { key: "webchat", label: "Webchat AI", Icon: Globe },
];

const DEFAULT_ALLOWED: Record<ChannelKey, string[]> = {
  voice: ["check_availability", "find_reservation", "get_opening_hours", "book_reservation", "create_waitlist_entry"],
  whatsapp: ["check_availability", "find_reservation", "book_reservation", "cancel_reservation", "create_waitlist_entry"],
  sms: ["check_availability", "find_reservation", "reconfirm_reservation"],
  webchat: ["check_availability", "book_reservation", "create_waitlist_entry", "get_opening_hours"],
};

type ChannelConfig = {
  enabled: boolean;
  test_mode: boolean;
  allowed_actions: string[];
};

export function ChannelReadinessCards({ restaurantId }: { restaurantId: string | null }) {
  const [channels, setChannels] = useState<Record<ChannelKey, ChannelConfig>>({
    voice: { enabled: false, test_mode: true, allowed_actions: DEFAULT_ALLOWED.voice },
    whatsapp: { enabled: false, test_mode: true, allowed_actions: DEFAULT_ALLOWED.whatsapp },
    sms: { enabled: false, test_mode: true, allowed_actions: DEFAULT_ALLOWED.sms },
    webchat: { enabled: false, test_mode: true, allowed_actions: DEFAULT_ALLOWED.webchat },
  });
  const [lastSuccess, setLastSuccess] = useState<Record<string, string | null>>({});
  const [confirmLive, setConfirmLive] = useState<ChannelKey | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      const { data } = await supabase.from("voice_agent_settings")
        .select("config").eq("restaurant_id", restaurantId).maybeSingle();
      const cfg = ((data?.config as any)?.channels ?? {}) as Partial<Record<ChannelKey, ChannelConfig>>;
      setChannels((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(prev) as ChannelKey[]) {
          if (cfg[k]) next[k] = { ...prev[k], ...cfg[k] };
        }
        return next;
      });

      const { data: logs } = await supabase.from("integration_logs")
        .select("metadata, created_at, status")
        .eq("restaurant_id", restaurantId)
        .eq("source", "voice_agent")
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(50);
      const last: Record<string, string | null> = {};
      for (const log of logs ?? []) {
        const ch = (log.metadata as any)?.channel;
        if (ch && !last[ch]) last[ch] = log.created_at;
      }
      setLastSuccess(last);
    })();
  }, [restaurantId]);

  const persist = async (next: Record<ChannelKey, ChannelConfig>) => {
    if (!restaurantId) return;
    const { data } = await supabase.from("voice_agent_settings")
      .select("config").eq("restaurant_id", restaurantId).maybeSingle();
    const config = { ...(data?.config as object ?? {}), channels: next };
    const { error } = await supabase.from("voice_agent_settings")
      .upsert({ restaurant_id: restaurantId, config }, { onConflict: "restaurant_id" });
    if (error) toast.error("Kon kanaal-instellingen niet opslaan");
  };

  const toggleEnabled = (key: ChannelKey, enabled: boolean) => {
    const next = { ...channels, [key]: { ...channels[key], enabled } };
    setChannels(next);
    persist(next);
  };

  const requestLive = (key: ChannelKey) => {
    if (channels[key].test_mode) setConfirmLive(key);
    else {
      const next = { ...channels, [key]: { ...channels[key], test_mode: true } };
      setChannels(next);
      persist(next);
    }
  };

  const confirmGoLive = () => {
    if (!confirmLive) return;
    const next = { ...channels, [confirmLive]: { ...channels[confirmLive], test_mode: false } };
    setChannels(next);
    persist(next);
    setConfirmLive(null);
    toast.success(`${confirmLive} live geactiveerd`);
  };

  const status = (c: ChannelConfig) => {
    if (!c.enabled) return { label: "Niet geconfigureerd", variant: "outline" as const };
    if (c.test_mode) return { label: "Testmodus", variant: "secondary" as const };
    return { label: "Live", variant: "default" as const };
  };

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {CHANNELS.map(({ key, label, Icon }) => {
          const c = channels[key];
          const s = status(c);
          return (
            <Card key={key}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{label}</span>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>{c.allowed_actions.length} toegestane acties</div>
                  <div>
                    Laatste actie:{" "}
                    {lastSuccess[key]
                      ? new Date(lastSuccess[key]!).toLocaleString("nl-NL")
                      : "—"}
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span>Ingeschakeld</span>
                    <Switch checked={c.enabled} onCheckedChange={(v) => toggleEnabled(key, v)} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Testmodus</span>
                    <Switch
                      checked={c.test_mode}
                      disabled={!c.enabled}
                      onCheckedChange={() => requestLive(key)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!confirmLive} onOpenChange={(o) => !o && setConfirmLive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Live mode activeren?</AlertDialogTitle>
            <AlertDialogDescription>
              Live mode kan ervoor zorgen dat AI-agents echte reserveringen aanmaken,
              wijzigen of annuleren via dit kanaal. Activeer dit alleen na succesvolle tests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGoLive}>Live mode activeren</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
