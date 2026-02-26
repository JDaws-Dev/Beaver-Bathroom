import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all purchases
export const getPurchases = query({
  args: {},
  handler: async (ctx) => {
    const purchases = await ctx.db
      .query("purchases")
      .order("desc")
      .collect();
    return purchases;
  },
});

// Get all users
export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .order("desc")
      .collect();
    return users;
  },
});

// Get game events with optional type filter
export const getGameEvents = query({
  args: {
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("gameEvents").order("desc");

    const events = await q.collect();

    // Filter by type if specified
    let filtered = args.type
      ? events.filter(e => e.type === args.type)
      : events;

    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

// Get stats summary
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const purchases = await ctx.db.query("purchases").collect();
    const events = await ctx.db.query("gameEvents").collect();
    const scores = await ctx.db.query("scores").collect();
    const dailyScores = await ctx.db.query("dailyScores").collect();

    // Calculate stats
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const eventsToday = events.filter(e => e.createdAt > oneDayAgo);
    const eventsThisWeek = events.filter(e => e.createdAt > oneWeekAgo);

    const gameStartsToday = eventsToday.filter(e => e.type === "game_start").length;
    const gameStartsThisWeek = eventsThisWeek.filter(e => e.type === "game_start").length;

    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount || 299), 0);

    return {
      totalUsers: users.length,
      totalPurchases: purchases.length,
      totalRevenue: totalRevenue / 100, // Convert cents to dollars
      totalGameStarts: events.filter(e => e.type === "game_start").length,
      gameStartsToday,
      gameStartsThisWeek,
      totalScoresSubmitted: scores.length,
      totalDailyChallenges: dailyScores.length,
      eventsToday: eventsToday.length,
      eventsThisWeek: eventsThisWeek.length,
    };
  },
});

// Record a purchase (called from stripe.ts)
export const recordPurchase = mutation({
  args: {
    email: v.string(),
    deviceId: v.optional(v.string()),
    stripeSessionId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if already recorded
    const existing = await ctx.db
      .query("purchases")
      .filter(q => q.eq(q.field("stripeSessionId"), args.stripeSessionId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("purchases", {
      email: args.email.toLowerCase().trim(),
      deviceId: args.deviceId,
      stripeSessionId: args.stripeSessionId,
      amount: args.amount,
      createdAt: Date.now(),
    });
  },
});

// Log a game event
export const logEvent = mutation({
  args: {
    type: v.string(),
    deviceId: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("gameEvents", {
      type: args.type,
      deviceId: args.deviceId,
      data: args.data,
      createdAt: Date.now(),
    });
  },
});
