import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create or get a user by device ID
export const getOrCreateUser = mutation({
  args: {
    deviceId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("deviceId"), args.deviceId))
      .first();

    if (existing) {
      // Update name if provided
      if (args.name && args.name !== existing.name) {
        await ctx.db.patch(existing._id, { name: args.name });
        return { ...existing, name: args.name };
      }
      return existing;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      deviceId: args.deviceId,
      name: args.name || "Player",
      createdAt: Date.now(),
    });

    return {
      _id: userId,
      deviceId: args.deviceId,
      name: args.name || "Player",
      createdAt: Date.now(),
    };
  },
});

// Update user's display name
export const updateName = mutation({
  args: {
    deviceId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("deviceId"), args.deviceId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { name: args.name });
      return { ...user, name: args.name };
    }
    return null;
  },
});

// Get user by device ID
export const getUser = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("deviceId"), args.deviceId))
      .first();
  },
});
