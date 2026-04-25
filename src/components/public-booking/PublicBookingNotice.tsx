// Friendly inline alert for empty/error/info states in the public widget.
// Hospitality tone — short, warm, never technical.
import { AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "info" | "warning" | "error";

export const PublicBookingNotice = ({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
}) => {
  const Icon = variant === "error" ? AlertCircle : variant === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex gap-3 text-sm",
        variant === "info" && "border-info/30 bg-info/5 text-foreground",
        variant === "warning" && "border-warning/40 bg-warning/10 text-foreground",
        variant === "error" && "border-destructive/40 bg-destructive/5 text-foreground",
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon
        className={cn(
          "h-4 w-4 mt-0.5 shrink-0",
          variant === "info" && "text-info",
          variant === "warning" && "text-warning",
          variant === "error" && "text-destructive",
        )}
      />
      <div className="space-y-0.5">
        {title && <div className="font-medium">{title}</div>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
};
