import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - simple device-based accounts
  users: defineTable({
    deviceId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    googleId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_device", ["deviceId"])
    .index("by_google", ["googleId"]),

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

  // Coupon codes for free premium access
  couponCodes: defineTable({
    code: v.string(),
    description: v.string(),
    maxUses: v.optional(v.number()), // undefined = unlimited
    currentUses: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  // Purchases - track Stripe payments
  purchases: defineTable({
    email: v.string(),
    deviceId: v.optional(v.string()),
    stripeSessionId: v.string(),
    amount: v.number(), // in cents
    createdAt: v.number(),
  }).index("by_email", ["email"])
    .index("by_date", ["createdAt"]),

  // Game events - track player activity
  gameEvents: defineTable({
    type: v.string(), // "game_start", "shift_complete", "game_over", "daily_start", "page_visit"
    deviceId: v.optional(v.string()),
    data: v.optional(v.any()), // Flexible data payload
    createdAt: v.number(),
  }).index("by_type", ["type"])
    .index("by_date", ["createdAt"])
    .index("by_device", ["deviceId"]),

  // Multiplayer rooms - Jackbox-style join code rooms
  rooms: defineTable({
    code: v.string(),              // 4-digit join code
    hostDeviceId: v.string(),
    hostName: v.string(),
    guestDeviceId: v.optional(v.string()),
    guestName: v.optional(v.string()),
    status: v.string(),            // "waiting", "playing", "finished"
    shift: v.number(),             // Which shift to play (0-5)
    gender: v.string(),            // "male" or "female"
    difficulty: v.optional(v.string()), // "easy", "normal", "hard", "insane"
    hostCosmetics: v.optional(v.object({
      hat: v.optional(v.string()),
      shirt: v.optional(v.string()),
      special: v.optional(v.union(v.string(), v.null())),
      accessory: v.optional(v.union(v.string(), v.null())),
      fur: v.optional(v.string()),
    })),
    guestCosmetics: v.optional(v.object({
      hat: v.optional(v.string()),
      shirt: v.optional(v.string()),
      special: v.optional(v.union(v.string(), v.null())),
      accessory: v.optional(v.union(v.string(), v.null())),
      fur: v.optional(v.string()),
    })),
    hostScore: v.number(),
    hostRating: v.number(),
    hostCombo: v.number(),
    hostCleaned: v.number(),
    guestScore: v.number(),
    guestRating: v.number(),
    guestCombo: v.number(),
    guestCleaned: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"])
    .index("by_host", ["hostDeviceId"])
    .index("by_status", ["status"]),

  // Visitors - track unique visitors and their activity
  visitors: defineTable({
    deviceId: v.string(),
    firstSeen: v.number(),
    lastSeen: v.number(),
    visitCount: v.number(),
    hasPlayed: v.boolean(),
    hasCompleted: v.boolean(), // Completed at least one shift
    hasPurchased: v.boolean(),
    platform: v.optional(v.string()), // mobile, desktop
    referrer: v.optional(v.string()),
  }).index("by_device", ["deviceId"])
    .index("by_first_seen", ["firstSeen"]),
});
