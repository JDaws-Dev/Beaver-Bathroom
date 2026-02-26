# Beaver's Bathroom Blitz - Visual Style Guide

## Art Style Decision: **Retro Americana Arcade**

After evaluating the options, the chosen style is a **hybrid of Option D (Retro Americana) + Option B (Modern Cartoon)** - combining the vintage travel stop aesthetic with clean, mobile-friendly vector rendering.

### Why This Style?

1. **Theme Alignment**: The game is set at a Texas travel stop - the 1950s-60s roadside aesthetic is perfect
2. **Differentiation**: Few mobile games use this visual language, making it memorable
3. **Mobile Readability**: Vector rendering scales well on all screens
4. **Asset Production**: AI tools (Midjourney, DALL-E) handle retro styles well
5. **Arcade Heritage**: Matches the "Blitz" arcade game energy
6. **Brand Consistency**: Aligns with existing color palette and BRANDING-PROMPTS.md

---

## Core Visual Pillars

### 1. Retro Americana Foundation
- **Era**: 1950s-1960s American roadside aesthetic
- **Inspiration**: Vintage gas station signs, Route 66 postcards, diner menus
- **Typography**: Bold serif/slab-serif fonts, hand-lettered sign painter style
- **Shapes**: Rounded rectangles, starburst accents, badge/shield shapes
- **Texture**: Subtle wood grain, chrome accents, Formica patterns

### 2. Modern Arcade Execution
- **Rendering**: Clean vector edges, not pixel art
- **Colors**: Saturated but not neon, warm palette
- **Animation**: Smooth, bouncy (CSS ease-out-back easing)
- **Feedback**: Juicy micro-interactions, particle effects
- **Readability**: High contrast, clear silhouettes

### 3. Bathroom Comedy Tone
- **Characters**: Exaggerated expressions, cartoony proportions
- **Situations**: Silly, not gross - PG-rated humor
- **Mascot**: Helpful, eager Bucky - always optimistic

---

## Color Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Golden Yellow** | `#FFD700` | 255, 215, 0 | Primary accents, UI highlights, VIP |
| **Warm Amber** | `#F5A623` | 245, 166, 35 | Secondary gold, borders, titles |
| **Deep Red** | `#C41E3A` | 196, 30, 58 | Buttons, warnings, urgent |
| **Wood Brown** | `#5D4037` | 93, 64, 55 | Backgrounds, panels, borders |
| **Dark Wood** | `#3D2814` | 61, 40, 20 | Shadows, depth |
| **Cream White** | `#FFF8E1` | 255, 248, 225 | Clean surfaces, stalls |
| **Forest Green** | `#2E7D32` | 46, 125, 50 | Clean/success indicators |
| **Light Blue** | `#64B5F6` | 100, 181, 246 | Water, sinks, cleaning |
| **Tile Beige** | `#C4B89A` | 196, 184, 154 | Floor tiles |
| **Alert Yellow** | `#FDD835` | 253, 216, 53 | Dirty stalls, warnings |

### Color Relationships
- **Wood tones** dominate backgrounds (travel stop feel)
- **Gold/amber** for interactive elements and rewards
- **Red** sparingly for CTAs and urgency
- **Green/blue** for game states (clean = green, water = blue)

---

## Typography

### Primary Font: System UI (Current)
Using system fonts for performance. Future consideration: custom web font.

### Font Hierarchy
| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Title (H1) | 1.7em | Bold | `#F5A623` (gold) |
| Section (H2) | 1.4em | Bold | `#F5A623` |
| Body Text | 1em | Normal | `#EEE` |
| Labels | 0.6-0.8em | Normal | `#C9A86C` |
| HUD Values | 1.1em | Bold | `#FFF` |

### Text Effects
- **Titles**: `text-shadow: 3px 3px 0 #2a1a0a` (retro offset shadow)
- **Glow**: `0 0 15px rgba(245,166,35,0.4)` for emphasis
- **Depth**: Multiple shadow layers for carved/embossed look

---

## Character Design

### Bucky the Beaver (Mascot)
- **Silhouette**: Clear beaver shape - rounded body, flat tail (tail not visible in current view)
- **Face**: Big eyes, buck teeth, rosy cheeks, expressive
- **Outfit**: Light blue attendant uniform, gold "BUCKY" nametag (future asset)
- **Expressions**: 4 moods (idle, happy, worried, sad) - exaggerated for readability
- **Color**: Warm brown fur `#C9A86C` to `#8B6342` gradient

### Customers
- **Style**: Emoji heads on CSS art bodies (hybrid approach)
- **Bodies**: Simple torso + legs, 8 shirt color variations
- **Types**: Regular, VIP (gold), Urgent (red), Messy (brown), Clean (blue)
- **Special Characters**: Named characters with badges and personality
- **Animation**: Walk cycle with head bob and leg movement

### Future Character Assets (AI-Generated)
When producing dedicated character art:
- Maintain cartoony proportions (big heads, small bodies)
- Exaggerated expressions readable at small sizes
- Consistent line weight (3-4px scaled)
- Warm, saturated colors matching palette

---

## UI Element Style

### Panels & Cards
```css
/* Wood panel style */
background: linear-gradient(180deg, #5a4030 0%, #3d2814 50%, #2d1f0f 100%);
border: 5px solid #f5a623;
border-radius: 20px;
box-shadow:
  0 8px 30px rgba(0,0,0,0.5),           /* Outer depth */
  inset 0 2px 4px rgba(255,200,100,0.15), /* Inner highlight */
  inset 0 -4px 8px rgba(0,0,0,0.3);      /* Inner shadow */
```

### Buttons
```css
/* Primary button (red) */
background: linear-gradient(180deg, #e53935 0%, #d4380d 50%, #b71c1c 100%);
border: 4px solid #a12d0a;
border-radius: 14px;
box-shadow:
  inset 0 3px 0 rgba(255,255,255,0.25),
  inset 0 -3px 6px rgba(0,0,0,0.3),
  0 4px 8px rgba(0,0,0,0.35);
```

### Interactive Feedback
- **Hover**: Scale 1.05-1.08, translateY(-2px), brighter gradient
- **Active/Press**: Scale 0.95, inset shadow increases
- **Disabled**: Opacity 0.45, grayscale filter

### Wood Grain Texture
```css
/* Apply to panels */
background:
  repeating-linear-gradient(90deg, #4a3828 0px, #5a4838 2px, #3d2814 4px, #4a3828 6px),
  linear-gradient(180deg, #5a4838 0%, #3d2814 50%, #2d1f0f 100%);
background-blend-mode: overlay;
```

---

## Environment Art

### Stalls
- **Frame**: Dark wood with lighter door panel
- **Door**: Horizontal wood grain, round handle, top vent slot
- **States**: Green (empty), Red (occupied), Yellow (dirty), Blue (cleaning)
- **Light**: 3D sphere effect with `radial-gradient`
- **Dirty indicators**: Stink lines, buzzing fly, grime spots overlay

### Floor
- **Pattern**: Checkered tiles using `repeating-conic-gradient`
- **Colors**: Alternating beige tones `#C4B89A` / `#D8CDB5`
- **Grout**: Thin dark lines via pseudo-element
- **Baseboard**: Wood strip at bottom edge

### Walls
- **Color**: Light beige gradient (institutional bathroom feel)
- **Texture**: Subtle horizontal lines
- **Decor**: "KEEP IT CLEAN" sign in green

### Sinks & Towels
- **Material**: Chrome/white enamel gradients
- **Shape**: Rounded, friendly proportions
- **Grouping**: Sinks and towels adjacent in new layout

---

## Animation Guidelines

### Easing
- **Standard bounce**: `cubic-bezier(0.34, 1.56, 0.64, 1)` - for pop/bounce effects
- **Smooth**: `ease-out` - for movements
- **Urgent**: `ease-in-out` - for loops

### Duration
| Animation Type | Duration |
|---------------|----------|
| Click feedback | 0.15-0.2s |
| Pop-in | 0.25-0.4s |
| Float up (score) | 1s |
| Walk cycle | 0.25s/step |
| State transitions | 0.3s |

### Key Animations
- **Stall clean**: Celebrate bounce + door swing + sparkle burst
- **Combo build**: Escalating glow (fire → intense → legendary)
- **Character walk**: Head bob + alternating legs
- **Dirty pulse**: Shake + yellow blink

---

## Asset Production Plan

### Phase 1: CSS Art (Current)
Already implemented:
- Beaver mascot (pure CSS)
- Stall doors (CSS gradients)
- Character bodies (CSS)
- All UI elements (CSS)
- Floor tiles (CSS)

**Pros**: No external files, instant loading, scales perfectly
**Cons**: Limited detail, harder to iterate on design

### Phase 2: AI-Generated Assets (Recommended Next)
Priority order:
1. **App Icon** - Needed for PWA/mobile
2. **Bucky Character Sheet** - For marketing, expanded in-game use
3. **Title Logo** - Replace CSS title with designed logo
4. **Social Share Image** - For link previews

**Tools**: Midjourney or DALL-E using prompts from BRANDING-PROMPTS.md
**Format**: PNG with transparency, SVG where possible

### Phase 3: Sprite Sheets (Future)
If moving beyond emoji heads:
- Customer character sprites (8 directions)
- Animated cleaning effects
- Item/powerup icons

**Production**: AI-generated base → clean up in vector editor
**Format**: Sprite sheets for efficient loading

---

## Mobile Readability Guidelines

### Touch Targets
- Minimum 44x44px (Apple HIG) to 48x48px (Material Design)
- Already implemented in responsive CSS

### Text Sizing
- Body text: minimum 16px
- Labels: minimum 12px
- Scale down carefully at 420px breakpoint

### Contrast
- White text on dark backgrounds
- Gold (`#F5A623`) on dark brown passes WCAG AA
- Red buttons have white text for readability

### Visual Hierarchy
- Most important: Dirty stalls (yellow glow)
- Secondary: Score, combo, timer
- Ambient: Customer positions, rating

---

## File Reference

| File | Purpose | Lines (approx) |
|------|---------|---------------|
| `src/styles.css` | All visual styles | ~500 |
| `index.html` | HTML structure + CSS art elements | ~250 |
| `BRANDING-PROMPTS.md` | AI art generation prompts | ~180 |

---

## Summary

The visual style is **Retro Americana Arcade** - a 1950s Texas travel stop aesthetic rendered with clean, modern vector techniques. This gives the game:

1. **Distinct identity** that matches the theme
2. **Mobile-first readability** with clean scaling
3. **Achievable asset pipeline** using AI tools
4. **Room to grow** from CSS art to dedicated sprites

The current CSS art implementation is serviceable and matches the vision. Future asset work should maintain this direction while adding polish through AI-generated character art and icons.
