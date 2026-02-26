import { action } from "./_generated/server";
import { v } from "convex/values";

// Create a Stripe Checkout Session for embedded checkout
export const createCheckoutSession = action({
  args: {
    deviceId: v.string(),
    returnUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    // Create checkout session via Stripe API
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "payment",
        "line_items[0][price]": "price_1T55raKgkIT46sg7WUjRuseI",
        "line_items[0][quantity]": "1",
        ui_mode: "embedded",
        return_url: args.returnUrl,
        client_reference_id: args.deviceId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Stripe error:", error);
      throw new Error("Failed to create checkout session");
    }

    const session = await response.json();
    return { clientSecret: session.client_secret };
  },
});

// Verify a completed checkout session
export const verifyCheckoutSession = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    // Retrieve session from Stripe
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${args.sessionId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Stripe verification error:", error);
      throw new Error("Failed to verify checkout session");
    }

    const session = await response.json();

    return {
      paid: session.payment_status === "paid",
      deviceId: session.client_reference_id,
      customerEmail: session.customer_details?.email || null,
    };
  },
});
