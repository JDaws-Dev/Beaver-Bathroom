# Progress & Learnings

This file maintains context between autonomous iterations.
**READ THIS FIRST** to understand recent decisions and roadblocks.

---

## Recent Context (Last 3 Iterations)

<!-- This section is a rolling window - keep only the last 3 entries -->

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

- Lines 1-175: CSS styles (includes beaver mascot styles)
- Lines 176-270: HTML structure (includes beaver element in HUD)
- Lines 271-end: JavaScript game logic
- Key functions: update(), renderPeople(), updateStallDOM(), clickStall(), setBeaverMood()

### CSS Art Techniques

- Wood grain: `repeating-linear-gradient(90deg,...)` with 2-4px stripe widths
- Depth: combine `box-shadow` (outer) + `inset box-shadow` (inner)
- 3D lights: `radial-gradient(circle at 30% 30%,...)` for sphere highlight
- Cartooniness: larger `border-radius`, bold borders, warm brown palette (#5d4037, #3e2723, #8d6e63)

### Testing

- No automated tests - manual browser testing required
- Test checklist: title screen, gender select, gameplay, stalls, sinks, customers, sounds

---

## Archive (Older Iterations)

<!-- Move entries here when they roll out of "Recent Context" -->

### Initial State (v4)
- Game is functional single-file HTML (~900 lines)
- Has gender selection, customer flow, cleaning mechanics
- Basic sound effects via Web Audio API
- Needs: more polish, cartoony visuals, deeper gameplay, story
