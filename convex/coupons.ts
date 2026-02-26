import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Redeem a coupon code for premium access
export const redeemCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const coupon = await ctx.db
      .query("couponCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase().trim()))
      .first();

    if (!coupon || !coupon.active) {
      return { valid: false, reason: "invalid" };
    }

    if (coupon.maxUses !== undefined && coupon.currentUses >= coupon.maxUses) {
      return { valid: false, reason: "expired" };
    }

    // Increment usage count
    await ctx.db.patch(coupon._id, {
      currentUses: coupon.currentUses + 1,
    });

    return { valid: true, description: coupon.description };
  },
});

// Seed initial coupon codes (run once)
export const seedCodes = mutation({
  handler: async (ctx) => {
    // Check if codes already exist
    const existing = await ctx.db.query("couponCodes").first();
    if (existing) {
      return { seeded: false, message: "Codes already exist" };
    }

    // Create initial codes
    await ctx.db.insert("couponCodes", {
      code: "DAWSFRIEND",
      description: "Friends & Family",
      currentUses: 0,
      active: true,
      createdAt: Date.now(),
    });

    return { seeded: true, message: "Seed codes created" };
  },
});
