import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Preset chat messages allowed in 1v1
const VALID_CHAT_IDS = [
  "bring_it", "too_slow", "clean_machine", "eww", "not_bad", "gg", "panic", "flex",
];

// Valid loadout item IDs
const VALID_LOADOUT_ITEMS = ["speed", "slow", "auto"];

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

const cosmeticsValidator = v.optional(v.object({
  hat: v.optional(v.string()),
  shirt: v.optional(v.string()),
  special: v.optional(v.union(v.string(), v.null())),
  accessory: v.optional(v.union(v.string(), v.null())),
  fur: v.optional(v.string()),
}));

// Helper: create a Quick Match room between two players
async function createQuickMatchRoom(
  ctx: any,
  host: { deviceId: string; playerName: string; cosmetics: any; _id?: any },
  guest: { deviceId: string; playerName: string; cosmetics: any; _id?: any }
) {
  let code = generateCode();
  let attempts = 0;
  while (attempts < 20) {
    const existingRoom = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .first();
    if (!existingRoom || existingRoom.status === "finished") break;
    code = generateCode();
    attempts++;
  }

  await ctx.db.insert("rooms", {
    code,
    hostDeviceId: host.deviceId,
    hostName: host.playerName,
    guestDeviceId: guest.deviceId,
    guestName: guest.playerName,
    status: "waiting",
    shift: Math.floor(Math.random() * 3),
    gender: Math.random() > 0.5 ? "male" : "female",
    difficulty: "normal",
    hostCosmetics: host.cosmetics,
    guestCosmetics: guest.cosmetics,
    isRandomMatch: true,
    hostScore: 0,
    hostRating: 5,
    hostCombo: 0,
    hostCleaned: 0,
    guestScore: 0,
    guestRating: 5,
    guestCombo: 0,
    guestCleaned: 0,
    createdAt: Date.now(),
  });

  return code;
}

// Join the matchmaking queue
export const joinQueue = mutation({
  args: {
    deviceId: v.string(),
    playerName: v.string(),
    cosmetics: cosmeticsValidator,
    autoMatch: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Clean up existing queue entries for this device
    const existing = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    for (const entry of existing) {
      if (entry.status === "waiting") {
        await ctx.db.patch(entry._id, { status: "expired" });
      }
    }

    // Auto-match: find a random opponent immediately
    if (args.autoMatch) {
      const waitingPlayers = await ctx.db
        .query("matchmakingQueue")
        .withIndex("by_status", (q) => q.eq("status", "waiting"))
        .collect();

      const opponent = waitingPlayers.find((p) => p.deviceId !== args.deviceId);

      if (opponent) {
        const code = await createQuickMatchRoom(ctx, opponent, {
          deviceId: args.deviceId,
          playerName: args.playerName,
          cosmetics: args.cosmetics,
        });

        await ctx.db.patch(opponent._id, { status: "matched", roomCode: code });

        const queueId = await ctx.db.insert("matchmakingQueue", {
          deviceId: args.deviceId,
          playerName: args.playerName,
          cosmetics: args.cosmetics,
          status: "matched",
          roomCode: code,
          queuedAt: Date.now(),
        });

        return { queueId, status: "matched", roomCode: code };
      }
    }

    // Add to queue (browse mode or no auto-match found)
    const queueId = await ctx.db.insert("matchmakingQueue", {
      deviceId: args.deviceId,
      playerName: args.playerName,
      cosmetics: args.cosmetics,
      status: "waiting",
      queuedAt: Date.now(),
    });

    return { queueId, status: "waiting" };
  },
});

// Challenge a specific player in the queue
// Send a challenge to a specific player (sets pending challenge on their queue entry)
export const challengePlayer = mutation({
  args: {
    deviceId: v.string(),
    playerName: v.string(),
    cosmetics: cosmeticsValidator,
    targetDeviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the target player in the queue
    const targetEntries = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_device", (q) => q.eq("deviceId", args.targetDeviceId))
      .collect();

    const target = targetEntries.find((e) => e.status === "waiting");
    if (!target) {
      return { error: "Player is no longer available" };
    }

    // Check if they already have a pending challenge
    if (target.challengeFrom) {
      return { error: "Player already has a pending challenge" };
    }

    // Set pending challenge on target's queue entry
    await ctx.db.patch(target._id, {
      challengeFrom: args.deviceId,
      challengeFromName: args.playerName,
      challengeFromCosmetics: args.cosmetics,
    });

    return { status: "pending" };
  },
});

// Accept a challenge — create room and match both players
export const acceptChallenge = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find my queue entry with a pending challenge
    const myEntries = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    const myEntry = myEntries.find((e) => e.status === "waiting" && e.challengeFrom);
    if (!myEntry || !myEntry.challengeFrom) {
      return { error: "No pending challenge" };
    }

    // Find the challenger's queue entry
    const challengerEntries = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_device", (q) => q.eq("deviceId", myEntry.challengeFrom))
      .collect();

    const challenger = challengerEntries.find((e) => e.status === "waiting");
    if (!challenger) {
      // Challenger left — clear the challenge
      await ctx.db.patch(myEntry._id, {
        challengeFrom: undefined,
        challengeFromName: undefined,
        challengeFromCosmetics: undefined,
      });
      return { error: "Challenger is no longer available" };
    }

    // Create room — challenger is host
    const code = await createQuickMatchRoom(ctx, challenger, {
      deviceId: args.deviceId,
      playerName: myEntry.playerName,
      cosmetics: myEntry.cosmetics,
    });

    // Update both queue entries to matched
    await ctx.db.patch(myEntry._id, { status: "matched", roomCode: code });
    await ctx.db.patch(challenger._id, { status: "matched", roomCode: code });

    return { status: "matched", roomCode: code };
  },
});

// Decline a challenge
export const declineChallenge = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const myEntries = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    const myEntry = myEntries.find((e) => e.status === "waiting" && e.challengeFrom);
    if (myEntry) {
      await ctx.db.patch(myEntry._id, {
        challengeFrom: undefined,
        challengeFromName: undefined,
        challengeFromCosmetics: undefined,
      });
    }

    return { success: true };
  },
});

// Leave the matchmaking queue
export const leaveQueue = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    for (const entry of entries) {
      if (entry.status === "waiting") {
        await ctx.db.patch(entry._id, { status: "expired" });
      }
    }

    return { success: true };
  },
});

// Poll queue status
export const pollQueue = query({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    // Find the most recent entry
    const latest = entries
      .sort((a, b) => b.queuedAt - a.queuedAt)[0];

    if (!latest) return { status: "none" };

    return {
      status: latest.status,
      roomCode: latest.roomCode,
      challengeFrom: latest.challengeFrom,
      challengeFromName: latest.challengeFromName,
      challengeFromCosmetics: latest.challengeFromCosmetics,
    };
  },
});

// Get all players currently waiting in the queue
export const getWaitingPlayers = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db
      .query("matchmakingQueue")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();

    // Look up best score for each player
    const results = await Promise.all(players.map(async (p) => {
      // Find user by deviceId to get their scores
      const user = await ctx.db
        .query("users")
        .withIndex("by_device", (q) => q.eq("deviceId", p.deviceId))
        .first();

      let bestScore = 0;
      if (user) {
        const scores = await ctx.db
          .query("scores")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        if (scores.length > 0) {
          bestScore = Math.max(...scores.map((s) => s.score));
        }
      }

      return {
        deviceId: p.deviceId,
        playerName: p.playerName,
        cosmetics: p.cosmetics,
        queuedAt: p.queuedAt,
        bestScore,
      };
    }));

    return results;
  },
});

// Send a preset chat message
export const sendChat = mutation({
  args: {
    roomCode: v.string(),
    senderDeviceId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!VALID_CHAT_IDS.includes(args.messageId)) {
      return { error: "Invalid message" };
    }

    await ctx.db.insert("chatMessages", {
      roomCode: args.roomCode,
      senderDeviceId: args.senderDeviceId,
      messageId: args.messageId,
      sentAt: Date.now(),
    });

    return { success: true };
  },
});

// Get recent chat messages for a room
export const getChat = query({
  args: {
    roomCode: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.eq("roomCode", args.roomCode))
      .collect();

    // Filter to recent messages (last 30 seconds) and optionally since timestamp
    const cutoff = args.since || (Date.now() - 30000);
    return messages
      .filter((m) => m.sentAt > cutoff)
      .sort((a, b) => a.sentAt - b.sentAt)
      .slice(-20);
  },
});

// Set loadout for a player in a room
export const setLoadout = mutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
    loadout: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate loadout items
    if (args.loadout.length > 3) return { error: "Max 3 items" };
    for (const item of args.loadout) {
      if (!VALID_LOADOUT_ITEMS.includes(item)) return { error: "Invalid item: " + item };
    }

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) return { error: "Room not found" };

    if (args.deviceId === room.hostDeviceId) {
      await ctx.db.patch(room._id, { hostLoadout: args.loadout });
    } else if (args.deviceId === room.guestDeviceId) {
      await ctx.db.patch(room._id, { guestLoadout: args.loadout });
    }

    return { success: true };
  },
});

// Set ready status for a player
export const setReady = mutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
    ready: v.boolean(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) return { error: "Room not found" };

    if (args.deviceId === room.hostDeviceId) {
      await ctx.db.patch(room._id, { hostReady: args.ready });
    } else if (args.deviceId === room.guestDeviceId) {
      await ctx.db.patch(room._id, { guestReady: args.ready });
    }

    return { success: true };
  },
});
