# Beaver's Bathroom Blitz

A Buc-ee's themed browser game where you play as a bathroom attendant keeping stalls clean.

## Current State (Season 2 / v6)

Cartoony art style with reactive beaver mascot, VIP customers, health inspector events, customer fights, upgrade system, premium features, 1v1 multiplayer, 28 achievement badges, and cosmetic unlocks.

## File Structure
```
/
├── index.html            # Game HTML shell
├── src/main.js           # All game logic (~9500+ lines)
├── src/styles.css        # All styles
├── src/UIOverlay.css     # UI overlay styles
├── CLAUDE.md             # This file
├── AGENTS.md             # Agent instructions
├── convex/               # Backend (Convex)
│   ├── schema.ts         # DB schema (rooms, scores, matchmaking, chat, users, purchases)
│   ├── multiplayer.ts    # Room create/join/sync/finish
│   ├── matchmaking.ts    # Queue, challenges, chat, loadout
│   ├── scores.ts         # Leaderboard (season 2)
│   ├── users.ts          # User management
│   └── admin.ts          # Admin utilities
├── promo-video/          # Remotion promo video project
│   ├── src/PromoVideo.tsx
│   ├── src/scenes/       # 5 scene components
│   └── public/audio/     # ElevenLabs VO clips
├── .beads/               # Issue tracking database
└── .pocock/              # Autonomous loop scripts
```

## Season 2 Changes

### 1v1 Multiplayer
- **Quick Match** — queue-based random matchmaking
- **Challenge system** — browse waiting players, send/accept/decline
- **Preset chat** — 10 predefined messages during 1v1 games
- **Score sync** — 2s polling during match
- Backend: `convex/matchmaking.ts` (new), updated `convex/multiplayer.ts` & `schema.ts`

### Unified Grade System
- Grade based on **final star rating**: S (5.0), A (4+), B (3+), C (2+), D (1+), F (<1)
- Previously was based on dirty/served ratio (hidden, confusing)
- Shown on game over screen, leaderboard, and share canvas

### Share Screen Redesign
- Player's equipped cosmetic avatar (not generic beaver logo)
- Grade circle with colored glow
- Polished layout with wood-grain background

### Achievement Badges (28)
Earned for milestones — displayed in Badges modal on title screen:
- **Starter:** Punch In, Getting Started, On Fire
- **Skill:** Unstoppable, Legendary, High Scorer, Score Legend, Perfect Shift
- **Grind:** Scrub Master, Sanitation Expert, Clean Machine, Customer Service, Lodge Legend, Hospitality King
- **Events:** Spotless, Peacemaker, Bouncer, Fight Club, Health Nut
- **Mastery:** Golden Plunger, Consistent, Combo God, Flawless, Last Second Hero
- **Stats tracked:** `achievementStats` in localStorage (shiftsCompleted, totalCleaned, totalServed, totalSaves, maxCombo, sGrades, perfectInspections, fightsWon, highestScore, perfectShifts)

### Season 2 Cosmetic Unlocks
5 new specials with achievement paths (also buyable with coins):
- Luchador (5 fights), Rockstar (10k score), Wizard (500 cleans), Candy Man (3 perfect shifts), Mad Scientist (10 inspections)

## Core Features

### Customer Flow (Animated)
1. **Enter** → **Find Stall** → **Walk to Stall** → **Enter Stall** → **Use Stall** → **Exit Stall** → **Wash Hands** → **Exit**
- ~30% skip towel phase (CONFIG.towelSkipChance)

### Customer Types
- Regular, **VIP** (2x rating impact), **Urgent** (faster, less patience), **Messy** (more tasks), **Clean** (fewer tasks)

### Multi-Step Cleaning
Click dirty stall → Task panel → Mash buttons: Plunge (30%), Scrub (75%), Mop (45%), Restock (40%)

### Events
- **Customer Fight** — 20% chance/shift, tap to break up, phases: approaching → arguing → brawl → breakup → done
- **Health Inspector** — 25% chance/shift, penalties per dirty stall
- **Rush Hour** — 15% chance/shift, faster spawns

### Upgrade System
Between shifts: Faster Cleaning, More Patience, Better Tips, Auto-Sink

### Power-ups
- Speed (2x cleaning 12s), Slow (2x slower arrivals 12s), Auto (instant clean one stall)

### Controls
- **Click/Tap** stalls, sinks, towels
- **Mash** task buttons to clean faster
- **Spacebar** quick-clean, **Q-P** for stalls 1-10, **1-3** for power-ups

## Technical Details

### Key Config
```javascript
shifts: [/* 6 total with scaling difficulty */],
patience: 10000, walkSpeed: 120, baseTaskTime: 1200, clickBoost: 50,
fightChance: 0.2, fightBonus: 75, fightArgueTime: 5000
```

### Audio
Web Audio API with procedural sounds (clicks, fanfares, beeps, alerts)

### Premium Gating
- Supply Shop locked overlay for non-premium
- Soft paywall after Shift 3
- $2.99 one-time via Stripe

## Development

### Deploy
```bash
npx convex deploy --yes                                    # Backend
vercel pull && vercel build --prod && vercel deploy --prod --prebuilt  # Frontend
```

### Issue Tracking (Beads)
```bash
bd list / bd ready / bd show <id>
```

### Promo Video
```bash
cd promo-video && npm start  # Remotion Studio at localhost:3002
```

## How to Test
1. Run `npx vite` and open the local URL
2. Select Men's or Women's restroom → "Clock In!"
3. Play through shifts — fights trigger on shift 2+
4. Check badges modal, outfitter, leaderboard
5. Test 1v1: open two tabs → Quick Match → both should find each other

## Buc-ee's Theme Elements
- Beaver mascot with reactive expressions
- Warm brown/orange color palette, wood-grain textures
- Rest stop bathroom humor, Texas road trip references
- Checkered tile floors, "Lodge quality" messaging
