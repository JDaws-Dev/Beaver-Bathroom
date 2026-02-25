# Beaver's Bathroom Blitz

A Buc-ee's themed single-file HTML browser game where you play as a bathroom attendant keeping stalls clean.

## Current State (v5 - Cartoony Overhaul)

Major visual and gameplay overhaul with cartoony art style, reactive beaver mascot, VIP customers, health inspector events, and upgrade system.

## File Structure
```
/
├── beaver.html      # Complete game (~1200+ lines)
├── CLAUDE.md        # This file
├── AGENTS.md        # Agent instructions
├── .beads/          # Issue tracking database
└── .pocock/         # Autonomous loop scripts
```

## Recent Changes (v5)

### Cartoony Visual Overhaul
- **Wood-grain stall doors** with rounded shapes and door handles
- **Reactive beaver mascot** in HUD with 4 expressions (happy, excited, worried, sad)
- **CSS art customer bodies** with personality (not just emoji heads)
- **Checkered floor tiles** and wall details with decorative elements
- **Cartoony UI** - rounded buttons, panels, and HUD elements
- **Professional title screen** with logo-like title and clear layout

### New Gameplay Features
- **VIP Customers** (👑) - 2x rating impact, bigger tips, wear crowns
- **Health Inspector Events** - Random inspections, keep all stalls clean!
- **Upgrade System** - Spend points between shifts on permanent upgrades
- **Messy vs Clean Customers** - Different customer types affect mess level
- **Combo Streak Bonuses** - Visual fanfare at high combos

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
  {stalls:5, sinks:2, spawnMin:3000, spawnMax:4500, ...},
  // ... 6 total shifts with scaling difficulty
],
patience: 10000,      // Customer patience (ms)
walkSpeed: 120,       // Pixels per second
baseTaskTime: 500,    // Base time per task (ms)
clickBoost: 80,       // Each click reduces task time
```

### Customer Phases
`enter` → `findStall` → `toStall` → `entering` → `inStall` → `exitStall` → `toSink` → `washing` → `exit`

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
1. Open `beaver.html` in browser
2. See the new professional title screen
3. Select Men's or Women's restroom
4. Click "Clock In!"
5. Watch customers with CSS art bodies walk around
6. Notice the reactive beaver mascot in the HUD
7. Look for VIP customers (crown icon)
8. Survive health inspector visits
9. Use the upgrade system between shifts

## Buc-ee's Theme Elements
- **Beaver mascot** with reactive expressions
- "Dam Good Restrooms - Since 1982" tagline
- Warm brown/orange color palette
- Wood-grain textures
- Rest stop bathroom humor
- Texas road trip references
- Checkered tile floors
- "Lodge quality" messaging
