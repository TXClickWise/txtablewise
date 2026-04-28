// Walk-ins pagina — gebruikt de snelle quick-sheet en AI Quick Seat input.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { UserPlus, Sparkles } from "lucide-react";
import { WalkInQuickSheet, type WalkInQuickPrefill } from "@/components/walk-in/WalkInQuickSheet";
import { AIQuickSeatInput } from "@/components/walk-in/AIQuickSeatInput";

const WalkInsPage = () => {
  const { current } = useRestaurant();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<WalkInQuickPrefill | undefined>();

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", current?.restaurant_id],
    enabled: !!current?.restaurant_id,
    queryFn: async () => {
      const { data } = await supabase.from("zones")
        .select("id, name")
        .eq("restaurant_id", current!.restaurant_id)
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const startQuick = (p?: WalkInQuickPrefill) => { setPrefill(p); setOpen(true); };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Walk-ins"
        description="Spontane gast aan de deur? Drie tikken en geplaatst."
      />

      <SectionCard
        title="Walk-in snel plaatsen"
        description="Open de snelle plaatsing-sheet. Voor een snelle walk-in heb je geen gastgegevens nodig."
        icon={<UserPlus />}
      >
        <Button size="lg" className="h-14 w-full text-base" onClick={() => startQuick()}>
          <UserPlus className="mr-2 h-5 w-5" /> Nieuwe walk-in
        </Button>
      </SectionCard>

      <AIQuickSeatInput zones={zones} onConfirm={(p) => startQuick(p)} />

      <SectionCard title="Tip" icon={<Sparkles />}>
        <p className="text-sm text-muted-foreground">
          Floor Mode en Tafelplan hebben dezelfde walk-in flow ingebouwd. Tik op een vrije
          tafel om die direct voor te selecteren.
        </p>
      </SectionCard>

      <WalkInQuickSheet
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setPrefill(undefined); }}
        prefill={prefill}
      />
    </div>
  );
};

export default WalkInsPage;
