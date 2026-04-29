import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, Check, X } from "lucide-react";

export default function AdminPlanRequestsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-plan-upgrade-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_upgrade_requests")
        .select("id, restaurant_id, current_plan, requested_plan, status, requester_note, admin_note, created_at, reviewed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Restaurant namen ophalen (geen FK, dus apart)
      const ids = Array.from(new Set(data?.map((r) => r.restaurant_id) ?? []));
      const { data: rests } = ids.length
        ? await supabase.from("restaurants").select("id, name").in("id", ids)
        : { data: [] as { id: string; name: string }[] };
      const map = new Map(rests?.map((r) => [r.id, r.name]) ?? []);
      return (data ?? []).map((r) => ({ ...r, restaurant_name: map.get(r.restaurant_id) ?? r.restaurant_id }));
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve, restaurantId, requestedPlan }: {
      id: string; approve: boolean; restaurantId: string; requestedPlan: string;
    }) => {
      // Update request
      const { error: e1 } = await supabase
        .from("plan_upgrade_requests")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (e1) throw e1;

      // Bij goedkeuring: zet plan op restaurant
      if (approve) {
        const { error: e2 } = await supabase
          .from("restaurants")
          .update({
            plan: requestedPlan as "trial" | "basic" | "pro",
            plan_started_at: new Date().toISOString(),
          })
          .eq("id", restaurantId);
        if (e2) throw e2;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Plan geactiveerd" : "Aanvraag afgewezen");
      qc.invalidateQueries({ queryKey: ["admin-plan-upgrade-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl">Plan-aanvragen</h1>
          <p className="text-sm text-muted-foreground">
            Keur upgrade-aanvragen van restaurants goed of af.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Laden…</Card>
      ) : requests.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Nog geen aanvragen.</Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{r.restaurant_name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    <span className="capitalize">{r.current_plan}</span> →{" "}
                    <strong className="capitalize text-foreground">{r.requested_plan}</strong>
                    <span className="mx-2">·</span>
                    {new Date(r.created_at).toLocaleString("nl-NL")}
                  </div>
                  {r.requester_note && (
                    <p className="text-sm mt-2 italic">"{r.requester_note}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      r.status === "pending"
                        ? "secondary"
                        : r.status === "approved"
                          ? "default"
                          : "destructive"
                    }
                  >
                    {r.status}
                  </Badge>
                  {r.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          review.mutate({ id: r.id, approve: false, restaurantId: r.restaurant_id, requestedPlan: r.requested_plan })
                        }
                        disabled={review.isPending}
                      >
                        <X className="h-4 w-4 mr-1" /> Afwijzen
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          review.mutate({ id: r.id, approve: true, restaurantId: r.restaurant_id, requestedPlan: r.requested_plan })
                        }
                        disabled={review.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" /> Goedkeuren
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
