# Progress & Learnings

This file maintains context between autonomous iterations.
**READ THIS FIRST** to understand recent decisions and roadblocks.

---

## Recent Context (Last 3 Iterations)

<!-- This section is a rolling window - keep only the last 3 entries -->

### Remove Blocking Tutorial System (etg)
- Goal: remove buggy interactive tutorial that blocked gameplay
- Decision: kept "How to Play" modal (non-blocking), removed interactive overlay
- Why: game teaches itself, Shift 1 is slow (4300-6400ms spawns), Bucky tips provide guidance
- Removed: tutorial-overlay HTML, 18 lines of tutorial CSS, ~150 lines of tutorial JS
- Removed: TUTORIAL_STEPS array, tutorialActive/tutorialStep/tutorialHighlight state
- Removed: startInteractiveTutorial, showTutorialStep, advanceTutorial, endTutorial functions
- Removed: tutorial-skip and tutorial-next event listeners
- Kept: tutorial-modal (How to Play), beaverTutorialSeen localStorage, Bucky tips system
- Files: index.html (~10 lines), src/styles.css (~18 lines), src/main.js (~150 lines)

### Beaver Speech Bubbles for Tips (3ud)
- Goal: have beaver mascot show speech bubble tips during first shift at relevant moments
- Added `#beaver-speech` element inside `#beaver-mascot` in HUD
- CSS: speech bubble with pointer arrow, pop animation, hidden by default (opacity:0)
- Responsive: smaller text at 600px and 420px breakpoints, wrapping text on phone
- 8 tips defined in BEAVER_TIPS object for different gameplay moments
- localStorage: tracks each tip shown with `beaverTip_<tipKey>` keys
- Only shows on first shift (game.shift === 0) and each tip only once
- Triggers: dirty stall, task panel open, dirty sink, powerup available, combo start, VIP customer, inspector warning, low time (15s)
- Files: index.html (CSS lines 104-108, 386, 430; HTML line 571; JS lines 1134-1169; triggers scattered)

### Sink Dirty Indicator in HUD (uh9)
- Goal: show dirty sink count in HUD so players don't forget them
- Added `#sinks-hud` element after dirty stall count in HUD
- Hidden by default (`style="display:none"`), only shows when sinks are dirty
- Uses 🚿 emoji + count for visual recognition
- Color escalation: blue (#64b5f6) normally, red (#e53935) when ALL sinks dirty
- Added `#dirty-sinks` CSS style (line 107)
- updateHUD() now calculates dirty sinks and toggles visibility (lines 1430-1439)
- Files: index.html (CSS line 107, HTML line 569, JS lines 1430-1439)

---

## Active Roadblocks

- No external assets: everything generated via CSS/SVG/Web Audio
- Must work offline in browser (Convex will add online features)

---

## Project Learnings

Patterns, gotchas, and decisions that affect future work:

### Stack

- Vite for dev server and bundling
- Convex for backend (auth, leaderboard - to be added)
- Pure vanilla JS - no frontend frameworks
- Web Audio API for procedural sounds
- CSS animations for all motion
- Emojis for characters (considering SVG alternatives)

### Patterns

- `$('id')` helper for getElementById
- `game` object holds all state
- `CONFIG` object for tunable values
- Customer phases: enter → findStall → toStall → entering → inStall → exitStall → toSink → washing → exit

### Code Structure

- `index.html`: HTML structure only (~170 lines)
- `src/styles.css`: all CSS (~489 lines)
- `src/main.js`: all game logic (~2511 lines)
- Key functions: update(), renderPeople(), updateStallDOM(), clickStall(), setBeaverMood()

### CSS Art Techniques

- Wood grain: `repeating-linear-gradient(90deg,...)` with 2-4px stripe widths
- Depth: combine `box-shadow` (outer) + `inset box-shadow` (inner)
- 3D lights: `radial-gradient(circle at 30% 30%,...)` for sphere highlight
- Cartooniness: larger `border-radius`, bold borders, warm brown palette (#5d4037, #3e2723, #8d6e63)
- Checkered tiles: `repeating-conic-gradient(from 0deg at 50% 50%,...)` with `background-size` for tile size

### Testing

- No automated tests - manual browser testing required
- Test checklist: title screen, gender select, gameplay, stalls, sinks, customers, sounds

---

## Archive (Older Iterations)

<!-- Move entries here when they roll out of "Recent Context" -->

### Stack Task Buttons Vertically on Mobile (5tr)
- Goal: make task buttons full-width and stacked for better touch on portrait phones
- Added to 420px breakpoint: `#task-buttons{flex-direction:column;gap:8px}` + `.task-btn{width:100%}`
- Touch targets: min-height 48px (exceeds 44px guideline)
- Change is purely CSS, no JS modifications
- Files: index.html (CSS lines 441-442 in 420px media query)

### Grace Period Before Dirty Stall Penalty (tct)
- Goal: add 200ms grace period when customer enters dirty stall, reduce frustration
- When customer reaches dirty stall in toStall phase, sets `p.gracePending = true` and `p.graceTimer = 200`
- In entering phase, checks each frame: if stall is empty/cleaning → award "JUST IN TIME" save
- If grace timer expires and stall still dirty → apply normal penalty
- Also handles 'cleaning' state: if player started cleaning during grace, instant completion + save
- Logic added to lines 1893-1944 in entering phase handler
- Files: index.html (toStall line 1876-1880, entering lines 1893-1944)

### Improve SAVED Message Clarity (424)
- Goal: change unclear "SAVED!" message to something more descriptive
- Changed: "SAVED! +50" → "JUST IN TIME! +50" (line 1849)
- Why: "Just in time" immediately conveys urgency + success of cleaning before customer entered
- Pairs well with existing "Close Calls" stat label on game over screen
- Files: index.html (one line change in toStall phase handler)

### High Score Persistence (rzf)
- Goal: save high score to localStorage, show on title and game over screens
- localStorage key: `beaverHighScore` - stores integer value
- Title screen: shows "🏆 High Score: X" below subtitle (hidden if 0)
- Game over screen: shows "High Score: X" below final score, adds "🎉 NEW RECORD!" if beaten
- CSS: `.high-score` class with `.visible` modifier (line 35-36)
- HTML: `#title-high-score` (line 499), `#go-high-score` (line 607)
- JS: `highScore` variable loaded on init (line 836), `updateHighScoreDisplay()` (line 2830)
- gameOver() checks for new record, saves to localStorage, updates display (line 2768-2780)
- Files: index.html (CSS, HTML, JS changes)

### Slow Down Shift 1 for New Players (f1f)
- Goal: reduce spawn rate 30% on first shift to let players learn
- Fix: increased spawnMin 3000→4300, spawnMax 4500→6400 (line 682)
- Math: 30% slower rate = 43% longer intervals (1/0.7 ≈ 1.43x)
- Other shifts unchanged - only affects Shift 1
- Files: index.html (CONFIG.shifts[0] line 682)

### Auto-show Tutorial on First Play (2uk)
- Goal: show tutorial automatically on first visit, don't make players hunt for it
- localStorage key: `beaverTutorialSeen` - set to 'true' when tutorial is closed
- On page load: check if key exists, if not show tutorial modal automatically
- Close handlers (close button, "Got it!" button, click outside) all set localStorage
- "How to Play" button still works for returning players
- Files: index.html (JS lines 2793-2811)
- Simple localStorage pattern, matches existing mute preference storage

### Bucky the Beaver Mentor Tips (a2h.4.2)
- Goal: add Bucky as mentor character providing tips before each shift
- New BUCKY_TIPS array (line 641-678): 6 shift-specific tip sets, 3 tips each
  - Shift 1: basics (mashing, patience bars, VIPs)
  - Shift 2: combos and urgency
  - Shift 3: powerups and puddles
  - Shift 4: health inspector prep
  - Shift 5: upgrades and endurance
  - Shift 6: final push encouragement
- CSS additions (lines 300-304, 459-462):
  - `.bucky-tip` green panel with flexbox layout
  - `.bucky-tip-icon` for beaver emoji
  - `.bucky-tip-label` styled "Bucky says..." header
  - `.bucky-tip-text` for the actual tip content
  - Responsive styles at 420px breakpoint
- HTML: added bucky-tip div in intro-card (lines 613-618) between desc and stats
- JS: showShiftIntro() updated (lines 1429-1432) to pick random tip per shift
- Makes beaver mascot meaningful - now provides contextual gameplay advice

### UI/UX and Gameplay Evaluation (el6)
- Goal: comprehensive evaluation without code changes - recommendations only
- Deliverable: EVALUATION.md with prioritized recommendations
- Key findings:
  - **Onboarding gap**: tutorial hidden, first shift too fast, no interactive guidance
  - **Mobile UX**: task buttons small, puddles hard to tap, missing haptic feedback
  - **Strategic depth limited**: most runs play similarly, upgrades incremental
  - **Core loop solid**: task sounds satisfying, combos feel rewarding, celebrations good
- Quick wins identified:
  1. Auto-show tutorial on first play (localStorage check)
  2. Slow spawn rate on Shift 1 (let players learn)
  3. Add `overscroll-behavior: none` for mobile
  4. High score persistence in localStorage
  5. Better "SAVED!" message clarity
- What creates tension: patience bars, multiple dirty stalls, inspectors, rush hour
- What creates joy: combos, saves, VIP bonuses, perfect inspections, special characters
- No code written - pure research/evaluation task

### Separate Music and SFX Volume Controls (7eo)
- Goal: separate controls for music vs SFX so players can mute independently
- Finding: feature already existed! `isMuted` (SFX) and `isMusicMuted` (music) were already separate
- Problem: UI wasn't clear - buttons had confusing icons (🔈 for muted music looked like speaker)
- Fix: added labeled controls for clarity
  - New `.audio-ctrl` wrapper with `.audio-label` ("SFX" / "Music")
  - Both buttons now show strikethrough when muted (`.muted{text-decoration:line-through}`)
  - Updated aria-labels for accessibility
  - Music button uses 🎵 consistently (muted state shown via opacity + strikethrough)
  - SFX button keeps 🔇/🔊 icons (already clear)
- Responsive: added `.audio-label` sizing at 600px and 420px breakpoints
- Files: index.html (CSS lines 105-106, 373, 416; HTML lines 539-540; JS line 945)
- localStorage keys unchanged: 'beaverMuted', 'beaverMusicMuted'

### Fix: Waiting Customers Don't Enter Available Stalls (7sq)
- Goal: fix bug where customers waiting in findStall phase didn't claim newly available stalls
- Root cause: stale reservedBy references - when a customer was removed from game.people array, their reservation on a stall might not be cleared in all edge cases
- Fix: added stale reservation cleanup loop at start of findStall phase (lines 1730-1735)
  - Checks if reservedBy points to a customer still in game.people
  - Clears reservation if customer no longer exists
- Location: updatePeople() function, findStall phase handler
- Why this works: reservedBy holding reference to removed customer would block other customers from claiming that stall
- The fix runs every frame for customers in findStall, quickly clearing any stale reservations

### Memorable Customer Characters (a2h.4.4)
- Goal: add named customer types with distinct personalities
- New SPECIAL_CUSTOMERS config array (line 681-712):
  - 9 named characters: Big Rig Bill, Road Trip Randy, Business Bob, Weekend Warrior, Trucker Tom (male)
  - Soccer Mom, Tourist Tina, Snack Sally, Road Queen (female)
- Each special character has: name, icon, badge, shirt color, patience modifier, messiness, custom thoughts
- spawnCustomer() updated (line 1537-1628):
  - Rolls for special character spawn first based on gender
  - Special characters use their own properties (not random)
  - patience < 0.7 triggers urgent behavior
  - Special characters show enter thought when spawning
- CSS additions (line 193-196):
  - .person.special with orange glow
  - .special-badge positioned top-left
  - .special-name label below patience bar (gold text on wood bg)
- renderPeople() updated (line 2143-2154):
  - Adds 'special' class when p.specialName exists
  - Creates badge and name elements for special characters
  - Happy state detection includes special character thoughts
- Responsive styles: smaller name labels at 600px and 420px breakpoints
- Character personalities: truckers patient/messy, soccer moms rushed/clean, tourists slow/clean

### Player Identity and Stakes (a2h.4.3)
- Goal: establish who player is, what they want, what happens on win/loss
- Player identity: "new hire at Beaver Lodge, first day"
- Goal: survive 6 shifts to earn the "Golden Plunger" award
- Stakes: win = trophy, lose = fired
- Title screen updates:
  - New .title-subtitle with player intro text (line 456)
  - .golden-plunger class with gold glow styling (line 33)
- SHIFT_NARRATIVES: added `progress` field ("Day 1 of 6", "Final Day", etc.)
- showShiftIntro() now shows progress instead of "SHIFT X"
- Tutorial updated: explains player is new hire, goal is 6 shifts
- WIN_MESSAGES: now reference Golden Plunger and "rookie" identity
- GAME_OVER_MESSAGES: reference badge, manager disappointment
- gameOver(): win title = "GOLDEN PLUNGER EARNED!", lose = "FIRED!", icon 📦 for loss
- endShift() comments: now reference remaining shifts, Golden Plunger for S grades
- CSS: .title-subtitle and .golden-plunger styles added

### Shift Narrative Names and Intro Screen (a2h.4.1)
- Goal: add narrative names to shifts with intro screen showing before gameplay
- New SHIFT_NARRATIVES config array with 6 shift stories:
  - Training Day, Lunch Rush, Tour Bus Season, Health Inspector, Festival Weekend, Championship Sunday
- New shift-intro screen HTML (line 568-576):
  - intro-card with shift number, title, description, stats (stalls/sinks/time)
  - btn-play to start shift
- CSS: lines 269-278 - intro-card, intro-title, intro-desc, intro-stats, intro-appear animation
- JS: showShiftIntro() function (line 1289) populates and shows intro screen
- Flow change: startShift() → showShiftIntro() → user clicks → startShift()
- Button handlers updated: start-btn and skip-upgrades now call showShiftIntro()
- endShift() uses narrative.name in result-title ("Training Day Complete!")
- Note: line numbers shifted ~10 lines from SHIFT_NARRATIVES addition

### Background Music - Procedural Upbeat Theme (a2h.3.3)
- Goal: add procedural background music using Web Audio API
- New music button 🎶/🔈 in HUD (line 493) - separate from SFX mute
- localStorage key: 'beaverMusicMuted' for independent music preference
- JS: lines 784-910 - complete music system:
  - MUSIC_NOTES object: C major scale frequencies
  - MELODY array: 24-note catchy pattern with rests
  - BASS array: 8-note simple root pattern
  - TEMPO: 180 BPM for upbeat feel
  - startMusic(), stopMusic(), toggleMusic(), updateMusicButton()
  - playMusicNote(): triangle wave melody, sine wave bass, soft attack/release
  - playNextMelodyNote/Bass(): setTimeout-based sequencers
- Integration:
  - startMusic() called in startShift() (line 1299)
  - stopMusic() called in endShift() (line 2365) and gameOver() (line 2429)
  - Music button click handler (line 2487-2491), init (line 2492)
- Volume: musicGain.value = 0.08 (lower than SFX to not overwhelm)
- Technique: separate gain node for music, oscillators array for cleanup

### Volume/Mute Controls (a2h.3.2)
- Goal: add UI to mute sounds, persist preference
- Added mute button to HUD (🔊/🔇 toggle)
- CSS: .mute-btn styles with hover/active states, opacity feedback (line 100-103)
- Mobile responsive styles at 600px (line 341) and 420px (line 381)
- JS: isMuted state loaded from localStorage on page load (line 667)
- JS: toggleMute(), updateMuteButton() functions (lines 673-685)
- JS: playSound() checks isMuted before playing (line 688)
- localStorage key: 'beaverMuted' (true/false string)
- Button added to HUD after Time stat (line 492)
- Click handler at line 2349, button state init at line 2353
- Technique: initAudio() called on mute click to ensure audioCtx exists

### Enhanced Task-Specific Sounds (a2h.3.1)
- Goal: make each cleaning task have unique, cartoony sound
- Added 4 new task sound functions:
  - playPlunge(): low freq burst (80Hz) + pop (200Hz) - comedic 'plop'
  - playScrub(): layered high freq sawtooth (1800-2200Hz) - spray sound
  - playMop(): high sine wobble (800-1000Hz) - squeaky clean
  - playRestock(): rapid random crinkle bursts (3000-5000Hz sawtooth)
- Added playTaskSound(taskId) dispatcher to map task IDs to sounds
- Task IDs: 'plunge', 'wipe', 'mop', 'tp' (from TASKS config ~line 616)
- Updated task button click handler (~line 1919/1929) to use playTaskSound()
- Randomization added to each sound for variety (Math.random() on freq)
- JS: lines 683-714 (new sound functions)
- Technique: layer multiple oscillators with slight timing offsets

### Escalating Combo Visual Effects (a2h.5.4)
- Goal: make combo feel more intense as it builds
- Three combo tiers with escalating effects:
  - combo-fire (3-4x): orange pulsing glow, 0.5s pulse, text-shadow
  - combo-intense (5-9x): red-orange faster pulse (0.35s), screen edge glow starts
  - combo-legendary (10x+): gold color, intense pulse (0.25s), bright screen edge glow
- CSS additions (lines 272-286):
  - @keyframes combo-pulse, combo-pulse-fast, combo-pulse-intense (scale animations)
  - @keyframes combo-glow, combo-glow-intense, combo-glow-legendary (text-shadow animations)
  - @keyframes screen-edge-glow, screen-edge-legendary (inset box-shadow on play-area)
  - Classes: #combo.combo-fire/intense/legendary, #play-area.combo-edge-glow/legendary
- JS updateHUD() (lines 1019-1029):
  - Added comboEl and playArea references
  - classList.toggle for combo-fire/intense/legendary based on game.combo
  - playArea classList.toggle for screen edge effects
  - Enhanced color/fontSize scaling for combo tiers
- JS completeTask() (lines 1957-1975):
  - Enhanced sparkle scaling: 10→14→20→24 particles by combo tier
  - Enhanced confetti scaling: 6→12→18→22 by combo tier
  - Tier-specific float messages: 🔥 (3x), ⚡ (5x), 🌟 LEGENDARY (10x)

### Animation Easing and Bounce (a2h.5.5)
- Goal: replace linear animations with bouncy/snappy easing
- Key easing curve: cubic-bezier(0.34, 1.56, 0.64, 1) - "ease-out-back" style with overshoot
- CSS changes:
  - pop-in: now 4-step keyframes with overshoot (scale 0.5 → 1.08 → 0.96 → 1)
  - float-up: adjusted for bounce at peak (scale 1.25 at 20%, 1.15 at 45%)
  - New value-bump animation for HUD number changes
- Added bouncy transitions to all interactive elements:
  - .btn, .task-btn, .powerup (0.15-0.18s)
  - .stall, .sink, #towels (0.15-0.18s)
  - .pick-item, .upgrade-card, .upgrade-cost (0.15-0.18s)
  - .gender-opt, #skip-upgrades (0.18s)
- JS changes:
  - New bumpValue(id) helper triggers value-bump animation on HUD items
  - Called on score/combo changes in completeTask()
  - Called on milestone rewards in checkComboMilestone()
- CSS: lines 267-271 (keyframes), line 728 (bumpValue function)
- Technique: el.classList.remove, void el.offsetWidth, el.classList.add for re-triggering

### Stink Lines and Visual Dirt Cues (a2h.5.3)
- Goal: add visual cues that make dirty stalls obviously need attention
- Added wavy stink lines with animated rising effect
  - 3 wavy lines that float upward with staggered animation delays
  - @keyframes stink-wave: translateY, scaleY, rotate for organic look
  - Uses flex layout for spacing, border-radius for curved shapes
- Added buzzing fly (🪰) that orbits around dirty stalls
  - @keyframes fly-buzz: figure-8 style flight pattern with rotation
  - Positioned top-right corner of stall
- Added grime spots overlay using radial gradients
  - ::after pseudo-element on .stall-body with brownish spots
  - Makes dirty stalls look visibly grimy
- Updated dirty stall body color to more brownish/dingy gradient
- Added position:relative to .stall for absolute positioning
- HTML: stink-lines and stall-fly elements added to stall innerHTML
- CSS: lines 123-137 (dirty stall styles and animations)

### Mobile-Friendly Touch Controls (a2h.5.6)
- Goal: make game playable on mobile phones
- Added touch-action: manipulation to prevent double-tap zoom on interactive elements
- Added -webkit-touch-callout:none and -webkit-tap-highlight-color:transparent to body
- Created two responsive breakpoints:
  - @media(max-width:600px): tablet/large phone sizes
  - @media(max-width:420px): smaller phones, extra touch-friendly
- Touch targets now have min-height/min-width of 44-48px (Apple HIG guideline)
- Key responsive adjustments:
  - Stalls: 54px→48px width, 88px→80px min-height
  - Task buttons: min-height:48px, larger padding
  - Powerups: min-height:44-48px
  - Sinks: 52px→48px, min-width:44px
  - Gender buttons: 50x50px on phone, min-width/height:44px
- Existing touch feedback animations preserved (click-pulse, stall-click, sink-ripple)
- CSS: lines 9-10 (touch-action, webkit styles), 299-380 (media queries)

### Cleaning Completion Celebration (a2h.5.2)
- Goal: make stall cleaning completion feel amazing
- New CSS animations:
  - stall-celebrate: bouncy scale animation (1 → 1.08 → 0.96 → 1.04 → 0.98 → 1)
  - stall-success-flash: green inset glow pulse on .stall-body
  - door-swing: physics-based door swing with overshoot (rotateY easing)
  - sparkle-burst: radial particle effect with CSS vars for direction
- New .stall.celebrate class triggers all three animations
- New spawnSparkles(x, y, count) function - radial sparkle particle effect
  - Uses CSS custom properties (--tx, --ty) for direction
  - Randomized size and timing
- Enhanced playStallClean() sound - layered arpeggio + high freq shimmer
  - Base: C5-E5-G5-C6 arpeggio (523-659-784-1047 Hz)
  - Overlay: sparkle shimmer (2093-2349-2637 Hz)
- Beaver now gets 'excited' for ALL clean completions (not just VIP/combo)
- Applied celebration to: completeTask(), save moments, auto-clean powerup
- CSS: lines 262-271 (new animations and classes)
- JS: spawnSparkles() ~700, completeTask() ~1799, save handling ~1268

### Click/Tap Feedback Polish (a2h.5.1)
- Added immediate visual feedback to all clickable elements
- New CSS animations: click-pulse, click-flash, stall-click, sink-ripple
- Task buttons: scale + flash on click (.task-btn.clicked)
- Stalls: bounce effect on click (.stall.clicked)
- Sinks: ripple effect on click (.sink.clicked)
- Towels/Powerups: pulse on click
- Pattern: el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
- CSS: lines 278-287 (click feedback animations)
- JS: clickStall, clickSink, showTaskPanel, powerup handlers

### Combo Streak Bonuses (a2h.2.5)
- Milestones at 3x, 5x, 10x combos with escalating rewards
- CONFIG.comboMilestones: array of {level, speedBoost, rating, points, msg}
  - 3x: "🔥 ON FIRE!" - 3s speed boost, +50 pts
  - 5x: "⚡ UNSTOPPABLE!" - 4s speed boost, +0.1 rating, +100 pts
  - 10x: "🌟 LEGENDARY!" - 5s speed boost, +0.3 rating, +250 pts
- game.comboBoost: remaining duration of speed boost (30% faster cleaning)
- game.lastMilestone: prevents re-triggering same milestone
- Visual: banner with animation, legendary gets gold styling
- Sound: escalating fanfares (3/4/5 note chords)
- Combo break: softer "COMBO LOST!" message at 3+ streaks
- CSS: lines 261-269 (milestone banner, break message, animations)
- HTML: lines 367-368 (combo-milestone, combo-break divs)
- JS: checkComboMilestone() ~693, showComboBreak() ~731, playComboMilestone/Break() ~557

### Prevent Multiple Customers Same Stall (8pk)
- Bug: race condition allowed multiple customers to target same stall
- Root cause: stall marked 'occupied' only after customer fully entered
- Fix: added `reservedBy` property to stalls
- When customer targets stall in findStall phase, immediately set `stall.reservedBy = p`
- findStall logic now skips reserved stalls (both empty and dirty)
- Reservation cleared when customer enters (state='occupied') or exits early
- JS: stall init ~767, findStall ~1196-1210, entering ~1282, toStall edge case ~1216

### Upgrade System Between Shifts (a2h.2.4)
- New "Beaver Supply Shop" screen between shifts
- Earn coins based on score + grade multiplier (S=2x, A=1.5x, B=1.2x, C=1x, F=0.5x)
- 4 permanent upgrades purchasable with coins:
  - Speed Scrub (⚡): 12% faster cleaning per level, max 5
  - Patience Plus (🕐): 15% longer customer wait per level, max 5
  - Auto-Mop (🤖): 8% chance tasks auto-complete per level, max 3
  - Better Supplies (📦): +1 of each powerup per shift, max 3
- Upgrade costs scale (baseCost * costScale^level)
- CSS: lines 217-241 (upgrade-screen, upgrade-card styles)
- HTML: lines 376-383 (upgrade-screen structure)
- JS: UPGRADES config ~417, game.coins/upgrades state ~593
- Helper functions: getUpgradeCost(), getUpgradeEffect(), calculateCoins()
- Integration: getEffectiveTaskTime(), getEffectivePatience() apply bonuses
- Flow: result-screen → upgrade-screen → next shift

### Title Screen Redesign (a2h.6)
- Complete redesign with card/sign metaphor - brown wood-grain card with gold border
- Beaver mascot integrated into title logo with bobbing animation
- Title text with glowing text-shadow effect, split "Beaver's / Bathroom Blitz"
- Tagline and subtitle with styled typography
- Instructions section: green Buc-ee's themed panel with "How to Play" title
- Each instruction is flexbox with icon + text for clean alignment
- Gender buttons: 120px wide with large emoji icons, gold glow on selection
- Clock In button: pulsing glow animation + shine effect when enabled
- Mobile responsive breakpoint updates for smaller screens
- CSS: lines 13-55 (title screen styles, animations)
- HTML: lines 242-289 (title-card structure with beaver mascot)
- Animations: title-beaver-bob, gender-selected, start-pulse, start-shine

### Health Inspector Events (a2h.2.3)
- 25% chance per shift (after first shift) for inspector visit
- Inspector appears 20-40 seconds into shift with 3-second warning banner
- Blue-themed warning banner: "🔍 HEALTH INSPECTOR! 🔍"
- Inspector walks from exit door → center → each stall in order
- At each stall: 600ms pause, checks if dirty, shows ✓ or ❌
- Result: dirty stalls = -0.5 rating each; clean inspection = +100 pts, +0.3 rating
- Sound effects: ascending tones for warning, happy chord for pass, low buzz for fail
- Inspector visual: 🧑‍⚕️ emoji with "HEALTH" badge and clipboard
- CSS: lines 202-208 (#inspector-warning, .inspector classes)
- JS: spawnInspector() ~1090, updateInspector() ~1123, finishInspection() ~1222
- Game state: game.inspector, game.inspectorTimer, game.inspectorWarning
- CONFIG: inspectorChance, inspectorPenalty, inspectorBonus

### VIP Customers - High Stakes Visitors (a2h.2.1)
- Added VIP customer type: 12% spawn chance (not if urgent)
- Visual: golden glow on icon, gold shirt, ⭐ badge on character
- Golden patience bar border with glow effect
- 2x rating impact (both positive and negative)
- 2x score multiplier when cleaning after VIP
- Reduced patience (80% of normal)
- Tracked via `p.vip` on person and `stall.wasVip` for clean bonus
- Creates strategic priority: clean VIP stalls fast for big rewards
- CSS: lines 133-136 (.person.vip styles)
- JS: spawnCustomer ~line 778, rating impacts ~834/912, clean bonus ~1203

### Background Art and Floor Details (a2h.1.5)
- Changed floor from plain stripes to checkered tile pattern
- Used `repeating-conic-gradient` for alternating tile colors (#c4b89a, #d8cdb5)
- Added grout lines via `::before` with thin dark repeating gradients
- Added baseboard via `::after` at floor bottom (wood brown gradient)
- Inset shadow at top of floor for depth
- Wall background: gradient from light beige to darker, horizontal line texture
- Added "🦫 KEEP IT CLEAN!" wall sign in Buc-ee's green
- CSS Technique: `repeating-conic-gradient(from 0deg at 50% 50%, ...)` for checkered pattern
- Files: beaver.html CSS lines 71-72, 96-99, HTML line 255

### Customer Character Improvements (a2h.1.3)
- Added CSS art body to customers: torso + animated legs
- Kept emoji as "head" for variety, added shirt for torso
- 8 shirt color variations for visual variety
- Walking animation: head-bob + alternating leg movement
- Mood states: urgent (red glow, shake), happy (golden, bounce), disgusted (green hue)
- Files: beaver.html CSS lines 110-138, JS lines 768-794

### UI Elements Cartoony Styling (a2h.1.4)
- Updated HUD with wood-grain texture, depth shadows, styled hud-items
- Task panel: wood-grain bg, bouncy rounded borders, styled task buttons with gradients
- Powerup buttons: consistent gradient styling, cartoony count badges, wood-grain container
- Main buttons (.btn): gradient bg, depth shadows, hover lift effect
- Title screen: styled instructions box (green gradient), gender buttons (selectable gold glow)
- Result screens: stat cards with gradients, grade badges with colored glows, pick items styled
- Pattern: combine `inset box-shadow` + outer `box-shadow` for depth
- Pattern: gradients (3-stop 180deg) for 3D button look
- Files: beaver.html CSS lines 11-175 (various sections)

### Beaver Mascot Integration (a2h.1.2)
- Added CSS art beaver face in HUD area (48x48px)
- Pure CSS character: ears, eyes with pupils, nose, mouth, teeth, cheeks
- 4 mood states: idle (eyes look around), happy (squint + bounce), excited (big smile + fast bounce), worried (wide eyes + shake), sad (droopy)
- `setBeaverMood(mood, duration)` function triggers expression changes
- Events: happy on stall clean, excited on combo/save, sad on rating loss, worried during rush hour
- Files: beaver.html - CSS lines 30-65, HTML lines 206-220, JS line 372 (setBeaverMood)

### Stall Visual Overhaul (a2h.1.1)
- Replaced plain stall rectangles with cartoony wood-grain design
- Used CSS `repeating-linear-gradient` + `background-blend-mode:overlay` for wood texture
- Added depth with multiple gradients, `box-shadow`, and `::before` highlight
- Stall lights now have `radial-gradient` for 3D sphere effect
- Door has top ventilation slot (`::before`) and chunky rounded handle (`::after`)
- State colors (empty/occupied/dirty/cleaning) now use richer gradients
- Updated responsive breakpoint for smaller screens
- Files: beaver.html (CSS lines 36-57)

### Initial State (v4)
- Game is functional single-file HTML (~900 lines)
- Has gender selection, customer flow, cleaning mechanics
- Basic sound effects via Web Audio API
- Needs: more polish, cartoony visuals, deeper gameplay, story
