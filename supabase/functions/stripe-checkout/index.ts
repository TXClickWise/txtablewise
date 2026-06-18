// Creates a Stripe Checkout session for a plan upgrade (basic/pro) or the ClickWise add-on.
// Uses dynamic price_data so no Stripe dashboard setup is required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Target = "basic" | "pro" | "clickwise";

const PLAN_PRICES: Record<Exclude<Target, "clickwise">, { amount: number; label: string }> = {
  basic: { amount: 4900, label: "TX TableWise Basic" },
  pro: { amount: 7900, label: "TX TableWise Pro" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supaService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new Error("Unauthorized");
    const user = userData.user;

    const body = await req.json();
    const target = body.target as Target;
    const restaurantId = body.restaurant_id as string;
    if (!restaurantId) throw new Error("restaurant_id required");
    if (!["basic", "pro", "clickwise"].includes(target)) throw new Error("invalid target");

    const service = createClient(supaUrl, supaService);

    // Verify caller is owner/manager of restaurant
    const { data: membership } = await service
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership || !["owner", "manager"].includes(membership.role)) {
      throw new Error("Forbidden");
    }

    const { data: restaurant } = await service
      .from("restaurants")
      .select("id, name, stripe_customer_id")
      .eq("id", restaurantId)
      .maybeSingle();
    if (!restaurant) throw new Error("Restaurant not found");

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Resolve / create customer
    let customerId = restaurant.stripe_customer_id as string | null;
    if (!customerId) {
      const list = await stripe.customers.list({ email: user.email!, limit: 1 });
      if (list.data.length > 0) {
        customerId = list.data[0].id;
      } else {
        const created = await stripe.customers.create({
          email: user.email!,
          name: restaurant.name,
          metadata: { restaurant_id: restaurantId, user_id: user.id },
        });
        customerId = created.id;
      }
      await service
        .from("restaurants")
        .update({ stripe_customer_id: customerId })
        .eq("id", restaurantId);
    }

    const origin = req.headers.get("origin") || "https://txtablewise.nl";
    const successUrl = `${origin}/app/instellingen/abonnement?stripe=success`;
    const cancelUrl = `${origin}/app/instellingen/abonnement?stripe=cancelled`;

    let session;
    if (target === "clickwise") {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "eur",
              recurring: { interval: "month" },
              unit_amount: 7900,
              tax_behavior: "exclusive",
              product_data: {
                name: "ClickWise add-on (incl. telefoonnummer)",
                description:
                  "Voice AI, WhatsApp en SMS via ClickWise. Excl. variabele gespreks-/SMS-/WhatsApp-verbruikskosten.",
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: { restaurant_id: restaurantId, kind: "clickwise_addon" },
          // Eenmalige setup fee op de eerste factuur
          // @ts-ignore - add_invoice_items wel ondersteund via subscription_data niet, gebruik invoice_items separately via add_invoice_items op session
        },
        // Eenmalige setup fee op eerste factuur (Checkout subscription mode ondersteunt dit via subscription_data.add_invoice_items? Nee – we voegen een aparte one-time price toe als line_item is niet toegestaan in subscription-mode mixed... daarom hieronder add_invoice_items via subscription_data is niet beschikbaar, dus we gebruiken invoice_items hook via webhook OR just include as line_item is invalid)
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          restaurant_id: restaurantId,
          target: "clickwise",
          setup_fee_cents: "18900",
        },
      });
    } else {
      const plan = PLAN_PRICES[target];
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "eur",
              recurring: { interval: "month" },
              unit_amount: plan.amount,
              tax_behavior: "exclusive",
              product_data: {
                name: plan.label,
                description: "Maandabonnement, commissie-vrij. Excl. 21% btw.",
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: { restaurant_id: restaurantId, plan: target },
        },
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { restaurant_id: restaurantId, target },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-checkout error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
