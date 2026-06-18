import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const emailSchema = z.string().trim().email({ message: "Vul een geldig e-mailadres in" }).max(255);
const passwordSchema = z.string().min(8, { message: "Minimaal 8 tekens" }).max(72);

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const planParam = searchParams.get("plan");
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupSent, setSignupSent] = useState(false);

  useEffect(() => {
    if (planParam === "basic" || planParam === "pro") {
      try {
        localStorage.setItem("pending_checkout_plan", planParam);
      } catch {
        /* ignore */
      }
    }
  }, [planParam]);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Onjuiste inloggegevens"
        : error.message);
      return;
    }
    toast.success("Welkom terug");
    navigate("/app", { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already")
        ? "Dit e-mailadres is al geregistreerd"
        : error.message.includes("Pwned") || error.message.includes("compromised")
        ? "Dit wachtwoord komt voor in bekende datalekken. Kies een ander wachtwoord."
        : error.message);
      return;
    }
    // Als e-mailverificatie aan staat is er nog geen sessie → toon "check je inbox"
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setSignupSent(true);
      return;
    }
    toast.success("Account aangemaakt");
    navigate("/app", { replace: true });
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google login mislukt");
      return;
    }
    if (result.redirected) return;
    navigate("/app", { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>Inloggen of account aanmaken — TX TableWise</title>
        <meta name="description" content="Log in op TX TableWise of maak een gratis account aan en start je commissievrije reserveringssysteem voor restaurants." />
        <link rel="canonical" href="https://txtablewise.nl/auth" />
        <meta property="og:title" content="Inloggen of account aanmaken — TX TableWise" />
        <meta property="og:description" content="Log in op TX TableWise of maak een gratis account aan en start je commissievrije reserveringssysteem voor restaurants." />
        <meta property="og:url" content="https://txtablewise.nl/auth" />
      </Helmet>
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <h1 className="font-display text-3xl text-primary">TableWise</h1>
          <p className="text-sm text-muted-foreground mt-1">Hospitality Operating System</p>
        </Link>

        <Card className="border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {defaultTab === "signup" ? "Start je gratis trial" : "Inloggen"}
            </CardTitle>
            <CardDescription>
              {defaultTab === "signup"
                ? "14 dagen volledige toegang, geen creditcard nodig."
                : "Toegang tot je restaurant dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signupSent ? (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  ✉️
                </div>
                <h3 className="font-display text-xl">Check je inbox</h3>
                <p className="text-sm text-muted-foreground">
                  We hebben een bevestigingslink gestuurd naar <strong>{email}</strong>.
                  Klik op de link in de mail om je account te activeren en aan de slag te gaan.
                </p>
                <p className="text-xs text-muted-foreground">
                  Geen mail ontvangen? Controleer je spam-map.
                </p>
                <Button variant="outline" className="w-full" onClick={() => { setSignupSent(false); setPassword(""); }}>
                  Terug
                </Button>
              </div>
            ) : (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Inloggen</TabsTrigger>
                <TabsTrigger value="signup">Gratis trial</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-mailadres</Label>
                    <Input
                      id="signin-email" type="email" required autoComplete="email"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="naam@restaurant.nl"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Wachtwoord</Label>
                      <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                        Wachtwoord vergeten?
                      </Link>
                    </div>
                    <Input
                      id="signin-password" type="password" required autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Bezig…" : "Inloggen"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Jouw naam</Label>
                    <Input
                      id="signup-name" type="text" autoComplete="name"
                      value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Bijv. Sophie"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mailadres</Label>
                    <Input
                      id="signup-email" type="email" required autoComplete="email"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="naam@restaurant.nl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Wachtwoord</Label>
                    <Input
                      id="signup-password" type="password" required autoComplete="new-password" minLength={8}
                      value={password} onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Minimaal 8 tekens</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Bezig…" : "Start gratis trial"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Door je aan te melden krijg je 14 dagen volledige toegang tot het Trial plan.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
            )}

            {!signupSent && (
              <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">of</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Inloggen met Google
            </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Door in te loggen ga je akkoord met onze voorwaarden.
        </p>
      </div>
    </div>
    </>
  );
};

export default Auth;
