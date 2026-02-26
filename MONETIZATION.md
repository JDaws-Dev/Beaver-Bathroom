# Monetization Plan - Free vs Paid Split

**Status:** Draft - awaiting approval
**Date:** 2026-02-26

---

## Free Version

**Content:**
- Shifts 1-3 (Training Day, Lunch Rush, Tour Bus Season)
- Basic customers + Urgent customers
- Health inspector events (core gameplay)

**Power-ups:**
- All 3 types available (Speed Boost, Slow-Mo, Insta-Clean)
- Limited to 1 of each per shift (no earning more)

**Progression:**
- No upgrade shop between shifts
- No daily rewards
- No achievements display
- Score tracked but no leaderboard

---

## Paid Version ($2.99 one-time)

**Content:**
- All 6 shifts + Golden Plunger ending
- VIP customers (2x stakes)
- 9 Special characters (Big Rig Bill, Soccer Mom, etc.)
- Speed Clean mini-game

**Power-ups:**
- Earn power-ups through gameplay
- Upgrade item duration/count in shop

**Progression:**
- Full perk system (Quick Scrub, Patience Plus, Auto-Assist)
- Full item upgrade system
- Daily rewards with streak multipliers (up to 3x)
- All 17 achievements
- Global leaderboard

---

## Unlock Flow

1. Player completes Shift 3
2. Show "Unlock Full Game" modal instead of upgrade shop
3. Stripe checkout link opens
4. On success, set `localStorage.beaverPremium = true`
5. Continue to Shift 4

---

## Implementation Notes

- Single localStorage flag: `beaverPremium`
- One paywall gate after Shift 3
- No recurring maintenance needed
- Payment via Stripe Payment Links (already have Stripe)

---

## Distribution Channels (Future)

| Channel | Reach | Effort |
|---------|-------|--------|
| itch.io | Indie game community | Low |
| CrazyGames / Poki | Casual game traffic, revenue share | Medium |
| TikTok/Reels | Viral potential | Medium |
| Product Hunt | Tech early adopters | Low |
| Reddit (r/WebGames) | Targeted players | Low |

---

## Decision Log

- Battle pass rejected - too much maintenance for this game type
- Ad rewards rejected - keeping it simple, one-time purchase
- Gumroad/LemonSqueezy not needed - already have Stripe
