// Stripe webhook: updates restaurant plan + clickwise_addon based on subscription lifecycle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) return new Response("missing key", { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
    } else {
      // Dev fallback: accept unsigned (NOT recommended for prod)
      event = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const restaurantId = session.metadata?.restaurant_id;
        const target = session.metadata?.target;
        const setupFeeCents = Number(session.metadata?.setup_fee_cents || 0);
        if (!restaurantId || !target) break;

        if (target === "clickwise" && setupFeeCents > 0 && session.customer) {
          // Voeg eenmalige setup fee als invoice item op de klant (verschijnt op eerstvolgende factuur)
          await stripe.invoiceItems.create({
            customer: session.customer as string,
            amount: setupFeeCents,
            currency: "eur",
            description: "ClickWise eenmalige setup",
            tax_behavior: "exclusive",
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const restaurantId = sub.metadata?.restaurant_id;
        const kind = sub.metadata?.kind;
        const plan = sub.metadata?.plan as "basic" | "pro" | undefined;
        if (!restaurantId) break;

        const active = ["active", "trialing", "past_due"].includes(sub.status);

        if (kind === "clickwise_addon") {
          await service
            .from("restaurants")
            .update({
              stripe_clickwise_subscription_id: sub.id,
              clickwise_addon_active: active,
            })
            .eq("id", restaurantId);
        } else if (plan === "basic" || plan === "pro") {
          await service
            .from("restaurants")
            .update({
              stripe_subscription_id: sub.id,
              plan: active ? plan : "trial",
              plan_started_at: new Date().toISOString(),
            })
            .eq("id", restaurantId);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const restaurantId = sub.metadata?.restaurant_id;
        const kind = sub.metadata?.kind;
        if (!restaurantId) break;
        if (kind === "clickwise_addon") {
          await service
            .from("restaurants")
            .update({ clickwise_addon_active: false, stripe_clickwise_subscription_id: null })
            .eq("id", restaurantId);
        } else {
          await service
            .from("restaurants")
            .update({ plan: "trial", stripe_subscription_id: null })
            .eq("id", restaurantId);
        }
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook handler error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
