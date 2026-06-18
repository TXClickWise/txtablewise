import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  acceptInvitation, getInvitationPreview, type InvitationPreview,
} from "@/services/teamMembers";
import { supabase } from "@/integrations/supabase/client";

const ROLE_LABEL: Record<string, string> = {
  owner: "Eigenaar", manager: "Manager", host: "Host", staff: "Medewerker",
};

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) { setPreviewError("Geen uitnodigings-token gevonden in de link."); return; }
    let cancelled = false;
    getInvitationPreview(token)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setPreviewError(e?.message || "Kon uitnodiging niet ophalen"); });
    return () => { cancelled = true; };
  }, [token]);

  const emailMatches = useMemo(() => {
    if (!user || !preview || !preview.valid) return false;
    return (user.email || "").toLowerCase() === preview.email.toLowerCase();
  }, [user, preview]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptInvitation(token);
      toast.success("Welkom in het team!");
      navigate("/app", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Accepteren mislukt");
    } finally {
      setAccepting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const loading = authLoading || (!preview && !previewError);

  const restaurantName = preview && preview.valid ? preview.restaurant_name : "het restaurant";
  const roleLabel = preview && preview.valid ? (ROLE_LABEL[preview.role] || preview.role) : "";
  const inviteEmail = preview && preview.valid ? preview.email : "";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Helmet><title>Uitnodiging — {restaurantName}</title></Helmet>
      <Card className="w-full max-w-md">
        <CardHeader>
          {preview && preview.valid ? (
            <>
              <CardTitle className="text-xl">
                Je bent uitgenodigd bij <span className="text-primary">{restaurantName}</span>
              </CardTitle>
              <CardDescription>
                {!user
                  ? <>Maak een account aan met <strong>{inviteEmail}</strong> om als <strong>{roleLabel}</strong> mee te werken.</>
                  : emailMatches
                    ? <>Bevestig hieronder om als <strong>{roleLabel}</strong> toe te treden.</>
                    : <>Deze uitnodiging is voor <strong>{inviteEmail}</strong>.</>
                }
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Uitnodiging</CardTitle>
              <CardDescription>Even kijken of deze uitnodiging nog geldig is…</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="text-sm text-muted-foreground flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Uitnodiging laden…
            </div>
          )}

          {previewError && (
            <p className="text-sm text-destructive">{previewError}</p>
          )}

          {preview && !preview.valid && (() => {
            const reason = (preview as { valid: false; reason: string }).reason;
            return (
              <div className="text-sm">
                <p className="font-medium mb-1">Deze uitnodiging is niet meer geldig.</p>
                <p className="text-muted-foreground">
                  {reason === "expired" && "De uitnodiging is verlopen."}
                  {reason === "revoked" && "De uitnodiging is ingetrokken."}
                  {reason === "accepted" && "De uitnodiging is al geaccepteerd."}
                  {reason === "not_found" && "We kunnen deze uitnodiging niet vinden."}
                </p>
                <p className="text-muted-foreground mt-2">
                  Vraag het restaurant gerust om een nieuwe uitnodiging.
                </p>
              </div>
            );
          })()}

          {preview && preview.valid && (
            <>
              {!user && (
                <div className="space-y-3">
                  <Button asChild size="lg" className="w-full">
                    <Link to={`/app/login?mode=signup&email=${encodeURIComponent(preview.email)}&invite=${token}`}>
                      Account aanmaken
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Heb je al een account?{" "}
                    <Link
                      to={`/app/login?email=${encodeURIComponent(preview.email)}&invite=${token}`}
                      className="text-primary hover:underline font-medium"
                    >
                      Inloggen
                    </Link>
                  </p>
                </div>
              )}

              {user && emailMatches && (
                <Button className="w-full" size="lg" onClick={handleAccept} disabled={accepting}>
                  {accepting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Word lid van {preview.restaurant_name}
                </Button>
              )}

              {user && !emailMatches && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Je bent ingelogd als <strong>{user.email}</strong>. Log uit en log opnieuw in met
                    {' '}<strong>{preview.email}</strong> om deze uitnodiging te accepteren.
                  </p>
                  <Button variant="outline" className="w-full" onClick={handleSignOut}>
                    Uitloggen
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
