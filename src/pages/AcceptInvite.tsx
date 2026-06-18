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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Helmet><title>Uitnodiging — TableWise</title></Helmet>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Uitnodiging</CardTitle>
          <CardDescription>Word lid van een restaurant op TableWise.</CardDescription>
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
                  Vraag het restaurant om een nieuwe uitnodiging.
                </p>
              </div>
            );
          })()}

          {preview && preview.valid && (
            <>
              <div className="rounded-lg border border-border p-4 text-sm space-y-1">
                <div><span className="text-muted-foreground">Restaurant:</span> <strong>{preview.restaurant_name}</strong></div>
                <div><span className="text-muted-foreground">Rol:</span> <strong>{ROLE_LABEL[preview.role] || preview.role}</strong></div>
                <div><span className="text-muted-foreground">Voor:</span> {preview.email}</div>
              </div>

              {!user && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Log in of maak een account met <strong>{preview.email}</strong> om te accepteren.
                  </p>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/app/login?mode=signup&email=${encodeURIComponent(preview.email)}&invite=${token}`}>
                        Account aanmaken
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to={`/app/login?email=${encodeURIComponent(preview.email)}&invite=${token}`}>
                        Inloggen
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {user && emailMatches && (
                <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                  {accepting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Word lid van {preview.restaurant_name}
                </Button>
              )}

              {user && !emailMatches && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Je bent ingelogd als <strong>{user.email}</strong>, maar deze uitnodiging is voor
                    {' '}<strong>{preview.email}</strong>. Log uit en log opnieuw in met dat adres.
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
