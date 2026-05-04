import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRestaurant } from "@/hooks/useRestaurant";
import { toast } from "sonner";

type Role = "owner" | "manager" | "host" | "staff";

type Props = {
  allow: Role[];
  children: ReactNode;
  /** Where to redirect if access is denied. Default: /app */
  redirectTo?: string;
};

/**
 * Guards a route based on the user's role in the current restaurant.
 * Use as wrapper around protected pages in App.tsx.
 */
export const RequireRole = ({ allow, children, redirectTo = "/app" }: Props) => {
  const { current, loading } = useRestaurant();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  }
  if (!current) return <Navigate to="/onboarding" replace />;

  if (!allow.includes(current.role as Role)) {
    // Show toast once on redirect
    queueMicrotask(() => toast.error("Geen toegang", { description: "Je hebt geen rechten voor deze pagina." }));
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
