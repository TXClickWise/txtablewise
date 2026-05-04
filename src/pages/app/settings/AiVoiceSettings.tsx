import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, PhoneCall, ExternalLink } from "lucide-react";
import { StepStatusBadge } from "@/components/onboarding/StepStatusBadge";

export default function AiVoiceSettings() {
  const { current } = useRestaurant();
  const restaurantId = current?.restaurant_id;

  const { data: agentKeys } = useQuery({
    queryKey: ["agent-keys-count", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { count } = await supabase
        .from("agent_api_keys")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId!)
        .is("revoked_at", null);
      return count ?? 0;
    },
  });

  const voiceStatus = (agentKeys ?? 0) > 0 ? "done" : "not_started";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">AI &amp; Voice</h1>
        <p className="text-sm text-muted-foreground">
          Beheer de AI Host (chat) en de telefonische Voice Agent. Configureer per kanaal of
          AI mag boeken, of alleen mag controleren en doorzetten.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-medium">AI Host (chat &amp; widget)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Beantwoordt vragen en stelt tijdslots voor binnen je reserveringswidget.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/app/ai-host">
              Openen <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <PhoneCall className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-medium flex items-center gap-2">
                Voice Agent (telefoon)
                <StepStatusBadge status={voiceStatus as any} />
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                ClickWise Voice AI — koppel via een agent API-key.{" "}
                {(agentKeys ?? 0) === 0
                  ? "Nog geen actieve agent-key ingesteld."
                  : `${agentKeys} actieve agent-key(s).`}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/app/voice-agent">Beheren</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
