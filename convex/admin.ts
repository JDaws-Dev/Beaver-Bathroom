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
    // Also update visitor record if we have a deviceId
    if (args.deviceId) {
      const visitor = await ctx.db
        .query("visitors")
        .withIndex("by_device", q => q.eq("deviceId", args.deviceId!))
        .first();

      if (visitor) {
        const updates: any = { lastSeen: Date.now(), visitCount: visitor.visitCount + (args.type === "page_visit" ? 1 : 0) };
        if (args.type === "game_start") updates.hasPlayed = true;
        if (args.type === "shift_complete" || args.type === "game_over") updates.hasCompleted = true;
        await ctx.db.patch(visitor._id, updates);
      }
    }

    return await ctx.db.insert("gameEvents", {
      type: args.type,
      deviceId: args.deviceId,
      data: args.data,
      createdAt: Date.now(),
    });
  },
});

// Track a page visit / register visitor
export const trackVisit = mutation({
  args: {
    deviceId: v.string(),
    platform: v.optional(v.string()),
    referrer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("visitors")
      .withIndex("by_device", q => q.eq("deviceId", args.deviceId))
      .first();

    if (existing) {
      // Update existing visitor
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
        visitCount: existing.visitCount + 1,
      });
      return existing._id;
    }

    // Create new visitor
    return await ctx.db.insert("visitors", {
      deviceId: args.deviceId,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      visitCount: 1,
      hasPlayed: false,
      hasCompleted: false,
      hasPurchased: false,
      platform: args.platform,
      referrer: args.referrer,
    });
  },
});

// Get all visitors
export const getVisitors = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const visitors = await ctx.db
      .query("visitors")
      .order("desc")
      .collect();

    return args.limit ? visitors.slice(0, args.limit) : visitors;
  },
});

// Get visitor stats
export const getVisitorStats = query({
  args: {},
  handler: async (ctx) => {
    const visitors = await ctx.db.query("visitors").collect();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const visitorsToday = visitors.filter(v => v.lastSeen > oneDayAgo);
    const visitorsThisWeek = visitors.filter(v => v.lastSeen > oneWeekAgo);
    const newToday = visitors.filter(v => v.firstSeen > oneDayAgo);
    const newThisWeek = visitors.filter(v => v.firstSeen > oneWeekAgo);

    const played = visitors.filter(v => v.hasPlayed);
    const completed = visitors.filter(v => v.hasCompleted);
    const purchased = visitors.filter(v => v.hasPurchased);

    const mobileVisitors = visitors.filter(v => v.platform === "mobile");

    return {
      totalVisitors: visitors.length,
      visitorsToday: visitorsToday.length,
      visitorsThisWeek: visitorsThisWeek.length,
      newVisitorsToday: newToday.length,
      newVisitorsThisWeek: newThisWeek.length,
      playedCount: played.length,
      completedCount: completed.length,
      purchasedCount: purchased.length,
      conversionToPlay: visitors.length > 0 ? (played.length / visitors.length * 100).toFixed(1) : "0",
      conversionToComplete: played.length > 0 ? (completed.length / played.length * 100).toFixed(1) : "0",
      conversionToPurchase: visitors.length > 0 ? (purchased.length / visitors.length * 100).toFixed(1) : "0",
      mobilePercent: visitors.length > 0 ? (mobileVisitors.length / visitors.length * 100).toFixed(1) : "0",
    };
  },
});
