import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  // Auth tables (users, sessions, accounts, etc.)
  ...authTables,

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
});
