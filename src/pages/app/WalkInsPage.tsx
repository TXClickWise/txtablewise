// Walk-ins pagina — gebruikt de snelle quick-sheet en AI Quick Seat input.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/useRestaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl">Walk-ins</h1>
        <p className="text-muted-foreground">
          Spontane gast aan de deur? Drie tikken en geplaatst.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <UserPlus className="h-5 w-5 text-primary" /> Walk-in snel plaatsen
          </CardTitle>
          <CardDescription>
            Open de snelle plaatsing-sheet. Voor een snelle walk-in heb je geen gastgegevens nodig.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="h-14 w-full text-base" onClick={() => startQuick()}>
            <UserPlus className="mr-2 h-5 w-5" /> Nieuwe walk-in
          </Button>
        </CardContent>
      </Card>

      <AIQuickSeatInput zones={zones} onConfirm={(p) => startQuick(p)} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Sparkles className="h-4 w-4 text-primary" /> Tip
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Floor Mode en Tafelplan hebben dezelfde walk-in flow ingebouwd. Tik op een vrije
          tafel om die direct voor te selecteren.
        </CardContent>
      </Card>

      <WalkInQuickSheet
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setPrefill(undefined); }}
        prefill={prefill}
      />
    </div>
  );
};

export default WalkInsPage;
