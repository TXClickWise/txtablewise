import * as React from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  updatedAt?: Date | null;
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
}

function formatRelative(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "zojuist";
  if (diff < 60) return `${diff}s geleden`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min geleden`;
  const h = Math.floor(mins / 60);
  return `${h} uur geleden`;
}

/**
 * Toont laatste update + refresh + verbindingstatus.
 * Belangrijk voor low-connectivity vertrouwen tijdens service.
 */
export function LastUpdatedIndicator({ updatedAt, onRefresh, loading, className }: Props) {
  const [, force] = React.useReducer((s) => s + 1, 0);
  const [online, setOnline] = React.useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  React.useEffect(() => {
    const t = setInterval(force, 15000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {online ? (
        <Wifi className="h-3.5 w-3.5 text-emerald-600" aria-label="Online" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-destructive" aria-label="Offline" />
      )}
      <span className="hidden sm:inline">
        {updatedAt ? `Bijgewerkt ${formatRelative(updatedAt)}` : "Nog niet bijgewerkt"}
      </span>
      {onRefresh && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Vernieuwen"
          className="h-9 px-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}
