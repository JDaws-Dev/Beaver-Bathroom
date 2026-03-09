import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Profanity blocklist — substring-matched, case-insensitive
const PROFANITY_LIST = [
  "nigger", "nigga", "faggot", "fag", "retard", "kike", "spic", "chink",
  "wetback", "coon", "darkie", "gook", "jap", "beaner", "tranny", "dyke",
  "twat", "cunt", "bitch", "slut", "whore", "asshole", "bastard", "dick",
  "cock", "pussy", "fuck", "shit", "piss", "damn", "wanker", "bollocks",
  "arse", "tits", "boob", "penis", "vagina", "anal", "cum", "semen",
  "nazi", "hitler", "kkk", "jihad", "rape", "molest", "pedo", "incest",
];

function cleanName(name: string): string {
  const lower = name.toLowerCase().replace(/[\s_\-\.]/g, "");
  for (const word of PROFANITY_LIST) {
    if (lower.includes(word)) return "Player";
  }
  return name;
}

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
        const safeName = cleanName(args.name);
        await ctx.db.patch(existing._id, { name: safeName });
        return { ...existing, name: safeName };
      }
      return existing;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      deviceId: args.deviceId,
      name: cleanName(args.name || "Player"),
      createdAt: Date.now(),
    });

    return {
      _id: userId,
      deviceId: args.deviceId,
      name: cleanName(args.name || "Player"),
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
      const safeName = cleanName(args.name);
      await ctx.db.patch(user._id, { name: safeName });
      return { ...user, name: safeName };
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
      const safeName = cleanName(args.name);
      // Update fields that may have changed
      await ctx.db.patch(byGoogle._id, {
        name: safeName,
        email: args.email,
        avatarUrl: args.avatarUrl,
        deviceId: args.deviceId, // Update to current device
      });
      // Check if this email has any purchases (cross-device premium restore)
      const purchase = await ctx.db
        .query("purchases")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();
      return { ...byGoogle, name: safeName, email: args.email, avatarUrl: args.avatarUrl, deviceId: args.deviceId, hasPurchase: !!purchase };
    }

    // 2. Look up by deviceId (linking existing anonymous user)
    const byDevice = await ctx.db
      .query("users")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first();

    if (byDevice) {
      const safeName = cleanName(args.name);
      // Link Google account to existing device user
      await ctx.db.patch(byDevice._id, {
        googleId: args.googleId,
        email: args.email,
        name: safeName,
        avatarUrl: args.avatarUrl,
      });
      // Check if this email has any purchases (cross-device premium restore)
      const purchase = await ctx.db
        .query("purchases")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();
      return { ...byDevice, googleId: args.googleId, email: args.email, name: safeName, avatarUrl: args.avatarUrl, hasPurchase: !!purchase };
    }

    // 3. Create new user
    const safeName = cleanName(args.name);
    const userId = await ctx.db.insert("users", {
      deviceId: args.deviceId,
      name: safeName,
      email: args.email,
      googleId: args.googleId,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    });

    // Check if this email has any purchases (cross-device premium restore)
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return {
      _id: userId,
      deviceId: args.deviceId,
      name: safeName,
      email: args.email,
      googleId: args.googleId,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
      hasPurchase: !!purchase,
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
