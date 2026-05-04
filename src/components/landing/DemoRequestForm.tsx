import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";

const schema = z.object({
  restaurant_name: z.string().trim().min(1, "Vul de naam van je restaurant in").max(200),
  contact_name: z.string().trim().min(1, "Vul je naam in").max(200),
  email: z.string().trim().email("Vul een geldig e-mailadres in").max(255),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
});

export function DemoRequestForm() {
  const [form, setForm] = useState({
    restaurant_name: "",
    contact_name: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Controleer het formulier");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("demo_requests").insert({
      restaurant_name: parsed.data.restaurant_name,
      contact_name: parsed.data.contact_name,
      email: parsed.data.email,
      phone: parsed.data.phone ? parsed.data.phone : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Versturen mislukt. Probeer het nog eens of mail ons direct.");
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-soft md:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="mt-5 font-display text-2xl font-semibold">Bedankt!</h3>
        <p className="mt-3 text-muted-foreground">
          We nemen binnen 24 uur contact met je op om een demo in te plannen.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border bg-card p-6 shadow-soft md:p-8"
      noValidate
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="restaurant_name">Naam restaurant</Label>
          <Input
            id="restaurant_name"
            required
            autoComplete="organization"
            value={form.restaurant_name}
            onChange={update("restaurant_name")}
            className="h-12"
            placeholder="Bijv. De Gouden Lepel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contactpersoon</Label>
          <Input
            id="contact_name"
            required
            autoComplete="name"
            value={form.contact_name}
            onChange={update("contact_name")}
            className="h-12"
            placeholder="Voor- en achternaam"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mailadres</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            className="h-12"
            placeholder="naam@restaurant.nl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            Telefoon <span className="text-muted-foreground">(optioneel)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={update("phone")}
            className="h-12"
            placeholder="06 12 34 56 78"
          />
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="mt-7 h-12 w-full text-base md:w-auto md:px-10"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Versturen…
          </>
        ) : (
          "Plan mijn demo"
        )}
      </Button>
      <p className="mt-4 text-sm text-muted-foreground">
        We nemen binnen 24 uur contact op. Geen verplichtingen.
      </p>
    </form>
  );
}
