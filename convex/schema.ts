import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - simple device-based accounts
  users: defineTable({
    deviceId: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_device", ["deviceId"]),

  // Scores table - global leaderboard
  scores: defineTable({
    // Optional userId - null for guest scores (not saved to leaderboard)
    userId: v.optional(v.id("users")),
    playerName: v.string(),
    score: v.number(),
    shift: v.number(), // How far they got (1-6)
    grade: v.string(), // S, A, B, C, F
    timestamp: v.number(),
  }).index("by_score", ["score"])
    .index("by_user", ["userId"]),

  // Daily challenge scores - separate leaderboard per day
  dailyScores: defineTable({
    userId: v.optional(v.id("users")),
    playerName: v.string(),
    score: v.number(),
    grade: v.string(),
    date: v.string(), // YYYY-MM-DD format
    timestamp: v.number(),
  }).index("by_date_score", ["date", "score"])
    .index("by_date", ["date"]),
});
