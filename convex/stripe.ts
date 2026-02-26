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

// Check if a purchase exists for a given email
export const checkPurchaseByEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    // Normalize email to lowercase
    const email = args.email.toLowerCase().trim();

    // List checkout sessions and filter by customer email
    // Stripe API doesn't support direct email filter on sessions, so we fetch recent ones
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions?" + new URLSearchParams({
        limit: "100",
        status: "complete",
      }),
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Stripe sessions list error:", error);
      throw new Error("Failed to check purchases");
    }

    const data = await response.json();

    // Find a completed session with matching email and our price
    const validSession = data.data.find((session: any) => {
      const sessionEmail = session.customer_details?.email?.toLowerCase();
      return (
        sessionEmail === email &&
        session.payment_status === "paid"
      );
    });

    if (validSession) {
      return {
        found: true,
        purchaseDate: new Date(validSession.created * 1000).toISOString(),
      };
    }

    return { found: false };
  },
});
