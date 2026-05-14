import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Laden…</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/app/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};
