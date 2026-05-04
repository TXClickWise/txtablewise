import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/hooks/useRestaurant";
import { usePilotReadiness } from "@/hooks/usePilotReadiness";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { compact?: boolean };

export const PilotReadinessChecklist = ({ compact = false }: Props) => {
  const { current } = useRestaurant();
  const { data, isLoading } = usePilotReadiness(current?.restaurant_id);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pilot-readiness checklist</CardTitle>
          <Badge variant={data.allRequiredOk ? "default" : "secondary"}>
            {data.requiredOk}/{data.requiredTotal} verplicht
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.items.map((item) => {
          const Icon = item.ok ? CheckCircle2 : item.required ? XCircle : AlertCircle;
          const tone = item.ok
            ? "text-emerald-600 dark:text-emerald-400"
            : item.required
              ? "text-destructive"
              : "text-muted-foreground";
          return (
            <div
              key={item.key}
              className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors"
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${tone}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{item.label}</span>
                  {!item.required && (
                    <Badge variant="outline" className="text-[10px] py-0">optioneel</Badge>
                  )}
                </div>
                {!item.ok && !compact && item.hint && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                )}
              </div>
              {!item.ok && item.link && (
                <Link
                  to={item.link}
                  className="text-xs text-primary hover:underline shrink-0 mt-1"
                >
                  Naar instellingen
                </Link>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
