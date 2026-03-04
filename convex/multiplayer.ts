import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Generate a random 4-digit code
function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Create a new multiplayer room
export const createRoom = mutation({
  args: {
    hostDeviceId: v.string(),
    hostName: v.string(),
    shift: v.number(),
    gender: v.string(),
  },
  handler: async (ctx, args) => {
    // Clean up any existing waiting rooms from this host
    const existingRooms = await ctx.db
      .query("rooms")
      .withIndex("by_host", (q) => q.eq("hostDeviceId", args.hostDeviceId))
      .collect();

    for (const room of existingRooms) {
      if (room.status === "waiting" || room.status === "playing") {
        await ctx.db.patch(room._id, { status: "finished" });
      }
    }

    // Generate a unique 4-digit code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 20) {
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing || existing.status === "finished") break;
      code = generateCode();
      attempts++;
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostDeviceId: args.hostDeviceId,
      hostName: args.hostName,
      guestDeviceId: undefined,
      guestName: undefined,
      status: "waiting",
      shift: args.shift,
      gender: args.gender,
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

    return { roomId, code };
  },
});

// Join a room with a 4-digit code
export const joinRoom = mutation({
  args: {
    code: v.string(),
    guestDeviceId: v.string(),
    guestName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) {
      return { error: "Room not found. Check the code and try again." };
    }

    if (room.status !== "waiting") {
      return { error: "This game has already started." };
    }

    if (room.hostDeviceId === args.guestDeviceId) {
      return { error: "You can't join your own room!" };
    }

    if (room.guestDeviceId) {
      return { error: "Room is full." };
    }

    await ctx.db.patch(room._id, {
      guestDeviceId: args.guestDeviceId,
      guestName: args.guestName,
    });

    return {
      roomId: room._id,
      code: room.code,
      hostName: room.hostName,
      shift: room.shift,
      gender: room.gender,
    };
  },
});

// Get room state (for polling)
export const getRoom = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    return room;
  },
});

// Host starts the game
export const startGame = mutation({
  args: {
    code: v.string(),
    hostDeviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) return { error: "Room not found." };
    if (room.hostDeviceId !== args.hostDeviceId) return { error: "Only the host can start the game." };
    if (!room.guestDeviceId) return { error: "Waiting for another player to join." };
    if (room.status !== "waiting") return { error: "Game already started." };

    await ctx.db.patch(room._id, { status: "playing" });
    return { success: true };
  },
});

// Update score during gameplay (called periodically)
export const updateScore = mutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
    score: v.number(),
    rating: v.number(),
    combo: v.number(),
    cleaned: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room || room.status !== "playing") return null;

    if (args.deviceId === room.hostDeviceId) {
      await ctx.db.patch(room._id, {
        hostScore: args.score,
        hostRating: args.rating,
        hostCombo: args.combo,
        hostCleaned: args.cleaned,
      });
    } else if (args.deviceId === room.guestDeviceId) {
      await ctx.db.patch(room._id, {
        guestScore: args.score,
        guestRating: args.rating,
        guestCombo: args.combo,
        guestCleaned: args.cleaned,
      });
    }

    return null;
  },
});

// Mark game as finished
export const finishGame = mutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
    score: v.number(),
    rating: v.number(),
    cleaned: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) return null;

    // Update final scores
    if (args.deviceId === room.hostDeviceId) {
      await ctx.db.patch(room._id, {
        hostScore: args.score,
        hostRating: args.rating,
        hostCleaned: args.cleaned,
        status: "finished",
      });
    } else if (args.deviceId === room.guestDeviceId) {
      await ctx.db.patch(room._id, {
        guestScore: args.score,
        guestRating: args.rating,
        guestCleaned: args.cleaned,
        status: "finished",
      });
    }

    return null;
  },
});

// Leave/close a room
export const leaveRoom = mutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) return null;

    if (args.deviceId === room.hostDeviceId) {
      // Host leaving closes the room
      await ctx.db.patch(room._id, { status: "finished" });
    } else if (args.deviceId === room.guestDeviceId) {
      // Guest leaving removes them from the room
      await ctx.db.patch(room._id, {
        guestDeviceId: undefined,
        guestName: undefined,
      });
    }

    return null;
  },
});
