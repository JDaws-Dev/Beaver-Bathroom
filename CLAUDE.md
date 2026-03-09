# Beaver's Bathroom Blitz

A Buc-ee's themed browser game where you play as a bathroom attendant keeping stalls clean.

## Current State (v5.1)

Cartoony art style with reactive beaver mascot, VIP customers, health inspector events, customer fights, upgrade system, and premium features.

## File Structure
```
/
├── index.html       # Game HTML shell
├── src/main.js      # All game logic (~8000+ lines)
├── src/styles.css   # All styles
├── src/UIOverlay.css # UI overlay styles
├── CLAUDE.md        # This file
├── AGENTS.md        # Agent instructions
├── convex/          # Backend (Convex)
├── .beads/          # Issue tracking database
└── .pocock/         # Autonomous loop scripts
```

## Recent Changes (v5.1)

### Customer Fight Event
- **Random event** (20% chance per shift, after shift 1)
- Two customers walk toward each other, argue with escalating emojis
- Player must **rapid-tap** the fight zone to break it up (same mechanic as cleaning)
- Quick breakup: +75 pts, +0.2 rating. Brawl timeout: -0.4 rating penalty
- During brawl: screen shakes, nearby customer patience drains 2x, rating drops
- Fight phases: `approaching` → `arguing` → `brawl` → `breakup` → `done`

### Supply Shop Premium Gate
- Non-premium users see a locked overlay with "Next Shift →" button
- Previously silently skipped with no explanation

### Lite Mode Fix
- Auto-enable (FPS < 24) is now session-only, not saved to localStorage
- Old stuck `beaverLowPerf` key is cleared on load
- Only manual toggle in settings persists across sessions

### Previous (v5)
- **Cartoony visual overhaul** — wood-grain doors, CSS art bodies, checkered floors
- **Reactive beaver mascot** — 4 expressions (happy, excited, worried, sad)
- **VIP Customers** (👑) — 2x rating impact, bigger tips
- **Health Inspector Events** — random inspections, penalties for dirty stalls
- **Upgrade System** — spend coins on items between shifts (premium)
- **Messy vs Clean Customers** — different mess levels
- **Combo Streak Bonuses** — visual fanfare at high combos

### Customer Types
- Regular customers (normal behavior)
- **VIP** 👑 - High stakes, 2x rating change
- **Urgent** - Move faster, less patience
- **Messy** - Leave more cleaning tasks
- **Clean** - Leave fewer tasks

## Features

### Customer Flow (Animated)
1. **Enter** - Spawn at exit door, walk into bathroom
2. **Find Stall** - Look for empty stall (or dirty if desperate)
3. **Walk to Stall** - Walk toward chosen stall
4. **Enter Stall** - Door opens, customer walks in and fades
5. **Use Stall** - Invisible inside, timer counts down
6. **Exit Stall** - Door opens, customer walks out
7. **Wash Hands** - Walk to sink at bottom of screen
8. **Exit** - Walk to exit door and leave

### Stall States
- **Empty** (green light) - Clean and available
- **Occupied** (red light) - Customer inside
- **Dirty** (yellow flashing) - Needs cleaning, has tasks
- **Cleaning** (blue light) - Player working on it

### Reactive Beaver Mascot
The beaver in the HUD reacts to gameplay:
- 😊 **Happy** - Default state, things going well
- 🤩 **Excited** - Combos, stalls cleaned, bonuses
- 😰 **Worried** - Dirty stalls piling up, low time
- 😢 **Sad** - Rating loss, customers leaving angry

### Multi-Step Cleaning
Click dirty stall → Task panel opens → Mash buttons to clean faster:
- 🪠 **Plunge** (30% chance)
- 🧽 **Scrub** (75% chance)
- 🧹 **Mop** (45% chance)
- 🧻 **Restock** (40% chance)

### Health Inspector Events
- Random inspections during shifts
- Inspector walks around checking stalls
- Penalty for each dirty stall found
- Bonus for all-clean inspection

### Customer Fight Events
- 20% chance per shift (after shift 1)
- Two customers walk toward each other and argue
- Emojis escalate: 😠 → 😡 → 🤬 → 🤜💥🤛
- Tap the fight zone rapidly to break it up
- Progress bar + percentage shows breakup progress
- If ignored: brawl with screen shake, nearby patience drain, rating loss
- CONFIG: `fightChance`, `fightBonus`, `fightPenalty`, `fightArgueTime`, `fightBrawlDrain`

### Upgrade System
Between shifts, spend points on:
- **Faster Cleaning** - Reduce task time
- **More Patience** - Customers wait longer
- **Better Tips** - Earn more per clean
- **Auto-Sink** - Sinks clean themselves

### Power-ups
- ⚡ **Speed** - 2x cleaning speed for 12s
- 🐢 **Slow** - 2x slower arrivals for 12s
- ✨ **Auto** - Instantly clean one dirty stall

### Controls
- **Click/Tap** stalls, sinks, towels to interact
- **Mash** task buttons to clean faster
- **Spacebar** - Quick-clean active task
- **Keyboard**: Q-P for stalls 1-10, 1-3 for power-ups

## Technical Details

### Key Config
```javascript
shifts: [
  {stalls:5, sinks:2, spawnMin:4300, spawnMax:6400, ...},
  // ... 6 total shifts with scaling difficulty
],
patience: 10000,      // Customer patience (ms)
walkSpeed: 120,       // Pixels per second
baseTaskTime: 1200,   // Base time per task (ms)
clickBoost: 50,       // Each click reduces task time
fightChance: 0.2,     // 20% chance of fight per shift
fightBonus: 75,       // Points for quick breakup
fightArgueTime: 5000, // ms before arguing becomes brawl
```

### Customer Phases
`enter` → `findStall` → `toStall` → `entering` → `inStall` → `exitStall` → `toSink` → `washing` → `toTowels` → `exit`
Note: ~30% of customers skip `toTowels` phase (CONFIG.towelSkipChance)

### Audio System
Uses Web Audio API with procedural sounds:
- Task clicks, completions, stall clean fanfares
- Urgent beeping when time is low
- Rush hour alerts
- Victory/failure sounds

## Development

### Issue Tracking (Beads)
```bash
bd list              # See all issues
bd ready             # See available work
bd show <id>         # View issue details
```

### Autonomous Loop (Pocock)
```bash
./.pocock/once.sh                    # Single iteration
./.pocock/loop.sh 10                 # 10 iterations
./.pocock/loop.sh 5 --epic <id>      # Work on specific epic
```

## How to Test
1. Run `npx vite` and open the local URL
2. Select Men's or Women's restroom
3. Click "Clock In!"
4. Play through shifts — fights can trigger on shift 2+
5. Watch for the red "FIGHT BREAKING OUT!" banner
6. Tap the fight zone rapidly to break it up
7. Survive health inspector visits
8. Non-premium users see locked Supply Shop overlay between shifts

## Buc-ee's Theme Elements
- **Beaver mascot** with reactive expressions
- "Dam Good Restrooms - Since 1982" tagline
- Warm brown/orange color palette
- Wood-grain textures
- Rest stop bathroom humor
- Texas road trip references
- Checkered tile floors
- "Lodge quality" messaging
