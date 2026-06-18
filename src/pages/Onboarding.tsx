import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyRestaurants } from "@/hooks/useCurrentRestaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

const schema = z.object({
  name: z.string().trim().min(2, "Naam te kort").max(120),
  slug: z.string().trim().min(2, "Slug te kort").max(60).regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en streepjes"),
});

const Onboarding = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: memberships, isLoading } = useMyRestaurants();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && memberships && memberships.length > 0) {
      navigate("/app", { replace: true });
    }
  }, [isLoading, memberships, navigate]);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slug || slug === slugify(name)) setSlug(slugify(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, slug });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_restaurant_with_owner", {
      _name: parsed.data.name,
      _slug: parsed.data.slug,
      _timezone: "Europe/Amsterdam",
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message.includes("duplicate") || error.message.includes("unique")
        ? "Deze slug is al in gebruik"
        : error.message);
      return;
    }
    toast.success("Restaurant aangemaakt");

    // Als gebruiker via "Start met Basic/Pro" op de landing kwam → direct Stripe-checkout starten
    let pendingPlan: string | null = null;
    try {
      pendingPlan = localStorage.getItem("pending_checkout_plan");
    } catch {
      /* ignore */
    }
    const restaurantId = data as unknown as string;
    if ((pendingPlan === "basic" || pendingPlan === "pro") && restaurantId) {
      try {
        const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke(
          "stripe-checkout",
          { body: { target: pendingPlan, restaurant_id: restaurantId } },
        );
        try {
          localStorage.removeItem("pending_checkout_plan");
        } catch {
          /* ignore */
        }
        if (!checkoutErr && checkoutData?.url) {
          window.location.href = checkoutData.url as string;
          return;
        }
        toast.error("Checkout kon niet worden gestart. Je trial is wel actief — je kunt later upgraden vanuit de instellingen.");
      } catch {
        try {
          localStorage.removeItem("pending_checkout_plan");
        } catch {
          /* ignore */
        }
        toast.error("Checkout kon niet worden gestart. Je trial is wel actief.");
      }
    }

    setSubmitting(false);
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-primary">Welkom bij TX TableWise</h1>
          <p className="text-sm text-muted-foreground mt-2">Laten we je restaurant opzetten</p>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Je restaurant</CardTitle>
            <CardDescription>Je kunt deze gegevens later aanpassen.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Naam restaurant</Label>
                <Input
                  id="name" required value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Bijv. Brasserie Het Anker"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Korte URL</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">tablewise.nl/</span>
                  <Input
                    id="slug" required value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    placeholder="het-anker"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Wordt gebruikt voor je publieke reserveringspagina.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Bezig…" : "Restaurant aanmaken"}
                </Button>
                <Button type="button" variant="ghost" onClick={async () => { await signOut(); navigate("/"); }}>
                  Uitloggen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
