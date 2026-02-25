import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get top scores for leaderboard
export const getTopScores = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_score")
      .order("desc")
      .take(limit);
    return scores;
  },
});

// Submit a new score
export const submitScore = mutation({
  args: {
    userId: v.optional(v.id("users")),
    playerName: v.string(),
    score: v.number(),
    shift: v.number(),
    grade: v.string(),
  },
  handler: async (ctx, args) => {
    const scoreId = await ctx.db.insert("scores", {
      userId: args.userId,
      playerName: args.playerName,
      score: args.score,
      shift: args.shift,
      grade: args.grade,
      timestamp: Date.now(),
    });
    return scoreId;
  },
});

// Get a user's best scores
export const getUserScores = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    return scores;
  },
});

// Get player's rank
export const getPlayerRank = query({
  args: { score: v.number() },
  handler: async (ctx, args) => {
    const higherScores = await ctx.db
      .query("scores")
      .withIndex("by_score")
      .filter((q) => q.gt(q.field("score"), args.score))
      .collect();
    return higherScores.length + 1;
  },
});
