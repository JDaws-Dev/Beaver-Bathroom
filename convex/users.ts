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

// Sign in with Google - links or creates user
export const signInWithGoogle = mutation({
  args: {
    googleId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Look up by googleId (returning user on new device)
    const byGoogle = await ctx.db
      .query("users")
      .withIndex("by_google", (q) => q.eq("googleId", args.googleId))
      .first();

    if (byGoogle) {
      // Update fields that may have changed
      await ctx.db.patch(byGoogle._id, {
        name: args.name,
        email: args.email,
        avatarUrl: args.avatarUrl,
        deviceId: args.deviceId, // Update to current device
      });
      return { ...byGoogle, name: args.name, email: args.email, avatarUrl: args.avatarUrl, deviceId: args.deviceId };
    }

    // 2. Look up by deviceId (linking existing anonymous user)
    const byDevice = await ctx.db
      .query("users")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first();

    if (byDevice) {
      // Link Google account to existing device user
      await ctx.db.patch(byDevice._id, {
        googleId: args.googleId,
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
      });
      return { ...byDevice, googleId: args.googleId, email: args.email, name: args.name, avatarUrl: args.avatarUrl };
    }

    // 3. Create new user
    const userId = await ctx.db.insert("users", {
      deviceId: args.deviceId,
      name: args.name,
      email: args.email,
      googleId: args.googleId,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    });

    return {
      _id: userId,
      deviceId: args.deviceId,
      name: args.name,
      email: args.email,
      googleId: args.googleId,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    };
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
