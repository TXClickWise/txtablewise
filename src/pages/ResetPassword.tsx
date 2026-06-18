import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const passwordSchema = z.string().min(8, { message: "Minimaal 8 tekens" }).max(72);

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    // Supabase plaatst de recovery-tokens in de URL-hash en zet automatisch een sessie via onAuthStateChange
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Fallback: check direct of er al een sessie is
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    // Als er na 2s geen recovery-event was en geen sessie, link is ongeldig/verlopen
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) setInvalidLink(true);
      });
    }, 2000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    if (password !== confirm) {
      toast.error("Wachtwoorden komen niet overeen");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("Pwned") || error.message.includes("compromised")
        ? "Dit wachtwoord komt voor in bekende datalekken. Kies een ander wachtwoord."
        : error.message);
      return;
    }
    toast.success("Wachtwoord bijgewerkt");
    navigate("/app", { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>Nieuw wachtwoord instellen — TX TableWise</title>
        <meta name="description" content="Stel een nieuw wachtwoord in voor je TX TableWise account." />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="https://txtablewise.nl/reset-password" />
        <meta property="og:title" content="Nieuw wachtwoord instellen — TX TableWise" />
        <meta property="og:description" content="Stel een nieuw wachtwoord in voor je TX TableWise account." />
        <meta property="og:url" content="https://txtablewise.nl/reset-password" />
      </Helmet>
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-primary">TableWise</h1>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Nieuw wachtwoord</CardTitle>
            <CardDescription>
              {invalidLink
                ? "Deze link is ongeldig of verlopen. Vraag een nieuwe aan."
                : "Kies een nieuw wachtwoord voor je account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invalidLink ? (
              <Button className="w-full" onClick={() => navigate("/forgot-password")}>
                Nieuwe resetlink aanvragen
              </Button>
            ) : !ready ? (
              <p className="text-sm text-muted-foreground text-center py-6">Link verifiëren…</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nieuw wachtwoord</Label>
                  <Input
                    id="password" type="password" required autoComplete="new-password" minLength={8}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Minimaal 8 tekens, niet uit een datalek.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Bevestig wachtwoord</Label>
                  <Input
                    id="confirm" type="password" required autoComplete="new-password" minLength={8}
                    value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Bezig…" : "Wachtwoord opslaan"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default ResetPassword;
