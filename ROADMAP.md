# Beaver's Bathroom Blitz - Roadmap

## Current State (v1.1)

**Live at:** https://beaversbathroomblitz.com

### Core Gameplay
- 6 shifts of increasing difficulty (5→10 stalls)
- Multi-step cleaning system (plunge, wipe, mop, restock TP)
- Customer flow with patience meters and thought bubbles
- Sink washing and paper towel stations
- Puddle/mess system (water, pee, vomit, muddy footprints)
- VIP customers, messy customers, clean freaks
- Inspector events with pass/fail consequences
- Rush hour events (flood of customers)
- Special named characters (Big Rig Bill, Soccer Mom, etc.)
- Beaver mascot walk power-up (customers follow mascot)

### Game Modes
- **Story Mode:** 6 shifts to earn the Golden Plunger
- **Endless Mode (Overtime):** Unlocks after completing all shifts, escalating difficulty
- **Daily Challenge:** Seeded RNG so all players get the same shift each day
- **Speed Clean Mini-Game:** 30-second bonus round after shifts 2, 4, 6

### Progression Systems
- **Employee Ranks:** Trainee → Cleaner → Senior → Supervisor → Manager → Legend
- **XP System:** Earn XP per shift based on performance
- **Coins:** Earned through gameplay, used for upgrades
- **Perks:** Permanent passive upgrades (Quick Scrub, Patience Plus, Auto-Assist)
- **Items:** Consumable power-ups (Brisket Sandwich, Icee Freeze, Beaver Nuggets, Beaver Walk)

### Engagement Features
- **Daily Rewards:** 7-day cycle (25→300 coins), streak multipliers (up to 3x), bonus items
- **Achievements:** 17 badges across categories (combos, cleaning, score, etc.)
- **Leaderboard:** Global high scores via Convex database
- **Social Sharing:** Canvas-based score cards for Instagram/TikTok

### Monetization
- **Premium Unlock ($2.99):** Unlocks Shifts 4-6, VIP customers, special characters, upgrades, daily challenge
- **Stripe Checkout:** Embedded checkout on-page (no redirect)
- **Purchase Restore:** Email-based restore via Stripe API lookup
- **Coupon Codes:** Free premium access codes (e.g., DAWSFRIEND)
- **Session Persistence:** Game saves when navigating to payment

### Buc-ee's Themed Items
| Item | Effect |
|------|--------|
| 🥩 Brisket Sandwich | 2x cleaning speed for 10s |
| 🧊 Icee Freeze | Slower spawns for 12s |
| 🍿 Beaver Nuggets | Instant clean one stall |
| 🦫 Beaver Walk | Mascot distracts customers for 8s |

### Technical
- Vite build system
- Convex real-time database (leaderboard, daily scores, coupons)
- PWA-ready (installable)
- Mobile-first responsive design
- Vercel deployment with auto-deploy
- Web Audio API procedural sounds
- Session persistence and auto-save

---

## In Progress

| Priority | Issue | Description |
|----------|-------|-------------|
| P0 | 5rl | Generate branding assets (app icon, favicon, social share) |
| P1 | 972 | Add legal pages (privacy, terms, contact) |
| P1 | byg | Update ROADMAP.md with current state |

---

## Planned Features

### Phase 2: More Mini-Games

| Mini-Game | Issue | Description | Status |
|-----------|-------|-------------|--------|
| **Speed Clean Challenge** | - | 30-second bonus round | ✅ Shipped |
| **Plunger Hero** | dzw | Rhythm game - time your plunges to the beat | Ready |
| **Towel Toss** | 1bw | Aim and throw towels to customers | Ready |
| **Inspection Prep** | rfn | Memory game - spot what's wrong before inspector | Ready |
| **Supply Run** | 1vc | Catch falling supplies, avoid hazards | Ready |
| **VIP Rush** | m50 | Only VIP customers, high stakes, big rewards | Ready |

### Phase 3: Content Expansion

| Feature | Description |
|---------|-------------|
| **Bathroom Locations** | Unlock new locations (Highway Stop, Airport, Stadium, etc.) |
| **Character Customization** | Different attendant outfits, accessories |
| **Special Events** | Holiday themes (Halloween bathroom, Christmas rush) |
| **Boss Battles** | Epic cleaning challenges (Tour Bus arrives, 50 customers!) |

### Phase 4: Monetization & Retention

| Feature | Description |
|---------|-------------|
| **Battle Pass** | Free + Premium tracks, seasonal content, $5-10 price point |
| **Ad Rewards** | Optional "watch ad for 2x coins" or extra life |
| **Cosmetic Shop** | Skins, themes, Beaver outfits (coins or premium currency) |
| **Weekly Tournaments** | Compete for top spot, prizes for winners |
| **Leaderboard Seasons** | Monthly resets with rewards |

### Phase 5: Social & Viral

| Feature | Description |
|---------|-------------|
| **Challenge Friends** | Send score challenges via link |
| **Multiplayer Mode** | Co-op bathroom cleaning (stretch goal) |
| **User Generated Content** | Custom bathroom layouts |
| **Streamer Mode** | Audience participation features |

---

## Visual Style

- **Aesthetic:** Retro Americana / 1950s travel stop
- **Color Palette:** Gold (#FFD700), Red (#C41E3A), Wood Brown (#5D4037)
- **Tagline:** "Dam Good Restrooms - Since 1982"
- **Mascot:** Beaver (distinct from Buc-ee's, no red cap)

### Branding Assets (In Progress - 5rl)
- App icon (1024x1024, 512x512, 192x192, 180x180)
- Favicon (16x16, 32x32, .ico)
- Social share image (1200x630)
- Title logo (PNG with transparency)

---

## Technical Improvements

### Completed
- [x] Sound system rewritten (procedural oscillators, no files)
- [x] Customer walking paths fixed (no clipping through sinks)
- [x] Mobile touch optimization (48px touch targets)
- [x] Session persistence and auto-save
- [x] AudioContext resume on user interaction

### Remaining
- [ ] Ambient bathroom audio (6bk - P3)
- [ ] Performance profiling on older devices
- [ ] PWA offline support

---

## Success Metrics

### Launch Goals
- [ ] 1,000 plays in first week
- [ ] 4+ star rating
- [x] < 3 second load time
- [x] Works on 95% of mobile browsers

### Growth Goals
- [ ] 10,000 monthly active users
- [ ] 5% day-1 retention
- [ ] Viral coefficient > 1 (shares lead to new players)
- [ ] Featured on gaming blogs/TikTok

---

## Inspiration & References

- **Cooking Fever** (450M downloads) - Dual currency, upgrades, content updates
- **Diner Dash** - Time management, customer satisfaction
- **Buc-ee's** - Texas roadside culture, clean bathroom reputation
- **Arcade classics** - Quick sessions, high score chasing

---

*Last updated: February 2026*
