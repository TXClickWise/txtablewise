import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, Check, X, History } from "lucide-react";

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

      const ids = Array.from(new Set(data?.map((r) => r.restaurant_id) ?? []));
      const { data: rests } = ids.length
        ? await supabase.from("restaurants").select("id, name").in("id", ids)
        : { data: [] as { id: string; name: string }[] };
      const map = new Map(rests?.map((r) => [r.id, r.name]) ?? []);
      return (data ?? []).map((r) => ({ ...r, restaurant_name: map.get(r.restaurant_id) ?? r.restaurant_id }));
    },
  });

  // Recent admin-actions feed (audit_log entries by system admins)
  const { data: recentAdminActions = [] } = useQuery({
    queryKey: ["admin-recent-actions"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, restaurant_id, entity, action, actor_label, after_data, created_at")
        .like("action", "admin.%")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r) => r.restaurant_id).filter(Boolean) as string[]));
      const { data: rests } = ids.length
        ? await supabase.from("restaurants").select("id, name").in("id", ids)
        : { data: [] as { id: string; name: string }[] };
      const map = new Map(rests?.map((r) => [r.id, r.name]) ?? []);
      return (data ?? []).map((r) => ({ ...r, restaurant_name: r.restaurant_id ? (map.get(r.restaurant_id) ?? r.restaurant_id) : "—" }));
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve, restaurantId, requestedPlan, currentPlan }: {
      id: string; approve: boolean; restaurantId: string; requestedPlan: string; currentPlan: string;
    }) => {
      const reviewedAt = new Date().toISOString();
      const { error: e1 } = await supabase
        .from("plan_upgrade_requests")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_by: user?.id,
          reviewed_at: reviewedAt,
        })
        .eq("id", id);
      if (e1) throw e1;

      if (approve) {
        const { error: e2 } = await supabase
          .from("restaurants")
          .update({
            plan: requestedPlan as "trial" | "basic" | "pro",
            plan_started_at: reviewedAt,
          })
          .eq("id", restaurantId);
        if (e2) throw e2;
      }

      // Audit-log de admin-actie (zichtbaar voor restaurant en system admin)
      await supabase.from("audit_log").insert([{
        restaurant_id: restaurantId,
        entity: "plan_upgrade_request",
        entity_id: id,
        action: approve ? "admin.plan_upgrade_approved" : "admin.plan_upgrade_rejected",
        actor_user_id: user?.id ?? null,
        actor_label: "system_admin",
        after_data: { from: currentPlan, to: requestedPlan, request_id: id },
      }]);

      // Emit integration_event zodat ClickWise/mailflow de eigenaar kan informeren
      await supabase.from("integration_events").insert([{
        restaurant_id: restaurantId,
        event_type: approve ? "plan.upgrade.approved" : "plan.upgrade.rejected",
        target: "clickwise",
        payload: {
          request_id: id,
          from_plan: currentPlan,
          to_plan: requestedPlan,
          reviewed_at: reviewedAt,
        },
      } as any]);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Plan geactiveerd — eigenaar wordt geïnformeerd" : "Aanvraag afgewezen — eigenaar wordt geïnformeerd");
      qc.invalidateQueries({ queryKey: ["admin-plan-upgrade-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-recent-actions"] });
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
            Keur upgrade-aanvragen van restaurants goed of af. Elke beslissing
            wordt gelogd en de eigenaar krijgt automatisch bericht.
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
                          review.mutate({ id: r.id, approve: false, restaurantId: r.restaurant_id, requestedPlan: r.requested_plan, currentPlan: r.current_plan })
                        }
                        disabled={review.isPending}
                      >
                        <X className="h-4 w-4 mr-1" /> Afwijzen
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          review.mutate({ id: r.id, approve: true, restaurantId: r.restaurant_id, requestedPlan: r.requested_plan, currentPlan: r.current_plan })
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

      <div className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium text-sm">Recente admin-acties</h2>
        </div>
        {recentAdminActions.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Nog geen admin-acties gelogd.</Card>
        ) : (
          <Card className="divide-y">
            {recentAdminActions.map((a: any) => (
              <div key={a.id} className="p-3 text-sm flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{a.restaurant_name}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{a.action.replace("admin.", "")}</span>
                  {a.after_data?.from && a.after_data?.to && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({a.after_data.from} → {a.after_data.to})
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("nl-NL")}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
