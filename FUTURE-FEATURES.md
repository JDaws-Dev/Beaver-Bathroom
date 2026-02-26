# Future Features (Phase 2+)

These features are saved for later implementation. Low-maintenance, zero ongoing work required.

---

## Difficulty Modes (Hard/Nightmare)

### Overview
Add difficulty modes that replay the same 6 shifts with modifiers.

### Modes
- **Normal**: Current difficulty (default)
- **Hard**: 1.3x spawn rate, 0.8x patience
- **Nightmare**: 1.6x spawn rate, 0.6x patience, more mess

### Why This Works
- Triples content without creating content
- Appeals to hardcore players
- Separate leaderboards per difficulty
- Zero maintenance

### Acceptance Criteria
- [ ] Difficulty selector on title screen
- [ ] Hard mode applies 1.3x/0.8x modifiers
- [ ] Nightmare mode applies 1.6x/0.6x modifiers
- [ ] Separate high scores per difficulty
- [ ] Achievements for beating Hard/Nightmare
- [ ] Visual indicator of current difficulty in HUD

---

## New Game+ / Prestige System

### Overview
After beating the game, players can 'prestige' to restart with permanent bonuses.

### Mechanics
- Beat Shift 6 → unlock Prestige option
- Prestige resets progress but grants +5% permanent bonus
- Stack up to 5 prestiges (25% total bonus)
- Bonus applies to: cleaning speed, patience, or coins

### Why This Works
- Adds replay incentive for completionists
- Progressive difficulty through self-imposed challenge
- Zero maintenance

### Acceptance Criteria
- [ ] Prestige option appears after beating game
- [ ] Prestige resets shift progress
- [ ] Permanent bonus applied (5% per prestige)
- [ ] Prestige level displayed somewhere
- [ ] Max 5 prestiges
- [ ] Achievements for prestige milestones

---

## Challenge Modifiers (Unlockable)

### Overview
Unlockable challenge modes that modify gameplay rules.

### Modifiers
- **No Power-ups**: Complete shifts without using items
- **VIP Only**: All customers are VIPs (high stakes)
- **Speed Run**: 2x game speed
- **Minimalist**: Only 1 of each power-up total
- **Inspector Gauntlet**: Inspector every 30 seconds

### Why This Works
- Creates variety without new content
- Achievements for completing challenges
- Hardcore player appeal
- Zero maintenance

### Acceptance Criteria
- [ ] Challenge modifiers unlocked after beating game
- [ ] Can toggle modifiers before starting shift
- [ ] Each modifier changes gameplay appropriately
- [ ] Achievements for completing with modifiers
- [ ] Modifiers can stack for extra challenge
