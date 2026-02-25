# Beaver's Bathroom Blitz

A Buc-ee's themed single-file HTML browser game where you play as a bathroom attendant keeping stalls clean.

## Current State (v4 - Major UI/UX Update)

Complete rewrite with gender selection, improved animations, sound effects, and visual polish.

## File Structure
```
/
├── beaver.html    # Complete game (~850 lines)
└── CLAUDE.md      # This file
```

## Recent Changes (v4)

### Gender Selection
- Choose Men's (🚹) or Women's (🚺) restroom at start
- Customer emojis match selected gender
- Male: 👨👴👦🧔👨‍🦰👨‍🦱👨‍🦳👱‍♂️🧑‍🦰
- Female: 👩👵👧👩‍🦰👩‍🦱👩‍🦳👱‍♀️👩‍🦲🧑‍🦱

### Fixed Customer Animation
- Customers walk TO the stall (not through it)
- Door opens as they approach
- They fade/shrink while entering the stall
- Door closes when fully inside
- Stall shows 🚽 when occupied (realistic - can't see inside!)
- Person reappears when exiting

### Sound Effects (Web Audio API)
- Task click: short beep
- Task complete: ascending tones
- Stall fully cleaned: celebratory chord
- Rating loss: descending sawtooth
- Shift end: victory fanfare

### Visual Polish
- Warmer brown color scheme (Buc-ee's theme)
- Better power-up icons: ⚡ Speed, 🐢 Slow, ✨ Auto
- Dirty stall count in HUD (⚠️ 3 or ✓)
- Confetti particles on stall clean
- Active effect glow on power-ups
- Task panel shows progress (2/3)
- Improved stall doors with handles
- Thicker patience bars (5px, color-coded)
- Pop-in animations for panels

## Features

### Customer Flow (Animated)
1. **Enter** - Spawn at exit door, walk into bathroom
2. **Find Stall** - Look for empty stall (or dirty if desperate)
3. **Walk to Stall** - Walk toward chosen stall
4. **Enter Stall** - Door opens, customer walks in and fades
5. **Use Stall** - Invisible inside, timer counts down
6. **Exit Stall** - Door opens, customer walks out
7. **Wash Hands** - Walk to sink, use it ~1.2s
8. **Exit** - Walk to exit door and leave

### Stall States
- **Empty** (green light) - Clean and available
- **Occupied** (red light) - Customer inside
- **Dirty** (yellow flashing) - Needs cleaning, has tasks
- **Cleaning** (blue light) - Player working on it

### Multi-Step Cleaning
Click dirty stall → Task panel opens → Click each task:
- 🪠 **Plunge** (25% chance)
- 🧽 **Wipe Seat** (70% chance)
- 🧹 **Mop** (40% chance)
- 🧻 **Refill TP** (35% chance)

### Sink System
- 2-4 sinks (increases with shift)
- Customers wash hands after stalls
- 30% chance sink gets dirty
- Click dirty sinks to clean (+25 points)

### Paper Towel Station
- 50% chance customers use towels
- Supply depletes over time
- Click to refill (+15 points)
- Turns red when low

### Progression
- 6 shifts with increasing difficulty
- More stalls per shift (5→10)
- Faster customer spawns
- Shorter occupation times

### Power-ups
- ⚡ **Speed** - 2x cleaning speed for 10s
- 🐢 **Slow** - 2x slower arrivals for 10s
- ✨ **Auto** - Instantly clean one dirty stall

### Controls
- **Click** stalls, sinks, towels to interact
- **Keyboard**: Q-P for stalls 1-10, 1-3 for power-ups

## Technical Details

### Key Config
```javascript
shifts: [
  {stalls:5, sinks:2, spawnMin:3500, spawnMax:5500, ...},
  // ... 6 total shifts
],
patience: 12000,      // Customer patience (ms)
walkSpeed: 100,       // Pixels per second
taskTime: 400,        // Time per cleaning task (ms)
sinkCleanTime: 600,   // Sink cleaning time (ms)
```

### Customer Phases
`enter` → `findStall` → `toStall` → `entering` → `inStall` → `exitStall` → `toSink` → `washing` → `exit`

### Audio System
Uses Web Audio API with oscillators:
- Frequencies: 200-1047 Hz
- Types: sine, square, sawtooth
- Short durations (50-300ms)

## Known Issues / TODO

### Potential Improvements
- [ ] Add tour bus events (flood of customers)
- [ ] Add manager inspection events
- [ ] Add more customer variety (VIP, runner)
- [ ] Show thought bubbles on impatient customers
- [ ] Mobile touch optimization
- [ ] Add background music (toggleable)
- [ ] Add high score persistence

### Design Notes
- Coordinates relative to `#floor-area`
- Stall positions from `#stalls-row` children
- Task panel absolute at bottom center
- All CSS/JS in single HTML file
- Web Audio API for sounds (no external files)

## How to Test
1. Open `beaver.html` in browser
2. Select Men's or Women's restroom
3. Click "Clock In!"
4. Watch customers walk in, enter stalls, exit
5. Click dirty (yellow) stalls to clean
6. Complete all tasks in task panel
7. Click dirty sinks to clean
8. Click towels to refill when low
9. Survive the shift!

## Buc-ee's Theme Elements
- Beaver mascot concept (🦫)
- "Dam Good Restrooms" tagline
- Warm brown color palette
- Rest stop bathroom humor
- Texas road trip references
- Clean bathroom reputation parody
