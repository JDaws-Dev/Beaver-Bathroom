import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

// Current season - increment when gameplay changes significantly
const CURRENT_SEASON = 2;

// Get top scores for leaderboard (current season only)
export const getTopScores = query({
  args: { limit: v.optional(v.number()), season: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const season = args.season ?? CURRENT_SEASON;
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_season_score", (q) => q.eq("season", season))
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
      playerName: cleanName(args.playerName),
      score: args.score,
      shift: args.shift,
      grade: args.grade,
      timestamp: Date.now(),
      season: CURRENT_SEASON,
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

// Get player's rank (current season)
export const getPlayerRank = query({
  args: { score: v.number() },
  handler: async (ctx, args) => {
    const higherScores = await ctx.db
      .query("scores")
      .withIndex("by_season_score", (q) => q.eq("season", CURRENT_SEASON))
      .filter((q) => q.gt(q.field("score"), args.score))
      .collect();
    return higherScores.length + 1;
  },
});

// Submit daily challenge score
export const submitDailyScore = mutation({
  args: {
    userId: v.optional(v.id("users")),
    playerName: v.string(),
    score: v.number(),
    grade: v.string(),
    date: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const scoreId = await ctx.db.insert("dailyScores", {
      userId: args.userId,
      playerName: cleanName(args.playerName),
      score: args.score,
      grade: args.grade,
      date: args.date,
      timestamp: Date.now(),
    });
    return scoreId;
  },
});

// Get daily challenge scores for a specific date
export const getDailyScores = query({
  args: { date: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const scores = await ctx.db
      .query("dailyScores")
      .withIndex("by_date_score", (q) => q.eq("date", args.date))
      .order("desc")
      .take(limit);
    return scores;
  },
});
