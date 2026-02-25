# Progress & Learnings

This file maintains context between autonomous iterations.
**READ THIS FIRST** to understand recent decisions and roadblocks.

---

## Recent Context (Last 3 Iterations)

<!-- This section is a rolling window - keep only the last 3 entries -->

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
- Mood states now visually distinct:
  - Urgent: red glow on icon, red shirt, body shakes
  - Happy: golden glow, bounce animation
  - Disgusted: green hue-rotate, recoil animation
- Improved patience bar: darker background, thicker border
- Thought bubbles: gradient bg, border, bounce-in animation
- Files: beaver.html CSS lines 110-138 (new styles), JS lines 768-794 (shirtColors), 1027-1041 (renderPeople body)

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

---

## Active Roadblocks

- Single-file constraint: all CSS/JS must stay in beaver.html
- No external assets: everything generated via CSS/SVG/Web Audio
- Must work offline in browser

---

## Project Learnings

Patterns, gotchas, and decisions that affect future work:

### Stack

- Pure HTML/CSS/JS - no frameworks, no build step
- Web Audio API for procedural sounds
- CSS animations for all motion
- Emojis for characters (considering SVG alternatives)

### Patterns

- `$('id')` helper for getElementById
- `game` object holds all state
- `CONFIG` object for tunable values
- Customer phases: enter → findStall → toStall → entering → inStall → exitStall → toSink → washing → exit

### Code Structure

- Lines 1-195: CSS styles (includes beaver mascot, customer character styles)
- Lines 196-290: HTML structure (includes beaver element in HUD)
- Lines 291-end: JavaScript game logic
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
