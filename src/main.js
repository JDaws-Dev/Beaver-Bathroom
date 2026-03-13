import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { createTitleScreenController } from "./titleScreen.js";
import { createSaveStateController } from "./saveState.js";
import { createLeaderboardsController } from "./leaderboards.js";
import { createSettingsController } from "./settingsController.js";
import { createDailyChallengeController } from "./dailyChallengeModal.js";
import { createMultiplayerPregameController } from "./multiplayerPregame.js";

// Initialize Convex client
const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

// Base URL for assets (handles Vite base path)
const BASE = import.meta.env.BASE_URL || '/';

// Auth state
let currentUser = null;
let deviceId = localStorage.getItem('beaverDeviceId');
let playerName = localStorage.getItem('beaverPlayerName') || '';

// Generate device ID if not exists
if (!deviceId) {
  deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem('beaverDeviceId', deviceId);
}

// Create or update user account
async function createOrUpdateUser(name) {
  try {
    const user = await convex.mutation(api.users.getOrCreateUser, {
      deviceId,
      name
    });
    if (user) {
      currentUser = { id: user._id, name: user.name, deviceId };
      playerName = user.name;
      localStorage.setItem('beaverPlayerName', user.name);
      localStorage.setItem('beaverUserId', user._id);
      updateAuthUI();
      return user;
    }
  } catch (e) {
    console.log('User creation failed:', e);
    // Fallback: just save name locally
    playerName = name;
    localStorage.setItem('beaverPlayerName', name);
  }
  return null;
}

// Google Sign-In helpers
function isGoogleSignedIn() {
  return !!localStorage.getItem('beaverGoogleId');
}

function decodeJwtPayload(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(base64);
  return JSON.parse(json);
}

function initGoogleSignIn() {
  if (typeof google === 'undefined' || !google.accounts) return;
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '237959676363-193pgpvofkbk19ndtt4bjnpn8abhr564.apps.googleusercontent.com');
  if (!clientId) return;
  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleSignIn,
    use_fedcm_for_prompt: false,
  });
}

async function handleGoogleSignIn(response) {
  const payload = decodeJwtPayload(response.credential);
  await handleGoogleSignInFromProfile(payload);
}

async function handleGoogleSignInFromProfile(payload) {
  try {
    const googleProfile = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
    };

    // Link/create user in Convex
    const user = await convex.mutation(api.users.signInWithGoogle, {
      ...googleProfile,
      deviceId,
    });

    if (user) {
      // Update local state
      localStorage.setItem('beaverGoogleId', googleProfile.googleId);
      localStorage.setItem('beaverGoogleEmail', googleProfile.email);
      localStorage.setItem('beaverAvatarUrl', googleProfile.avatarUrl || '');
      localStorage.setItem('beaverPlayerName', googleProfile.name);
      localStorage.setItem('beaverUserId', user._id);

      // Restore premium if this email has a purchase (cross-device support)
      if (user.hasPurchase && !isPremium()) {
        localStorage.setItem('beaverPremium', 'true');
        updatePremiumUI();
        console.log('Premium restored via Google sign-in purchase lookup');
      }

      currentUser = { id: user._id, name: googleProfile.name, deviceId };
      playerName = googleProfile.name;
      updateAuthUI();
    }

    // Resolve pending sign-in promise
    if (_googleSignInResolve) {
      _googleSignInResolve(true);
      _googleSignInResolve = null;
    }
  } catch (e) {
    console.log('Google sign-in failed:', e);
    if (_googleSignInResolve) {
      _googleSignInResolve(false);
      _googleSignInResolve = null;
    }
  }
}

let _googleSignInResolve = null;

function showSignInModal(onComplete) {
  // Create modal if it doesn't exist
  let modal = $('google-signin-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'google-signin-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
    modal.innerHTML = `
      <div style="background:linear-gradient(135deg,#5c3d1e,#8B6914);border-radius:20px;padding:32px 28px;max-width:360px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:3px solid #d4a543;">
        <div style="font-size:48px;margin-bottom:8px;">🦫</div>
        <h2 style="color:#ffe4a0;margin:0 0 8px;font-size:22px;font-family:inherit;">Save Your Progress!</h2>
        <p style="color:#ddd;margin:0 0 20px;font-size:14px;line-height:1.4;">Sign in to keep your scores across devices and see your name on the leaderboard.</p>
        <div id="google-signin-btn-container" style="display:flex;justify-content:center;margin-bottom:16px;"></div>
        <button id="google-signin-skip" style="background:none;border:none;color:#bbb;font-size:13px;cursor:pointer;text-decoration:underline;padding:8px;">Skip for now</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';

  // Render Google button
  const btnContainer = modal.querySelector('#google-signin-btn-container');
  btnContainer.innerHTML = '';
  const btn = document.createElement('button');
  btn.style.cssText = 'background:#fff;color:#333;border:1px solid #ddd;border-radius:24px;padding:10px 24px;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit;';
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.9 33.1 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.5 18.8 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.4 0-9.9-3.5-11.3-8.3l-6.5 5C9.5 39.5 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.7 39.5 44 34 44 24c0-1.3-.2-2.7-.4-3.9z"/></svg> Sign in with Google';
  btn.addEventListener('click', () => triggerGoogleSignIn());
  btnContainer.appendChild(btn);

  // Set up promise for Google callback
  const googlePromise = new Promise(resolve => { _googleSignInResolve = resolve; });

  // Skip button
  const skipBtn = modal.querySelector('#google-signin-skip');
  const handleSkip = () => {
    modal.style.display = 'none';
    skipBtn.removeEventListener('click', handleSkip);
    _googleSignInResolve = null;
    onComplete();
  };
  skipBtn.addEventListener('click', handleSkip);

  // On Google sign-in success
  googlePromise.then((success) => {
    modal.style.display = 'none';
    skipBtn.removeEventListener('click', handleSkip);
    onComplete();
  });
}

// Load existing user on startup
async function initAuth() {
  const savedUserId = localStorage.getItem('beaverUserId');
  const savedName = localStorage.getItem('beaverPlayerName');

  if (savedUserId && savedName) {
    currentUser = { id: savedUserId, name: savedName, deviceId };
    playerName = savedName;
  }

  // Try to sync with server if we have a deviceId
  if (deviceId && savedName) {
    try {
      const user = await convex.query(api.users.getUser, { deviceId });
      if (user) {
        currentUser = { id: user._id, name: user.name, deviceId };
        playerName = user.name;
        localStorage.setItem('beaverPlayerName', user.name);
      }
    } catch (e) {
      console.log('Could not sync user:', e);
    }
  }

  updateAuthUI();

  // Init Google Sign-In library (waits for GIS script to load)
  if (typeof google !== 'undefined' && google.accounts) {
    initGoogleSignIn();
  } else {
    window.addEventListener('load', () => {
      setTimeout(initGoogleSignIn, 500);
    });
  }
}

// Update auth UI elements
function updateAuthUI() {
  const nameDisplay = $('player-name-display');
  if (nameDisplay) {
    nameDisplay.textContent = currentUser ? currentUser.name : 'Guest';
  }

  // Update title screen sign-in row
  const signinBtn = $('title-google-signin');
  const signedInEl = $('title-signed-in');
  const signedInName = $('title-signed-in-name');
  if (signinBtn && signedInEl) {
    if (isGoogleSignedIn()) {
      signinBtn.style.display = 'none';
      signedInEl.style.display = 'inline';
      if (signedInName) signedInName.textContent = playerName || localStorage.getItem('beaverGoogleEmail') || 'Signed in';
    } else {
      signinBtn.style.display = 'inline-flex';
      signedInEl.style.display = 'none';
    }
  }
}

// Analytics tracking
function trackEvent(type, data = {}) {
  console.log('Tracking event:', type, data);
  try {
    convex.mutation(api.admin.logEvent, {
      type,
      deviceId,
      data,
    }).then(() => console.log('Event tracked:', type))
      .catch(e => console.error('Track event failed:', type, e));
  } catch (e) {
    console.error('Track event exception:', e);
  }
}

const leaderboardsController = createLeaderboardsController({
  $,
  convex,
  api,
  getPlayerName: () => playerName,
  getCurrentUserId: () => currentUser?.id || null,
  getTodayString,
});

const fetchLeaderboard = (...args) => leaderboardsController.fetchLeaderboard(...args);
const submitScore = (...args) => leaderboardsController.submitScore(...args);
const submitDailyScore = (...args) => leaderboardsController.submitDailyScore(...args);
const fetchDailyLeaderboard = (...args) => leaderboardsController.fetchDailyLeaderboard(...args);

// Track page visit for analytics
async function trackPageVisit() {
  try {
    const platform = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    const referrer = document.referrer || undefined;
    await convex.mutation(api.admin.trackVisit, {
      deviceId,
      platform,
      referrer,
    });
  } catch (e) {
    console.log('Visit tracking failed:', e);
  }
}

// Initialize
initAuth();
fetchLeaderboard();
trackPageVisit();

const SHIFT_NARRATIVES = [
  {name: 'Training Day', desc: "Welcome to Beaver's Travel Stop, rookie! Show us what you've got.", progress: "Day 1 of 6"},
  {name: 'The Lunch Rush', desc: "You survived training! But hungry travelers are coming...", progress: "Day 2 of 6"},
  {name: 'Tour Bus Season', desc: "Three buses just pulled in. The Golden Plunger awaits!", progress: "Day 3 of 6"},
  {name: 'Health Inspector', desc: "Word is the inspector might visit. Keep it spotless!", progress: "Day 4 of 6"},
  {name: 'Festival Weekend', desc: "BBQ fest crowd incoming! You're so close to that trophy...", progress: "Day 5 of 6"},
  {name: 'Championship Sunday', desc: "FINAL SHIFT! Earn the Golden Plunger and become a legend!", progress: "Final Day"},
];

// Visual themes per shift — applied to bathroom area
const SHIFT_THEMES = [
  {wall:'#f5f0e6', floor:'#d4c8a8', accent:'#8b7355', wallDetail:'rgba(200,190,170,0.3)', sign:'🧹 KEEP IT CLEAN!'},
  {wall:'#f0ece0', floor:'#c8b888', accent:'#a08050', wallDetail:'rgba(180,160,120,0.3)', sign:'☕ FRESH COFFEE NEXT DOOR'},
  {wall:'#e8e4d8', floor:'#bfb080', accent:'#907040', wallDetail:'rgba(160,140,100,0.35)', sign:'🚌 TOUR BUS PARKING →'},
  {wall:'#f8f8f0', floor:'#d8d0c0', accent:'#607860', wallDetail:'rgba(100,150,100,0.2)', sign:'✅ INSPECTION READY'},
  {wall:'#f5e8d0', floor:'#c8a870', accent:'#c05020', wallDetail:'rgba(200,100,50,0.15)', sign:'🎪 BBQ FEST TODAY!'},
  {wall:'#e0d8c8', floor:'#b8a068', accent:'#c8a020', wallDetail:'rgba(200,160,30,0.2)', sign:'🏆 CHAMPIONSHIP FINALS'},
];

// Beaver the Beaver mentor tips - shown on shift intro
const BEAVER_TIPS = [
  // Shift 1 (Training Day) tips - basics
  [
    "Mash those task buttons fast! Speed is everything in this business.",
    "Watch the patience bars - red means trouble!",
    "VIP customers have gold badges. They tip big but expect the best!",
  ],
  // Shift 2 (Lunch Rush) tips - combo focus
  [
    "Chain your cleans for combo streaks. 3x combos give speed boosts!",
    "Don't forget the sinks! Travelers notice dirty sinks too.",
    "Urgent customers move fast - help 'em quick or they'll leave mad!",
  ],
  // Shift 3 (Tour Bus) tips - volume handling
  [
    "Use your items wisely - 🥩 Brisket and 🍿 Nuggets are lifesavers!",
    "When it gets busy, prioritize VIPs and urgent customers.",
    "Watch for puddles on the floor - click 'em to mop 'em up!",
  ],
  // Shift 4 (Health Inspector) tips - cleanliness
  [
    "Health inspector might visit! Keep ALL stalls clean, not just busy ones.",
    "A perfect inspection gives bonus points AND rating!",
    "Clean stalls glow green. Any yellow means the inspector will notice!",
  ],
  // Shift 5 (Festival Weekend) tips - endurance
  [
    "Almost there! Spend coins on perks between shifts.",
    "Quick Scrub perk makes a HUGE difference late game.",
    "Rush hour is chaos - stay calm and keep clicking!",
  ],
  // Shift 6 (Championship) tips - final push
  [
    "This is it! Everything you've learned comes together now.",
    "Legendary 10x combos give massive bonuses - go for glory!",
    "You got this, rookie. Make Beaver's Travel Stop proud!",
  ],
];

const CONFIG = {
  shifts: [
    {stalls:5, sinks:2, spawnMin:4300, spawnMax:6400, occMin:2000, occMax:4000, duration:60},
    {stalls:6, sinks:2, spawnMin:2500, spawnMax:4000, occMin:1800, occMax:3500, duration:65},
    {stalls:7, sinks:3, spawnMin:2200, spawnMax:3500, occMin:1600, occMax:3200, duration:70},
    {stalls:8, sinks:3, spawnMin:1800, spawnMax:3000, occMin:1400, occMax:2800, duration:75},
    {stalls:9, sinks:3, spawnMin:1500, spawnMax:2500, occMin:1200, occMax:2500, duration:80},
    {stalls:10, sinks:4, spawnMin:1200, spawnMax:2000, occMin:1000, occMax:2200, duration:90},
  ],
  patience: 10000,
  walkSpeed: 120,
  baseTaskTime: 980,   // Base time per task (ms worth of progress needed)
  clickBoost: 68,      // Each mash tap reduces time by this much
  sinkCleanTime: 400,
  rushChance: 0.15,    // Chance of rush hour per shift
  inspectorChance: 0.25,  // Chance of inspector visit per shift
  inspectorPenalty: 0.5,  // Rating loss per dirty stall
  inspectorBonus: 100,    // Points for clean inspection
  // Combo milestones: [combo level, speed boost duration (ms), rating recovery, bonus points]
  comboMilestones: [
    { level: 3, speedBoost: 3000, rating: 0, points: 50, msg: '🔥 ON FIRE!' },
    { level: 5, speedBoost: 4000, rating: 0.1, points: 100, msg: '⚡ UNSTOPPABLE!' },
    { level: 10, speedBoost: 5000, rating: 0.3, points: 250, msg: '🌟 LEGENDARY!' },
  ],
  fightChance: 0.2,       // Chance per shift (after shift 1)
  fightPenalty: 0.4,       // Rating loss if brawl not stopped
  fightBonus: 75,          // Points for quick breakup
  fightArgueTime: 5000,    // ms before arguing becomes brawl
  fightBrawlDrain: 2,      // Patience drain multiplier on nearby customers
  towelSkipChance: 0.3,  // 30% of customers skip towel drying
  // Mess spawn chances per source (base values, scaled by shift)
  messChance: {
    sinkSplash: 0.018,   // Water puddle after sink use
    stallAccident: 0.045, // Pee puddle on angry leave
    walkwayRandom: 0.0045, // Random mess during rush
    vomitSick: 0.06,     // Vomit from sick customers
  },
  // Mess frequency scales up per shift: shift 0 = 0, shift 1 = 0.3, ... shift 5 = 1.0
  messScaleByShift: [0, 0.18, 0.3, 0.45, 0.62, 0.78],
};

// MESS_TYPES: Different mess varieties with severity and cleanup time
const MESS_TYPES = {
  water: {
    icon: '💧',
    name: 'Water Splash',
    severity: 1,
    cleanTime: 200,   // Quick clean
    points: 15,
    color: 'water',
    stinkLines: false,
    message: '💧 SPLASH!',
    sound: 'splash',
  },
  pee: {
    icon: '💦',
    name: 'Accident',
    severity: 2,
    cleanTime: 400,   // Medium clean
    points: 30,
    color: 'pee',
    stinkLines: true,
    message: '💦 ACCIDENT!',
    sound: 'splash',
  },
  vomit: {
    icon: '🤮',
    name: 'Vomit',
    severity: 3,
    cleanTime: 600,   // Long clean
    points: 50,
    color: 'vomit',
    stinkLines: true,
    message: '🤮 MESS!',
    sound: 'splat',
  },
  muddy: {
    icon: '👣',
    name: 'Muddy Prints',
    severity: 1,
    cleanTime: 250,
    points: 20,
    color: 'muddy',
    stinkLines: false,
    message: '👣 MUD!',
    sound: 'squish',
  },
};

// SKILLS: Earned automatically as you complete shifts (not purchased)
// Each shift unlocks/upgrades a skill in order
const SKILLS = [
  {
    id: 'scrub',
    name: 'Quick Scrub',
    icon: '🧹',
    desc: 'Clean faster',
    effect: 0.10,     // 10% faster per level
    maxLevel: 3,
    unlockText: 'The manager noticed your hustle!',
  },
  {
    id: 'patience',
    name: 'Patience Plus',
    icon: '🕐',
    desc: 'Customers wait longer',
    effect: 0.12,     // 12% more patience per level
    maxLevel: 3,
    unlockText: 'Word spreads about your service!',
  },
  {
    id: 'tips',
    name: 'Better Tips',
    icon: '💰',
    desc: 'Earn more coins',
    effect: 0.15,     // 15% more coins per level
    maxLevel: 3,
    unlockText: 'Customers appreciate quality!',
  },
];

// SKILL_UNLOCK_ORDER: Which skill unlocks/levels up after each shift
// Shift 0→1: scrub L1, 1→2: patience L1, 2→3: tips L1, 3→4: scrub L2, etc.
const SKILL_UNLOCK_ORDER = [
  'scrub', 'patience', 'tips', 'scrub', 'patience', 'tips', 'scrub', 'patience', 'tips'
];

// ITEMS: Consumable powerups (buy with coins for extra uses)
const ITEMS = [
  {
    id: 'speed',
    name: 'Brisket Sandwich',
    icon: '🥩',
    desc: 'Texas BBQ energy! 2x cleaning speed',
    duration: 10000,  // 10s
    cost: 30,
  },
  {
    id: 'slow',
    name: 'Icee Freeze',
    icon: '🧊',
    desc: 'Brain freeze! Slower spawns',
    duration: 12000,
    cost: 30,
  },
  {
    id: 'auto',
    name: 'Beaver Nuggets',
    icon: '🍿',
    desc: 'Instant clean one stall',
    cost: 75,
  },
  {
    id: 'mascot',
    name: 'Beaver Walk',
    icon: '🦫',
    desc: 'Beaver distracts customers!',
    duration: 8000,  // 8s
    cost: 60,
  },
];

// COSMETICS: All wearable items organized by category and tier
// Categories: headgear, uniforms, special
// Tiers: 0=starter, 1-5=rank-gated progression
const COSMETICS = [
  // === HEADGEAR (12) ===
  {id:'hat-none', category:'headgear', name:'No Hat', icon:'🚫', unlock:'default', tier:0},
  {id:'hat-cap', category:'headgear', name:"Classic Cap", icon:'🧢', unlock:'default', tier:0},
  {id:'hat-visor', category:'headgear', name:'Sun Visor', icon:'🧢', unlock:'shift1', desc:'Complete Shift 1 or buy', tier:1, cost:75},
  {id:'hat-hardhat', category:'headgear', name:'Hard Hat', icon:'⛑️', unlock:'shift2', desc:'Complete Shift 2 or buy', tier:1, cost:100},
  {id:'hat-beanie', category:'headgear', name:'Beanie', icon:'🧶', unlock:'clean50', desc:'Clean 50 stalls or buy', tier:2, cost:150},
  {id:'hat-cowboy', category:'headgear', name:'Cowboy Hat', icon:'🤠', unlock:'shift4', desc:'Complete Shift 4', tier:2, premium:true},
  {id:'hat-sombrero', category:'headgear', name:'Sombrero', icon:'🎩', unlock:'serve200', desc:'Serve 200 customers or buy', tier:3, cost:350},
  {id:'hat-chef', category:'headgear', name:"Chef's Toque", icon:'👨‍🍳', unlock:'clean100', desc:'Clean 100 stalls', tier:3, premium:true},
  {id:'hat-party', category:'headgear', name:'Party Hat', icon:'🥳', unlock:'streak7', desc:'7-day login streak', tier:4, premium:true},
  {id:'hat-viking', category:'headgear', name:'Viking Helmet', icon:'⚔️', unlock:'combo25', desc:'Get a 25x combo', tier:4, premium:true},
  {id:'hat-crown', category:'headgear', name:'Golden Crown', icon:'👑', unlock:'allS', desc:'All S-grades', tier:5, premium:true},
  {id:'hat-tophat', category:'headgear', name:'Top Hat', icon:'🎩', unlock:'legend', desc:'Reach Legend rank', tier:5, premium:true},

  // === UNIFORMS (12) ===
  {id:'shirt-polo', category:'uniforms', name:'Red Polo', icon:'👕', unlock:'default', tier:0},
  {id:'shirt-none', category:'uniforms', name:'No Shirt', icon:'🚫', unlock:'default', tier:0},
  {id:'shirt-artios', category:'uniforms', name:'Cool Tee', icon:'🎨', unlock:'default', tier:0},
  {id:'shirt-overalls', category:'uniforms', name:'Overalls', icon:'👷', unlock:'clean25', desc:'Clean 25 stalls or buy', tier:1, cost:75},
  {id:'shirt-hawaiian', category:'uniforms', name:'Hawaiian', icon:'🌺', unlock:'shift3', desc:'Complete Shift 3 or buy', tier:2, cost:150},
  {id:'shirt-lab-coat', category:'uniforms', name:'Lab Coat', icon:'🥼', unlock:'inspect5', desc:'Pass 5 inspections or buy', tier:2, cost:200},
  {id:'shirt-camo', category:'uniforms', name:'Camo Vest', icon:'🫒', unlock:'serve300', desc:'Serve 300 customers or buy', tier:3, cost:350},
  {id:'shirt-flannel', category:'uniforms', name:'Flannel', icon:'🪓', unlock:'shift5', desc:'Complete Shift 5', tier:3, premium:true},
  {id:'shirt-raincoat', category:'uniforms', name:'Raincoat', icon:'🧥', unlock:'coins300', desc:'Buy for 300 coins', tier:3, cost:300},
  {id:'shirt-jersey', category:'uniforms', name:'Jersey #82', icon:'🏈', unlock:'combo20', desc:'Get a 20x combo', tier:4, premium:true},
  {id:'shirt-hoodie', category:'uniforms', name:'Hoodie', icon:'🧥', unlock:'coins300', desc:'Buy for 300 coins', tier:4, cost:300},
  {id:'shirt-tuxedo', category:'uniforms', name:'Tuxedo', icon:'🤵', unlock:'allS', desc:'All S-grades', tier:5, premium:true},
  {id:'shirt-tank', category:'uniforms', name:'Tank Top', icon:'🩱', unlock:'coins100', desc:'Buy for 100 coins', tier:1, cost:100},
  {id:'shirt-denim', category:'uniforms', name:'Denim Jacket', icon:'🧥', unlock:'coins200', desc:'Buy for 200 coins', tier:2, cost:200},
  {id:'shirt-letterman', category:'uniforms', name:'Letterman', icon:'🏅', unlock:'coins400', desc:'Buy for 400 coins', tier:3, cost:400},
  {id:'shirt-poncho', category:'uniforms', name:'Poncho', icon:'🪕', unlock:'coins500', desc:'Buy for 500 coins', tier:4, cost:500},

  // === HEADGEAR SHOP ITEMS ===
  {id:'hat-bucket', category:'headgear', name:'Bucket Hat', icon:'🪣', unlock:'coins100', desc:'Buy for 100 coins', tier:1, cost:100},
  {id:'hat-headband', category:'headgear', name:'Headband', icon:'💪', unlock:'coins150', desc:'Buy for 150 coins', tier:2, cost:150},
  {id:'hat-fedora', category:'headgear', name:'Fedora', icon:'🎩', unlock:'coins300', desc:'Buy for 300 coins', tier:3, cost:300},
  {id:'hat-pirate', category:'headgear', name:'Pirate Hat', icon:'🏴‍☠️', unlock:'coins500', desc:'Buy for 500 coins', tier:4, cost:500},

  // === SPECIAL (6 + 4 shop) ===
  {id:'special-superhero', category:'special', name:'Superhero', icon:'🦸', unlock:'combo15', desc:'Get a 15x combo or buy', tier:2, cost:250},
  {id:'special-disco', category:'special', name:'Disco Beaver', icon:'🪩', unlock:'serve500', desc:'Serve 500 customers or buy', tier:3, cost:600},
  {id:'special-santa', category:'special', name:'Santa Beaver', icon:'🎅', unlock:'streak21', desc:'21-day login streak', tier:4, premium:true},
  {id:'special-uncle-sam', category:'special', name:'Uncle Sam', icon:'🇺🇸', unlock:'shift6', desc:'Complete Shift 6', tier:4, premium:true},
  {id:'special-zombie', category:'special', name:'Zombie Beaver', icon:'🧟', unlock:'coins1000', desc:'Buy for 1000 coins', tier:5, cost:1000},
  {id:'special-astronaut', category:'special', name:'Astronaut', icon:'🧑‍🚀', unlock:'legend', desc:'Reach Legend rank', tier:5, premium:true},
  {id:'special-ninja', category:'special', name:'Ninja Beaver', icon:'🥷', unlock:'coins400', desc:'Buy for 400 coins', tier:2, cost:400},
  {id:'special-pirate', category:'special', name:'Pirate Beaver', icon:'🏴‍☠️', unlock:'coins700', desc:'Buy for 700 coins', tier:3, cost:700},
  {id:'special-cowboy-full', category:'special', name:'Full Cowboy', icon:'🤠', unlock:'coins800', desc:'Buy for 800 coins', tier:4, cost:800},
  {id:'special-robot', category:'special', name:'Robo-Beaver', icon:'🤖', unlock:'coins1200', desc:'Buy for 1200 coins', tier:5, cost:1200},

  // === SEASON 2 SPECIALS ===
  {id:'special-luchador', category:'special', name:'Luchador', icon:'🤼', unlock:'fight5', desc:'Break up 5 fights or buy', tier:3, cost:500},
  {id:'special-rockstar', category:'special', name:'Rockstar', icon:'🎸', unlock:'score10k', desc:'Score 10,000+ in one game or buy', tier:3, cost:600},
  {id:'special-wizard', category:'special', name:'Wizard Beaver', icon:'🧙', unlock:'clean500', desc:'Clean 500 stalls total or buy', tier:4, cost:700},
  {id:'special-candyman', category:'special', name:'Candy Man', icon:'🍭', unlock:'perfect3', desc:'3 perfect shifts (5-star) or buy', tier:4, cost:800},
  {id:'special-madscientist', category:'special', name:'Mad Scientist', icon:'🧪', unlock:'inspect10', desc:'Ace 10 inspections or buy', tier:4, cost:900},
];

// Tier names and rank requirements
const COSMETIC_TIERS = [
  {tier:0, name:'Starter', icon:'🧹', rankRequired:'Trainee'},
  {tier:1, name:'Trainee', icon:'🧹', rankRequired:'Trainee'},
  {tier:2, name:'Attendant', icon:'🪠', rankRequired:'Attendant'},
  {tier:3, name:'Supervisor', icon:'📋', rankRequired:'Supervisor'},
  {tier:4, name:'Manager', icon:'🎩', rankRequired:'Manager'},
  {tier:5, name:'Legend', icon:'👑', rankRequired:'Legend'},
];

let cosmeticState = JSON.parse(localStorage.getItem('beaverCosmetics') || 'null') || {
  unlocked: ['hat-none','hat-cap','shirt-polo','shirt-none','shirt-artios'],
  equipped: {hat:'hat-cap', shirt:'shirt-polo', special:null},
  lastSeen: Date.now(),
};
// Migrate from activeLook format back to multi-equip
if (cosmeticState.activeLook && !cosmeticState.equipped) {
  const id = cosmeticState.activeLook;
  cosmeticState.equipped = {hat:'hat-cap', shirt:'shirt-polo', special:null};
  if (id.startsWith('hat-')) cosmeticState.equipped.hat = id;
  else if (id.startsWith('shirt-')) cosmeticState.equipped.shirt = id;
  else if (id.startsWith('special-')) cosmeticState.equipped.special = id;
  delete cosmeticState.activeLook;
}
// Ensure equipped has all slots
if (!cosmeticState.equipped) cosmeticState.equipped = {hat:'hat-cap', shirt:'shirt-polo', special:null};
delete cosmeticState.equipped.accessory;
delete cosmeticState.equipped.fur;
if (!cosmeticState.equipped.special) cosmeticState.equipped.special = null;
if (!cosmeticState.lastSeen) cosmeticState.lastSeen = Date.now();
// Remove old fur/color from unlocked defaults
cosmeticState.unlocked = cosmeticState.unlocked.filter(id => !id.startsWith('color-'));
// Ensure all default (tier 0) items are always unlocked
COSMETICS.filter(c => c.unlock === 'default').forEach(c => {
  if (!cosmeticState.unlocked.includes(c.id)) cosmeticState.unlocked.push(c.id);
});

function saveCosmeticState() {
  localStorage.setItem('beaverCosmetics', JSON.stringify(cosmeticState));
}

function getComboSpriteSrc() {
  const e = cosmeticState.equipped;
  // Special overrides everything
  if (e.special) return `${BASE}images/cosmetics/${e.special}.png`;
  // Combo sprite: hat + shirt
  const hat = e.hat || 'hat-cap';
  const shirt = e.shirt || 'shirt-polo';
  return `${BASE}images/cosmetics/combo-${hat}-${shirt}.png`;
}


function getOpponentSpriteSrc() {
  const c = mpState.opponentCosmetics;
  if (!c) return BASE + 'images/cosmetics/combo-hat-cap-shirt-polo.png';
  if (c.special) return BASE + 'images/cosmetics/' + c.special + '.png';
  const hat = c.hat || 'hat-cap';
  const shirt = c.shirt || 'shirt-polo';
  return BASE + 'images/cosmetics/combo-' + hat + '-' + shirt + '.png';
}

function applyCosmeticsToBeaver() {
  const e = cosmeticState.equipped;
  const src = getComboSpriteSrc();
  // Fallback chain: combo → shirt-base → hat-only → base
  const fallbacks = [
    `${BASE}images/cosmetics/shirt-base-${e.shirt || 'shirt-polo'}.png`,
    `${BASE}images/cosmetics/${e.hat || 'hat-cap'}.png`,
    `${BASE}images/cosmetics/base.png`,
  ];
  const setWithFallback = (el) => {
    if (!el) return;
    let idx = 0;
    el.onerror = () => {
      if (idx < fallbacks.length) { el.src = fallbacks[idx++]; }
      else { el.onerror = null; }
    };
    el.src = src;
  };
  setWithFallback(document.getElementById('beaver-sprite'));
  setWithFallback(document.getElementById('title-beaver-sprite'));
}

function updateAccessoryOverlay(id, src) {
  let el = document.getElementById(id);
  if (!src) {
    if (el) el.style.display = 'none';
    return;
  }
  if (!el) return;
  el.src = src;
  el.style.display = 'block';
}

function checkCosmeticUnlocks() {
  let newUnlocks = [];
  const dr = JSON.parse(localStorage.getItem('beaverDailyReward') || '{}');
  const streak = dr.streak || 0;
  const rank = getCurrentRank();
  for (const c of COSMETICS) {
    if (cosmeticState.unlocked.includes(c.id)) continue;
    if (c.premium && !isPremium()) continue;
    // Check tier gating — player must have reached the required rank
    if (c.tier > 0) {
      const tierInfo = COSMETIC_TIERS[c.tier];
      if (tierInfo) {
        const reqRank = EMPLOYEE_RANKS.find(r => r.name === tierInfo.rankRequired);
        if (reqRank && employeeXP < reqRank.xp) continue;
      }
    }
    let earned = false;
    switch(c.unlock) {
      case 'shift1': earned = achievementStats.shiftsCompleted >= 1; break;
      case 'shift2': earned = achievementStats.shiftsCompleted >= 2; break;
      case 'shift3': earned = achievementStats.shiftsCompleted >= 3; break;
      case 'shift4': earned = achievementStats.shiftsCompleted >= 4; break;
      case 'shift5': earned = achievementStats.shiftsCompleted >= 5; break;
      case 'shift6': earned = achievementStats.shiftsCompleted >= 6; break;
      case 'clean25': earned = achievementStats.totalCleaned >= 25; break;
      case 'clean50': earned = achievementStats.totalCleaned >= 50; break;
      case 'clean100': earned = achievementStats.totalCleaned >= 100; break;
      case 'clean200': earned = achievementStats.totalCleaned >= 200; break;
      case 'serve100': earned = achievementStats.totalServed >= 100; break;
      case 'serve200': earned = achievementStats.totalServed >= 200; break;
      case 'serve300': earned = achievementStats.totalServed >= 300; break;
      case 'serve500': earned = achievementStats.totalServed >= 500; break;
      case 'combo15': earned = achievementStats.maxCombo >= 15; break;
      case 'combo20': earned = achievementStats.maxCombo >= 20; break;
      case 'combo25': earned = achievementStats.maxCombo >= 25; break;
      case 'streak7': earned = streak >= 7; break;
      case 'streak14': earned = streak >= 14; break;
      case 'streak21': earned = streak >= 21; break;
      case 'streak30': earned = streak >= 30; break;
      case 'allS': earned = achievementStats.sGrades >= 6; break;
      case 'gradeS': earned = achievementStats.sGrades >= 1; break;
      case 'legend': earned = rank.name === 'Legend'; break;
      case 'manager': earned = rank.name === 'Manager' || rank.name === 'Legend'; break;
      case 'inspect5': earned = (achievementStats.perfectInspections || 0) >= 5; break;
      case 'inspect10': earned = (achievementStats.perfectInspections || 0) >= 10; break;
      case 'fight5': earned = (achievementStats.fightsWon || 0) >= 5; break;
      case 'score10k': earned = (achievementStats.highestScore || 0) >= 10000; break;
      case 'clean500': earned = achievementStats.totalCleaned >= 500; break;
      case 'perfect3': earned = (achievementStats.perfectShifts || 0) >= 3; break;
      case 'insane6': earned = localStorage.getItem('beaverInsane6') === 'true'; break;
      // coins are purchased manually, not auto-unlocked
    }
    if (earned) {
      cosmeticState.unlocked.push(c.id);
      newUnlocks.push(c);
      trackEvent('outfitter_unlock', { item: c.id, name: c.name, category: c.category, method: c.unlock });
    }
  }
  if (newUnlocks.length > 0) {
    saveCosmeticState();
    updateOutfitterBadge();
    for (const c of newUnlocks) {
      floatMessage(`🎉 Unlocked: ${c.icon} ${c.name}!`, window.innerWidth / 2, 80, 'good');
    }
  }
  return newUnlocks;
}

// NEW badge system — count unseen items
function getNewItemCount() {
  return cosmeticState.unlocked.filter(id => {
    const c = COSMETICS.find(co => co.id === id);
    return c && c.unlock !== 'default';
  }).length - (cosmeticState.seenCount || 0);
}

function updateOutfitterBadge() {
  const count = getNewItemCount();
  const badge = $('outfitter-badge');
  const avatarBadge = $('avatar-badge');
  const avatarEl = document.querySelector('.player-row-avatar');
  if (badge) {
    badge.style.display = count > 0 ? 'flex' : 'none';
    badge.textContent = count;
  }
  if (avatarBadge) {
    avatarBadge.style.display = count > 0 ? 'flex' : 'none';
    avatarBadge.textContent = count;
  }
  if (avatarEl) {
    avatarEl.classList.toggle('has-new', count > 0);
  }
}

function markOutfitterSeen() {
  const nonDefaultCount = cosmeticState.unlocked.filter(id => {
    const c = COSMETICS.find(co => co.id === id);
    return c && c.unlock !== 'default';
  }).length;
  cosmeticState.seenCount = nonDefaultCount;
  cosmeticState.lastSeen = Date.now();
  saveCosmeticState();
  updateOutfitterBadge();
}

const TASKS = [
  {id:'plunge', icon:'🪠', label:'Plunge', chance:0.3},
  {id:'wipe', icon:'🧽', label:'Scrub', chance:0.75},
  {id:'mop', icon:'🧹', label:'Mop', chance:0.45},
  {id:'tp', icon:'🧻', label:'Restock', chance:0.4},
];

const THOUGHTS = {
  impatient: ['Hurry up!', 'Come ON!', 'Ugh...', 'NEED TO GO!', 'Waiting...', 'Tick tock!'],
  desperate: ['EMERGENCY!', 'HURRY!!!', 'CAN\'T WAIT!', 'PLEASE!', 'NOW!!!'],
  happy: ['Ahh, nice!', 'Nice & clean!', 'Perfect!', 'Spotless!', 'Thanks!'],
  disgusted: ['Gross!', 'Ewww!', 'Nasty...', 'Yuck!', 'Really?!'],
};

const CUSTOMERS_MALE = ['👨','👴','👦','🧔','👨‍🦰','👨‍🦱','👨‍🦳','👱‍♂️','🧑‍🦰','👨‍🦲'];
const CUSTOMERS_FEMALE = ['👩','👵','👧','👩‍🦰','👩‍🦱','👩‍🦳','👱‍♀️','👩‍🦲','🧑‍🦱','👩‍🔧'];

const CUSTOMER_VISUALS_MALE = [
  { hair:'cap', accessory:'none', build:'broad', face:'neutral', headShape:'round', skin:'#f2c39b', hairColor:'#6d4c41' },
  { hair:'short', accessory:'none', build:'average', face:'soft', headShape:'oval', skin:'#d9a37c', hairColor:'#3e2723' },
  { hair:'buzz', accessory:'none', build:'broad', face:'smirk', headShape:'square', skin:'#b97a56', hairColor:'#4e342e' },
  { hair:'part', accessory:'none', build:'tall', face:'stern', headShape:'oval', skin:'#8d5a3c', hairColor:'#212121' },
  { hair:'beanie', accessory:'none', build:'stocky', face:'soft', headShape:'round', skin:'#f0d2b6', hairColor:'#5d4037' },
  { hair:'spike', accessory:'none', build:'athletic', face:'smirk', headShape:'square', skin:'#c98d66', hairColor:'#8d6e63' },
  { hair:'short', accessory:'none', build:'petite', face:'neutral', headShape:'oval', skin:'#e0b18a', hairColor:'#4e342e' },
  { hair:'buzz', accessory:'none', build:'stocky', face:'stern', headShape:'square', skin:'#7a4f35', hairColor:'#212121' },
];

const CUSTOMER_VISUALS_FEMALE = [
  { hair:'pageboy', accessory:'none', build:'average', face:'soft', headShape:'oval', skin:'#f2c39b', hairColor:'#5d4037' },
  { hair:'flip', accessory:'none', build:'petite', face:'smile', headShape:'round', skin:'#d9a37c', hairColor:'#8d5a46' },
  { hair:'beehive', accessory:'none', build:'tall', face:'neutral', headShape:'oval', skin:'#b97a56', hairColor:'#3e2723' },
  { hair:'bouffant-pony', accessory:'none', build:'athletic', face:'stern', headShape:'square', skin:'#8d5a3c', hairColor:'#212121' },
  { hair:'set-curls', accessory:'none', build:'average', face:'smile', headShape:'round', skin:'#f0d2b6', hairColor:'#4e342e' },
  { hair:'pageboy', accessory:'none', build:'tall', face:'smirk', headShape:'square', skin:'#c98d66', hairColor:'#212121' },
  { hair:'flip', accessory:'none', build:'petite', face:'soft', headShape:'round', skin:'#e0b18a', hairColor:'#b36b4d' },
  { hair:'bouffant-pony', accessory:'none', build:'athletic', face:'neutral', headShape:'oval', skin:'#7a4f35', hairColor:'#3e2723' },
];

// Named special characters that create memorable moments
const SPECIAL_CUSTOMERS = [
  // Male bathroom characters
  {name:'Big Rig Bill', icon:'🧔', badge:'🚚', gender:'male', chance:0.06,
   shirt:{top:'#8b4513',bot:'#5d3a1a',border:'#3d2510'}, // Brown trucker
   patience:1.3, messiness:1, // Patient but messy
   thoughts:{enter:'Long haul!',happy:'Now THAT\'S a clean restroom!',impatient:'Seen worse...'}},
  {name:'Road Trip Randy', icon:'👨‍🦰', badge:'🚗', gender:'male', chance:0.05,
   shirt:{top:'#ff6b6b',bot:'#ee5a5a',border:'#d43d3d'}, // Red vacation shirt
   patience:0.5, messiness:0, // Super urgent, been driving 8 hours
   thoughts:{enter:'8 HOURS!',happy:'Finally!',impatient:'CAN\'T WAIT!'}},
  {name:'Business Bob', icon:'👨', badge:'💼', gender:'male', chance:0.05,
   shirt:{top:'#2c3e50',bot:'#1a252f',border:'#0d1318'}, // Suit
   patience:0.7, messiness:-1, // Tight schedule but clean
   thoughts:{enter:'Quick stop.',happy:'Efficient!',impatient:'Time is money!'}},
  {name:'Weekend Warrior', icon:'👱‍♂️', badge:'🎣', gender:'male', chance:0.05,
   shirt:{top:'#27ae60',bot:'#1e8449',border:'#145a32'}, // Outdoor green
   patience:1.4, messiness:0, // Relaxed, headed to the lake
   thoughts:{enter:'Lake time!',happy:'Great pit stop!',impatient:'No rush...'}},
  {name:'Trucker Tom', icon:'🧔', badge:'⛽', gender:'male', chance:0.04,
   shirt:{top:'#34495e',bot:'#2c3e50',border:'#1a252f'}, // Gray work shirt
   patience:1.5, messiness:1, // Bill's buddy, very patient
   thoughts:{enter:'Bill here?',happy:'Top notch!',impatient:'Eh, it happens.'}},
  // Female bathroom characters
  {name:'Soccer Mom', icon:'👩', badge:'⚽', gender:'female', chance:0.06,
   shirt:{top:'#9b59b6',bot:'#8e44ad',border:'#6c3483'}, // Purple athleisure
   patience:0.6, messiness:-1, // Rushed but clean
   thoughts:{enter:'Practice in 20!',happy:'Perfect!',impatient:'Kids are waiting!'}},
  {name:'Tourist Tina', icon:'👩‍🦰', badge:'📸', gender:'female', chance:0.05,
   shirt:{top:'#f39c12',bot:'#d68910',border:'#b9770e'}, // Bright tourist
   patience:1.2, messiness:-1, // Taking photos, distracted but clean
   thoughts:{enter:'THE famous restrooms?!',happy:'Instagram perfect!',impatient:'One more pic...'}},
  {name:'Snack Sally', icon:'👱‍♀️', badge:'🍫', gender:'female', chance:0.05,
   shirt:{top:'#e74c3c',bot:'#c0392b',border:'#922b21'}, // Red
   patience:1.0, messiness:-1, // Here for snacks, distracted
   thoughts:{enter:'Snack time!',happy:'Clean AND they have fudge!',impatient:'Where\'s the jerky aisle?'}},
  {name:'Road Queen', icon:'👩‍🦱', badge:'👑', gender:'female', chance:0.04,
   shirt:{top:'#e91e63',bot:'#c2185b',border:'#880e4f'}, // Pink
   patience:0.8, messiness:0, // Standards, but fair
   thoughts:{enter:'Pit stop, y\'all!',happy:'LOVE this place!',impatient:'Hmm...'}}
];

function getCustomerVisualProfile(gender, specialName) {
  if (specialName) {
    const specials = {
      'Big Rig Bill': { hair:'cap', accessory:'none', build:'stocky', face:'stern', headShape:'square', skin:'#c58b63', hairColor:'#4e342e' },
      'Road Trip Randy': { hair:'spike', accessory:'none', build:'athletic', face:'smirk', headShape:'oval', skin:'#d9a37c', hairColor:'#bf360c' },
      'Business Bob': { hair:'part', accessory:'none', build:'tall', face:'stern', headShape:'oval', skin:'#b97a56', hairColor:'#212121' },
      'Weekend Warrior': { hair:'visor', accessory:'none', build:'athletic', face:'soft', headShape:'round', skin:'#e0b18a', hairColor:'#6d4c41' },
      'Trucker Tom': { hair:'beanie', accessory:'none', build:'stocky', face:'neutral', headShape:'square', skin:'#8d5a3c', hairColor:'#3e2723' },
      'Soccer Mom': { hair:'bouffant-pony', accessory:'none', build:'athletic', face:'neutral', headShape:'oval', skin:'#d9a37c', hairColor:'#5d4037' },
      'Tourist Tina': { hair:'flip', accessory:'none', build:'petite', face:'smile', headShape:'round', skin:'#f2c39b', hairColor:'#b36b4d' },
      'Snack Sally': { hair:'pageboy', accessory:'none', build:'average', face:'smile', headShape:'round', skin:'#f0d2b6', hairColor:'#6d4c41' },
      'Road Queen': { hair:'set-curls', accessory:'none', build:'tall', face:'smirk', headShape:'square', skin:'#b97a56', hairColor:'#212121' },
    };
    if (specials[specialName]) return specials[specialName];
  }
  const source = gender === 'male' ? CUSTOMER_VISUALS_MALE : CUSTOMER_VISUALS_FEMALE;
  return { ...pick(source) };
}

function getCustomerVisualStyle(p) {
  const visual = p.visual || {};
  const shirt = p.shirt || { top:'#5a8dd8', bot:'#3d6cb8', border:'#2d5090' };
  const jacketTop = p.vip ? '#fff4b0' : shirt.top;
  const jacketBot = p.vip ? '#d7b24a' : shirt.bot;
  return [
    `--shirt-top:${jacketTop}`,
    `--shirt-bot:${jacketBot}`,
    `--shirt-border:${shirt.border}`,
    `--skin-tone:${visual.skin || '#d9a37c'}`,
    `--hair-color:${visual.hairColor || '#5d4037'}`,
  ].join(';');
}

const CLEAN_MESSAGES = [
  'Sparkling! ✨', 'Spotless!', 'Super clean!', 'Fresh!', 'Pristine!',
  'Squeaky clean!', 'Like new!', 'Beaver-approved!', 'Road-trip ready!',
  'Rest stop royalty!', 'Travel stop quality!', 'Tail-slapping clean!'
];

const GAME_OVER_MESSAGES = [
  "The manager's taking your badge back...",
  "Maybe bathroom work isn't for you...",
  "Beaver looks disappointed. Real disappointed.",
  "Time to update your resume...",
  "The Golden Plunger slips away...",
];

const WIN_MESSAGES = [
  "You did it, rookie! The Golden Plunger is yours!",
  "From new hire to bathroom legend in 6 shifts!",
  "Beaver would be proud. Actually, Beaver IS proud!",
  "The cleanest restrooms this side of Texas!",
  "You've earned your place at Beaver's Travel Stop!",
];

// ACHIEVEMENTS: Badges earned for milestones
const ACHIEVEMENTS = [
  // First timer achievements
  {id:'first_shift', name:'Punch In', icon:'🎉', desc:'Complete your first shift', check: (g,s) => s.shiftsCompleted >= 1},
  {id:'golden_plunger', name:'Golden Plunger', icon:'🪠', desc:'Complete all 6 shifts', check: (g,s) => s.shiftsCompleted >= 6},

  // Combo achievements
  {id:'combo_3', name:'On Fire', icon:'🔥', desc:'Reach a 3x combo', check: (g,s) => s.maxCombo >= 3},
  {id:'combo_5', name:'Unstoppable', icon:'⚡', desc:'Reach a 5x combo', check: (g,s) => s.maxCombo >= 5},
  {id:'combo_10', name:'Legendary', icon:'🌟', desc:'Reach a 10x combo', check: (g,s) => s.maxCombo >= 10},

  // Cleaning achievements
  {id:'clean_10', name:'Getting Started', icon:'🧹', desc:'Clean 10 stalls total', check: (g,s) => s.totalCleaned >= 10},
  {id:'clean_50', name:'Scrub Master', icon:'🧽', desc:'Clean 50 stalls total', check: (g,s) => s.totalCleaned >= 50},
  {id:'clean_100', name:'Sanitation Expert', icon:'🚽', desc:'Clean 100 stalls total', check: (g,s) => s.totalCleaned >= 100},

  // Score achievements
  {id:'score_1000', name:'Point Collector', icon:'💯', desc:'Score 1,000 points in one shift', check: (g,s) => g.score >= 1000},
  {id:'score_5000', name:'High Scorer', icon:'🎯', desc:'Score 5,000 points in one shift', check: (g,s) => g.score >= 5000},
  {id:'score_10000', name:'Score Legend', icon:'🥇', desc:'Score 10,000 points in one shift', check: (g,s) => g.score >= 10000},

  // Perfect achievements
  {id:'perfect_shift', name:'Perfect Shift', icon:'✨', desc:'Complete a shift with S grade', check: (g,s) => s.sGrades >= 1},
  {id:'perfect_inspect', name:'Spotless', icon:'🔍', desc:'Pass a health inspection perfectly', check: (g,s) => s.perfectInspections >= 1},

  // Save achievements
  {id:'save_1', name:'Close Call', icon:'😅', desc:'Clean a stall just in time', check: (g,s) => s.totalSaves >= 1},
  {id:'save_10', name:'Clutch Player', icon:'💪', desc:'Make 10 "just in time" saves', check: (g,s) => s.totalSaves >= 10},

  // Service achievements
  {id:'serve_50', name:'Customer Service', icon:'👥', desc:'Serve 50 customers total', check: (g,s) => s.totalServed >= 50},
  {id:'serve_100', name:'Lodge Legend', icon:'🦫', desc:'Serve 100 customers total', check: (g,s) => s.totalServed >= 100},
  {id:'serve_500', name:'Hospitality King', icon:'👑', desc:'Serve 500 customers total', check: (g,s) => s.totalServed >= 500},

  // Fight achievements
  {id:'peacemaker', name:'Peacemaker', icon:'🛡️', desc:'Break up a customer fight', check: (g,s) => (s.fightsWon || 0) >= 1},
  {id:'bouncer', name:'Bouncer', icon:'🥊', desc:'Break up 5 customer fights', check: (g,s) => (s.fightsWon || 0) >= 5},
  {id:'fight_club', name:'Fight Club', icon:'🏆', desc:'Break up 10 customer fights', check: (g,s) => (s.fightsWon || 0) >= 10},

  // Inspection achievements
  {id:'inspector_5', name:'Health Nut', icon:'🔍', desc:'Ace 5 health inspections', check: (g,s) => (s.perfectInspections || 0) >= 5},

  // Mastery achievements
  {id:'clean_500', name:'Clean Machine', icon:'🤖', desc:'Clean 500 stalls total', check: (g,s) => s.totalCleaned >= 500},
  {id:'perfect_3', name:'Consistent', icon:'💎', desc:'Complete 3 perfect 5-star shifts', check: (g,s) => (s.perfectShifts || 0) >= 3},
  {id:'combo_25', name:'Combo God', icon:'👼', desc:'Reach a 25x combo', check: (g,s) => s.maxCombo >= 25},
  {id:'all_s', name:'Flawless', icon:'🏅', desc:'Get S-grade on all 6 shifts', check: (g,s) => s.sGrades >= 6},
  {id:'save_50', name:'Last Second Hero', icon:'🦸', desc:'Make 50 "just in time" saves', check: (g,s) => s.totalSaves >= 50},
];

// EMPLOYEE RANKS: Progression system
// XP earned = score * grade multiplier (same as coins)
const EMPLOYEE_RANKS = [
  {id:'trainee', name:'Trainee', icon:'🧹', xp:0, perk:'Starting your journey', color:'#888'},
  {id:'attendant', name:'Attendant', icon:'🪠', xp:500, perk:'Unlocked rank badge display', color:'#c9a86c'},
  {id:'supervisor', name:'Supervisor', icon:'📋', xp:2000, perk:'Earned a name tag', color:'#4fc3f7'},
  {id:'manager', name:'Manager', icon:'🎩', xp:5000, perk:'Gold HUD accents unlocked', color:'#ffd700'},
  {id:'legend', name:'Legend', icon:'👑', xp:10000, perk:'Legendary title styling', color:'#ff4081'},
];

// Load employee rank data from localStorage
let employeeXP = parseInt(localStorage.getItem('beaverEmployeeXP')) || 0;

function getCurrentRank() {
  // Find highest rank the player qualifies for
  for (let i = EMPLOYEE_RANKS.length - 1; i >= 0; i--) {
    if (employeeXP >= EMPLOYEE_RANKS[i].xp) return EMPLOYEE_RANKS[i];
  }
  return EMPLOYEE_RANKS[0];
}

function getNextRank() {
  const current = getCurrentRank();
  const idx = EMPLOYEE_RANKS.findIndex(r => r.id === current.id);
  return idx < EMPLOYEE_RANKS.length - 1 ? EMPLOYEE_RANKS[idx + 1] : null;
}

function getRankProgress() {
  const current = getCurrentRank();
  const next = getNextRank();
  if (!next) return 1; // Max rank
  const rangeXP = next.xp - current.xp;
  const progressXP = employeeXP - current.xp;
  return Math.min(1, progressXP / rangeXP);
}

function addEmployeeXP(amount) {
  const oldRank = getCurrentRank();
  employeeXP += amount;
  localStorage.setItem('beaverEmployeeXP', employeeXP);
  const newRank = getCurrentRank();
  if (newRank.id !== oldRank.id) {
    showRankUp(newRank);
  }
  updateRankDisplay();
}

// Notification queue system - show banners one at a time
const notificationQueue = [];
let notificationShowing = false;
let paymentModalActive = false; // Block notifications while payment modal is showing

function queueNotification(type, data) {
  notificationQueue.push({ type, data });
  processNotificationQueue();
}

function processNotificationQueue() {
  // Don't show notifications while payment modal is active
  if (notificationShowing || paymentModalActive || notificationQueue.length === 0) return;

  notificationShowing = true;
  const notif = notificationQueue.shift();

  if (notif.type === 'rank') {
    showRankUpBanner(notif.data);
  } else if (notif.type === 'achievement') {
    showAchievementBanner(notif.data);
  }
}

function onNotificationDone() {
  notificationShowing = false;
  // Small delay before showing next
  setTimeout(() => processNotificationQueue(), 300);
}

function showRankUp(rank) {
  queueNotification('rank', rank);
}

function showRankUpBanner(rank) {
  const banner = document.createElement('div');
  banner.className = 'rank-up-banner';
  banner.innerHTML = `
    <div class="rank-up-icon">${rank.icon}</div>
    <div class="rank-up-info">
      <div class="rank-up-label">PROMOTED!</div>
      <div class="rank-up-name">${rank.name}</div>
      <div class="rank-up-perk">${rank.perk}</div>
    </div>
  `;
  document.body.appendChild(banner);
  playRankUpSound();
  haptic('success');
  setTimeout(() => banner.classList.add('show'), 50);
  setTimeout(() => {
    banner.classList.remove('show');
    setTimeout(() => {
      banner.remove();
      onNotificationDone();
    }, 500);
  }, 3500);
}

function playRankUpSound() {
  if (isMuted || isSfxMuted) return;
  initAudio();
  // Grand fanfare for promotion
  const freqs = [392, 523, 659, 784, 1047]; // G4, C5, E5, G5, C6
  freqs.forEach((f, i) => {
    setTimeout(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.value = 0.2 * sfxVolume;
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    }, i * 100);
  });
}

function updateRankDisplay() {
  const rankBadge = $('player-rank');
  const rankProgress = $('rank-progress-fill');
  const rankXP = $('rank-xp');

  if (!rankBadge) return;

  const rank = getCurrentRank();
  const next = getNextRank();

  rankBadge.innerHTML = `<span class="rank-icon">${rank.icon}</span> ${rank.name}`;
  rankBadge.style.color = rank.color;

  if (rankProgress) {
    rankProgress.style.width = (getRankProgress() * 100) + '%';
    rankProgress.style.background = rank.color;
  }

  if (rankXP) {
    if (next) {
      rankXP.textContent = `${employeeXP.toLocaleString()} / ${next.xp.toLocaleString()} XP`;
    } else {
      rankXP.textContent = `${employeeXP.toLocaleString()} XP (MAX)`;
    }
  }

  // Apply rank-based styling
  applyRankStyling(rank);
}

function applyRankStyling(rank) {
  const container = $('game-container');
  if (!container) return;

  // Remove old rank classes
  EMPLOYEE_RANKS.forEach(r => container.classList.remove('rank-' + r.id));
  // Add current rank class
  container.classList.add('rank-' + rank.id);
}

// Load achievement stats from localStorage
let achievementStats = JSON.parse(localStorage.getItem('beaverAchievementStats') || 'null') || {
  shiftsCompleted: 0,
  maxCombo: 0,
  totalCleaned: 0,
  totalServed: 0,
  totalSaves: 0,
  sGrades: 0,
  perfectInspections: 0,
};
let unlockedAchievements = JSON.parse(localStorage.getItem('beaverAchievements') || '[]');

function saveAchievementData() {
  localStorage.setItem('beaverAchievementStats', JSON.stringify(achievementStats));
  localStorage.setItem('beaverAchievements', JSON.stringify(unlockedAchievements));
}

function checkAchievements() {
  let newUnlocks = [];
  for (const ach of ACHIEVEMENTS) {
    if (unlockedAchievements.includes(ach.id)) continue;
    if (ach.check(game, achievementStats)) {
      unlockedAchievements.push(ach.id);
      newUnlocks.push(ach);
    }
  }
  if (newUnlocks.length > 0) {
    saveAchievementData();
    showAchievementUnlock(newUnlocks[0]); // Show first new unlock
  }
}

function showAchievementUnlock(ach) {
  queueNotification('achievement', ach);
}

function showAchievementBanner(ach) {
  const banner = document.createElement('div');
  banner.className = 'achievement-unlock';
  banner.innerHTML = `
    <div class="achievement-icon">${ach.icon}</div>
    <div class="achievement-info">
      <div class="achievement-label">Achievement Unlocked!</div>
      <div class="achievement-name">${ach.name}</div>
    </div>
  `;
  document.body.appendChild(banner);
  playAchievementSound();
  haptic('success');
  setTimeout(() => banner.classList.add('show'), 50);
  setTimeout(() => {
    banner.classList.remove('show');
    setTimeout(() => {
      banner.remove();
      onNotificationDone();
    }, 500);
  }, 2500);
}

function playCosmeticUnlockSound() {
  if (isMuted || isSfxMuted) return;
  initAudio();
  // Sparkly reveal: rising shimmer + chime
  const notes = [587, 740, 880, 1175, 1397]; // D5, F#5, A5, D6, F#6
  notes.forEach((f, i) => {
    setTimeout(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.value = 0.12 * sfxVolume;
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    }, i * 100);
  });
}

function playAchievementSound() {
  if (isMuted || isSfxMuted) return;
  initAudio();
  // Ascending triumphant arpeggio
  const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
  freqs.forEach((f, i) => {
    setTimeout(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.value = 0.15 * sfxVolume;
      gain.gain.exponentialDecayTo?.(0.01, 0.3) || gain.gain.setValueAtTime(0.15 * sfxVolume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }, i * 80);
  });
}

function openAchievementsModal() {
  // Achievements are premium-only
  if (!isPremium()) {
    showPaywallModal('landing');
    return;
  }
  const modal = $('achievements-modal');
  const grid = $('achievements-grid');
  grid.innerHTML = ACHIEVEMENTS.map(ach => {
    const unlocked = unlockedAchievements.includes(ach.id);
    return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
        <div class="ach-icon">${unlocked ? ach.icon : '🔒'}</div>
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
      </div>
    `;
  }).join('');

  // Update counter
  const counter = $('achievements-count');
  if (counter) counter.textContent = `${unlockedAchievements.length}/${ACHIEVEMENTS.length}`;

  modal.classList.add('active');
  playClick();
}

function closeAchievementsModal() {
  $('achievements-modal').classList.remove('active');
}

// =============================================================================
// =============================================================================
// DAILY LOGIN REWARD SYSTEM
// =============================================================================

const DAILY_REWARDS = [
  { day: 1, coins: 25,  label: '25 🪙' },
  { day: 2, coins: 50,  label: '50 🪙' },
  { day: 3, coins: 75,  label: '75 🪙' },
  { day: 4, coins: 100, label: '100 🪙' },
  { day: 5, coins: 150, label: '150 🪙' },
  { day: 6, coins: 200, label: '200 🪙' },
  { day: 7, coins: 300, label: '300 🪙 + 🍿', bonus: 'beaverNuggets' },
];

// Streak multipliers
function getStreakMultiplier(streak) {
  if (streak >= 30) return { mult: 3, label: '3x LEGENDARY!' };
  if (streak >= 14) return { mult: 2, label: '2x BONUS' };
  if (streak >= 7) return { mult: 1.5, label: '1.5x BONUS' };
  return { mult: 1, label: '' };
}

// Load daily reward state
let dailyRewardState = JSON.parse(localStorage.getItem('beaverDailyReward') || 'null') || {
  lastClaimDate: null,
  streak: 0,
  pendingCoins: 0, // Coins to add to next game session
};

// Get today's date as YYYY-MM-DD string
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

// Check if reward is available
function checkDailyReward() {
  const today = getTodayString();
  if (dailyRewardState.lastClaimDate === today) {
    return null; // Already claimed today
  }

  // Calculate if streak continues or resets
  let newStreak = 1;
  if (dailyRewardState.lastClaimDate) {
    const lastDate = new Date(dailyRewardState.lastClaimDate);
    const todayDate = new Date(today);
    const dayDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (dayDiff === 1) {
      // Consecutive day - continue streak
      newStreak = dailyRewardState.streak + 1;
    } else if (dayDiff > 1) {
      // Streak broken
      newStreak = 1;
    }
  }

  // Calculate reward (cycle through 7 days)
  const dayIndex = ((newStreak - 1) % 7);
  const reward = DAILY_REWARDS[dayIndex];
  const streakInfo = getStreakMultiplier(newStreak);
  const finalCoins = Math.floor(reward.coins * streakInfo.mult);

  return {
    day: dayIndex + 1,
    streak: newStreak,
    baseCoins: reward.coins,
    finalCoins: finalCoins,
    label: reward.label,
    bonus: reward.bonus,
    streakLabel: streakInfo.label,
    streakMult: streakInfo.mult,
  };
}

// Show the daily reward modal
function showDailyRewardModal() {
  // Daily rewards are premium-only
  if (!isPremium()) return false;

  const reward = checkDailyReward();
  if (!reward) return false;

  const modal = $('daily-reward-modal');
  if (!modal) return false;

  // Populate reward info
  $('dr-day-num').textContent = reward.day;
  $('dr-streak').textContent = reward.streak;
  $('dr-coins').textContent = '+' + reward.finalCoins;

  // Show streak multiplier badge if applicable
  const streakBadge = $('dr-streak-badge');
  if (reward.streakMult > 1 && streakBadge) {
    streakBadge.textContent = reward.streakLabel;
    streakBadge.classList.add('visible');
  } else if (streakBadge) {
    streakBadge.classList.remove('visible');
  }

  // Show bonus item if day 7
  const bonusEl = $('dr-bonus');
  if (reward.bonus && bonusEl) {
    bonusEl.textContent = '+ Free Beaver Nuggets!';
    bonusEl.classList.add('visible');
  } else if (bonusEl) {
    bonusEl.classList.remove('visible');
  }

  // Build calendar preview
  const calendar = $('dr-calendar');
  if (calendar) {
    calendar.innerHTML = DAILY_REWARDS.map((r, i) => {
      const isPast = i < reward.day - 1;
      const isToday = i === reward.day - 1;
      return `<div class="dr-cal-day ${isPast ? 'claimed' : ''} ${isToday ? 'today' : ''}">
        <span class="dr-cal-num">${i + 1}</span>
        <span class="dr-cal-reward">${r.coins}🪙</span>
      </div>`;
    }).join('');
  }

  modal.classList.add('active');
  playDailyRewardSound();
  return true;
}

// Claim the reward
function claimDailyReward() {
  const reward = checkDailyReward();
  if (!reward) return;

  // Update state
  dailyRewardState.lastClaimDate = getTodayString();
  dailyRewardState.streak = reward.streak;
  dailyRewardState.pendingCoins += reward.finalCoins;

  // Apply bonus item for day 7
  if (reward.bonus === 'beaverNuggets') {
    dailyRewardState.pendingBonusItem = 'auto';  // Gives a free Beaver Nuggets (auto-clean)
  }

  // Save to localStorage
  localStorage.setItem('beaverDailyReward', JSON.stringify(dailyRewardState));

  // Close modal with celebration
  haptic('success');
  $('daily-reward-modal').classList.remove('active');

  // Add a coin animation to title screen
  showCoinCollect(reward.finalCoins);
}

// Apply pending coins and bonus items to game start
function applyPendingDailyCoins() {
  if (dailyRewardState.pendingCoins > 0) {
    game.coins += dailyRewardState.pendingCoins;
    dailyRewardState.pendingCoins = 0;
  }
  // Apply pending bonus item (Beaver Nuggets from day 7)
  if (dailyRewardState.pendingBonusItem === 'auto') {
    game.powerups.auto++;
    dailyRewardState.pendingBonusItem = null;
  }
  localStorage.setItem('beaverDailyReward', JSON.stringify(dailyRewardState));
}

// Show coin collect animation on title
function showCoinCollect(amount) {
  const float = document.createElement('div');
  float.className = 'coin-float';
  float.textContent = '+' + amount + ' 🪙';
  const titleCard = document.querySelector('.title-card');
  if (titleCard) {
    titleCard.appendChild(float);
    setTimeout(() => float.remove(), 1500);
  }
}

// Play celebratory sound for daily reward
function playDailyRewardSound() {
  if (isMuted || isSfxMuted) return;
  initAudio();
  // Ascending coin collect arpeggio
  const freqs = [392, 523, 659, 784]; // G4, C5, E5, G5
  freqs.forEach((f, i) => {
    setTimeout(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.value = 0.12 * sfxVolume;
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    }, i * 60);
  });
}

// =============================================================================
// PREMIUM / PAYWALL
// =============================================================================

// Stripe publishable key (live)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51RtgcnKgkIT46sg7XmLrt97ZPHRVx7D00UEJsobuDjUmSBg8JS7cfPpF716cXtcn9xLikK29AnzH22BG3bk51XmV00cN5bpZ7G';

// Stripe checkout instance
let stripeCheckout = null;

// Check if user has premium
function isPremium() {
  return localStorage.getItem('beaverPremium') === 'true';
}

// Update premium UI indicator (border color)
function updatePremiumUI() {
  const container = $('game-container');
  if (container) {
    container.classList.toggle('is-premium', isPremium());
  }
}

// Set premium status (called after successful Stripe payment)
function setPremium() {
  localStorage.setItem('beaverPremium', 'true');
  updatePremiumUI();
}

// Show paywall modal
// context: 'milestone' (after shift 3) or 'landing' (from title screen)
function showPaywallModal(context = 'milestone') {
  const modal = $('paywall-modal');
  if (!modal) return;
  // Reset to info view
  $('pw-info-view').style.display = '';
  $('pw-checkout-view').style.display = 'none';
  $('pw-restore-view').style.display = 'none';
  // Reset coupon code input area
  const codeArea = $('pw-code-input-area');
  const codeToggle = $('pw-show-code-btn');
  const codeInput = $('pw-coupon-input');
  const codeError = $('pw-code-error');
  if (codeArea) codeArea.classList.add('hidden');
  if (codeToggle) codeToggle.textContent = 'Have a code?';
  if (codeInput) codeInput.value = '';
  if (codeError) codeError.classList.add('hidden');

  // Update content based on context
  const title = $('pw-title');
  const message = $('pw-message');
  if (context === 'landing') {
    if (title) title.textContent = 'Go Premium!';
    if (message) message.textContent = 'Unlock the full Beaver\'s Bathroom experience!';
  } else {
    // milestone context - after completing 3 shifts
    if (title) title.textContent = "You're a Natural!";
    if (message) message.textContent = "You've completed 3 shifts and proven yourself as a bathroom attendant!";
  }

  modal.classList.add('active');
  playClick();
}

// Close paywall modal
function closePaywallModal() {
  const modal = $('paywall-modal');
  if (modal) modal.classList.remove('active');
  // Clean up checkout if exists
  if (stripeCheckout) {
    stripeCheckout.destroy();
    stripeCheckout = null;
  }
}

// Handle purchase button click - start embedded checkout
async function handlePurchase() {
  // Switch to checkout view
  $('pw-info-view').style.display = 'none';
  $('pw-checkout-view').style.display = '';
  $('checkout-loading').style.display = 'flex';
  $('checkout-container').innerHTML = '';

  try {
    // Get checkout session from Convex
    const returnUrl = window.location.origin + window.location.pathname + '?session_id={CHECKOUT_SESSION_ID}';
    const { clientSecret } = await convex.action(api.stripe.createCheckoutSession, {
      deviceId,
      returnUrl,
    });

    // Initialize Stripe
    const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

    // Create embedded checkout
    stripeCheckout = await stripe.initEmbeddedCheckout({
      clientSecret,
    });

    // Hide loading, mount checkout
    $('checkout-loading').style.display = 'none';
    stripeCheckout.mount('#checkout-container');

  } catch (e) {
    console.error('Checkout error:', e);
    // Show error, go back to info view
    $('checkout-loading').innerHTML = '<p style="color:#e53935">Failed to load checkout. Please try again.</p>';
    setTimeout(() => {
      $('pw-info-view').style.display = '';
      $('pw-checkout-view').style.display = 'none';
    }, 2000);
  }
}

// Handle back button in checkout view
function handleCheckoutBack() {
  // Clean up checkout
  if (stripeCheckout) {
    stripeCheckout.destroy();
    stripeCheckout = null;
  }
  // Switch back to info view
  $('pw-info-view').style.display = '';
  $('pw-checkout-view').style.display = 'none';
}

// Show restore view when restore button is clicked
function showRestoreView() {
  $('pw-info-view').style.display = 'none';
  $('pw-restore-view').style.display = '';
  $('pw-restore-email').value = '';
  $('pw-restore-email').focus();
  hideRestoreStatus();
}

// Hide restore view and go back to info view
function hideRestoreView() {
  $('pw-restore-view').style.display = 'none';
  $('pw-info-view').style.display = '';
  hideRestoreStatus();
}

// Show restore status message
function showRestoreStatus(msg, isError) {
  const status = $('pw-restore-status');
  status.textContent = msg;
  status.classList.remove('hidden', 'error', 'success');
  status.classList.add(isError ? 'error' : 'success');
}

// Hide restore status message
function hideRestoreStatus() {
  const status = $('pw-restore-status');
  status.classList.add('hidden');
  status.classList.remove('error', 'success');
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Handle restore check - verify purchase by email
async function handleRestoreCheck() {
  const email = $('pw-restore-email').value.trim();

  // Validate email
  if (!email) {
    showRestoreStatus('Please enter your email address.', true);
    return;
  }
  if (!isValidEmail(email)) {
    showRestoreStatus('Please enter a valid email address.', true);
    return;
  }

  // Show loading state
  const btn = $('pw-restore-check-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Checking...';
  btn.disabled = true;
  hideRestoreStatus();

  try {
    // Check for purchase with backend
    const result = await convex.action(api.stripe.checkPurchaseByEmail, { email });

    if (result.found) {
      setPremium();
      showRestoreStatus('Purchase found! Premium unlocked.', false);
      playWin();

      // Close modal after brief delay
      setTimeout(() => {
        closePaywallModal();
        floatMessage('🎉 Premium Restored!', window.innerWidth / 2, 100, 'good');
        titleScreenController.updateTitleButtonStates();
      }, 1500);
      return true;
    } else {
      showRestoreStatus('No purchase found for this email. Make sure you\'re using the same email you used to pay.', true);
      return false;
    }

  } catch (e) {
    console.error('Restore check error:', e);
    showRestoreStatus('Could not verify purchase. Please try again later.', true);
    return false;
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// Check URL params on page load for returning from Stripe
async function checkStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  if (sessionId) {
    console.log('Stripe return detected, session:', sessionId);
    try {
      // Verify the session with backend
      const result = await convex.action(api.stripe.verifyCheckoutSession, { sessionId });
      console.log('Verification result:', result, 'Local deviceId:', deviceId);

      if (result.paid) {
        // Payment confirmed - set premium regardless of deviceId match
        // (deviceId mismatch can happen if user cleared localStorage)
        setPremium();

        // Store email for future restore
        if (result.customerEmail) {
          localStorage.setItem('beaverPurchaseEmail', result.customerEmail);
        }

        // Clean up URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Update title screen buttons to show unlocked state
        titleScreenController.updateTitleButtonStates();
        updatePremiumUI();

        // Show payment success modal
        setTimeout(() => {
          playWin();
          haptic('success');
          showPaymentSuccessModal();
        }, 500);
      } else {
        console.log('Payment not confirmed yet');
      }
    } catch (e) {
      console.error('Stripe return verification failed:', e);
      // Still try to show something to user
      floatMessage('Verifying payment...', window.innerWidth / 2, 100, 'good');
    }
  }

  // Also check legacy ?premium=success for backwards compatibility
  if (params.get('premium') === 'success') {
    setPremium();
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    titleScreenController.updateTitleButtonStates();
    setTimeout(() => {
      playWin();
      showPaymentSuccessModal();
    }, 500);
  }
}

// Toggle coupon code input visibility
function toggleCouponInput() {
  const inputArea = $('pw-code-input-area');
  const toggleBtn = $('pw-show-code-btn');
  if (inputArea && toggleBtn) {
    inputArea.classList.toggle('hidden');
    toggleBtn.textContent = inputArea.classList.contains('hidden') ? 'Have a code?' : 'Hide';
  }
}

// Redeem coupon code for premium access
async function redeemCoupon() {
  const input = $('pw-coupon-input');
  const errorEl = $('pw-code-error');
  const redeemBtn = $('pw-redeem-btn');

  if (!input || !errorEl || !redeemBtn) return;

  const code = input.value.trim();
  if (!code) {
    errorEl.textContent = 'Please enter a code';
    errorEl.classList.remove('hidden');
    return;
  }

  // Show loading state
  const originalText = redeemBtn.textContent;
  redeemBtn.textContent = '...';
  redeemBtn.disabled = true;
  errorEl.classList.add('hidden');

  try {
    const result = await convex.mutation(api.coupons.redeemCode, { code });

    if (result.valid) {
      // Success! Grant premium
      setPremium();
      closePaywallModal();
      playWin();
      floatMessage('🎉 Premium Unlocked!', window.innerWidth / 2, 100, 'good');
      titleScreenController.updateTitleButtonStates();

      // Clear input
      input.value = '';
    } else {
      // Show error
      if (result.reason === 'expired') {
        errorEl.textContent = 'This code has expired';
      } else {
        errorEl.textContent = 'Invalid code';
      }
      errorEl.classList.remove('hidden');
      playBad();
    }
  } catch (e) {
    console.error('Coupon redemption error:', e);
    errorEl.textContent = 'Could not verify code. Try again.';
    errorEl.classList.remove('hidden');
    playBad();
  } finally {
    redeemBtn.textContent = originalText;
    redeemBtn.disabled = false;
  }
}

const titleScreenController = createTitleScreenController({
  $,
  achievements: ACHIEVEMENTS,
  isPremium,
  playClick,
  fetchLeaderboard,
  handlePurchase,
  initAudio,
  initGame: init,
  getCurrentShift: () => game.shift || 0,
  startShift,
  showShiftIntro,
});

// =============================================================================
// MINI-GAME: SPEED CLEAN CHALLENGE
// =============================================================================

// Mini-game configuration
const MINIGAME_CONFIG = {
  duration: 30,           // 30 seconds
  stallCount: 8,          // Number of stalls to show
  respawnDelay: 300,      // ms before new stall appears after cleaning
  coinsPerClean: 5,       // Coins earned per stall cleaned
  triggerAfterShift: [1, 3, 5], // Trigger after shifts 2, 4, 6 (0-indexed)
};

// Mini-game state
let minigame = {
  active: false,
  time: 0,
  cleaned: 0,
  stalls: [],
  lastTime: 0,
};

// Mini-game comments based on performance
const MINIGAME_COMMENTS = [
  { min: 0, msg: "Keep practicing, rookie!" },
  { min: 5, msg: "Getting the hang of it!" },
  { min: 10, msg: "Nice cleaning skills!" },
  { min: 15, msg: "Speed demon! 🔥" },
  { min: 20, msg: "Unstoppable cleaner! ⚡" },
  { min: 25, msg: "LEGENDARY SPEED! 🌟" },
];

function shouldTriggerMinigame() {
  // DISABLED: User wants to test mini-games before enabling
  return false;
  // Trigger after specific shifts (0-indexed in game.shift, but we check AFTER endShift)
  // return MINIGAME_CONFIG.triggerAfterShift.includes(game.shift);
}

function showMinigameIntro() {
  playClick();
  showScreen('minigame-intro');
}

function startMinigame() {
  minigame = {
    active: true,
    time: MINIGAME_CONFIG.duration,
    cleaned: 0,
    stalls: [],
    lastTime: performance.now(),
  };

  // Build initial stalls
  buildMinigameStalls();
  updateMinigameHUD();
  showScreen('minigame-screen');

  // Start mini-game loop
  requestAnimationFrame(minigameLoop);
  playClick();
  haptic('strong');
}

function buildMinigameStalls() {
  const container = $('minigame-stalls');
  container.innerHTML = '';
  minigame.stalls = [];

  for (let i = 0; i < MINIGAME_CONFIG.stallCount; i++) {
    const stall = document.createElement('div');
    stall.className = 'minigame-stall';
    stall.dataset.index = i;
    stall.innerHTML = `
      <span class="stall-icon">🚽</span>
      <span class="minigame-stall-label">DIRTY</span>
    `;
    stall.addEventListener('click', () => cleanMinigameStall(i));
    container.appendChild(stall);
    minigame.stalls.push({ element: stall, dirty: true, respawnTimer: 0 });
  }
}

function cleanMinigameStall(index) {
  const stall = minigame.stalls[index];
  if (!stall || !stall.dirty || !minigame.active) return;

  stall.dirty = false;
  stall.element.classList.add('cleaned');
  stall.respawnTimer = MINIGAME_CONFIG.respawnDelay;
  minigame.cleaned++;

  // Effects
  playStallClean();
  haptic('medium');
  updateMinigameHUD();

  // Spawn sparkles at stall position
  const rect = stall.element.getBoundingClientRect();
  spawnSparkles(rect.left + rect.width/2, rect.top + rect.height/2, 8);
}

function respawnMinigameStall(index) {
  const stall = minigame.stalls[index];
  if (!stall) return;

  // Create new stall element
  const newStall = document.createElement('div');
  newStall.className = 'minigame-stall';
  newStall.dataset.index = index;
  newStall.innerHTML = `
    <span class="stall-icon">🚽</span>
    <span class="minigame-stall-label">DIRTY</span>
  `;
  newStall.addEventListener('click', () => cleanMinigameStall(index));

  // Replace in container
  const container = $('minigame-stalls');
  container.replaceChild(newStall, stall.element);

  // Update state
  stall.element = newStall;
  stall.dirty = true;
  stall.respawnTimer = 0;
}

function minigameLoop(now) {
  if (!minigame.active) return;

  const dt = Math.min(now - minigame.lastTime, 100);
  minigame.lastTime = now;

  // Update timer
  minigame.time -= dt / 1000;

  // Update respawn timers
  minigame.stalls.forEach((stall, i) => {
    if (!stall.dirty && stall.respawnTimer > 0) {
      stall.respawnTimer -= dt;
      if (stall.respawnTimer <= 0) {
        respawnMinigameStall(i);
      }
    }
  });

  // Check for urgent timer styling
  const timerEl = $('minigame-timer');
  if (minigame.time <= 10) {
    timerEl.classList.add('urgent');
  } else {
    timerEl.classList.remove('urgent');
  }

  updateMinigameHUD();

  // Check for end
  if (minigame.time <= 0) {
    endMinigame();
    return;
  }

  requestAnimationFrame(minigameLoop);
}

function updateMinigameHUD() {
  $('minigame-timer').textContent = Math.max(0, Math.ceil(minigame.time));
  $('minigame-cleaned').textContent = minigame.cleaned;
}

function endMinigame() {
  minigame.active = false;

  // Calculate rewards
  const bonusCoins = minigame.cleaned * MINIGAME_CONFIG.coinsPerClean;
  game.coins += bonusCoins;

  // Find appropriate comment
  let comment = MINIGAME_COMMENTS[0].msg;
  for (const c of MINIGAME_COMMENTS) {
    if (minigame.cleaned >= c.min) comment = c.msg;
  }

  // Update results screen
  $('minigame-final-cleaned').textContent = minigame.cleaned;
  $('minigame-bonus-coins').textContent = '+' + bonusCoins;
  $('minigame-comment').textContent = comment;

  // Play celebration
  playWin();
  haptic('success');

  showScreen('minigame-result');
}

function continueFromMinigame() {
  // Continue to shop or final results
  // game.shift was already incremented when next-btn was clicked
  playClick();
  if (game.shift < CONFIG.shifts.length) {
    showUpgradeScreen();
  } else {
    gameOver();
  }
}

// =============================================================================
// MINI-GAME: SUPPLY RUN
// =============================================================================

const SUPPLYRUN_CONFIG = {
  duration: 30,              // 30 seconds
  startLives: 3,             // Starting lives
  baseSpawnRate: 1200,       // ms between spawns at start
  minSpawnRate: 400,         // ms minimum spawn rate
  speedupPerSecond: 30,      // Reduce spawn rate by this much per second
  fallSpeed: 200,            // Base pixels per second
  fallSpeedIncrease: 5,      // Increase fall speed per second
  catcherWidth: 80,          // Catcher hitbox width
  coinsPerCatch: 2,          // Coins earned per catch
  triggerAfterShift: [0, 2, 4], // After shifts 1, 3, 5 (0-indexed)
};

// Supply types with point values and spawn weights
const SUPPLY_TYPES = [
  { emoji: '🧻', name: 'toilet paper', points: 10, weight: 30 },
  { emoji: '🧼', name: 'soap', points: 15, weight: 25 },
  { emoji: '🧽', name: 'sponge', points: 12, weight: 20 },
  { emoji: '🧴', name: 'lotion', points: 18, weight: 15 },
  { emoji: '🪥', name: 'brush', points: 20, weight: 10 },
];

// Hazard types (reduce lives)
const HAZARD_TYPES = [
  { emoji: '💩', name: 'poop', weight: 15 },
  { emoji: '🪳', name: 'cockroach', weight: 10 },
  { emoji: '🦠', name: 'germ', weight: 5 },
];

// Calculate total weight for random selection
const TOTAL_SUPPLY_WEIGHT = SUPPLY_TYPES.reduce((sum, t) => sum + t.weight, 0);
const TOTAL_HAZARD_WEIGHT = HAZARD_TYPES.reduce((sum, t) => sum + t.weight, 0);

// Supply Run state
let supplyrun = {
  active: false,
  time: 0,
  score: 0,
  caught: 0,
  lives: 3,
  items: [],
  catcherX: 0,
  lastTime: 0,
  spawnTimer: 0,
  currentSpawnRate: SUPPLYRUN_CONFIG.baseSpawnRate,
  currentFallSpeed: SUPPLYRUN_CONFIG.fallSpeed,
};

// Comments based on performance
const SUPPLYRUN_COMMENTS = [
  { min: 0, msg: "Better luck next time!" },
  { min: 50, msg: "Getting started!" },
  { min: 100, msg: "Nice catching!" },
  { min: 200, msg: "Supply champion! 🏆" },
  { min: 300, msg: "LEGENDARY CATCHER! 🌟" },
];

function shouldTriggerSupplyRun() {
  // DISABLED: User wants to test mini-games before enabling
  return false;
  // return SUPPLYRUN_CONFIG.triggerAfterShift.includes(game.shift);
}

function showSupplyRunIntro() {
  playClick();
  showScreen('supplyrun-intro');
}

function startSupplyRun() {
  const areaEl = $('supplyrun-area');
  const areaRect = areaEl.getBoundingClientRect();

  supplyrun = {
    active: true,
    time: SUPPLYRUN_CONFIG.duration,
    score: 0,
    caught: 0,
    lives: SUPPLYRUN_CONFIG.startLives,
    items: [],
    catcherX: areaRect.width / 2,
    lastTime: performance.now(),
    spawnTimer: 0,
    currentSpawnRate: SUPPLYRUN_CONFIG.baseSpawnRate,
    currentFallSpeed: SUPPLYRUN_CONFIG.fallSpeed,
  };

  // Clear previous items
  $('supplyrun-items').innerHTML = '';

  // Position catcher in center
  updateCatcherPosition();
  updateSupplyRunHUD();
  showScreen('supplyrun-screen');

  // Set up touch/mouse controls
  setupSupplyRunControls();

  // Start game loop
  requestAnimationFrame(supplyRunLoop);
  playClick();
  haptic('strong');
}

function setupSupplyRunControls() {
  const areaEl = $('supplyrun-area');

  // Remove old listeners by cloning
  const newArea = areaEl.cloneNode(true);
  areaEl.parentNode.replaceChild(newArea, areaEl);

  // Touch controls
  newArea.addEventListener('touchmove', (e) => {
    if (!supplyrun.active) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = newArea.getBoundingClientRect();
    supplyrun.catcherX = Math.max(40, Math.min(rect.width - 40, touch.clientX - rect.left));
    updateCatcherPosition();
  }, { passive: false });

  newArea.addEventListener('touchstart', (e) => {
    if (!supplyrun.active) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = newArea.getBoundingClientRect();
    supplyrun.catcherX = Math.max(40, Math.min(rect.width - 40, touch.clientX - rect.left));
    updateCatcherPosition();
  }, { passive: false });

  // Mouse controls
  newArea.addEventListener('mousemove', (e) => {
    if (!supplyrun.active) return;
    const rect = newArea.getBoundingClientRect();
    supplyrun.catcherX = Math.max(40, Math.min(rect.width - 40, e.clientX - rect.left));
    updateCatcherPosition();
  });

  // Keyboard controls
  supplyrun.keyHandler = (e) => {
    if (!supplyrun.active) return;
    const areaRect = $('supplyrun-area')?.getBoundingClientRect();
    if (!areaRect) return;
    const moveSpeed = 30;
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      supplyrun.catcherX = Math.max(40, supplyrun.catcherX - moveSpeed);
      updateCatcherPosition();
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      supplyrun.catcherX = Math.min(areaRect.width - 40, supplyrun.catcherX + moveSpeed);
      updateCatcherPosition();
    }
  };
  document.addEventListener('keydown', supplyrun.keyHandler);
}

function updateCatcherPosition() {
  const catcher = $('supplyrun-catcher');
  if (catcher) {
    catcher.style.left = supplyrun.catcherX + 'px';
  }
}

function spawnSupplyItem() {
  const areaEl = $('supplyrun-area');
  const areaRect = areaEl.getBoundingClientRect();

  // 25% chance of hazard
  const isHazard = Math.random() < 0.25;

  let itemData;
  if (isHazard) {
    // Pick random hazard based on weight
    let roll = Math.random() * TOTAL_HAZARD_WEIGHT;
    for (const h of HAZARD_TYPES) {
      roll -= h.weight;
      if (roll <= 0) {
        itemData = { ...h, isHazard: true, points: 0 };
        break;
      }
    }
  } else {
    // Pick random supply based on weight
    let roll = Math.random() * TOTAL_SUPPLY_WEIGHT;
    for (const s of SUPPLY_TYPES) {
      roll -= s.weight;
      if (roll <= 0) {
        itemData = { ...s, isHazard: false };
        break;
      }
    }
  }

  if (!itemData) itemData = { ...SUPPLY_TYPES[0], isHazard: false };

  // Create DOM element
  const el = document.createElement('div');
  el.className = 'supplyrun-item';
  el.textContent = itemData.emoji;
  el.style.left = (Math.random() * (areaRect.width - 60) + 30) + 'px';
  el.style.top = '-50px';

  $('supplyrun-items').appendChild(el);

  supplyrun.items.push({
    el,
    y: -50,
    x: parseFloat(el.style.left),
    isHazard: itemData.isHazard,
    points: itemData.points,
    caught: false,
  });
}

function supplyRunLoop(now) {
  if (!supplyrun.active) return;

  const dt = Math.min(now - supplyrun.lastTime, 100);
  supplyrun.lastTime = now;

  // Update timer
  supplyrun.time -= dt / 1000;

  // Increase difficulty over time
  const elapsed = SUPPLYRUN_CONFIG.duration - supplyrun.time;
  supplyrun.currentSpawnRate = Math.max(
    SUPPLYRUN_CONFIG.minSpawnRate,
    SUPPLYRUN_CONFIG.baseSpawnRate - elapsed * SUPPLYRUN_CONFIG.speedupPerSecond
  );
  supplyrun.currentFallSpeed = SUPPLYRUN_CONFIG.fallSpeed + elapsed * SUPPLYRUN_CONFIG.fallSpeedIncrease;

  // Spawn new items
  supplyrun.spawnTimer -= dt;
  if (supplyrun.spawnTimer <= 0) {
    spawnSupplyItem();
    supplyrun.spawnTimer = supplyrun.currentSpawnRate;
  }

  // Update items
  const areaEl = $('supplyrun-area');
  const areaRect = areaEl.getBoundingClientRect();
  const catcherY = areaRect.height - 60; // Catcher position from bottom
  const catcherWidth = SUPPLYRUN_CONFIG.catcherWidth;

  supplyrun.items = supplyrun.items.filter(item => {
    if (item.caught) return false;

    // Move item down
    item.y += supplyrun.currentFallSpeed * (dt / 1000);
    item.el.style.top = item.y + 'px';

    // Check if caught
    if (item.y >= catcherY - 30 && item.y <= catcherY + 20) {
      const itemCenter = item.x + 20; // Approximate center of emoji
      if (Math.abs(itemCenter - supplyrun.catcherX) < catcherWidth / 2) {
        item.caught = true;
        item.el.classList.add('caught');

        if (item.isHazard) {
          // Caught hazard - lose a life
          supplyrun.lives--;
          playBad();
          haptic('error');
          spawnFloatText(item.x, item.y, '💔', '#ff5252');
        } else {
          // Caught supply - add points
          supplyrun.score += item.points;
          supplyrun.caught++;
          playClick();
          haptic('light');
          spawnFloatText(item.x, item.y, '+' + item.points, '#69f0ae');
        }

        updateSupplyRunHUD();

        // Remove element after animation
        setTimeout(() => item.el.remove(), 300);
        return false;
      }
    }

    // Check if missed (fell past bottom)
    if (item.y > areaRect.height) {
      if (!item.isHazard) {
        // Missed a supply - no penalty, but show miss
        item.el.classList.add('missed');
      }
      setTimeout(() => item.el.remove(), 300);
      return false;
    }

    return true;
  });

  // Check for urgent timer styling
  const timerEl = $('supplyrun-timer');
  if (supplyrun.time <= 10) {
    timerEl.classList.add('urgent');
  } else {
    timerEl.classList.remove('urgent');
  }

  updateSupplyRunHUD();

  // Check for end conditions
  if (supplyrun.time <= 0 || supplyrun.lives <= 0) {
    endSupplyRun();
    return;
  }

  requestAnimationFrame(supplyRunLoop);
}

function spawnFloatText(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'float-msg';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.color = color;
  el.style.position = 'absolute';
  el.style.fontWeight = 'bold';
  el.style.fontSize = '1.5em';
  el.style.zIndex = '100';
  el.style.animation = 'float-up 0.8s ease-out forwards';
  $('supplyrun-items').appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function updateSupplyRunHUD() {
  $('supplyrun-timer').textContent = Math.max(0, Math.ceil(supplyrun.time));
  $('supplyrun-score').textContent = supplyrun.score;
  $('supplyrun-lives').textContent = '❤️'.repeat(Math.max(0, supplyrun.lives));
}

function endSupplyRun() {
  supplyrun.active = false;

  // Clean up keyboard listener
  if (supplyrun.keyHandler) {
    document.removeEventListener('keydown', supplyrun.keyHandler);
    supplyrun.keyHandler = null;
  }

  // Clear remaining items
  $('supplyrun-items').innerHTML = '';

  // Calculate rewards
  const bonusCoins = Math.floor(supplyrun.score / 10) * SUPPLYRUN_CONFIG.coinsPerCatch;
  game.coins += bonusCoins;

  // Find appropriate comment
  let comment = SUPPLYRUN_COMMENTS[0].msg;
  for (const c of SUPPLYRUN_COMMENTS) {
    if (supplyrun.score >= c.min) comment = c.msg;
  }

  // Update results screen
  $('supplyrun-final-caught').textContent = supplyrun.caught;
  $('supplyrun-bonus-coins').textContent = '+' + bonusCoins;
  $('supplyrun-comment').textContent = comment;

  // Play celebration or sad sound based on outcome
  if (supplyrun.lives <= 0) {
    playBad();
    haptic('error');
  } else {
    playWin();
    haptic('success');
  }

  showScreen('supplyrun-result');
}

function continueFromSupplyRun() {
  // Continue to shop or final results
  playClick();
  if (game.shift < CONFIG.shifts.length) {
    showUpgradeScreen();
  } else {
    gameOver();
  }
}

let game = {};
let selectedGender = 'female';
// Difficulty is now 1v1-only; solo always uses 'normal'
let selectedDifficulty = 'normal'; // Only changed in MP host flow

const DIFFICULTY_MODIFIERS = {
  easy:   { spawn: 1.4, patience: 1.4, occupy: 1.2, score: 0.5 },
  normal: { spawn: 1.0, patience: 1.0, occupy: 1.0, score: 1.0 },
  hard:   { spawn: 0.7, patience: 0.7, occupy: 0.85, score: 1.5 },
  insane: { spawn: 0.5, patience: 0.5, occupy: 0.7, score: 2.0 },
};
let highScore = parseInt(localStorage.getItem('beaverHighScore')) || 0;
let endlessHighScore = parseInt(localStorage.getItem('beaverEndlessHighScore')) || 0;
let endlessUnlocked = localStorage.getItem('beaverEndlessUnlocked') === 'true';

// Daily Challenge state
let dailyHighScore = parseInt(localStorage.getItem('beaverDailyHighScore')) || 0;
let dailyDate = localStorage.getItem('beaverDailyDate') || '';
let dailyAttempts = parseInt(localStorage.getItem('beaverDailyAttempts')) || 0;

// Performance monitoring for mobile optimization
const perf = {
  frameTimes: [],
  lastHudUpdate: 0,
  hudUpdateInterval: 50, // Update HUD every 50ms instead of every frame
  lowPerfMode: false,
  lowPerfThreshold: 18, // Only drop to lite mode on clearly poor sustained FPS
  autoLiteNotified: false, // Prevent repeated auto-enable notifications
  frameCount: 0,
  lastFpsCheck: 0,
  currentFps: 60,
  lowPerfStrikeCount: 0,
  lowPerfGracePeriod: 5000,
};

// Check if device is likely mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Initialize low-perf mode from manual preference only
const savedLowPerf = localStorage.getItem('beaverLowPerfOptIn');
if (savedLowPerf === 'true') {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('low-perf');
    perf.lowPerfMode = true;
    perf.hudUpdateInterval = 100;
  });
}
// Clear old auto-saved key so users aren't stuck in lite mode
localStorage.removeItem('beaverLowPerf');
// Reset the old manual key so existing users start in full visual mode unless they opt back in.
localStorage.removeItem('beaverLowPerfManual');

// Enable low performance mode (reduces visual effects)
function setLowPerfMode(enabled) {
  perf.lowPerfMode = enabled;
  document.body.classList.toggle('low-perf', enabled);
  if (enabled) {
    perf.hudUpdateInterval = 100; // Even less frequent HUD updates
  } else {
    perf.hudUpdateInterval = 50;
  }
}

// Monitor FPS and auto-enable low-perf mode if needed
function updatePerfMonitor(now) {
  perf.frameCount++;

  // Check FPS every second
  if (now - perf.lastFpsCheck >= 1000) {
    perf.currentFps = perf.frameCount;
    perf.frameCount = 0;
    perf.lastFpsCheck = now;

    // Auto-enable low-perf mode if FPS drops (session only, not saved)
    if (now < perf.lowPerfGracePeriod) return;

    if (perf.currentFps < perf.lowPerfThreshold) {
      perf.lowPerfStrikeCount++;
    } else {
      perf.lowPerfStrikeCount = 0;
    }

    if (perf.lowPerfStrikeCount >= 3 && !perf.lowPerfMode && !perf.autoLiteNotified) {
      setLowPerfMode(true);
      perf.autoLiteNotified = true;
      perf.lowPerfStrikeCount = 0;
      // Don't save to localStorage — only persist if user manually toggles
      console.log('Auto-enabled Lite Mode (FPS:', perf.currentFps, ')');
    }
  }
}

// Seeded RNG for daily challenge (mulberry32)
let seededRngState = 0;
function seededRng() {
  seededRngState |= 0;
  seededRngState = seededRngState + 0x6D2B79F5 | 0;
  let t = Math.imul(seededRngState ^ seededRngState >>> 15, 1 | seededRngState);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function getDailySeed() {
  const today = new Date();
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function seedRng(seed) {
  seededRngState = seed;
  // Warm up the RNG with a few iterations
  for (let i = 0; i < 10; i++) seededRng();
}

// Audio
let audioCtx = null;
let isMuted = localStorage.getItem('beaverMuted') === 'true';
let isSfxMuted = localStorage.getItem('beaverSfxMuted') === 'true';
// parseInt returns NaN for null/empty, || handles that with default values
let sfxVolume = (parseInt(localStorage.getItem('beaverSfxVolume')) || 70) / 100;
let musicVolume = (parseInt(localStorage.getItem('beaverMusicVolume')) || 50) / 100;

// Haptics — navigator.vibrate works on Android only; iOS needs visual fallback
let hapticsEnabled = localStorage.getItem('beaverHaptics') !== 'false'; // default ON
const canVibrate = typeof navigator.vibrate === 'function';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function haptic(type = 'light') {
  if (!hapticsEnabled) return;
  const patterns = {
    light: 15,           // Quick tap - UI clicks
    medium: 40,          // Task complete, coin collect
    strong: 80,          // Stall cleaned, combo milestone
    success: [50, 30, 50], // Shift complete, achievement
    warning: [30, 20, 30, 20, 30], // Low patience, inspector
    error: 150           // Customer leaves, rating drop
  };
  // Android: real vibration
  if (canVibrate) {
    try { navigator.vibrate(patterns[type] || patterns.light); } catch(e) {}
  }
  // All touch devices: visual micro-shake for strong/error/success/warning
  if ('ontouchstart' in window && (type === 'strong' || type === 'error' || type === 'success' || type === 'warning')) {
    const el = document.querySelector('.screen.active') || document.body;
    el.classList.remove('haptic-bump');
    void el.offsetWidth;
    el.classList.add('haptic-bump');
  }
}

function toggleHaptics() {
  hapticsEnabled = !hapticsEnabled;
  localStorage.setItem('beaverHaptics', hapticsEnabled);
  updateSettingsUI();
  if (hapticsEnabled) haptic('medium'); // Feedback that haptics are on
}

async function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume AudioContext on user interaction (required by browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (e) {}
  }
}

// Initialize audio on ANY user interaction (multiple calls are safe)
// Use capture:true so initAudio runs BEFORE button handlers (creates audioCtx first)
['click', 'touchstart', 'keydown'].forEach(evt => {
  document.addEventListener(evt, initAudio, { capture: true, passive: true });
});

// === SIMPLE OSCILLATOR-BASED SOUND SYSTEM ===
// All sounds use Web Audio oscillators - no external files needed
// Design: short, cartoony, satisfying sounds with low frequencies to avoid shrillness

// Helper: play a simple tone with envelope
function playTone(freq, duration, type = 'sine', volume = 0.2) {
  if (!audioCtx || isMuted || isSfxMuted) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
    return;
  }
  const vol = volume * (isNaN(sfxVolume) ? 0.7 : sfxVolume);
  if (vol === 0) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

// Helper: play a quick frequency sweep (for cartoony effects)
function playSweep(startFreq, endFreq, duration, type = 'sine', volume = 0.2) {
  if (!audioCtx || isMuted || isSfxMuted) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
    return;
  }
  const vol = volume * (isNaN(sfxVolume) ? 0.7 : sfxVolume);
  if (vol === 0) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration * 0.8);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

function toggleMasterMute() {
  isMuted = !isMuted;
  localStorage.setItem('beaverMuted', isMuted);
  updateSettingsUI();
  if (isMuted) {
    stopMusic();
  } else if (game.running && !isMusicMuted) {
    startMusic();
  }
}

function setSfxVolume(val) {
  sfxVolume = val / 100;
  localStorage.setItem('beaverSfxVolume', val);
  const valEl = $('sfx-val');
  if (valEl) valEl.textContent = val + '%';
}

function setMusicVolume(val) {
  musicVolume = val / 100;
  localStorage.setItem('beaverMusicVolume', val);
  const valEl = $('music-val');
  if (valEl) valEl.textContent = val + '%';
  // Update live music volume
  if (musicGain) musicGain.gain.value = 0.05 * musicVolume;
}

function updateSettingsUI() {
  // SFX toggle and slider
  const sfxToggle = $('sfx-toggle');
  const sfxSlider = $('sfx-volume');
  if (sfxToggle) {
    sfxToggle.textContent = isSfxMuted ? 'OFF' : 'ON';
    sfxToggle.classList.toggle('active', !isSfxMuted);
  }
  if (sfxSlider) {
    sfxSlider.value = sfxVolume * 100;
    sfxSlider.disabled = isSfxMuted;
  }

  // Music toggle and slider
  const musicToggle = $('music-toggle');
  const musicSlider = $('music-volume');
  if (musicToggle) {
    musicToggle.textContent = isMusicMuted ? 'OFF' : 'ON';
    musicToggle.classList.toggle('active', !isMusicMuted);
  }
  if (musicSlider) {
    musicSlider.value = musicVolume * 100;
    musicSlider.disabled = isMusicMuted;
  }

  // Haptics toggle
  const hapticsBtn = $('haptics-toggle');
  if (hapticsBtn) {
    hapticsBtn.textContent = hapticsEnabled ? 'ON' : 'OFF';
    hapticsBtn.classList.toggle('active', hapticsEnabled);
  }

  // Performance mode toggle
  const perfBtn = $('perf-toggle');
  if (perfBtn) {
    perfBtn.textContent = perf.lowPerfMode ? 'ON' : 'OFF';
    perfBtn.classList.toggle('active', perf.lowPerfMode);
  }
}

function toggleSfx() {
  isSfxMuted = !isSfxMuted;
  localStorage.setItem('beaverSfxMuted', isSfxMuted);
  updateSettingsUI();
}

function toggleMusic() {
  isMusicMuted = !isMusicMuted;
  localStorage.setItem('beaverMusicMuted', isMusicMuted);
  if (isMusicMuted) {
    stopMusic();
  } else if (game.running && !game.paused) {
    startMusic();
  }
  updateSettingsUI();
}

function togglePerfMode() {
  setLowPerfMode(!perf.lowPerfMode);
  localStorage.setItem('beaverLowPerfOptIn', perf.lowPerfMode);
  updateSettingsUI();
}

// === UI SOUNDS ===
function playClick() {
  // Quick, snappy click - 400Hz short burst
  playTone(400, 0.06, 'square', 0.12);
}

function playTaskComplete() {
  // Pleasant two-tone completion
  playTone(330, 0.1, 'triangle', 0.15);
  setTimeout(() => playTone(440, 0.12, 'triangle', 0.18), 70);
}

// === TASK SOUNDS ===
function playPlunge() {
  // Low "bloop" sound - satisfying plunger pop
  playSweep(150 + Math.random() * 30, 80, 0.12, 'sine', 0.2);
}

function playScrub() {
  // Quick spray/scrub sound - noise-like
  playTone(300 + Math.random() * 100, 0.08, 'sawtooth', 0.08);
}

function playMop() {
  // Squeaky mop - rising pitch
  playSweep(200, 350 + Math.random() * 50, 0.1, 'triangle', 0.12);
}

function playRestock() {
  // Rustling paper/plastic sound
  playTone(400 + Math.random() * 200, 0.06, 'sawtooth', 0.06);
  setTimeout(() => playTone(500 + Math.random() * 150, 0.05, 'sawtooth', 0.05), 40);
}

function playTaskSound(taskId) {
  switch(taskId) {
    case 'plunge': playPlunge(); break;
    case 'wipe': playScrub(); break;
    case 'mop': playMop(); break;
    case 'tp': playRestock(); break;
    default: playClick();
  }
}

// === STALL CLEAN - BIG REWARD SOUND ===
function playStallClean() {
  // Ascending arpeggio - C-E-G major chord
  playTone(262, 0.1, 'triangle', 0.15);
  setTimeout(() => playTone(330, 0.1, 'triangle', 0.15), 60);
  setTimeout(() => playTone(392, 0.15, 'triangle', 0.18), 120);
}

// === FEEDBACK SOUNDS ===
function playBad() {
  // Quick descending buzz - something went wrong
  playSweep(300, 150, 0.15, 'sawtooth', 0.12);
}

function playUrgent() {
  // Two-tone alert beep
  playTone(400, 0.08, 'square', 0.1);
  setTimeout(() => playTone(350, 0.08, 'square', 0.1), 100);
}

function playRush() {
  // Faster, higher urgent
  playTone(500, 0.06, 'square', 0.12);
  setTimeout(() => playTone(450, 0.06, 'square', 0.12), 80);
}

function playInspector() {
  // Official-sounding alert
  playTone(440, 0.1, 'sine', 0.15);
  setTimeout(() => playTone(550, 0.1, 'sine', 0.15), 120);
  setTimeout(() => playTone(440, 0.15, 'sine', 0.12), 240);
}

function playInspectorBad() {
  // Low failure buzz
  playSweep(250, 100, 0.2, 'sawtooth', 0.15);
}

function playInspectorGood() {
  // Happy passing sound
  playTone(392, 0.08, 'triangle', 0.15);
  setTimeout(() => playTone(494, 0.08, 'triangle', 0.15), 80);
  setTimeout(() => playTone(587, 0.12, 'triangle', 0.18), 160);
}

function playWin() {
  // Victory fanfare
  playTone(392, 0.12, 'triangle', 0.18);
  setTimeout(() => playTone(494, 0.12, 'triangle', 0.18), 100);
  setTimeout(() => playTone(587, 0.15, 'triangle', 0.2), 200);
  setTimeout(() => playTone(784, 0.2, 'triangle', 0.22), 320);
}

// === COMBO SOUNDS ===
function playComboMilestone(level) {
  if (level >= 10) {
    // Legendary - big ascending chord
    playTone(392, 0.1, 'triangle', 0.2);
    setTimeout(() => playTone(494, 0.1, 'triangle', 0.2), 60);
    setTimeout(() => playTone(587, 0.1, 'triangle', 0.2), 120);
    setTimeout(() => playTone(784, 0.15, 'triangle', 0.25), 180);
  } else if (level >= 5) {
    // Intense - three note chord
    playTone(350, 0.1, 'triangle', 0.18);
    setTimeout(() => playTone(440, 0.1, 'triangle', 0.18), 70);
    setTimeout(() => playTone(550, 0.12, 'triangle', 0.2), 140);
  } else {
    // Fire - two note
    playTone(330, 0.1, 'triangle', 0.15);
    setTimeout(() => playTone(440, 0.12, 'triangle', 0.18), 80);
  }
}

function playComboBreak() {
  // Sad descending blip
  playSweep(400, 200, 0.1, 'sine', 0.1);
}

// === TOILET FLUSH ===
function playFlush() {
  const variety = Math.floor(Math.random() * 3);
  const baseFreq = variety === 0 ? 120 : variety === 1 ? 100 : 140;
  const vol = variety === 1 ? 0.18 : 0.12;
  playSweep(baseFreq + 30, baseFreq - 20, 0.25, 'sine', vol);
}

// === CUSTOMER REACTIONS ===
function playCustomerHappy() {
  // Pleasant ascending tone
  playSweep(300, 450 + Math.random() * 50, 0.12, 'triangle', 0.1);
}

function playCustomerDisgusted() {
  // Descending grumpy sound
  playSweep(350, 180, 0.15, 'sawtooth', 0.08);
}

function playCustomerImpatient() {
  // Quick impatient blip
  playTone(450 + Math.random() * 50, 0.06, 'square', 0.08);
}

// === COMEDY SOUNDS ===
function playFart() {
  // Low rumble - comedic
  playSweep(100 + Math.random() * 30, 60, 0.12, 'sawtooth', 0.1);
}

function playSplash() {
  // Quick splash effect
  playSweep(400, 200, 0.08, 'sine', 0.1);
  setTimeout(() => playTone(300, 0.06, 'sine', 0.08), 50);
}

function playBloop() {
  // Cute bloop
  playSweep(300, 400 + Math.random() * 100, 0.1, 'sine', 0.12);
}

// === DOOR SOUNDS ===
function playDoorCreak() {
  playSweep(150 + Math.random() * 50, 200, 0.1, 'triangle', 0.08);
}

function playDoorOpen() {
  playSweep(180, 250 + Math.random() * 30, 0.12, 'triangle', 0.1);
}

function playDoorClose() {
  playSweep(200 + Math.random() * 30, 120, 0.1, 'sine', 0.1);
}

// === AMBIENT SOUNDS ===
function playSinkWater() {
  // Quick water sound
  playTone(600 + Math.random() * 200, 0.08, 'sine', 0.05);
}

function playFootstep() {
  // Very quiet tap
  playTone(200 + Math.random() * 50, 0.04, 'sine', 0.03);
}

// === SPECIAL SOUNDS ===
function playVIPFanfare() {
  // Royal fanfare
  playTone(392, 0.1, 'triangle', 0.18);
  setTimeout(() => playTone(494, 0.1, 'triangle', 0.18), 100);
  setTimeout(() => playTone(587, 0.15, 'triangle', 0.2), 200);
}

function playCoinEarned() {
  // Coin cha-ching
  playTone(800 + Math.random() * 100, 0.08, 'sine', 0.12);
  setTimeout(() => playTone(1000, 0.1, 'sine', 0.15), 60);
}

function playPowerup() {
  // Rising powerup sound
  playSweep(300, 600, 0.15, 'triangle', 0.15);
  setTimeout(() => playTone(700, 0.1, 'triangle', 0.12), 120);
}

// Mascot Walk System - Beaver WALKS IN from the exit door, customers freak out and swarm
function startMascotWalk() {
  const floorArea = $('floor-area');
  const floorRect = floorArea.getBoundingClientRect();

  // Remove any existing mascot
  const oldMascot = document.getElementById('floor-beaver');
  if (oldMascot) oldMascot.remove();

  // Get exit door position (beaver enters/exits through the door)
  const exitDoor = $('exit-door');
  const exitRect = exitDoor.getBoundingClientRect();
  const floorLeft = floorRect.left;
  const startX = exitRect.left - floorLeft + exitRect.width / 2 - 25;
  // Start inside the door (negative Y, above visible area) so beaver emerges FROM door
  const doorY = exitRect.top - floorRect.top + exitRect.height / 2;
  const startY = doorY - 60;  // Start hidden above door

  // Create beaver character - just the emoji, no background
  const mascotEl = document.createElement('div');
  mascotEl.id = 'floor-beaver';
  mascotEl.innerHTML = '🦫';
  mascotEl.style.cssText = `
    position: absolute;
    left: ${startX}px;
    top: ${startY}px;
    z-index: 150;
    font-size: 3.5em;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
    transition: none;
  `;
  floorArea.appendChild(mascotEl);

  // Walk from exit door toward center, then across, then back to door
  game.mascotWalk = {
    el: mascotEl,
    x: startX,
    y: startY,
    startX: startX,  // Remember start position for exit
    startY: startY,
    phase: 'entering',  // 'entering' -> 'walking' -> 'exiting'
    targetY: floorRect.height * 0.45,  // Walk down into the floor
    targetX: floorRect.width * 0.7,    // Then walk to the right
    speed: 80
  };

  floatMessage('🦫 BEAVER ON THE FLOOR!', 400, 150, 'combo');
}

// Initialize a customer for crowding behavior
function initDistractedCustomer(p) {
  if (p.distracted) return;  // Already initialized
  p.distracted = true;
  // Random offset so customers spread around beaver
  p.crowdOffset = (Math.random() - 0.5) * 4;  // -2 to 2
  p.crowdOffsetY = (Math.random() - 0.5) * 3;  // -1.5 to 1.5
}

function updateMascotWalk(dt) {
  if (!game.mascotWalk || !game.mascotWalk.el) return;

  const mascotEl = game.mascotWalk.el;
  const m = game.mascotWalk;
  const dtSec = dt / 1000;  // Convert ms to seconds

  // Phase 1: Walk down from exit door into the floor
  if (m.phase === 'entering') {
    m.y += m.speed * dtSec;
    if (m.y >= m.targetY) {
      m.y = m.targetY;
      m.phase = 'walking';
    }
  }
  // Phase 2: Walk across the floor
  else if (m.phase === 'walking') {
    m.x += m.speed * dtSec;
    if (m.x >= m.targetX) {
      m.phase = 'exiting';
    }
  }
  // Phase 3: Walk back to exit door
  else if (m.phase === 'exiting') {
    const dx = m.startX - m.x;
    const dy = m.startY - m.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) {
      endMascotWalk();
      return;
    }

    // Walk toward the exit door
    m.x += (dx / dist) * m.speed * dtSec;
    m.y += (dy / dist) * m.speed * dtSec;
  }

  mascotEl.style.left = m.x + 'px';
  mascotEl.style.top = m.y + 'px';

  // Beaver center position for customer attraction
  const beaverX = m.x + 40;
  const beaverY = m.y + 40;

  // Distract customers - they stop what they're doing and crowd toward beaver
  for (const p of game.people) {
    // Only distract customers who are walking around (not in stalls or washing)
    if (p.phase === 'enter' || p.phase === 'findStall' || p.phase === 'toStall') {
      if (!p.distracted) {
        p.distracted = true;
        p.savedPhase = p.phase;  // Remember what they were doing
        p.crowdOffset = (Math.random() - 0.5) * 3;
        p.crowdOffsetY = (Math.random() - 0.5) * 2;
        // Show excited thought
        p.thought = ['Photo op!', 'Is that Beaver?!', 'OMG!', 'No way!', 'WOW!'][Math.floor(Math.random() * 5)];
        p.thoughtMood = 'neutral';
        p.thoughtTimer = 5000;
      }

      // Crowd toward beaver (but don't teleport - walk naturally)
      const targetX = beaverX + p.crowdOffset * 30;
      const targetY = beaverY + p.crowdOffsetY * 25;
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 15) {
        // Walk toward beaver at normal speed
        const speed = CONFIG.walkSpeed * dtSec;
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
      }

      // Show excited thought
      if (!p.thought || p.thoughtTimer <= 0) {
        p.thought = ['Photo op!', 'Is that Beaver?!', 'OMG!', 'No way!', 'WOW!'][Math.floor(Math.random() * 5)];
        p.thoughtMood = 'neutral';
        p.thoughtTimer = 2000;
      }
    }
  }
}

function endMascotWalk() {
  // Remove the beaver element
  if (game.mascotWalk && game.mascotWalk.el) {
    game.mascotWalk.el.remove();
  }
  const oldBeaver = document.getElementById('floor-beaver');
  if (oldBeaver) oldBeaver.remove();

  game.mascotWalk = null;
  game.effects.mascot = 0;

  // Undistract all customers
  for (const p of game.people) {
    p.distracted = false;
    p.distractedThought = false;
    delete p.crowdOffset;
    delete p.crowdOffsetY;
  }
}

// Background Music System - Procedural Upbeat Theme
let isMusicMuted = localStorage.getItem('beaverMusicMuted') === 'true';
let musicPlaying = false;
let musicOscillators = [];
let musicGain = null;
let musicInterval = null;

// Simple pleasant scale - C major pentatonic for easy listening
const MUSIC_NOTES = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99
};

// Simple catchy melody - think elevator music meets game show
const MELODY = [
  // A section - bouncy and light
  ['C5', 0.25], ['E5', 0.25], ['G5', 0.5],
  ['E5', 0.25], ['C5', 0.25], ['D5', 0.5],
  ['E5', 0.25], ['D5', 0.25], ['C5', 0.5],
  [null, 0.5],

  // B section - simple variation
  ['G4', 0.25], ['C5', 0.25], ['E5', 0.5],
  ['D5', 0.25], ['E5', 0.25], ['C5', 0.5],
  ['A4', 0.25], ['G4', 0.25], ['E4', 0.5],
  [null, 0.5],

  // A section repeat
  ['C5', 0.25], ['E5', 0.25], ['G5', 0.5],
  ['E5', 0.25], ['D5', 0.25], ['C5', 0.5],
  ['D5', 0.25], ['E5', 0.25], ['G5', 0.5],
  [null, 0.5],

  // Ending phrase
  ['E5', 0.25], ['D5', 0.25], ['C5', 0.25], ['G4', 0.25],
  ['A4', 0.5], ['G4', 0.5],
  ['C5', 1.0],
  [null, 0.5]
];

// Simple bass - root notes, steady rhythm
const BASS = [
  ['C4', 0.5], [null, 0.5], ['G4', 0.5], [null, 0.5],
  ['C4', 0.5], [null, 0.5], ['E4', 0.5], [null, 0.5],
  ['A4', 0.5], [null, 0.5], ['G4', 0.5], [null, 0.5],
  ['C4', 0.5], [null, 0.5], ['G4', 0.5], [null, 0.5]
];

let melodyIndex = 0;
let bassIndex = 0;
const TEMPO = 140; // BPM - moderate pace (was 180)
const BEAT_MS = 60000 / TEMPO;

function startMusic() {
  const effectiveMusicVol = isNaN(musicVolume) ? 0.5 : musicVolume;
  if (!audioCtx || isMuted || isMusicMuted || effectiveMusicVol === 0 || musicPlaying) return;
  // Resume context if suspended
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
    return;
  }
  musicPlaying = true;
  melodyIndex = 0;
  bassIndex = 0;

  // Create master gain for music (quiet background, scaled by musicVolume)
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.05 * effectiveMusicVol; // Quieter than before
  musicGain.connect(audioCtx.destination);

  // Start the music loop
  playNextMelodyNote();
  playNextBassNote();
}

function playMusicNote(freq, duration, type = 'sine', vol = 1.0) {
  if (!audioCtx || !musicGain || !musicPlaying) return null;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(musicGain);
    osc.frequency.value = freq;
    osc.type = type;
    // Soft attack and release for smoother sound
    const now = audioCtx.currentTime;
    const noteLen = duration * BEAT_MS / 1000;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.setValueAtTime(vol, now + noteLen * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + noteLen);
    osc.start(now);
    osc.stop(now + noteLen + 0.05);
    musicOscillators.push(osc);
    return osc;
  } catch(e) { return null; }
}

function playNextMelodyNote() {
  if (!musicPlaying) return;
  const [note, duration] = MELODY[melodyIndex];
  if (note) {
    playMusicNote(MUSIC_NOTES[note], duration, 'triangle', 0.6);
  }
  melodyIndex = (melodyIndex + 1) % MELODY.length;
  setTimeout(playNextMelodyNote, duration * BEAT_MS);
}

function playNextBassNote() {
  if (!musicPlaying) return;
  const [note, duration] = BASS[bassIndex];
  if (note) {
    playMusicNote(MUSIC_NOTES[note] / 2, duration, 'sine', 0.4);
  }
  bassIndex = (bassIndex + 1) % BASS.length;
  setTimeout(playNextBassNote, duration * BEAT_MS);
}

function stopMusic() {
  musicPlaying = false;
  // Stop all active oscillators
  musicOscillators.forEach(osc => {
    try { osc.stop(); } catch(e) {}
  });
  musicOscillators = [];
  if (musicGain) {
    try { musicGain.disconnect(); } catch(e) {}
    musicGain = null;
  }
}

// Beaver mascot expressions
let beaverTimeout = null;
function setBeaverMood(mood, duration = 1000) {
  const beaver = document.getElementById('beaver-mascot');
  if (!beaver) return;
  beaver.className = 'beaver-' + mood;
  clearTimeout(beaverTimeout);
  if (duration > 0) {
    beaverTimeout = setTimeout(() => beaver.className = 'beaver-idle', duration);
  }
}

// Beaver speech bubble tips - shown at relevant moments during first shift
const BEAVER_SPEECH_TIPS = {
  dirtyStall: "Click dirty stalls to clean!",
  taskMash: "Mash the buttons faster!",
  dirtySink: "Don't forget the sinks!",
  powerupReady: "Use your items! (🥩🧊🍿🦫)",
  comboStart: "Keep cleaning for combos!",
  lowTime: "Hurry! Time's running out!",
  vipCustomer: "VIP customer! Clean fast for 2x bonus!",
  inspectorComing: "Keep stalls clean for inspection!",
  fightBreaking: "Break up that fight! Tap fast!"
};
let tipTimeout = null;
let shownTips = {};

function showBeaverTip(tipKey, duration = 3500) {
  // Only show tips on first shift
  if (game.shift > 0) return;
  // Only show each tip once per session
  const storageKey = 'beaverTip_' + tipKey;
  if (shownTips[tipKey] || localStorage.getItem(storageKey)) return;

  shownTips[tipKey] = true;
  localStorage.setItem(storageKey, 'true');

  const speech = document.getElementById('beaver-speech');
  if (!speech) return;

  clearTimeout(tipTimeout);
  speech.textContent = BEAVER_SPEECH_TIPS[tipKey];
  speech.classList.add('active');
  setBeaverMood('happy', duration);

  tipTimeout = setTimeout(() => {
    speech.classList.remove('active');
  }, duration);
}

function $(id) { return document.getElementById(id); }
function rand() {
  // Use seeded RNG in daily and multiplayer modes for fairness
  return (game.mode === 'daily' || game.mode === 'multiplayer') ? seededRng() : Math.random();
}
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function rnd(min, max) { return min + rand() * (max - min); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function screenShake(intensity = 1) {
  const el = $('play-area');
  el.style.setProperty('--shake-px', Math.round(3 * intensity) + 'px');
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 200 + intensity * 100);
}

function bumpValue(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('value-bump');
  void el.offsetWidth; // Force reflow
  el.classList.add('value-bump');
}

function init() {
  game = {
    mode: 'campaign',         // 'campaign' or 'endless'
    shift: 0,
    score: 0,
    rating: 5,
    combo: 0,
    maxCombo: 0,
    time: 0,
    elapsed: 0,               // Total elapsed time (for endless mode)
    running: false,
    stalls: [],
    sinks: [],
    people: [],
    puddles: [],
    towels: 10,
    powerups: {speed: 1, slow: 1, auto: 0, mascot: 0},
    effects: {speed: 0, slow: 0, mascot: 0},
    mascotWalk: null,  // Mascot walk state when active
    spawnTimer: 0,
    activeStall: -1,
    activeTask: -1,
    taskProgress: 0,
    _clickTimestamps: [],     // Anti-auto-clicker: recent click times
    stats: {cleaned: 0, served: 0, dirty: 0, abandoned: 0, saves: 0},
    personId: 0,
    gender: selectedGender,
    difficulty: selectedDifficulty,
    rushMode: false,
    rushTimer: 0,
    lastUrgentBeep: 0,
    inspector: null,          // Inspector object when active
    inspectorTimer: 0,        // Countdown until inspector appears
    inspectorWarning: 0,      // Warning countdown before inspector enters
    fight: null,              // Fight object when active
    fightTimer: 0,            // Countdown until fight starts
    fightWarning: 0,          // Warning countdown before fight starts
    coins: 0,                 // Currency for items
    skills: {scrub: 0, patience: 0, tips: 0},  // Passive skills (earned per shift)
    comboBoost: 0,            // Remaining duration of combo speed boost
    lastMilestone: 0,         // Last milestone level achieved (to avoid re-triggering)
    comboTimer: 0,            // Time remaining before combo resets (ms)
    comboTimerMax: 0,         // Max combo timer for progress bar
    tipsEarned: 0,            // Total coins earned from customer tips this shift
    isMultiplayer: false,     // Set true for 1v1 games (enables difficulty modifiers)
    exitDoorOpen: false,
    exitDoorTimer: 0,
  };

  // Apply any pending daily reward coins
  applyPendingDailyCoins();
  updateExitDoorDOM();
}

function setupGameTouchGuards() {
  if (setupGameTouchGuards.initialized) return;
  setupGameTouchGuards.initialized = true;

  let lastTouchEnd = 0;
  const guardedSelectors = ['#play-area', '#floor-area', '#bathroom', '#game-container'];

  const preventDoubleTapZoom = (e) => {
    const target = e.target;
    const tappedGameSurface = target instanceof Element && guardedSelectors.some((selector) => target.closest(selector));
    if (!tappedGameSurface) return;

    const now = Date.now();
    if (now - lastTouchEnd < 320) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  };

  document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
}
setupGameTouchGuards.initialized = false;

function getCustomers() {
  return game.gender === 'male' ? CUSTOMERS_MALE : CUSTOMERS_FEMALE;
}

function getShiftConfig() {
  // Daily mode uses generated config
  if (game.mode === 'daily' && game.dailyShiftOverride) {
    return game.dailyShiftOverride;
  }
  const base = CONFIG.shifts[Math.min(game.shift, CONFIG.shifts.length - 1)];
  // Only apply difficulty modifiers in multiplayer
  if (!game.isMultiplayer) return base;
  const diff = DIFFICULTY_MODIFIERS[game.difficulty || 'normal'];
  if (!diff || diff.spawn === 1) return base;
  return {
    ...base,
    spawnMin: Math.round(base.spawnMin * diff.spawn),
    spawnMax: Math.round(base.spawnMax * diff.spawn),
    occMin: Math.round(base.occMin * diff.occupy),
    occMax: Math.round(base.occMax * diff.occupy),
  };
}

function getEffectiveTaskTime() {
  // Quick Scrub skill reduces task time
  const scrubBonus = getSkillEffect('scrub');
  let time = CONFIG.baseTaskTime * (1 - scrubBonus);
  // Combo milestone speed boost (30% faster)
  if (game.comboBoost > 0) time *= 0.7;
  return time;
}

function getTaskProgressPercent(taskIndex) {
  if (game.activeTask !== taskIndex) return 0;
  const effectiveTaskTime = getEffectiveTaskTime();
  if (!effectiveTaskTime || effectiveTaskTime <= 0) return 0;
  return Math.min(100, Math.max(0, (game.taskProgress / effectiveTaskTime) * 100));
}

function setTaskProgressFill(el, progress) {
  if (!el) return;
  const scale = Math.min(1, Math.max(0, progress / 100));
  el.style.transform = `scaleX(${scale})`;
}

function updateActiveTaskProgressUI() {
  if (game.activeStall < 0 || game.activeTask < 0) return;
  const buttons = $('task-buttons');
  if (!buttons) return;
  const activeBtn = buttons.querySelector('.task-btn.active');
  if (!activeBtn) return;
  const progress = getTaskProgressPercent(game.activeTask);
  setTaskProgressFill(activeBtn.querySelector('.progress'), progress);
}

function getEffectivePatience() {
  // Patience skill increases customer patience
  const patienceBonus = getSkillEffect('patience');
  // Only apply difficulty modifier in multiplayer
  const diff = game.isMultiplayer ? DIFFICULTY_MODIFIERS[game.difficulty || 'normal'] : null;
  let patience = CONFIG.patience * (1 + patienceBonus) * (diff ? diff.patience : 1);
  // Endless mode: patience decreases 5% per minute
  if (game.mode === 'endless') {
    const minutesPlayed = Math.floor(game.elapsed / 60000);
    const patienceMultiplier = Math.max(0.3, 1 - minutesPlayed * 0.05); // Min 30% patience
    patience *= patienceMultiplier;
  }
  return patience;
}

function getSkillEffect(skillId) {
  const skill = SKILLS.find(s => s.id === skillId);
  if (!skill) return 0;
  return skill.effect * game.skills[skillId];
}

function updatePowerupTimer(elId, remaining) {
  const el = $(elId);
  if (!el) return;
  let timer = el.querySelector('.pow-timer');
  if (remaining > 0) {
    const sec = Math.ceil(remaining / 1000);
    if (!timer) {
      timer = document.createElement('span');
      timer.className = 'pow-timer';
      el.appendChild(timer);
    }
    timer.textContent = sec + 's';
  } else if (timer) {
    timer.remove();
  }
}

function getItemDuration(itemId) {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item || !item.duration) return 12000;
  return item.duration;
}

function getDifficultyScoreMultiplier() {
  // Only apply difficulty score multiplier in multiplayer
  if (!game.isMultiplayer) return 1;
  const diff = DIFFICULTY_MODIFIERS[game.difficulty || 'normal'];
  return diff ? diff.score : 1;
}

function addScore(points) {
  const scaled = Math.round(points * getDifficultyScoreMultiplier());
  game.score += scaled;
  return scaled;
}

function getCoinBonus() {
  // Better Tips skill increases coins earned
  return 1 + getSkillEffect('tips');
}

function showScreen(id) {
  const current = document.querySelector('.screen.active');
  const next = $(id);
  if (!next) return;
  if (current && current !== next) {
    // Quick crossfade
    current.classList.add('fade-out');
    next.classList.add('active');
    // Force display:flex before fading in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.classList.add('fade-in');
      });
    });
    setTimeout(() => {
      current.classList.remove('active', 'fade-out');
      next.classList.remove('fade-in');
    }, 250);
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'fade-out', 'fade-in'));
    next.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.classList.add('fade-in');
      });
    });
    setTimeout(() => next.classList.remove('fade-in'), 250);
  }
}

function spawnConfetti(x, y, count = 8) {
  const emojis = ['✨','⭐','💫','🌟','🎉'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.textContent = pick(emojis);
    el.style.left = (x + rnd(-30, 30)) + 'px';
    el.style.top = y + 'px';
    el.style.animationDelay = (i * 0.04) + 's';
    $('play-area').appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
}

function spawnSparkles(x, y, count = 10) {
  const sparkles = ['✨','⭐','💫','✦','✧'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle';
    el.textContent = pick(sparkles);
    const angle = (i / count) * Math.PI * 2;
    const dist = rnd(40, 80);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    el.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    el.style.animationDelay = (i * 0.03) + 's';
    el.style.fontSize = rnd(0.8, 1.4) + 'em';
    $('play-area').appendChild(el);
    setTimeout(() => el.remove(), 600);
  }
}

function floatMessage(text, x, y, type = 'good') {
  const el = document.createElement('div');
  el.className = 'float-msg ' + type;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  $('play-area').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function floatCoin(x, y) {
  const el = document.createElement('div');
  el.className = 'float-coin';
  el.textContent = '🪙';
  el.style.left = (x + rnd(-15, 15)) + 'px';
  el.style.top = y + 'px';
  $('play-area').appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function interactWithCustomer(personId) {
  const p = game.people.find(person => person.id === personId);
  if (!p || p.greeted || p.frozen) return;
  if (!['enterDoor', 'enter', 'findStall', 'toStall', 'entering', 'exitStall', 'toSink', 'toTowels', 'exit'].includes(p.phase)) return;

  p.greeted = true;
  const isCalming = p.urgent;
  const isCharming = p.vip && !isCalming;
  const isChatting = !isCharming && !isCalming;
  const points = addScore(isCharming ? 28 : (isCalming ? 18 : 12));
  p.patience = Math.min(p.maxPatience, p.patience + (isCharming ? 1050 : (isCalming ? 1200 : 525)));
  if (isCalming) {
    p.urgent = false;
    p.thought = pick(['Okay, okay...', 'Made it in time!', 'Whew, thanks!']);
  } else if (isCharming) {
    p.thought = pick(['Excellent service.', 'Much appreciated.', 'Classy place!']);
  } else if (p.gender === 'female') {
    p.thought = pick(['Why, hello!', 'Much obliged!', 'Well hi there!']);
  } else {
    p.thought = pick(['Howdy!', 'Thanks, friend!', 'Hey there!']);
  }
  p.thoughtMood = 'good';
  p.thoughtTimer = 1400;
  p.interactionPulse = 420;
  floatMessage(`+${points} ${isCalming ? 'CALM' : (isCharming ? 'CHARM' : 'CHAT')}`, p.x + 10, p.y - 18, 'good');
  bumpValue('score');
  playClick();
  haptic('light');
}

function checkComboMilestone() {
  // Find highest milestone we've reached
  const milestones = CONFIG.comboMilestones;
  for (let i = milestones.length - 1; i >= 0; i--) {
    const m = milestones[i];
    if (game.combo >= m.level && game.lastMilestone < m.level) {
      // Reached a new milestone!
      game.lastMilestone = m.level;

      // Rewards
      if (m.speedBoost > 0) game.comboBoost = m.speedBoost;
      if (m.rating > 0) { game.rating = clamp(game.rating + m.rating, 0, 5); bumpValue('rating'); }
      if (m.points > 0) { addScore(m.points); bumpValue('score'); }

      // Visual feedback
      const banner = $('combo-milestone');
      banner.textContent = m.msg;
      banner.classList.remove('show', 'legendary');
      void banner.offsetWidth; // Force reflow
      banner.classList.add('show');
      if (m.level >= 10) banner.classList.add('legendary');
      setTimeout(() => banner.classList.remove('show', 'legendary'), 1500);

      // Screen flash
      $('play-area').classList.add('combo-flash');
      setTimeout(() => $('play-area').classList.remove('combo-flash'), 400);

      // Sound & haptics
      playComboMilestone(m.level);
      haptic('strong');

      // Extra confetti for big milestones
      const confettiCount = m.level >= 10 ? 25 : (m.level >= 5 ? 18 : 12);
      spawnConfetti(400, 150, confettiCount);

      break; // Only trigger one milestone at a time
    }
  }
}

function showComboBreak(hadCombo) {
  if (hadCombo >= 3) {
    const breakMsg = $('combo-break');
    breakMsg.classList.remove('show');
    void breakMsg.offsetWidth;
    breakMsg.classList.add('show');
    setTimeout(() => breakMsg.classList.remove('show'), 800);
    playComboBreak();
  }
  game.lastMilestone = 0; // Reset milestone tracking
}

function buildStalls() {
  const row = $('stalls-row');
  row.innerHTML = '';
  const cfg = getShiftConfig();
  game.stalls = [];

  for (let i = 0; i < cfg.stalls; i++) {
    game.stalls.push({
      state: 'empty',
      timer: 0,
      tasks: [],
      customer: '',
      doorOpen: false,
      doorTimer: 0,
      wasVip: false,
      reservedBy: null
    });

    const el = document.createElement('div');
    el.className = 'stall empty';
    el.dataset.index = i;
    el.innerHTML = `
      <div class="stink-lines"><div class="stink-line"></div><div class="stink-line"></div><div class="stink-line"></div></div>
      <div class="stall-fly">🪰</div>
      <div class="stall-light"></div>
      <div class="stall-body">
        <div class="stall-icon">🚽</div>
        <div class="stall-label"></div>
        <div class="stall-bar" style="width:0"></div>
        <div class="stall-door"></div>
      </div>
      <div class="stall-num">${i+1}</div>
    `;
    el.addEventListener('click', () => clickStall(i));
    row.appendChild(el);
  }
}

function buildSinks() {
  const container = $('sinks-area');
  const platform = $('sink-towel-area');
  const floorArea = $('floor-area');
  container.innerHTML = '';
  const cfg = getShiftConfig();
  game.sinks = [];

  if (platform) platform.dataset.sinks = String(cfg.sinks);
  if (container) container.dataset.sinks = String(cfg.sinks);
  if (floorArea) floorArea.dataset.sinks = String(cfg.sinks);

  for (let i = 0; i < cfg.sinks; i++) {
    game.sinks.push({dirty: false, cleaning: false, progress: 0});

    const el = document.createElement('div');
    el.className = 'sink';
    el.dataset.index = i;
    el.innerHTML = `<div class="sink-bowl"></div><div class="sink-label">SINK</div>`;
    el.addEventListener('click', () => clickSink(i));
    container.appendChild(el);
  }
}

function updateStallDOM(i) {
  const stall = game.stalls[i];
  const el = $('stalls-row').children[i];
  if (!el) return;

  el.className = 'stall ' + stall.state;
  el.querySelector('.stall-door').classList.toggle('open', stall.doorOpen);

  const icon = el.querySelector('.stall-icon');
  const label = el.querySelector('.stall-label');
  const bar = el.querySelector('.stall-bar');

  if (stall.state === 'occupied') {
    icon.textContent = '🚽';
    label.textContent = '';
  } else if (stall.state === 'dirty') {
    icon.textContent = '💩';
    label.textContent = 'DIRTY';
  } else if (stall.state === 'cleaning') {
    icon.textContent = '🧹';
    label.textContent = '';
    const total = stall.tasks.length;
    const done = stall.tasks.filter(t => t.done).length;
    const currentProg = game.activeTask >= 0 ? (game.taskProgress / getEffectiveTaskTime()) : 0;
    const progress = ((done + currentProg) / total) * 100;
    bar.style.width = Math.min(100, progress) + '%';
  } else {
    icon.textContent = '🚽';
    label.textContent = '';
    bar.style.width = '0';
  }
}

function setStallDoor(i, isOpen, holdMs = 0) {
  const stall = game.stalls[i];
  if (!stall) return;
  stall.doorOpen = isOpen;
  stall.doorTimer = isOpen ? holdMs : 0;
  updateStallDOM(i);
}

function updateExitDoorDOM() {
  const exitDoor = $('exit-door');
  if (!exitDoor) return;
  exitDoor.classList.toggle('open', !!game.exitDoorOpen);
}

function openExitDoor(holdMs = 0) {
  game.exitDoorOpen = true;
  game.exitDoorTimer = Math.max(game.exitDoorTimer || 0, holdMs);
  updateExitDoorDOM();
}

function closeExitDoor() {
  game.exitDoorOpen = false;
  game.exitDoorTimer = 0;
  updateExitDoorDOM();
}

function updateSinkDOM(i) {
  const sink = game.sinks[i];
  const el = $('sinks-area').children[i];
  if (!el) return;
  el.classList.toggle('dirty', sink.dirty);
  el.classList.toggle('cleaning', sink.cleaning);
}

function getDirtyCount() {
  return game.stalls.filter(s => s.state === 'dirty').length;
}

function updateHUD() {
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += game.rating >= i + 0.75 ? '⭐' : (game.rating >= i + 0.25 ? '🌟' : '☆');
  }
  $('rating').textContent = stars;
  const ratingEl = $('rating');
  const playArea2 = $('play-area');
  if (game.rating <= 1) {
    ratingEl.style.animation = 'blink 0.3s infinite';
    playArea2.classList.add('rating-critical');
  } else if (game.rating <= 1.5) {
    ratingEl.style.animation = 'blink 0.8s infinite';
    playArea2.classList.remove('rating-critical');
  } else {
    ratingEl.style.animation = '';
    playArea2.classList.remove('rating-critical');
  }

  $('score').textContent = Math.floor(game.score);

  const comboMult = 1 + game.combo * 0.5;
  const boostIcon = game.comboBoost > 0 ? '⚡' : '';
  const comboEl = $('combo');
  const playArea = $('play-area');
  comboEl.textContent = game.combo > 0 ? `${boostIcon}x${comboMult.toFixed(1)}` : 'x1';
  comboEl.style.color = game.combo >= 10 ? '#ffd700' : (game.combo >= 5 ? '#ff5722' : (game.combo >= 3 ? '#f5a623' : '#fff'));
  comboEl.style.transform = game.combo >= 10 ? 'scale(1.5)' : (game.combo >= 5 ? 'scale(1.35)' : (game.combo >= 3 ? 'scale(1.2)' : 'scale(1)'));
  // Escalating combo visual effects
  comboEl.classList.toggle('combo-fire', game.combo >= 3 && game.combo < 5);
  comboEl.classList.toggle('combo-intense', game.combo >= 5 && game.combo < 10);
  comboEl.classList.toggle('combo-legendary', game.combo >= 10);
  playArea.classList.toggle('combo-edge-glow', game.combo >= 5 && game.combo < 10);
  playArea.classList.toggle('combo-edge-legendary', game.combo >= 10);

  const dirtyCount = getDirtyCount();
  const dirtySinks = game.sinks ? game.sinks.filter(s => s.dirty).length : 0;
  const totalDirty = dirtyCount + dirtySinks;
  $('dirty-count').textContent = totalDirty > 0 ? `⚠️ ${dirtyCount}🚽${dirtySinks > 0 ? `+${dirtySinks}🚿` : ''}` : '✓';
  $('dirty-count').style.color = totalDirty > 3 ? '#e53935' : (totalDirty > 0 ? '#fdd835' : '#43a047');

  // Keep dirty-sinks element but hide if merged
  const sinksEl = $('dirty-sinks');
  if (sinksEl) sinksEl.style.display = 'none';

  // Timer display - counts up in endless, down in campaign
  if (game.mode === 'endless') {
    const sec = Math.floor(game.time);
    $('timer').textContent = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
    $('timer').style.color = '#64b5f6'; // Blue for endless
    $('timer').style.animation = '';
  } else {
    const sec = Math.max(0, Math.ceil(game.time));
    $('timer').textContent = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
    $('timer').style.color = sec <= 10 ? '#e53935' : (sec <= 20 ? '#fdd835' : '#43a047');
    $('timer').style.animation = sec <= 10 ? 'blink 0.5s infinite' : '';
  }

  // Urgent beeping when time is low (campaign only)
  if (game.mode !== 'endless') {
    const sec = Math.max(0, Math.ceil(game.time));
    if (sec <= 10 && sec > 0 && game.running) {
      const now = Date.now();
      if (now - game.lastUrgentBeep > 1000) {
        playUrgent();
        game.lastUrgentBeep = now;
      }
    }
  }

  $('cnt-speed').textContent = game.powerups.speed;
  $('cnt-slow').textContent = game.powerups.slow;
  $('cnt-auto').textContent = game.powerups.auto;
  $('cnt-mascot').textContent = game.powerups.mascot;

  $('pow-speed').classList.toggle('disabled', game.powerups.speed <= 0 && game.effects.speed <= 0);
  $('pow-slow').classList.toggle('disabled', game.powerups.slow <= 0 && game.effects.slow <= 0);
  $('pow-auto').classList.toggle('disabled', game.powerups.auto <= 0);
  $('pow-mascot').classList.toggle('disabled', game.powerups.mascot <= 0 && game.effects.mascot <= 0);
  $('pow-speed').classList.toggle('active-effect', game.effects.speed > 0);
  $('pow-slow').classList.toggle('active-effect', game.effects.slow > 0);
  $('pow-mascot').classList.toggle('active-effect', game.effects.mascot > 0);
  // Powerup countdown timers
  updatePowerupTimer('pow-speed', game.effects.speed);
  updatePowerupTimer('pow-slow', game.effects.slow);
  updatePowerupTimer('pow-mascot', game.effects.mascot);

  const towelEl = $('towels');
  towelEl.classList.toggle('low', game.towels <= 2 && game.towels > 0);
  towelEl.classList.toggle('empty', game.towels === 0);
  // Update CSS-art paper sheets: 3 = full, 2 = medium, 1 = low, 0 = empty
  const sheetsEl = towelEl.querySelector('.towel-sheets');
  const sheetCount = game.towels > 5 ? 3 : (game.towels > 2 ? 2 : (game.towels > 0 ? 1 : 0));
  if (sheetsEl && sheetsEl.children.length !== sheetCount) {
    sheetsEl.innerHTML = Array.from({length: sheetCount}, () => '<div class="towel-sheet"></div>').join('');
  }
  towelEl.querySelector('.towel-label').textContent = game.towels === 0 ? 'EMPTY!' : 'TOWELS';
}

// ============ ENDLESS MODE ============

function isEndlessUnlocked() {
  return endlessUnlocked && isPremium();
}

function unlockEndless() {
  endlessUnlocked = true;
  localStorage.setItem('beaverEndlessUnlocked', 'true');
  updateOvertimeButton();
}

function updateOvertimeButton() {
  const btn = $('overtime-btn');
  if (!btn) return;
  if (isEndlessUnlocked()) {
    btn.classList.remove('locked');
    btn.textContent = '⏰ Overtime';
  } else {
    btn.classList.add('locked');
    btn.textContent = '🔒 Overtime';
  }
}

function startEndlessMode() {
  if (!isEndlessUnlocked()) {
    // Show message or paywall
    if (!isPremium()) {
      showPaywallModal('landing');
    } else {
      // Not unlocked yet - need to beat campaign first
      floatMessage('🔒 Beat all 6 shifts first!', window.innerWidth / 2, 150, 'bad');
    }
    return;
  }

  setupGameTouchGuards();
  init();
  game.mode = 'endless';
  game.shift = 5; // Use Shift 6 config (hardest)
  game.elapsed = 0;
  game.time = 0; // Will count up

  // Build bathroom with Shift 6 config
  buildStalls();
  buildSinks();
  hideTaskPanel();
  updateHUD();

  // Start with full powerups
  game.powerups = {speed: 2, slow: 2, auto: 1, mascot: 1};

  // Max out skills for endless
  game.skills = {scrub: 3, patience: 3, tips: 3};

  game.running = true;
  showScreen('game-screen');
  startMusic();
  startAutoSave();
  game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endlessGameOver() {
  game.running = false;
  stopMusic();
  stopAutoSave();
  clearSavedState();
  haptic('error');

  // Clean up
  if (game.mascotWalk || game.effects.mascot > 0) endMascotWalk();
  game.inspector = null;
  const inspectorEl = $('floor-area').querySelector('.inspector');
  if (inspectorEl) inspectorEl.remove();
  $('inspector-warning').style.display = 'none';
  cleanupFight();

  const finalScore = Math.floor(game.score);
  const minutesSurvived = Math.floor(game.elapsed / 60000);
  const secondsSurvived = Math.floor((game.elapsed % 60000) / 1000);
  const isNewRecord = finalScore > endlessHighScore;

  if (isNewRecord) {
    endlessHighScore = finalScore;
    localStorage.setItem('beaverEndlessHighScore', finalScore.toString());
    playWin();
  } else {
    playBad();
  }

  // Show game over screen with endless stats
  $('go-icon').textContent = '⏰';
  $('go-title').textContent = 'OVERTIME OVER!';
  $('go-score').textContent = finalScore.toLocaleString();
  $('go-comment').textContent = `You survived ${minutesSurvived}m ${secondsSurvived}s!`;
  $('go-stats').innerHTML = `
    <div class="stat"><div class="num">${game.stats.cleaned}</div><div class="lbl">Stalls Cleaned</div></div>
    <div class="stat"><div class="num">${game.stats.served}</div><div class="lbl">Customers Served</div></div>
    <div class="stat"><div class="num">${minutesSurvived}:${secondsSurvived.toString().padStart(2, '0')}</div><div class="lbl">Time Survived</div></div>
  `;

  // High score display
  const goHighScore = $('go-high-score');
  if (goHighScore) {
    goHighScore.textContent = `Endless High Score: ${endlessHighScore.toLocaleString()}`;
    goHighScore.classList.add('visible');
  }
  if (isNewRecord) {
    const recordEl = document.createElement('div');
    recordEl.className = 'new-record';
    recordEl.textContent = '🎉 NEW ENDLESS RECORD!';
    $('go-stats').appendChild(recordEl);
  }

  // Hide name input for endless (use existing name)
  $('go-name-section').style.display = 'none';
  $('retry-btn').textContent = 'Play Again';

  showScreen('gameover-screen');
}

// Daily Challenge Mode
function generateDailyConfig(seed) {
  // Seed the RNG with today's date
  seedRng(seed);

  // Generate shift parameters from seed (within reasonable bounds)
  const stalls = 6 + Math.floor(seededRng() * 4);  // 6-9 stalls
  const sinks = 2 + Math.floor(seededRng() * 2);   // 2-3 sinks
  const duration = 75 + Math.floor(seededRng() * 30); // 75-105 seconds
  const spawnMin = 1800 + Math.floor(seededRng() * 800);
  const spawnMax = spawnMin + 800 + Math.floor(seededRng() * 600);
  const occMin = 1400 + Math.floor(seededRng() * 400);
  const occMax = occMin + 800 + Math.floor(seededRng() * 600);

  // Special modifiers based on seed
  const hasInspector = seededRng() > 0.5;  // 50% chance
  const hasRushHour = seededRng() > 0.4;   // 60% chance
  const vipBoost = seededRng() > 0.7;      // 30% chance of extra VIPs

  return {
    stalls,
    sinks,
    duration,
    spawnMin,
    spawnMax,
    occMin,
    occMax,
    hasInspector,
    hasRushHour,
    vipBoost,
  };
}

function isDailyUnlocked() {
  return isPremium();
}

function checkDailyReset() {
  const today = getTodayString();
  if (dailyDate !== today) {
    // New day - reset daily stats
    dailyDate = today;
    dailyHighScore = 0;
    dailyAttempts = 0;
    localStorage.setItem('beaverDailyDate', today);
    localStorage.setItem('beaverDailyHighScore', '0');
    localStorage.setItem('beaverDailyAttempts', '0');
  }
}

function updateDailyButton() {
  const btn = $('daily-btn');
  if (!btn) return;

  checkDailyReset();

  // Just toggle locked class - don't replace innerHTML (button now uses SVG icon)
  if (!isDailyUnlocked()) {
    btn.classList.add('locked');
  } else {
    btn.classList.remove('locked');
  }
}

function startDailyMode() {
  if (!isDailyUnlocked()) {
    showPaywallModal('landing');
    return;
  }

  checkDailyReset();
  dailyAttempts++;
  localStorage.setItem('beaverDailyAttempts', dailyAttempts.toString());

  init();
  game.mode = 'daily';
  game.shift = 0;
  game.elapsed = 0;

  // Seed RNG with today's date and generate config
  const seed = getDailySeed();
  seedRng(seed);
  game.dailyConfig = generateDailyConfig(seed);

  // Re-seed for gameplay (config generation consumed some RNG calls)
  seedRng(seed);

  // Apply daily config
  const cfg = game.dailyConfig;
  game.time = cfg.duration;

  // Override CONFIG for this mode
  game.dailyShiftOverride = {
    stalls: cfg.stalls,
    sinks: cfg.sinks,
    duration: cfg.duration,
    spawnMin: cfg.spawnMin,
    spawnMax: cfg.spawnMax,
    occMin: cfg.occMin,
    occMax: cfg.occMax,
  };

  // Set up modifiers
  if (cfg.hasInspector) {
    game.inspectorTimer = rnd(20000, 45000);
  }
  if (cfg.hasRushHour) {
    game.rushTimer = rnd(15000, 35000);
  }

  // Start with moderate powerups
  game.powerups = {speed: 1, slow: 1, auto: 0, mascot: 0};
  game.skills = {scrub: 1, patience: 1, tips: 1};

  buildStalls();
  buildSinks();
  hideTaskPanel();
  updateHUD();
  showScreen('game-screen');
  $('rush-warning').style.display = 'none';
  $('inspector-warning').style.display = 'none';
  $('fight-warning').style.display = 'none';
  $('pause-overlay').classList.remove('active');

  // Track daily challenge start
  trackEvent('daily_start', { seed: getDailySeed(), attempt: dailyAttempts });

  game.running = true;
  game.paused = false;
  game.lastTime = performance.now();
  startMusic();
  startAutoSave();
  requestAnimationFrame(gameLoop);
}

function dailyGameOver() {
  game.running = false;
  stopMusic();
  stopAutoSave();
  clearSavedState();

  // Clean up
  if (game.mascotWalk || game.effects.mascot > 0) endMascotWalk();
  game.inspector = null;
  const inspectorEl = $('floor-area').querySelector('.inspector');
  if (inspectorEl) inspectorEl.remove();
  $('inspector-warning').style.display = 'none';
  cleanupFight();

  const finalScore = Math.floor(game.score);
  const isNewRecord = finalScore > dailyHighScore;

  if (isNewRecord) {
    dailyHighScore = finalScore;
    localStorage.setItem('beaverDailyHighScore', finalScore.toString());
    playWin();
    haptic('success');
  } else {
    playBad();
    haptic('medium');
  }

  // Calculate grade
  const grade = getGrade();

  // Show game over screen
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'});

  $('go-icon').textContent = '📅';
  $('go-title').textContent = 'DAILY CHALLENGE';
  $('go-score').textContent = finalScore.toLocaleString();
  $('go-msg').textContent = isNewRecord
    ? `🎉 New daily best! Attempt #${dailyAttempts}`
    : `Today's best: ${dailyHighScore.toLocaleString()}`;
  $('go-stats').innerHTML = `
    <div class="stat"><div class="num">${dateStr}</div><div class="lbl">${getTodayString()}</div></div>
    <div class="stat"><div class="num">${game.stats.cleaned}</div><div class="lbl">Stalls Cleaned</div></div>
    <div class="stat"><div class="num">${game.stats.served}</div><div class="lbl">Customers Served</div></div>
  `;

  // High score display
  const goHighScore = $('go-high-score');
  if (goHighScore) {
    goHighScore.textContent = `Daily Best: ${dailyHighScore.toLocaleString()}`;
    goHighScore.classList.add('visible');
  }
  if (isNewRecord) {
    const recordEl = document.createElement('div');
    recordEl.className = 'new-record';
    recordEl.textContent = '🎉 NEW DAILY BEST!';
    $('go-stats').appendChild(recordEl);
  }

  // Submit to daily leaderboard
  if (isPremium() && playerName) {
    submitDailyScore(finalScore, grade);
  }

  // Hide name input (use existing name)
  $('go-name-section').style.display = 'none';
  $('retry-btn').textContent = 'Try Again';

  showScreen('gameover-screen');
}

function applyShiftTheme(shiftIdx) {
  const theme = SHIFT_THEMES[shiftIdx] || SHIFT_THEMES[0];
  const bathroom = $('bathroom');
  if (!bathroom) return;
  bathroom.style.background = `linear-gradient(180deg, ${theme.wall} 0%, ${theme.floor} 100%)`;
  bathroom.style.setProperty('--wall-detail', theme.wallDetail);
  bathroom.style.setProperty('--accent', theme.accent);
  // Wall sign
  let sign = bathroom.querySelector('.shift-sign');
  if (!sign) {
    sign = document.createElement('div');
    sign.className = 'shift-sign';
    bathroom.appendChild(sign);
  }
  sign.textContent = theme.sign;
}

function showShiftIntro() {
  const cfg = getShiftConfig();
  const narrative = SHIFT_NARRATIVES[game.shift] || SHIFT_NARRATIVES[0];
  $('intro-shift-num').textContent = narrative.progress || `SHIFT ${game.shift + 1}`;
  $('intro-title').textContent = narrative.name;
  $('intro-desc').textContent = narrative.desc;
  // Pick a random tip for this shift from Beaver
  const shiftTips = BEAVER_TIPS[game.shift] || BEAVER_TIPS[0];
  const tip = shiftTips[Math.floor(rand() * shiftTips.length)];
  $('intro-tip').textContent = tip;
  $('intro-stalls').textContent = cfg.stalls;
  $('intro-sinks').textContent = cfg.sinks;
  $('intro-time').textContent = cfg.duration;
  showScreen('shift-intro');
}

function startShift() {
  // Track game start
  trackEvent('game_start', { mode: game.mode, shift: game.shift, gender: game.gender });
  applyShiftTheme(game.shift);

  const cfg = getShiftConfig();
  game.time = cfg.duration;
  game.spawnTimer = rnd(300, 800);
  game.people = [];
  game.stats = {cleaned: 0, served: 0, dirty: 0, abandoned: 0, saves: 0};
  game.activeStall = -1;
  game.activeTask = -1;
  game.taskProgress = 0;
  game.towels = 10;
  game.rushMode = false;
  game.rushTimer = 0;
  game.inspector = null;
  game.inspectorTimer = 0;
  game.inspectorWarning = 0;
  game.fight = null;
  game.fightTimer = 0;
  game.fightWarning = 0;
  game.puddles = [];
  document.querySelectorAll('.puddle').forEach(el => el.remove());

  // Set starting item counts based on item upgrades
  // Powerups: start with 1 of each basic item
  // Extra items purchased with coins carry over between shifts
  if (!game.powerups) {
    game.powerups = {speed: 1, slow: 1, auto: 0, mascot: 0};
  }

  // No random events in multiplayer — pure head-to-head cleaning
  if (game.mode !== 'multiplayer') {
    // Maybe trigger inspector visit (not on first shift, or always in daily)
    if (rand() < CONFIG.inspectorChance && game.shift > 0) {
      game.inspectorTimer = rnd(20000, 40000);
    }

    // Maybe trigger fight (not on first shift)
    if (rand() < CONFIG.fightChance && game.shift > 0) {
      game.fightTimer = rnd(25000, 50000);
    }

    // Maybe trigger rush hour
    if (rand() < CONFIG.rushChance && game.shift > 0) {
      game.rushTimer = rnd(15000, 30000);
    }
  }

  buildStalls();
  buildSinks();
  setupGameTouchGuards();
  hideTaskPanel();
  updateHUD();
  showScreen('game-screen');
  $('rush-warning').style.display = 'none';
  $('inspector-warning').style.display = 'none';
  $('fight-warning').style.display = 'none';
  $('pause-overlay').classList.remove('active');

  // Countdown before gameplay starts
  const cdOverlay = $('shift-countdown');
  const cdNum = cdOverlay.querySelector('.countdown-number');
  cdOverlay.classList.remove('hidden');
  game.running = false;
  game.paused = false;

  const steps = ['3', '2', '1', 'GO!'];
  let step = 0;
  function nextStep() {
    if (step >= steps.length) {
      cdOverlay.classList.add('hidden');
      game.running = true;
      game.lastTime = performance.now();
      if (game.people.length === 0) {
        spawnCustomer();
        game.spawnTimer = rnd(Math.max(900, cfg.spawnMin * 0.55), Math.max(1400, cfg.spawnMin * 0.8));
      }
      startMusic();
      startAutoSave();
      requestAnimationFrame(gameLoop);
      return;
    }
    cdNum.textContent = steps[step];
    cdNum.classList.remove('countdown-pop');
    void cdNum.offsetWidth;
    cdNum.style.animation = 'none';
    void cdNum.offsetWidth;
    cdNum.style.animation = '';
    if (step < 3) playTone(330 + step * 110, 0.1, 'square', 0.15);
    else playSweep(440, 880, 0.3, 'square', 0.2);
    step++;
    setTimeout(nextStep, step <= 3 ? 700 : 500);
  }
  nextStep();
}

function gameLoop(now) {
  if (!game.running) return;

  // Monitor performance
  updatePerfMonitor(now);

  // Skip game logic when paused but keep loop running
  if (game.paused) {
    game.lastTime = now;
    requestAnimationFrame(gameLoop);
    return;
  }

  const dt = Math.min(now - game.lastTime, 100);
  game.lastTime = now;

  try {
    update(dt);
  } catch(e) { console.error('update error:', e); }

  // Throttle HUD updates for better mobile performance
  try {
    if (now - perf.lastHudUpdate >= perf.hudUpdateInterval) {
      updateHUD();
      perf.lastHudUpdate = now;
    }
    renderPeople();
  } catch(e) { console.error('render error:', e); }

  requestAnimationFrame(gameLoop);
}

function update(dt) {
  const cfg = getShiftConfig();

  if (game.exitDoorTimer > 0) {
    game.exitDoorTimer -= dt;
    if (game.exitDoorTimer <= 0) closeExitDoor();
  }

  // Endless mode: count up, end on rating 0
  if (game.mode === 'endless') {
    game.elapsed += dt;
    game.time += dt / 1000; // Count up for display
    // End game when rating hits 0
    if (game.rating <= 0) {
      game.rating = 0;
      endlessGameOver();
      return;
    }
  } else if (game.mode === 'daily') {
    // Daily mode: single shift, count down, end on time or rating 0
    game.time -= dt / 1000;
    if (game.time <= 0 || game.rating <= 0) {
      dailyGameOver();
      return;
    }
    if (game.time <= 15 && game.time > 14.5) showBeaverTip('lowTime');
  } else {
    // Campaign mode: count down
    game.time -= dt / 1000;
    if (game.time <= 0) {
      endShift();
      return;
    }
    // Low time warning at 15 seconds
    if (game.time <= 15 && game.time > 14.5) showBeaverTip('lowTime');
  }

  // Rush hour logic
  if (game.rushTimer > 0) {
    game.rushTimer -= dt;
    if (game.rushTimer <= 0 && !game.rushMode) {
      game.rushMode = true;
      game.rushDuration = 8000;
      $('rush-warning').style.display = 'block';
      playRush();
      screenShake();
      setBeaverMood('worried', 0); // Stay worried during rush
    }
  }
  if (game.rushMode) {
    game.rushDuration -= dt;
    // Random mess spawn during rush (chaos!) - scaled by shift
    if (rand() < CONFIG.messChance.walkwayRandom * getMessScale() * (dt / 1000)) {
      spawnRandomMess();
    }
    // Show countdown in rush warning
    const rushSec = Math.max(0, Math.ceil(game.rushDuration / 1000));
    $('rush-warning').textContent = `🚌 TOUR BUS! ${rushSec}s 🚌`;
    if (game.rushDuration <= 0) {
      game.rushMode = false;
      $('rush-warning').style.display = 'none';
      $('rush-warning').textContent = '🚌 TOUR BUS ARRIVING! 🚌';
      if (!game.inspector && !game.fight) setBeaverMood('idle', 0);
    }
  }

  // Health inspector logic
  if (game.inspectorTimer > 0 && !game.inspector) {
    game.inspectorTimer -= dt;
    // Show warning 3 seconds before arrival
    if (game.inspectorTimer <= 3000 && game.inspectorWarning === 0) {
      game.inspectorWarning = 3000;
      $('inspector-warning').style.display = 'block';
      playInspector();
      haptic('warning'); // Alert player to inspector
      setBeaverMood('worried', 0);
      showBeaverTip('inspectorComing');
    }
    if (game.inspectorWarning > 0) {
      game.inspectorWarning -= dt;
    }
    if (game.inspectorTimer <= 0) {
      spawnInspector();
      $('inspector-warning').style.display = 'none';
    }
  }

  // Update inspector
  if (game.inspector) {
    updateInspector(dt);
  }

  // Customer fight logic
  if (game.fightTimer > 0 && !game.fight) {
    game.fightTimer -= dt;
    if (game.fightTimer <= 3000 && game.fightWarning === 0) {
      game.fightWarning = 3000;
      $('fight-warning').style.display = 'block';
      haptic('warning');
      setBeaverMood('worried', 0);
      showBeaverTip('fightBreaking');
    }
    if (game.fightWarning > 0) {
      game.fightWarning -= dt;
    }
    if (game.fightTimer <= 0) {
      spawnFight();
      // Keep banner visible during approaching phase — hide when fight zone appears
      if (!game.fight) {
        // spawnFight failed (not enough customers), banner stays for retry
      }
    }
  }

  // Update fight
  if (game.fight) {
    updateFight(dt);
  }

  // Spawn customers
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnCustomer();
    let interval = rnd(cfg.spawnMin, cfg.spawnMax);
    if (game.effects.slow > 0) interval *= 2;
    if (game.rushMode) interval *= 0.3; // Much faster during rush
    // Endless mode: spawn faster over time (15% faster per minute)
    if (game.mode === 'endless') {
      const minutesPlayed = Math.floor(game.elapsed / 60000);
      const spawnMultiplier = 1 / (1 + minutesPlayed * 0.15);
      interval *= spawnMultiplier;
    }
    game.spawnTimer = interval;
  }

  // Update stalls
  for (let i = 0; i < game.stalls.length; i++) {
    const stall = game.stalls[i];

    if (stall.state === 'occupied') {
      stall.timer -= dt;
      if (stall.timer <= 0) {
        customerLeaves(i);
      }
    }

    if (stall.doorOpen && stall.doorTimer > 0) {
      stall.doorTimer -= dt;
      if (stall.doorTimer <= 0 && stall.state !== 'occupied') {
        setStallDoor(i, false);
      }
    }
  }

  // Update active cleaning (auto-progress, but clicking is faster!)
  if (game.activeStall >= 0 && game.activeTask >= 0) {
    const stall = game.stalls[game.activeStall];
    // Guard: ensure active task still valid
    if (!stall || !stall.tasks || !stall.tasks[game.activeTask] || stall.tasks[game.activeTask].done) {
      game.activeTask = -1;
      game.activeStall = -1;
      hideTaskPanel();
    } else {
      const speed = game.effects.speed > 0 ? 2 : 1;
      game.taskProgress += dt * 0.4 * speed; // Modest auto-progress so stalls feel less click-heavy

      if (game.taskProgress >= getEffectiveTaskTime()) {
        completeTask();
      }
      updateStallDOM(game.activeStall);
      updateActiveTaskProgressUI();
    }
  }

  // Update sinks
  for (let i = 0; i < game.sinks.length; i++) {
    const sink = game.sinks[i];
    if (sink.cleaning) {
      sink.progress += dt;
      if (sink.progress >= CONFIG.sinkCleanTime) {
        sink.cleaning = false;
        sink.dirty = false;
        sink.progress = 0;
        addScore(25);
        playTaskComplete();
        floatMessage('+25', 400, 350, 'good');
      }
      updateSinkDOM(i);
    }
  }

  updatePeople(dt);

  if (game.effects.speed > 0) game.effects.speed -= dt;
  if (game.effects.slow > 0) game.effects.slow -= dt;
  if (game.effects.mascot > 0) {
    game.effects.mascot -= dt;
    updateMascotWalk(dt);
    if (game.effects.mascot <= 0) {
      endMascotWalk();
    }
  }
  if (game.comboBoost > 0) game.comboBoost -= dt;


  // Combo pressure timer - resets combo if you idle too long at 3x+
  if (game.combo >= 3 && game.comboTimer > 0) {
    game.comboTimer -= dt;
    const timerEl = $('combo-timer');
    if (timerEl) {
      const pct = Math.max(0, game.comboTimer / game.comboTimerMax * 100);
      timerEl.style.width = pct + '%';
      timerEl.classList.toggle('active', pct > 0);
      timerEl.classList.toggle('warning', pct < 30);
    }
    if (game.comboTimer <= 0) {
      // Combo expired!
      game.combo = 0;
      game.comboBoost = 0;
      game.lastMilestone = 0;
      const comboBreak = $('combo-break');
      comboBreak.classList.remove('show');
      void comboBreak.offsetWidth;
      comboBreak.classList.add('show');
      setBeaverMood('sad', 1500);
      screenShake(0.5);
      const timerEl2 = $('combo-timer');
      if (timerEl2) { timerEl2.style.width = '0'; timerEl2.classList.remove('active', 'warning'); }
    }
  }

  // Floor messes age and penalize rating if left uncleaned
  game.puddles.forEach(p => {
    p.age = (p.age || 0) + dt;
    if (p.age > 8000 && !p.penalized) {
      p.penalized = true;
      game.rating = Math.max(0, game.rating - 0.15);
      floatMessage('-⭐ Messy floor!', p.x, p.y - 20, 'bad');
    }
  });

  if (game.rating <= 0) {
    if (game.mode === 'multiplayer' && mpState.active) {
      // In 1v1: hitting 0 stars = automatic loss, end the match
      endShift();
    } else {
      gameOver();
    }
  }
}

function spawnCustomer() {
  if (game.people.filter(p => p.phase !== 'exit').length >= 12) return;

  const floor = $('floor-area');
  const rect = floor.getBoundingClientRect();
  const exitDoor = $('exit-door').getBoundingClientRect();

  // Check for special character spawn first (premium only, disabled in multiplayer for fairness)
  const genderFilter = game.gender === 'male' ? 'male' : 'female';
  let special = null;

  // Special characters only for premium users (disabled in MP for fairness)
  if (isPremium() && game.mode !== 'multiplayer') {
    const eligibleSpecials = SPECIAL_CUSTOMERS.filter(c => c.gender === genderFilter);
    for (const sc of eligibleSpecials) {
      if (rand() < sc.chance) {
        special = sc;
        break;
      }
    }
  }

  let isUrgent, isVip, messiness, shirt, icon, specialName, specialBadge, specialThoughts;

  if (special) {
    // Special character - use their specific properties
    specialName = special.name;
    specialBadge = special.badge;
    specialThoughts = special.thoughts;
    icon = special.icon;
    shirt = special.shirt;
    messiness = special.messiness;
    isUrgent = special.patience < 0.7; // Low patience = urgent behavior
    isVip = false; // Special characters aren't VIPs (they're their own thing)
  } else {
    // Regular customer
    specialName = null;
    specialBadge = null;
    specialThoughts = null;
    icon = pick(getCustomers());
    isUrgent = rand() < 0.2; // 20% chance of urgent customer
    // VIP customers only for premium users (disabled in MP for fairness)
    isVip = isPremium() && game.mode !== 'multiplayer' && !isUrgent && rand() < 0.12;

    // Messiness: 0 = average, -1 = clean (sparkle), 1 = messy (more tasks)
    const messRoll = rand();
    messiness = messRoll < 0.15 ? -1 : (messRoll < 0.35 ? 1 : 0);

    // Variety of shirt colors for personality
    const shirtColors = [
      {top:'#5a8dd8',bot:'#3d6cb8',border:'#2d5090'}, // Blue
      {top:'#e57373',bot:'#c62828',border:'#b71c1c'}, // Red
      {top:'#81c784',bot:'#43a047',border:'#2e7d32'}, // Green
      {top:'#ffb74d',bot:'#fb8c00',border:'#e65100'}, // Orange
      {top:'#ba68c8',bot:'#8e24aa',border:'#6a1b9a'}, // Purple
      {top:'#4dd0e1',bot:'#00acc1',border:'#00838f'}, // Cyan
      {top:'#f06292',bot:'#e91e63',border:'#c2185b'}, // Pink
      {top:'#aed581',bot:'#7cb342',border:'#558b2f'}, // Lime
    ];

    // Determine shirt color based on type
    if (isVip) {
      shirt = {top:'#ffd700',bot:'#daa520',border:'#b8860b'}; // Gold for VIP
    } else if (messiness === 1) {
      shirt = {top:'#a67c52',bot:'#8b5a2b',border:'#6d4c2a'}; // Brown for messy
    } else if (messiness === -1) {
      shirt = {top:'#81d4fa',bot:'#4fc3f7',border:'#0288d1'}; // Light blue for clean
    } else {
      shirt = pick(shirtColors);
    }
  }

  // Calculate patience based on special character or regular modifiers
  const basePat = getEffectivePatience();
  let patience;
  if (special) {
    patience = basePat * special.patience;
  } else if (isUrgent) {
    patience = basePat * 0.6;
  } else if (isVip) {
    patience = basePat * 0.8;
  } else {
    patience = basePat;
  }

  // Special characters get an enter thought
  const enterThought = specialThoughts && specialThoughts.enter ? specialThoughts.enter : '';
  const enterTimer = enterThought ? 2500 : 0;
  const visual = getCustomerVisualProfile(genderFilter, specialName);
  openExitDoor(520);

  game.people.push({
    id: ++game.personId,
    icon: icon,
    gender: genderFilter,
    x: exitDoor.left - rect.left + 15,
    y: exitDoor.top - rect.top + 20,
    phase: 'enterDoor',
    doorTimer: 220,
    target: -1,
    patience: patience,
    maxPatience: patience,
    urgent: isUrgent,
    vip: isVip,
    messiness: messiness,
    thought: enterThought,
    thoughtMood: 'neutral',
    thoughtTimer: enterTimer,
    shirt: shirt,
    visual,
    specialName: specialName,
    specialBadge: specialBadge,
    specialThoughts: specialThoughts,
    enterOffsetX: rnd(-30, 30), // Random X offset for natural-looking enter paths
    greeted: false,
  });

  if (isVip) {
    showBeaverTip('vipCustomer');
    playVIPFanfare();
  }

  // Entry messes — muddy boots, urgent accidents, or sick arrivals
  // Scaled by shift so early shifts focus on stall cleaning
  const p = game.people[game.people.length - 1];
  const mScale = getMessScale();
  if (floor && mScale > 0) {
    const floorRect = floor.getBoundingClientRect();
    // Muddy boots on entry (messy customers or random chance)
    if (rand() < (messiness === 1 ? 0.11 : 0.018) * mScale) {
      spawnPuddle(p.x + rnd(-20, 20), floorRect.height - rnd(10, floorRect.height * 0.6), 'muddy');
    }
    // Urgent customers might have a pee accident on entry
    if (isUrgent && rand() < 0.028 * mScale) {
      spawnPuddle(p.x + rnd(-25, 25), floorRect.height - rnd(20, floorRect.height * 0.6), 'pee');
    }
    // Small chance of vomit on arrival (sick travelers)
    if (rand() < (messiness === 1 ? CONFIG.messChance.vomitSick * 0.3 : CONFIG.messChance.vomitSick * 0.12) * mScale) {
      spawnPuddle(p.x + rnd(-20, 20), floorRect.height - rnd(15, floorRect.height * 0.6), 'vomit');
    }
  }
}

// Get mess scale factor for the current shift (0 on shift 1, ramps to 1.0)
function getMessScale() {
  const idx = Math.min(game.shift, CONFIG.messScaleByShift.length - 1);
  return CONFIG.messScaleByShift[idx];
}

function getLocalObstacleRect(el, floorRect, padX = 0, padTop = 0, padBottom = 0) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left - floorRect.left - padX,
    right: rect.right - floorRect.left + padX,
    top: rect.top - floorRect.top - padTop,
    bottom: rect.bottom - floorRect.top + padBottom,
    centerX: rect.left - floorRect.left + rect.width / 2,
  };
}

const CUSTOMER_BODY_HEIGHT = 64;
const CUSTOMER_BODY_WIDTH = 50;
const SINK_STAND_OFFSET = 34;
const TOWEL_STAND_OFFSET = 32;

function pushCustomerOutOfRect(p, obstacle) {
  if (!obstacle) return;
  const footX = p.x + CUSTOMER_BODY_WIDTH * 0.5;
  const footY = p.y + CUSTOMER_BODY_HEIGHT;
  if (footX <= obstacle.left || footX >= obstacle.right || footY <= obstacle.top || footY >= obstacle.bottom) return;

  const sidePush = footX < obstacle.centerX ? obstacle.left - CUSTOMER_BODY_WIDTH * 0.6 : obstacle.right - CUSTOMER_BODY_WIDTH * 0.4;
  const pushUp = obstacle.top - CUSTOMER_BODY_HEIGHT - 6;
  const distUp = Math.abs(p.y - pushUp);
  const distSide = Math.abs(p.x - sidePush);

  if (distUp <= distSide * 1.15) {
    p.y = pushUp;
  } else {
    p.x = sidePush;
    p.y = Math.min(p.y, obstacle.top - CUSTOMER_BODY_HEIGHT * 0.75);
  }
}

// Keep roaming customers off the sink block and towel dispenser.
function deflectFromFixtures(p, floorRect) {
  const platformRect = getLocalObstacleRect($('sink-towel-area'), floorRect, 18, 22, 10);
  const sinksRect = getLocalObstacleRect($('sinks-area'), floorRect, 18, 20, 12);
  const towelsRect = getLocalObstacleRect($('towels'), floorRect, 18, 20, 10);
  const footX = p.x + CUSTOMER_BODY_WIDTH * 0.5;
  const footY = p.y + CUSTOMER_BODY_HEIGHT;

  if (platformRect && footX > platformRect.left && footX < platformRect.right && footY > platformRect.top) {
    p.y = platformRect.top - CUSTOMER_BODY_HEIGHT - 6;
  }
  pushCustomerOutOfRect(p, sinksRect);
  pushCustomerOutOfRect(p, towelsRect);
}

function getFixtureStandY(el, floorRect, offset = 48) {
  if (!el) return floorRect.height - 120;
  const rect = el.getBoundingClientRect();
  return rect.top - floorRect.top - CUSTOMER_BODY_HEIGHT - offset;
}

function isCustomerMovingOnFloor(p) {
  return ['enterDoor', 'enter', 'findStall', 'toStall', 'entering', 'exitStall', 'toSink', 'toTowels', 'exit'].includes(p.phase) && !p.frozen;
}

function separateCustomers(floorRect) {
  const movers = game.people.filter(isCustomerMovingOnFloor);
  const minDist = 22;

  for (let i = 0; i < movers.length; i++) {
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i];
      const b = movers[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      if (dist >= minDist) continue;

      const overlap = (minDist - dist) * 0.5;
      const nx = dx / dist;
      const ny = dy / dist;

      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
    }
  }

  for (const p of movers) {
    if (p.phase === 'washing') continue;
    deflectFromFixtures(p, floorRect);
  }
}

function updatePeople(dt) {
  const cfg = getShiftConfig();
  const floor = $('floor-area');
  const floorRect = floor.getBoundingClientRect();
  const baseSpeed = CONFIG.walkSpeed * (dt / 1000);

  for (let i = game.people.length - 1; i >= 0; i--) {
    const p = game.people[i];
    const speed = p.urgent ? baseSpeed * 1.4 : baseSpeed;

    // Skip movement for frozen customers (in a fight)
    if (p.frozen) continue;

    // Update thought timer
    if (p.thoughtTimer > 0) p.thoughtTimer -= dt;
    if (p.interactionPulse > 0) p.interactionPulse -= dt;

    // Check if customer steps in mess (walking phases only)
    if (['enter', 'findStall', 'toStall', 'toSink', 'toTowels', 'exit'].includes(p.phase)) {
      const mess = checkCustomerInMess(p);
      if (mess && !p.steppedInMess) {
        p.steppedInMess = mess.id;
        p.thought = pick(THOUGHTS.disgusted);
        p.thoughtMood = 'bad';
        p.thoughtTimer = 1500;
        playCustomerDisgusted();
        haptic('warning');
        // Messy messes leave footprints
        if (mess.type === 'muddy' || mess.type === 'vomit') {
          p.hasMessyFeet = true;
        }
        // Small rating hit for letting customers step in mess
        game.rating = clamp(game.rating - 0.05, 0, 5);
      }
    }

    // Messy feet leave occasional footprints
    if (p.hasMessyFeet && rand() < 0.002 * (dt / 16)) {
      spawnPuddle(p.x + rnd(-15, 15), p.y + rnd(10, 30), 'muddy');
      // Feet get cleaner over time
      if (rand() < 0.3) p.hasMessyFeet = false;
    }

    // Messy customers leave muddy drips while walking through the room
    if (p.messiness === 1 && (p.phase === 'enter' || p.phase === 'toStall') && rand() < 0.001 * (dt / 16)) {
      spawnPuddle(p.x + rnd(-10, 10), p.y + rnd(5, 15), 'muddy');
    }

    // Patience - only drain when truly waiting for a stall
    // Only drain during findStall when NO empty unreserved stalls are available
    const shouldDrainPatience = p.phase === 'findStall' && !game.stalls.some(s => s.state === 'empty' && !s.reservedBy);

    if (shouldDrainPatience) {
      p.patience -= dt;

      // Show impatient thoughts
      const patienceRatio = p.patience / p.maxPatience;
      if (patienceRatio < 0.3 && p.thoughtTimer <= 0) {
        // Special characters have their own impatient line
        if (p.specialThoughts && p.specialThoughts.impatient) {
          p.thought = p.specialThoughts.impatient;
        } else {
          p.thought = pick(patienceRatio < 0.15 ? THOUGHTS.desperate : THOUGHTS.impatient);
        }
        playCustomerImpatient();
        p.thoughtMood = 'urgent';
        p.thoughtTimer = 2000;
      }

      if (p.patience <= 0) {
        const ratingLoss = p.vip ? 0.6 : 0.3; // VIP = 2x rating impact
        game.rating = clamp(game.rating - ratingLoss, 0, 5);
        game.stats.abandoned++;
        const hadCombo = game.combo;
        const comboLoss = p.vip ? 5 : 3; // VIP abandonment costs more combo
        game.combo = Math.max(0, game.combo - comboLoss);
        if (game.combo < 3) { game.comboTimer = 0; const ct = $('combo-timer'); if (ct) { ct.style.width = '0'; ct.classList.remove('active','warning'); } }
        if (hadCombo >= 3) showComboBreak(hadCombo); // Show break on any significant combo loss
        if (hadCombo >= 3 && game.combo > 0) floatMessage(`-${comboLoss} COMBO!`, p.x, p.y - 40, 'bad');
        p.angry = true; // Mark as angry — no tip
        playBad();
        haptic('error'); // Negative feedback for customer leaving
        screenShake(p.vip ? 1.5 : 1); // VIP leaves = bigger shake
        setBeaverMood('sad', 1500);
        const msg = p.vip ? '⭐ VIP LEFT! -' + ratingLoss.toFixed(1) + '⭐' : '😤 LEFT!';
        floatMessage(msg, p.x, p.y - 20, 'bad');

        // Pee accident when customer gives up!
        spawnPuddle(p.x + rnd(-30, 30), p.y + rnd(10, 45), 'pee');

        p.phase = 'exit';
        continue;
      }
    }

    if (p.phase === 'enterDoor') {
      openExitDoor(220);
      p.doorTimer = Math.max(0, (p.doorTimer || 0) - dt);
      if (p.doorTimer <= 0) {
        p.phase = 'enter';
      }
    }
    else if (p.phase === 'enter') {
      // If distracted by mascot, show thought (movement handled in updateMascotWalk)
      if (p.distracted) {
        if (!p.distractedThought) {
          p.distractedThought = true;
          p.thought = ['Photo op!', 'Is that Beaver?!', 'OMG!', 'No way!', 'WOW!'][Math.floor(rand() * 5)];
          p.thoughtMood = 'neutral';
          p.thoughtTimer = 10000;  // Keep showing while distracted
        }
        // Movement handled by updateMascotWalk() - skip normal enter movement
      } else {
      p.distractedThought = false;

      // Get sink-towel area to avoid walking through it
      const sinkTowelArea = $('sink-towel-area');
      const sinkTowelRect = sinkTowelArea ? sinkTowelArea.getBoundingClientRect() : null;

      // Safe Y is above the sink-towel area
      const safeY = sinkTowelRect
        ? sinkTowelRect.top - floorRect.top - 45
        : floorRect.height - 100;

      // Check if customer is in the "danger zone" (could clip through sinks)
      const inDangerZone = sinkTowelRect && p.y > safeY;

      if (inDangerZone) {
        // Walk straight up first to clear the sink area
        p.y -= speed * 1.2;
      } else {
        // Clear of sink area - walk to center of floor
        const tx = floorRect.width / 2 - 15 + (p.enterOffsetX || 0);
        const ty = floorRect.height / 2 - 20;
        const dx = tx - p.x, dy = ty - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 15) {
          p.phase = 'findStall';
        } else {
          p.x += (dx / dist) * speed;
          p.y += (dy / dist) * speed;
        }
      }
      }  // End of else (not distracted)
    }
    else if (p.phase === 'findStall') {
      // If distracted by mascot, show thought (movement handled in updateMascotWalk)
      if (p.distracted) {
        if (!p.distractedThought) {
          p.distractedThought = true;
          p.thought = ['Photo op!', 'Is that Beaver?!', 'OMG!', 'No way!', 'WOW!'][Math.floor(rand() * 5)];
          p.thoughtMood = 'neutral';
          p.thoughtTimer = 10000;
        }
        // Movement handled by updateMascotWalk() - skip normal stall search
      } else {
      p.distractedThought = false;
      // Clear stale reservations (fix for bug where reservations weren't cleared)
      for (let j = 0; j < game.stalls.length; j++) {
        if (game.stalls[j].reservedBy && !game.people.includes(game.stalls[j].reservedBy)) {
          game.stalls[j].reservedBy = null;
        }
      }

      let found = -1;
      // Find empty unreserved stall
      for (let j = 0; j < game.stalls.length; j++) {
        if (game.stalls[j].state === 'empty' && !game.stalls[j].reservedBy) { found = j; break; }
      }
      // Fallback: dirty stall not being cleaned and not reserved
      if (found < 0) {
        for (let j = 0; j < game.stalls.length; j++) {
          if (game.stalls[j].state === 'dirty' && game.activeStall !== j && !game.stalls[j].reservedBy) { found = j; break; }
        }
      }
      if (found >= 0) {
        game.stalls[found].reservedBy = p; // Reserve immediately
        p.target = found;
        p.phase = 'toStall';
      }
      }  // End of else (not distracted)
    }
    else if (p.phase === 'toStall') {
      // If distracted by mascot, show thought (movement handled in updateMascotWalk)
      if (p.distracted) {
        if (!p.distractedThought) {
          p.distractedThought = true;
          p.thought = ['Photo op!', 'Is that Beaver?!', 'OMG!', 'No way!', 'WOW!'][Math.floor(rand() * 5)];
          p.thoughtMood = 'neutral';
          p.thoughtTimer = 10000;
        }
        // Movement handled by updateMascotWalk() - skip normal toStall movement
      } else {
      p.distractedThought = false;
      const stallRow = $('stalls-row');
      const stallEl = stallRow.children[p.target];
      if (!stallEl) {
        if (p.target >= 0 && game.stalls[p.target]) game.stalls[p.target].reservedBy = null;
        p.phase = 'exit';
        continue;
      }

      const stallRect = stallEl.getBoundingClientRect();
      const tx = stallRect.left - floorRect.left + stallRect.width/2 - 12;
      const ty = 8;
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 12) {
        const stall = game.stalls[p.target];

        // If stall is being cleaned, redirect customer to find another stall
        if (stall.state === 'cleaning') {
          stall.reservedBy = null; // Release reservation
          p.phase = 'findStall';
          p.target = -1;
          continue;
        }

        p.phase = 'entering';
        p.enterTimer = 420;
        p.enterTargetX = tx;
        p.enterTargetY = ty - 18;

        if (stall.state === 'dirty') {
          // Start grace period - player has 200ms to finish cleaning
          p.gracePending = true;
          p.graceTimer = 200;
        }

        setStallDoor(p.target, true);
        playDoorOpen();
      } else {
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
        deflectFromFixtures(p, floorRect);
      }
      }  // End of else (not distracted)
    }
    else if (p.phase === 'entering') {
      p.enterTimer -= dt;
      const enterSpeed = speed * 0.8;
      const tx = p.enterTargetX ?? p.x;
      const ty = p.enterTargetY ?? (p.y - 10);
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        p.x += (dx / dist) * Math.min(dist, enterSpeed * 0.5);
        p.y += (dy / dist) * Math.min(dist, enterSpeed);
      }

      // Grace period handling - check if stall was cleaned in time
      if (p.gracePending) {
        const stall = game.stalls[p.target];
        if (stall.state === 'empty' || stall.state === 'cleaning') {
          // Cleaned in time (or actively cleaning)! Award save bonus
          p.gracePending = false;
          game.stats.saves++;
          const savePts = addScore(50);
          floatMessage(`JUST IN TIME! +${savePts}`, p.x, p.y - 30, 'save');
          playStallClean();
          setBeaverMood('excited', 1200);
          // Complete cleaning instantly if still in progress
          if (stall.state === 'cleaning') {
            stall.state = 'empty';
            stall.tasks = [];
            if (game.activeStall === p.target) {
              game.activeStall = -1;
              game.activeTask = -1;
              hideTaskPanel();
            }
          }
          const stallEl = $('stalls-row').children[p.target];
          if (stallEl) {
            stallEl.classList.remove('celebrate');
            void stallEl.offsetWidth;
            stallEl.classList.add('celebrate');
            setTimeout(() => stallEl.classList.remove('celebrate'), 650);
            const rect = stallEl.getBoundingClientRect();
            const playRect = $('play-area').getBoundingClientRect();
            spawnSparkles(rect.left - playRect.left + rect.width/2, rect.top - playRect.top + 40, 12);
          }
          updateStallDOM(p.target);
        } else {
          p.graceTimer -= dt;
          if (p.graceTimer <= 0) {
            // Grace period expired, stall still dirty - apply penalty
            p.gracePending = false;
            p.enteredDirty = true; // Mark that they committed to dirty stall
            const ratingLoss = p.vip ? 0.8 : 0.4;
            game.rating = clamp(game.rating - ratingLoss, 0, 5);
            game.stats.dirty++;
            const hadCombo = game.combo;
            game.combo = Math.max(0, game.combo - 3);
            if (game.combo < 3) { game.comboTimer = 0; const ct = $('combo-timer'); if (ct) { ct.style.width = '0'; ct.classList.remove('active','warning'); } }
            showComboBreak(hadCombo);
            playBad();
            playCustomerDisgusted();
            screenShake();
            setBeaverMood('sad', 1500);
            p.thought = pick(THOUGHTS.disgusted);
            p.thoughtMood = 'bad';
            p.thoughtTimer = 2000;
            const msg = p.vip ? '⭐ VIP DISGUSTED! -' + ratingLoss.toFixed(1) + '⭐' : '-0.4⭐ GROSS!';
            floatMessage(msg, p.x, p.y - 30, 'bad');
          }
        }
      }

      if (p.enterTimer <= 0) {
        const stall = game.stalls[p.target];

        // If stall is being cleaned and customer hasn't committed to dirty stall yet,
        // redirect them to find another stall
        if (stall.state === 'cleaning' && !p.enteredDirty) {
          stall.reservedBy = null; // Release reservation
          setStallDoor(p.target, false);
          playDoorClose();
          p.phase = 'findStall'; // Go back to finding a stall
          p.target = -1;
          continue;
        }

        stall.state = 'occupied';
        stall.reservedBy = null; // Clear reservation now that customer is inside
        stall.customer = p.icon;
        stall.wasVip = p.vip; // Track if VIP used this stall
        stall.messiness = p.messiness; // Track messiness for task generation
        stall.timer = rnd(cfg.occMin, cfg.occMax);
        setStallDoor(p.target, false);
        playDoorClose();
        stall.tasks = [];

        if (game.activeStall === p.target) {
          game.activeStall = -1;
          game.activeTask = -1;
          hideTaskPanel();
        }
        game.stats.served++;
        updateStallDOM(p.target);
        p.phase = 'inStall';
      }
    }
    else if (p.phase === 'inStall') {
      // Handled by stall timer
    }
    else if (p.phase === 'exitStall') {
      const ty = 80;
      if (p.y < ty) {
        p.y += speed;
        deflectFromFixtures(p, floorRect);
      } else {
        p.phase = 'toSink';
      }
    }
    else if (p.phase === 'toSink') {
      const sinkIdx = game.sinks.findIndex(s => !s.dirty && !s.cleaning);
      if (sinkIdx < 0) { p.phase = 'exit'; continue; }

      const sinksArea = $('sinks-area');
      const sinkEl = sinksArea.children[sinkIdx];
      if (!sinkEl) { p.phase = 'exit'; continue; }

      const sinkRect = sinkEl.getBoundingClientRect();
      const tx = sinkRect.left - floorRect.left + sinkRect.width/2 - 12;
      const ty = getFixtureStandY(sinkEl, floorRect, SINK_STAND_OFFSET);
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 12) {
        p.y = ty;
        p.phase = 'washing';
        p.washTime = 1000;
        p.sinkIdx = sinkIdx;
        playSinkWater();
      } else {
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
        deflectFromFixtures(p, floorRect);
      }
    }
    else if (p.phase === 'washing') {
      p.washTime -= dt;
      if (p.washTime <= 0) {
        if (rand() < 0.25) {
          game.sinks[p.sinkIdx].dirty = true;
          showBeaverTip('dirtySink');
        }
        updateSinkDOM(p.sinkIdx);
        // Chance of water splash on floor (scaled by shift)
        if (rand() < CONFIG.messChance.sinkSplash * getMessScale()) {
          const sinkEl = $('sinks-area').children[p.sinkIdx];
          if (sinkEl) {
            const sinkRect = sinkEl.getBoundingClientRect();
            const x = sinkRect.left - floorRect.left + rnd(-25, 25);
            const y = sinkRect.top - floorRect.top - rnd(20, 60);
            spawnPuddle(x, y, 'water');
          }
        }

        // Customer wants to dry hands (configurable skip chance)
        const skipTowel = rand() < CONFIG.towelSkipChance;
        if (skipTowel) {
          // Didn't need towel, still happy
          if (p.specialThoughts && p.specialThoughts.happy) {
            p.thought = p.specialThoughts.happy;
          } else {
            p.thought = pick(THOUGHTS.happy);
          }
          p.thoughtMood = 'good';
          playCustomerHappy();
          p.thoughtTimer = 1500;
          const sinkEl = $('sinks-area').children[p.sinkIdx];
          p.y = Math.min(p.y, getFixtureStandY(sinkEl, floorRect, SINK_STAND_OFFSET));
          p.phase = 'exit';
        } else {
          // Walk to towel dispenser
          p.phase = 'toTowels';
        }
      }
    }
    else if (p.phase === 'toTowels') {
      const towelEl = $('towels');
      const towelRect = towelEl.getBoundingClientRect();
      const tx = towelRect.left - floorRect.left + towelRect.width/2;
      const ty = getFixtureStandY(towelEl, floorRect, TOWEL_STAND_OFFSET);
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 15) {
        p.y = ty;
        // Arrived at towels
        if (game.towels > 0) {
          game.towels--;
          // Happy - got a towel
          if (p.specialThoughts && p.specialThoughts.happy) {
            p.thought = p.specialThoughts.happy;
          } else {
            p.thought = pick(THOUGHTS.happy);
          }
          p.thoughtMood = 'good';
          playCustomerHappy();
          p.thoughtTimer = 1500;
        } else {
          // No towels! Customer is unhappy
          p.thought = pick(['No towels?!', 'Wet hands...', 'Seriously?', 'Ugh, drip dry...']);
          p.thoughtMood = 'bad';
          p.thoughtTimer = 2000;
          const penalty = p.vip ? 0.3 : 0.15;
          game.rating = Math.max(0, game.rating - penalty);
          floatMessage('No towels! -⭐', p.x, p.y - 30, 'bad');
          playBad();
          playCustomerDisgusted();
          setBeaverMood('worried', 1500);
        }
        p.phase = 'exit';
      } else {
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
        deflectFromFixtures(p, floorRect);
      }
    }
    else if (p.phase === 'exit') {
      // Tip system — happy customers tip coins on exit
      if (!p.tipped && !p.angry && !p.steppedInPuddle) {
        p.tipped = true;
        const baseTip = p.vip ? 3 : 1;
        const tipAmount = Math.floor(baseTip * getCoinBonus());
        if (tipAmount > 0) {
          game.coins += tipAmount;
          game.tipsEarned += tipAmount;
          floatCoin(p.x, p.y - 10);
          if (p.vip) floatCoin(p.x + 10, p.y - 15);
        }
      }

      const exitDoor = $('exit-door').getBoundingClientRect();
      const tx = exitDoor.left - floorRect.left + 15;
      const ty = exitDoor.top - floorRect.top + 20;
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 60) openExitDoor(360);

      if (dist < 20 && !p.frozen && game.exitDoorOpen) {
        game.people.splice(i, 1);
      } else if (dist >= 20) {
        p.x += (dx / dist) * speed * 1.2;
        p.y += (dy / dist) * speed * 1.2;
        deflectFromFixtures(p, floorRect);
      }
    }

    // Customer disgust when stepping in puddle
    if (!p.steppedInPuddle && game.puddles.length > 0) {
      for (const puddle of game.puddles) {
        const pdx = p.x - puddle.x, pdy = p.y - puddle.y;
        if (Math.sqrt(pdx*pdx + pdy*pdy) < 30) {
          p.steppedInPuddle = true;
          p.thought = pick(['Gross!', 'Eww!', 'Disgusting!', 'Clean this up!']);
          p.thoughtMood = 'bad';
          p.thoughtTimer = 2500;
          game.rating = Math.max(0, game.rating - (p.vip ? 0.2 : 0.1));
          break;
        }
      }
    }
  }

  separateCustomers(floorRect);
}

function customerLeaves(stallIdx) {
  const stall = game.stalls[stallIdx];
  stall.state = 'dirty';
  setStallDoor(stallIdx, true, 850);
  playFlush(); // Toilet flush sound
  playDoorOpen(); // Door opening

  // Generate tasks based on customer messiness
  // Clean customers (-1): lower chance of each task, min 1 task
  // Average customers (0): normal behavior
  // Messy customers (1): higher chance of each task, likely 3-4 tasks
  const messiness = stall.messiness || 0;
  const chanceModifier = messiness === -1 ? 0.35 : (messiness === 1 ? 1.15 : 0.92);

  // Occasional comedy sound (8% chance for fart, higher for messy customers)
  if (rand() < (messiness === 1 ? 0.15 : 0.08)) {
    setTimeout(() => playFart(), 150);
  }

  stall.tasks = TASKS.filter(t => rand() < (t.chance * chanceModifier)).map(t => ({...t, done: false}));

  // Ensure minimum tasks based on messiness
  if (messiness === 1 && stall.tasks.length < 2) {
    // Messy customers still create more work, but no longer force 3-click marathons
    const remaining = TASKS.filter(t => !stall.tasks.find(st => st.id === t.id));
    while (stall.tasks.length < 2 && remaining.length > 0) {
      const idx = Math.floor(rand() * remaining.length);
      stall.tasks.push({...remaining.splice(idx, 1)[0], done: false});
    }
  } else if (stall.tasks.length === 0) {
    // At least 1 task for everyone
    stall.tasks.push({...TASKS[1], done: false});
  }

  showBeaverTip('dirtyStall');

  const person = game.people.find(p => p.phase === 'inStall' && p.target === stallIdx);
  if (person) {
    const stallRow = $('stalls-row');
    const stallEl = stallRow.children[stallIdx];
    const floorRect = $('floor-area').getBoundingClientRect();
    if (stallEl) {
      const stallRect = stallEl.getBoundingClientRect();
      person.x = stallRect.left - floorRect.left + stallRect.width/2 - 12;
      person.y = 8;
    }
    person.phase = 'exitStall';

    // Chance of floor mess when exiting - messy customers more likely, scaled by shift
    const baseMessChance = person.messiness === 1 ? 0.08 : (person.messiness === -1 ? 0.015 : 0.035);
    if (rand() < baseMessChance * getMessScale()) {
      const messRoll = rand();
      const messType = messRoll < 0.4 ? 'pee' : (messRoll < 0.75 ? 'vomit' : 'muddy');
      const floorEl = $('floor-area');
      const floorH = floorEl ? floorEl.getBoundingClientRect().height : 400;
      spawnPuddle(person.x + rnd(-30, 30), person.y + rnd(20, Math.min(floorH * 0.5, 120)), messType);
    }
  }
}

function spawnPuddle(x, y, type) {
  const safePos = getSafePuddlePosition(x, y);
  x = safePos.x;
  y = safePos.y;
  const messType = MESS_TYPES[type] || MESS_TYPES.water;
  const id = Date.now() + Math.random();
  game.puddles.push({ id, x, y, type, age: 0, cleaning: false, cleanProgress: 0 });
  renderPuddles();
  playBad();
  if (messType.sound === 'splat') {
    playSplat();
  } else if (messType.sound === 'squish') {
    playSquish();
  } else {
    playSplash();
  }
  floatMessage(messType.message, x, y - 20, 'bad');
}

function getFloorObstacleRects() {
  const floor = $('floor-area');
  if (!floor) return [];
  const floorRect = floor.getBoundingClientRect();
  const obstacleIds = ['exit-door', 'sinks-area', 'towels'];
  return obstacleIds.map((id) => {
    const el = $(id);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left - floorRect.left - 18,
      right: rect.right - floorRect.left + 18,
      top: rect.top - floorRect.top - 18,
      bottom: rect.bottom - floorRect.top + 18,
    };
  }).filter(Boolean);
}

function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function getSafePuddlePosition(x, y) {
  const floor = $('floor-area');
  if (!floor) return { x, y };
  const floorRect = floor.getBoundingClientRect();
  const minX = 28;
  const maxX = Math.max(minX, floorRect.width - 28);
  const minY = 42;
  const maxY = Math.max(minY, floorRect.height - 28);
  const obstacles = getFloorObstacleRects();

  let safeX = clamp(x, minX, maxX);
  let safeY = clamp(y, minY, maxY);

  for (let i = 0; i < 8; i++) {
    const hit = obstacles.find((rect) => pointInRect(safeX, safeY, rect));
    if (!hit) break;

    const options = [
      { x: hit.left - 10, y: safeY },
      { x: hit.right + 10, y: safeY },
      { x: safeX, y: hit.top - 10 },
      { x: safeX, y: hit.bottom + 10 },
    ].map((pos) => ({
      x: clamp(pos.x, minX, maxX),
      y: clamp(pos.y, minY, maxY),
    }));

    safeX = options[0].x;
    safeY = options[0].y;

    for (const option of options) {
      if (!obstacles.some((rect) => pointInRect(option.x, option.y, rect))) {
        safeX = option.x;
        safeY = option.y;
        break;
      }
    }
  }

  return { x: safeX, y: safeY };
}

// Spawn random mess in bathroom area (for rush hour chaos)
function spawnRandomMess() {
  const floor = $('floor-area');
  const rect = floor.getBoundingClientRect();
  // Random location across floor area
  const x = rnd(40, rect.width - 40);
  const y = rnd(60, rect.height - 60);
  // Random mess type weighted by frequency
  const roll = rand();
  let type = 'water';
  if (roll < 0.22) type = 'muddy';
  else if (roll < 0.36) type = 'vomit';
  else if (roll < 0.52) type = 'pee';
  spawnPuddle(x, y, type);
}

// Spawn water splash near sinks
function spawnSinkSplash() {
  const sinksArea = $('sinks-area');
  if (!sinksArea) return;
  const floor = $('floor-area');
  const floorRect = floor.getBoundingClientRect();
  const sinkRect = sinksArea.getBoundingClientRect();
  const x = sinkRect.left - floorRect.left + rnd(10, sinkRect.width - 10);
  const y = sinkRect.top - floorRect.top - rnd(20, 50);
  spawnPuddle(x, y, 'water');
}

function renderPuddles() {
  // Remove old puddle elements
  document.querySelectorAll('.puddle').forEach(el => el.remove());

  const floor = $('floor-area');
  game.puddles.forEach(puddle => {
    const messType = MESS_TYPES[puddle.type] || MESS_TYPES.water;
    const el = document.createElement('div');
    el.className = 'puddle ' + puddle.type + (puddle.cleaning ? ' mopping' : '');
    el.dataset.puddleId = puddle.id;
    el.style.left = puddle.x + 'px';
    el.style.top = puddle.y + 'px';
    // Add icon for muddy footprints
    if (puddle.type === 'muddy') {
      el.innerHTML = '<span class="puddle-icon">👣</span>';
    } else if (messType.stinkLines) {
      el.innerHTML = `<div class="puddle-stink"><div class="stink-line"></div><div class="stink-line"></div><div class="stink-line"></div></div>`;
    }
    // Progress bar for cleaning
    if (puddle.cleaning) {
      const pct = Math.min(100, (puddle.cleanProgress / messType.cleanTime) * 100);
      el.innerHTML += `<div class="puddle-progress"><div class="puddle-progress-fill" style="width:${pct}%"></div></div>`;
    }
    el.addEventListener('click', () => clickPuddle(puddle.id));
    floor.appendChild(el);
  });
}

function clickPuddle(id) {
  const idx = game.puddles.findIndex(p => p.id === id);
  if (idx === -1) return;

  const puddle = game.puddles[idx];
  const messType = MESS_TYPES[puddle.type] || MESS_TYPES.water;

  // Start cleaning if not already
  if (!puddle.cleaning) {
    puddle.cleaning = true;
    puddle.cleanProgress = 0;
    playMop();
    haptic('light');
    renderPuddles();
    return;
  }

  // Add progress on each click
  const boost = game.effects.speed > 0 ? 96 : 64;
  puddle.cleanProgress += boost;
  playMop();
  haptic('light');

  // Check if cleaned
  if (puddle.cleanProgress >= messType.cleanTime) {
    addScore(messType.points);
    game.stats.cleaned++;
    game.combo++;

    floatMessage('+' + messType.points + ' 🧹', puddle.x, puddle.y - 10, 'good');
    playTaskComplete();
    haptic('strong');
    setBeaverMood('happy', 800);

    // Animate out
    const el = document.querySelector(`.puddle[data-puddle-id="${puddle.id}"]`);
    if (el) el.classList.add('cleaning');

    spawnSparkles(puddle.x + 20, puddle.y + 14, 6);

    setTimeout(() => {
      const newIdx = game.puddles.findIndex(p => p.id === id);
      if (newIdx !== -1) {
        game.puddles.splice(newIdx, 1);
        renderPuddles();
      }
    }, 300);
  } else {
    renderPuddles();
  }
}

// Play splat sound for vomit
function playSplat() {
  // Gross splat sound - low freq burst
  playSweep(120, 40, 0.15, 'sawtooth', 0.2);
}

// Play squish sound for muddy footprints
function playSquish() {
  // Squelchy mud sound
  playSweep(200, 80, 0.1, 'sine', 0.12);
}

// Check if customer is stepping in a mess
function checkCustomerInMess(person) {
  for (const puddle of game.puddles) {
    const dx = Math.abs(person.x - puddle.x);
    const dy = Math.abs(person.y - puddle.y);
    if (dx < 30 && dy < 25) {
      return puddle;
    }
  }
  return null;
}

// DEPRECATED - keeping for backwards compat
function clickPuddleOld(id) {
  const idx = game.puddles.findIndex(p => p.id === id);
  if (idx === -1) return;

  const puddle = game.puddles[idx];
  const points = puddle.type === 'vomit' ? 40 : 30;
  addScore(points);
  game.stats.cleaned++;

  floatMessage('+' + points + ' 🧹', puddle.x, puddle.y - 10, 'good');
  playTaskComplete();

  // Animate out
  const el = document.querySelector(`.puddle[style*="left: ${puddle.x}px"]`);
  if (el) el.classList.add('cleaning');

  setTimeout(() => {
    game.puddles.splice(idx, 1);
    renderPuddles();
  }, 300);
}

function spawnInspector() {
  const floor = $('floor-area');
  const rect = floor.getBoundingClientRect();
  const exitDoor = $('exit-door').getBoundingClientRect();

  game.inspector = {
    x: exitDoor.left - rect.left + 15,
    y: exitDoor.top - rect.top + 20,
    phase: 'enter',        // enter, inspect, counting, leave
    currentStall: -1,      // Which stall is being checked
    dirtyCount: 0,         // How many dirty stalls found
    inspectTimer: 0,       // Time spent at current stall
    countdownTimer: 0,     // Time before showing results
  };

  // Remove existing inspector element if any
  const existing = floor.querySelector('.inspector');
  if (existing) existing.remove();

  // Create inspector element
  const el = document.createElement('div');
  el.className = 'inspector';
  el.innerHTML = `
    <div class="inspector-body">
      <div class="inspector-icon">🧑‍⚕️</div>
      <div class="inspector-badge">HEALTH</div>
      <div class="inspector-clipboard">📋</div>
    </div>`;
  floor.appendChild(el);

  setBeaverMood('worried', 0);
}

function updateInspector(dt) {
  const inspector = game.inspector;
  if (!inspector) return;

  const floor = $('floor-area');
  const floorRect = floor.getBoundingClientRect();
  const speed = CONFIG.walkSpeed * 0.7 * (dt / 1000); // Slower than customers

  const el = floor.querySelector('.inspector');
  if (!el) return;

  if (inspector.phase === 'enter') {
    // Walk to first stall area
    const tx = floorRect.width / 2 - 60;
    const ty = 30;
    const dx = tx - inspector.x, dy = ty - inspector.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 10) {
      inspector.phase = 'inspect';
      inspector.currentStall = 0;
      inspector.inspectTimer = 0;
    } else {
      inspector.x += (dx / dist) * speed;
      inspector.y += (dy / dist) * speed;
    }
  }
  else if (inspector.phase === 'inspect') {
    // Move to current stall and check it
    const stallRow = $('stalls-row');
    const stallEl = stallRow.children[inspector.currentStall];

    if (!stallEl) {
      // Done with all stalls, show results
      inspector.phase = 'counting';
      inspector.countdownTimer = 1500;
      return;
    }

    const stallRect = stallEl.getBoundingClientRect();
    const tx = stallRect.left - floorRect.left + stallRect.width/2 - 20;
    const ty = 25;
    const dx = tx - inspector.x, dy = ty - inspector.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 10) {
      inspector.inspectTimer += dt;

      // Check stall after brief pause
      if (inspector.inspectTimer >= 600) {
        const stall = game.stalls[inspector.currentStall];
        if (stall.state === 'dirty') {
          inspector.dirtyCount++;
          floatMessage('❌', inspector.x + 20, inspector.y - 10, 'bad');
          playBad();
        } else if (stall.state === 'empty') {
          floatMessage('✓', inspector.x + 20, inspector.y - 10, 'good');
        }
        // Move to next stall
        inspector.currentStall++;
        inspector.inspectTimer = 0;
      }
    } else {
      inspector.x += (dx / dist) * speed;
      inspector.y += (dy / dist) * speed;
    }
  }
  else if (inspector.phase === 'counting') {
    inspector.countdownTimer -= dt;
    if (inspector.countdownTimer <= 0) {
      finishInspection();
      inspector.phase = 'leave';
    }
  }
  else if (inspector.phase === 'leave') {
    // Walk to exit
    const exitDoor = $('exit-door').getBoundingClientRect();
    const tx = exitDoor.left - floorRect.left + 15;
    const ty = exitDoor.top - floorRect.top + 20;
    const dx = tx - inspector.x, dy = ty - inspector.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 15) {
      // Inspector gone
      game.inspector = null;
      el.remove();
      setBeaverMood('idle', 0);
      return;
    } else {
      inspector.x += (dx / dist) * speed;
      inspector.y += (dy / dist) * speed;
    }
  }

  // Update element position
  el.style.left = inspector.x + 'px';
  el.style.top = inspector.y + 'px';
}

function finishInspection() {
  const inspector = game.inspector;
  if (!inspector) return;

  const dirtyCount = inspector.dirtyCount;
  const totalStalls = game.stalls.length;

  if (dirtyCount === 0) {
    // Perfect inspection!
    addScore(CONFIG.inspectorBonus);
    game.rating = clamp(game.rating + 0.3, 0, 5);
    floatMessage('PERFECT INSPECTION! +' + CONFIG.inspectorBonus, 400, 200, 'combo');
    playInspectorGood();
    spawnConfetti(400, 200, 12);
    setBeaverMood('excited', 2000);
    // Track achievement
    achievementStats.perfectInspections++;
    saveAchievementData();
    checkAchievements();
  } else {
    // Penalty based on dirty stalls
    const ratingLoss = dirtyCount * CONFIG.inspectorPenalty;
    game.rating = clamp(game.rating - ratingLoss, 0, 5);
    floatMessage('INSPECTION: -' + ratingLoss.toFixed(1) + '⭐ (' + dirtyCount + ' dirty)', 400, 200, 'bad');
    playInspectorBad();
    screenShake();
    setBeaverMood('sad', 2000);
  }
}

// ---- Customer Fight Event ----

function spawnFight() {
  const floor = $('floor-area');
  const floorRect = floor.getBoundingClientRect();

  // Find eligible customers (visible, not about to leave)
  // Prefer customers in longer-lasting phases so they don't vanish mid-fight
  const eligiblePhases = ['findStall', 'toStall', 'toSink', 'washing', 'toTowels', 'enter'];
  const eligible = game.people.filter(p => eligiblePhases.includes(p.phase) && !p.frozen);

  if (eligible.length < 2) {
    // Not enough customers yet — retry in 2 seconds (skip warning on retry)
    game.fightTimer = 2000;
    game.fightWarning = 1; // non-zero so warning doesn't re-trigger
    return;
  }

  // Pick 2 random customers
  const idx1 = Math.floor(rand() * eligible.length);
  let idx2 = Math.floor(rand() * (eligible.length - 1));
  if (idx2 >= idx1) idx2++;
  const fighter1 = eligible[idx1];
  const fighter2 = eligible[idx2];

  // Freeze both customers — they'll walk toward each other first
  fighter1.frozen = true;
  fighter2.frozen = true;
  fighter1.preFightPhase = fighter1.phase;
  fighter2.preFightPhase = fighter2.phase;

  const midX = (fighter1.x + fighter2.x) / 2;
  const midY = (fighter1.y + fighter2.y) / 2;

  game.fight = {
    fighter1,
    fighter2,
    x: midX,
    y: midY,
    phase: 'approaching',  // approaching, arguing, brawl, breakup, done
    argueTimer: CONFIG.fightArgueTime,
    brawlTimer: 0,
    brawlMaxTime: 8000,
    breakupProgress: 0,
    breakupTarget: 300,
    shakeTimer: 0,
    ratingDrainTimer: 0,
    _clickTimestamps: [],
  };

  setBeaverMood('worried', 0);
}

function updateFightProgress(el) {
  if (!game.fight || !el) return;
  const pct = Math.min(100, Math.round((game.fight.breakupProgress / game.fight.breakupTarget) * 100));
  const fill = el.querySelector('.fight-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const pctEl = el.querySelector('.fight-pct');
  if (pctEl) pctEl.textContent = pct + '%';
}

function createFightZone() {
  const fight = game.fight;
  if (!fight) return;
  const floor = $('floor-area');

  // Remove existing fight zone if any
  const existing = floor.querySelector('.fight-zone');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'fight-zone';
  el.innerHTML = `
    <div class="fight-label">👊 TAP HERE! 👊</div>
    <div class="fight-emojis"><span>😠</span><span>!?!</span><span>😠</span></div>
    <div class="fight-progress-bar"><div class="fight-progress-fill" style="width:0%"></div></div>
    <div class="fight-pct">0%</div>`;
  el.style.left = (fight.x - 50) + 'px';
  el.style.top = (fight.y - 40) + 'px';

  // Tap handler for breaking up the fight
  const onTap = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!game.fight || game.fight.phase === 'done' || game.fight.phase === 'approaching') return;

    const now = Date.now();
    game.fight._clickTimestamps.push(now);
    if (game.fight._clickTimestamps.length > 5) game.fight._clickTimestamps = game.fight._clickTimestamps.slice(-5);
    if (game.fight._clickTimestamps.length >= 5) {
      const span = game.fight._clickTimestamps[4] - game.fight._clickTimestamps[0];
      if (span / 4 < 30) return;
    }

    haptic('light');
    playClick();

    // Any tap during arguing or brawl enters breakup mode
    const wasBrawl = game.fight.phase === 'brawl';
    if (game.fight.phase === 'arguing' || game.fight.phase === 'brawl') {
      game.fight.phase = 'breakup';
      game.fight.wasBrawl = wasBrawl;
    }

    const boost = game.effects.speed > 0 ? CONFIG.clickBoost * 2 : CONFIG.clickBoost;
    game.fight.breakupProgress += boost;

    updateFightProgress(el);

    if (game.fight.breakupProgress >= game.fight.breakupTarget) {
      finishFight(game.fight.wasBrawl || false);
    }
  };

  el.addEventListener('pointerdown', onTap);
  el.addEventListener('click', onTap); // fallback for some browsers

  floor.appendChild(el);
}

function updateFight(dt) {
  const fight = game.fight;
  if (!fight) return;

  // Safety: if either fighter was removed from game, cancel fight
  if (!game.people.includes(fight.fighter1) || !game.people.includes(fight.fighter2)) {
    cleanupFight();
    return;
  }

  const floor = $('floor-area');
  const speed = CONFIG.walkSpeed * 1.2 * (dt / 1000); // Walk briskly toward each other

  // Phase: approaching — fighters walk toward each other
  if (fight.phase === 'approaching') {
    const dx1 = fight.x - 18 - fight.fighter1.x;
    const dy1 = fight.y - fight.fighter1.y;
    const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (d1 > 5) {
      fight.fighter1.x += (dx1 / d1) * speed;
      fight.fighter1.y += (dy1 / d1) * speed;
    }

    const dx2 = fight.x + 18 - fight.fighter2.x;
    const dy2 = fight.y - fight.fighter2.y;
    const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (d2 > 5) {
      fight.fighter2.x += (dx2 / d2) * speed;
      fight.fighter2.y += (dy2 / d2) * speed;
    }

    // Both close enough — start arguing and show fight zone
    if (d1 <= 5 && d2 <= 5) {
      fight.phase = 'arguing';
      fight.fighter1.fighting = true;
      fight.fighter2.fighting = true;
      $('fight-warning').style.display = 'none';
      createFightZone();
    }
    return;
  }

  const el = floor.querySelector('.fight-zone');
  if (!el) return;

  // Update fight zone position to track fighters
  el.style.left = (fight.x - 50) + 'px';
  el.style.top = (fight.y - 40) + 'px';

  if (fight.phase === 'arguing') {
    fight.argueTimer -= dt;

    // Escalate speech bubbles
    const emojis = el.querySelector('.fight-emojis');
    if (emojis) {
      if (fight.argueTimer < CONFIG.fightArgueTime * 0.5) {
        emojis.innerHTML = '<span>😡</span><span>💢</span><span>😡</span>';
      }
      if (fight.argueTimer < CONFIG.fightArgueTime * 0.2) {
        emojis.innerHTML = '<span>🤬</span><span>💥</span><span>🤬</span>';
      }
    }

    if (fight.argueTimer <= 0) {
      fight.phase = 'brawl';
      fight.brawlTimer = 0;
      fight.wasBrawl = true;
      screenShake(1.5);

      if (emojis) emojis.innerHTML = '<span>🤜</span><span>💥</span><span>🤛</span>';
      const label = el.querySelector('.fight-label');
      if (label) label.textContent = '⚠️ BRAWL! TAP NOW!';
    }
  }

  else if (fight.phase === 'brawl') {
    fight.brawlTimer += dt;

    fight.shakeTimer += dt;
    if (fight.shakeTimer >= 2000) {
      screenShake(1);
      fight.shakeTimer = 0;
    }

    // Drain nearby customer patience at 2x
    game.people.forEach(p => {
      if (p === fight.fighter1 || p === fight.fighter2) return;
      if (p.frozen) return;
      const dx = p.x - fight.x, dy = p.y - fight.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        p.patience -= dt * (CONFIG.fightBrawlDrain - 1);
      }
    });

    // Rating drains slowly during brawl
    fight.ratingDrainTimer += dt;
    if (fight.ratingDrainTimer >= 1000) {
      game.rating = clamp(game.rating - 0.1, 0, 5);
      fight.ratingDrainTimer = 0;
    }

    if (fight.brawlTimer >= fight.brawlMaxTime) {
      finishFight(true);
      return;
    }

    // Slow auto-progress
    fight.breakupProgress += dt * 0.02;
    updateFightProgress(el);
  }

  else if (fight.phase === 'breakup') {
    fight.breakupProgress += dt * 0.1;
    updateFightProgress(el);

    if (fight.breakupProgress >= fight.breakupTarget) {
      finishFight(fight.wasBrawl || false);
    }
  }
}

function finishFight(wasBrawl) {
  const fight = game.fight;
  if (!fight) return;

  fight.phase = 'done';

  if (!wasBrawl) {
    // Quick breakup - bonus! Track for achievements
    achievementStats.fightsWon = (achievementStats.fightsWon || 0) + 1;
    saveAchievementData();
    addScore(CONFIG.fightBonus);
    game.rating = clamp(game.rating + 0.2, 0, 5);
    floatMessage('FIGHT STOPPED! +' + CONFIG.fightBonus, fight.x, fight.y - 20, 'combo');
    spawnConfetti(fight.x, fight.y, 8);
    setBeaverMood('excited', 2000);
  } else {
    // Brawl happened - penalty
    const ratingLoss = CONFIG.fightPenalty;
    game.rating = clamp(game.rating - ratingLoss, 0, 5);
    floatMessage('BRAWL! -' + ratingLoss.toFixed(1) + '⭐', fight.x, fight.y - 20, 'bad');
    playBad();
    screenShake(2);
    setBeaverMood('sad', 2000);
  }

  // Unfreeze fighters and restore their movement
  if (fight.fighter1) {
    fight.fighter1.frozen = false;
    fight.fighter1.fighting = false;
    fight.fighter1.phase = fight.fighter1.preFightPhase || 'exit';
  }
  if (fight.fighter2) {
    fight.fighter2.frozen = false;
    fight.fighter2.fighting = false;
    fight.fighter2.phase = fight.fighter2.preFightPhase || 'exit';
  }

  // Remove fight zone element
  const floor = $('floor-area');
  const el = floor.querySelector('.fight-zone');
  if (el) el.remove();

  game.fight = null;
}

function cleanupFight() {
  if (game.fight) {
    // Unfreeze fighters
    if (game.fight.fighter1) {
      game.fight.fighter1.frozen = false;
      game.fight.fighter1.fighting = false;
    }
    if (game.fight.fighter2) {
      game.fight.fighter2.frozen = false;
      game.fight.fighter2.fighting = false;
    }
  }
  game.fight = null;
  game.fightTimer = 0;
  game.fightWarning = 0;
  const fightEl = $('floor-area').querySelector('.fight-zone');
  if (fightEl) fightEl.remove();
  $('fight-warning').style.display = 'none';
}

function renderPeople() {
  const floor = $('floor-area');

  floor.querySelectorAll('.person').forEach(el => {
    const id = parseInt(el.dataset.id);
    if (!game.people.find(p => p.id === id)) el.remove();
  });

  game.people.forEach(p => {
    if (p.phase === 'inStall') {
      const el = floor.querySelector(`.person[data-id="${p.id}"]`);
      if (el) el.remove();
      return;
    }

    let el = floor.querySelector(`.person[data-id="${p.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'person walking';
      el.dataset.id = p.id;
      el.innerHTML = `
        <div class="person-body">
          <div class="person-shadow"></div>
          <div class="person-head-wrap">
            <div class="person-hair"></div>
            <div class="person-headgear"></div>
            <div class="person-head">
              <div class="person-face">
                <div class="person-eyes"><span></span><span></span></div>
                <div class="person-mouth"></div>
              </div>
            </div>
            <div class="person-accessory"></div>
          </div>
          <div class="person-arms"><div class="person-arm left"></div><div class="person-arm right"></div></div>
          <div class="person-torso"></div>
          <div class="person-legs"><div class="person-leg"></div><div class="person-leg"></div></div>
        </div>
        <div class="patience-bar"><div class="patience-fill"></div></div>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        interactWithCustomer(parseInt(el.dataset.id, 10));
      });
      floor.appendChild(el);
    }

    const visual = p.visual || {};
    const body = el.querySelector('.person-body');
    if (body) body.style.cssText = getCustomerVisualStyle(p);
    const hairEl = el.querySelector('.person-hair');
    const gearEl = el.querySelector('.person-headgear');
    const accessoryEl = el.querySelector('.person-accessory');
    const torsoEl = el.querySelector('.person-torso');
    const headEl = el.querySelector('.person-head');
    const faceEl = el.querySelector('.person-face');
    if (hairEl) hairEl.className = `person-hair hair-${visual.hair || 'short'}`;
    if (gearEl) gearEl.className = `person-headgear gear-${visual.hair || 'short'}`;
    if (accessoryEl) accessoryEl.className = `person-accessory accessory-${visual.accessory || 'none'}`;
    if (torsoEl) torsoEl.className = `person-torso build-${visual.build || 'average'}`;
    if (headEl) headEl.className = `person-head head-${visual.headShape || 'oval'}`;
    if (faceEl) faceEl.className = `person-face face-${visual.face || 'neutral'}`;

    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';

    // When distracted, customers still walk (they're orbiting the beaver)
    const isWalking = p.phase !== 'washing' && p.phase !== 'entering';
    el.classList.toggle('walking', isWalking);
    el.classList.toggle('entering', p.phase === 'entering');
    el.classList.toggle('female', p.gender === 'female');
    el.classList.toggle('male', p.gender !== 'female');
    el.classList.toggle('urgent', p.urgent);
    el.classList.toggle('vip', p.vip);
    el.classList.toggle('distracted', p.distracted);
    el.classList.toggle('messy', p.messiness === 1);
    el.classList.toggle('clean', p.messiness === -1);
    el.classList.toggle('fighting', !!p.fighting);
    el.classList.toggle('greeted', !!p.greeted);
    el.classList.toggle('interaction-pop', (p.interactionPulse || 0) > 0);
    const canInteract = !p.greeted && !p.frozen && ['enterDoor', 'enter', 'findStall', 'toStall', 'entering', 'exitStall', 'toSink', 'toTowels', 'exit'].includes(p.phase);
    el.classList.toggle('can-greet', canInteract && !p.urgent && !p.vip);
    el.classList.toggle('can-calm', canInteract && p.urgent);
    el.classList.toggle('can-charm', canInteract && p.vip && !p.urgent);

    // Add VIP badge if needed
    if (p.vip && !el.querySelector('.vip-badge')) {
      const badge = document.createElement('div');
      badge.className = 'vip-badge';
      badge.textContent = '⭐';
      el.querySelector('.person-body').appendChild(badge);
    }

    // Add messy/clean badge if needed
    if (p.messiness === 1 && !el.querySelector('.messy-badge')) {
      const badge = document.createElement('div');
      badge.className = 'messy-badge';
      badge.textContent = '💩';
      el.querySelector('.person-body').appendChild(badge);
    }
    if (p.messiness === -1 && !el.querySelector('.clean-badge')) {
      const badge = document.createElement('div');
      badge.className = 'clean-badge';
      badge.textContent = '✨';
      el.querySelector('.person-body').appendChild(badge);
    }

    // Add special character badge and name
    el.classList.toggle('special', !!p.specialName);
    if (p.specialName && !el.querySelector('.special-badge')) {
      const badge = document.createElement('div');
      badge.className = 'special-badge';
      badge.textContent = p.specialBadge || '⭐';
      el.querySelector('.person-body').appendChild(badge);
      const nameEl = document.createElement('div');
      nameEl.className = 'special-name';
      nameEl.textContent = p.specialName;
      el.appendChild(nameEl);
    }

    const nameEl = el.querySelector('.special-name');
    if (nameEl) nameEl.style.display = '';

    // Mood states based on thoughts
    const isHappy = p.thought && (THOUGHTS.happy.includes(p.thought) ||
      (p.specialThoughts && p.thought === p.specialThoughts.happy));
    const isDisgusted = p.thought && THOUGHTS.disgusted.includes(p.thought);
    el.classList.toggle('happy', isHappy && p.thoughtTimer > 0);
    el.classList.toggle('disgusted', isDisgusted && p.thoughtTimer > 0);

    const patienceRatio = p.patience / p.maxPatience;
    el.classList.toggle('impatient', false);

    // Only show patience bar when patience is draining
    const patienceBar = el.querySelector('.patience-bar');
    const pct = patienceRatio * 100;
    if (pct < 95) {
      patienceBar.style.display = '';
      const fill = el.querySelector('.patience-fill');
      fill.style.width = pct + '%';
      fill.style.background = pct > 50 ? '#43a047' : (pct > 25 ? '#fdd835' : '#e53935');
    } else {
      patienceBar.style.display = 'none';
    }
  });
}

function clickStall(i) {
  if (!game.running) return;
  const stall = game.stalls[i];
  const stallEl = $('stalls-row').children[i];

  // Visual click feedback
  if (stallEl) {
    stallEl.classList.remove('clicked');
    void stallEl.offsetWidth;
    stallEl.classList.add('clicked');
  }
  haptic('light'); // Light tap on stall selection

  if (stall.state === 'dirty' || stall.state === 'cleaning') {
    if (stall.state === 'dirty') {
      stall.state = 'cleaning';
      updateStallDOM(i);
    }
    game.activeStall = i;
    game._clickTimestamps = []; // Reset anti-auto-clicker on stall switch
    // Always auto-select first incomplete task (reset when switching stalls)
    const firstTask = stall.tasks.findIndex(t => !t.done);
    if (firstTask >= 0) {
      game.activeTask = firstTask;
      game.taskProgress = 0;
    }
    showTaskPanel(i);
    playClick();
  }
}

function showTaskPanel(stallIdx) {
  const stall = game.stalls[stallIdx];
  const remaining = stall.tasks.filter(t => !t.done).length;
  const total = stall.tasks.length;
  $('task-title').textContent = `Stall ${stallIdx + 1} - ${total - remaining}/${total} done`;

  const btns = $('task-buttons');
  btns.innerHTML = stall.tasks.map((t, ti) => {
    const progress = getTaskProgressPercent(ti);
    return `<div class="task-btn ${t.done ? 'done' : ''} ${game.activeTask === ti ? 'active' : ''}" data-idx="${ti}">
      <div class="progress" style="transform:scaleX(${progress / 100})"></div>
      <span class="task-btn-label">${t.icon} ${t.label}</span>
    </div>`;
  }).join('');

  btns.querySelectorAll('.task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ti = parseInt(btn.dataset.idx);
      if (!stall.tasks[ti].done) {
        // Anti-auto-clicker: track click rate
        const now = Date.now();
        game._clickTimestamps.push(now);
        if (game._clickTimestamps.length > 5) game._clickTimestamps = game._clickTimestamps.slice(-5);
        if (game._clickTimestamps.length >= 5) {
          const span = game._clickTimestamps[4] - game._clickTimestamps[0];
          if (span / 4 < 30) return; // avg interval < 30ms = inhuman, ignore
        }

        btn.classList.remove('clicked');
        void btn.offsetWidth;
        btn.classList.add('clicked');
        haptic('light');

        if (game.activeTask === ti) {
          const boost = game.effects.speed > 0 ? CONFIG.clickBoost * 2 : CONFIG.clickBoost;
          game.taskProgress += boost;
          playTaskSound(stall.tasks[ti].id);
          if (game.taskProgress >= getEffectiveTaskTime()) {
            completeTask();
          } else {
            updateTaskPanel();
          }
        } else {
          game.activeTask = ti;
          game.taskProgress = 0;
          game._clickTimestamps = []; // Reset on task switch
          const boost = game.effects.speed > 0 ? CONFIG.clickBoost * 2 : CONFIG.clickBoost;
          game.taskProgress += boost;
          playTaskSound(stall.tasks[ti].id);
          if (game.taskProgress >= getEffectiveTaskTime()) {
            completeTask();
          } else {
            showTaskPanel(stallIdx);
          }
        }
      }
    });
  });

  $('task-panel').classList.add('show');
  showBeaverTip('taskMash');
}

function updateTaskPanel() {
  if (game.activeStall < 0) return;
  const stall = game.stalls[game.activeStall];
  if (!stall || !stall.tasks) return;
  const btns = $('task-buttons').querySelectorAll('.task-btn');
  $('task-title').textContent = `Stall ${game.activeStall + 1} - ${stall.tasks.filter(t => t.done).length}/${stall.tasks.length} done`;

  btns.forEach((btn, ti) => {
    if (ti >= stall.tasks.length) return;
    const progress = getTaskProgressPercent(ti);
    const progEl = btn.querySelector('.progress');
    setTaskProgressFill(progEl, progress);
    btn.classList.toggle('active', game.activeTask === ti && !stall.tasks[ti].done);
    btn.classList.toggle('done', !!stall.tasks[ti].done);
  });

  updateStallDOM(game.activeStall);
}

function hideTaskPanel() {
  $('task-panel').classList.remove('show');
}

function completeTask() {
  if (game.activeStall < 0 || game.activeTask < 0) return;

  const stallIdx = game.activeStall; // Save before we reset it
  const stall = game.stalls[stallIdx];

  // Guard against race condition where stall/task was already cleared
  if (!stall || !stall.tasks || !stall.tasks[game.activeTask]) {
    game.activeStall = -1;
    game.activeTask = -1;
    hideTaskPanel();
    return;
  }

  stall.tasks[game.activeTask].done = true;
  game.taskProgress = 0;
  playTaskComplete();
  haptic('medium'); // Task completion feedback

  // Check if all done
  if (stall.tasks.every(t => t.done)) {
    const wasVip = stall.wasVip;
    stall.state = 'empty';
    haptic('strong'); // Stall cleaned celebration
    stall.tasks = [];
    stall.wasVip = false; // Reset for next customer
    game.combo++;
    if (game.combo > game.maxCombo) game.maxCombo = game.combo;
    // Reset combo pressure timer — scales down as combo grows (more pressure!)
    const comboTime = game.combo >= 10 ? 5000 : game.combo >= 7 ? 6000 : game.combo >= 5 ? 7000 : game.combo >= 3 ? 8000 : 0;
    game.comboTimer = comboTime;
    game.comboTimerMax = comboTime;
    checkComboMilestone();
    bumpValue('combo');

    const comboMult = 1 + game.combo * 0.5;
    const vipMult = wasVip ? 2 : 1; // VIP stalls give 2x score!
    const points = Math.floor(100 * comboMult * vipMult);
    addScore(points);
    bumpValue('score');
    game.stats.cleaned++;
    const ratingGain = wasVip ? 0.16 : 0.08; // VIP = 2x rating boost too
    game.rating = clamp(game.rating + ratingGain, 0, 5);

    const stallEl = $('stalls-row').children[stallIdx];
    if (stallEl) {
      const rect = stallEl.getBoundingClientRect();
      const playRect = $('play-area').getBoundingClientRect();
      const x = rect.left - playRect.left + rect.width/2;
      const y = rect.top - playRect.top + 20;

      // Celebration animation on the stall
      stallEl.classList.remove('celebrate');
      void stallEl.offsetWidth; // Force reflow
      stallEl.classList.add('celebrate');
      setTimeout(() => stallEl.classList.remove('celebrate'), 650);

      // Sparkle burst effect - scales continuously with combo
      const sparkleCount = game.combo >= 15 ? 36 : (game.combo >= 10 ? 28 : (game.combo >= 5 ? 20 : (game.combo >= 3 ? 14 : (wasVip ? 16 : 10))));
      spawnSparkles(x, y + 40, sparkleCount);

      let msg;
      if (game.combo >= 15) {
        msg = `💎 ${game.combo}x GODLIKE! +${points}`;
      } else if (game.combo >= 10) {
        msg = `🌟 ${game.combo}x LEGENDARY! +${points}`;
      } else if (wasVip) {
        msg = `⭐ VIP! +${points}`;
      } else if (game.combo >= 5) {
        msg = `⚡ ${game.combo}x COMBO! +${points}`;
      } else if (game.combo >= 3) {
        msg = `🔥 ${game.combo}x COMBO! +${points}`;
      } else {
        msg = `+${points} ${pick(CLEAN_MESSAGES)}`;
      }
      floatMessage(msg, x, y, (wasVip || game.combo >= 3) ? 'combo' : 'good');
      const confettiCount = game.combo >= 15 ? 32 : (game.combo >= 10 ? 24 : (game.combo >= 5 ? 18 : (game.combo >= 3 ? 12 : (wasVip ? 14 : 6))));
      spawnConfetti(x, y + 30, confettiCount);
    }

    playStallClean();
    // Extra sound at high combos for extra fun
    if (game.combo >= 10) { playBloop(); playBloop(); }
    else if (game.combo >= 5) playBloop();
    // Beaver always gets excited for a clean stall!
    if (wasVip || game.combo >= 3) {
      screenShake(game.combo >= 15 ? 2 : (game.combo >= 10 ? 1.5 : 1));
      setBeaverMood('excited', 1500);
    } else {
      setBeaverMood('excited', 800);
    }

    game.activeStall = -1;
    game.activeTask = -1;
    hideTaskPanel();
    // After first clean, hint about powerups
    if (game.combo >= 2) showBeaverTip('comboStart');
    else if (game.powerups.speed > 0 || game.powerups.slow > 0) showBeaverTip('powerupReady');
  } else {
    // Move to next task
    const nextTask = stall.tasks.findIndex(t => !t.done);
    game.activeTask = nextTask;
    showTaskPanel(game.activeStall);
  }

  updateStallDOM(stallIdx);
}

function clickSink(i) {
  if (!game.running) return;
  const sink = game.sinks[i];
  const sinkEl = $('sinks-area').children[i];

  // Visual click feedback
  if (sinkEl) {
    sinkEl.classList.remove('clicked');
    void sinkEl.offsetWidth;
    sinkEl.classList.add('clicked');
  }

  if (sink.dirty && !sink.cleaning) {
    sink.cleaning = true;
    sink.progress = 0;
    playClick();
  }
}

$('towels').addEventListener('click', () => {
  if (!game.running) return;
  const towelEl = $('towels');

  // Visual click feedback
  towelEl.classList.remove('clicked');
  void towelEl.offsetWidth;
  towelEl.classList.add('clicked');

  if (game.towels < 10) {
    game.towels = 10;
    const restockPts = addScore(20);
    floatMessage(`+${restockPts} Restocked!`, 60, 300, 'good');
    playTaskComplete();
  }
});

$('pow-speed').addEventListener('click', () => {
  const el = $('pow-speed');
  el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
  if (game.powerups.speed > 0 && game.effects.speed <= 0) {
    game.powerups.speed--;
    game.effects.speed = getItemDuration('speed');
    updatePowerupTimer('pow-speed', game.effects.speed);
    playPowerup();
    haptic('strong'); // Powerup activation feedback
    floatMessage('🥩 BRISKET POWER!', 400, 200, 'combo');
  }
});

$('pow-slow').addEventListener('click', () => {
  const el = $('pow-slow');
  el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
  if (game.powerups.slow > 0 && game.effects.slow <= 0) {
    game.powerups.slow--;
    game.effects.slow = getItemDuration('slow');
    updatePowerupTimer('pow-slow', game.effects.slow);
    playPowerup();
    haptic('strong'); // Powerup activation feedback
    floatMessage('🧊 BRAIN FREEZE!', 400, 200, 'combo');
  }
});

$('pow-auto').addEventListener('click', () => {
  const el = $('pow-auto');
  el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
  if (game.powerups.auto > 0) {
    const dirty = game.stalls.findIndex(s => s.state === 'dirty');
    if (dirty >= 0) {
      game.powerups.auto--;
      game.stalls[dirty].state = 'empty';
      game.stalls[dirty].tasks = [];
      addScore(75);
      game.stats.cleaned++;
      updateStallDOM(dirty);

      const stallEl = $('stalls-row').children[dirty];
      if (stallEl) {
        // Celebration animation
        stallEl.classList.remove('celebrate');
        void stallEl.offsetWidth;
        stallEl.classList.add('celebrate');
        setTimeout(() => stallEl.classList.remove('celebrate'), 650);

        const rect = stallEl.getBoundingClientRect();
        const playRect = $('play-area').getBoundingClientRect();
        const x = rect.left - playRect.left + rect.width/2;
        const y = rect.top - playRect.top;
        spawnSparkles(x, y + 40, 12);
        spawnConfetti(x, y + 30, 10);
        floatMessage('🍿 NUGGET MAGIC!', rect.left - playRect.left, y, 'combo');
      }
      playStallClean();
      haptic('strong'); // Powerup activation feedback
      setBeaverMood('excited', 1000);
    }
  }
});

$('pow-mascot').addEventListener('click', () => {
  console.log('MASCOT CLICKED! powerups:', game.powerups.mascot, 'effects:', game.effects.mascot);
  const el = $('pow-mascot');
  el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
  if (game.powerups.mascot > 0 && game.effects.mascot <= 0) {
    console.log('STARTING BEAVER WALK');
    game.powerups.mascot--;
    game.effects.mascot = getItemDuration('mascot');
    updatePowerupTimer('pow-mascot', game.effects.mascot);
    startMascotWalk();
    playPowerup();
    haptic('strong');
    setBeaverMood('excited', 1500);
  } else {
    console.log('BLOCKED: no powerups or already active');
  }
});

// Grade calculation based on performance
function getGrade() {
  const r = game.rating;
  if (r >= 5.0) return 'S';
  if (r >= 4.0) return 'A';
  if (r >= 3.0) return 'B';
  if (r >= 2.0) return 'C';
  if (r >= 1.0) return 'D';
  return 'F';
}

// XP rewards skill-based play: combos, grades, and speed matter more than raw output
function calculateXP(score, grade) {
  let xp = Math.floor(score / 15); // Lower base than coins
  const gradeBonus = {S: 3, A: 2, B: 1.5, C: 1, D: 0.7, F: 0.3};
  xp = Math.floor(xp * (gradeBonus[grade] || 1));
  // Combo bonus: reward high max combo
  const comboBonus = 1 + Math.min(game.maxCombo || 0, 25) * 0.04; // up to 2x at 25 combo
  xp = Math.floor(xp * comboBonus);
  return xp;
}

// Supply Shop system - simplified item purchases
function calculateCoins(score, grade) {
  // Base coins from score
  let coins = Math.floor(score / 10);
  // Grade bonus multiplier
  const gradeBonus = {S: 2, A: 1.5, B: 1.2, C: 1, D: 0.7, F: 0.5};
  coins = Math.floor(coins * (gradeBonus[grade] || 1));
  // Better Tips skill bonus
  coins = Math.floor(coins * getCoinBonus());
  return coins;
}

function unlockNextSkill() {
  // Unlock the next skill based on shift completed
  const skillId = SKILL_UNLOCK_ORDER[game.shift];
  if (!skillId) return null;

  const skill = SKILLS.find(s => s.id === skillId);
  if (!skill || game.skills[skillId] >= skill.maxLevel) return null;

  game.skills[skillId]++;
  return skill;
}

function renderSupplyShop() {
  const grid = $('upgrades-grid');
  grid.innerHTML = '';
  $('coins').textContent = game.coins;

  // Show current powerup counts
  const inventoryHtml = `
    <div class="shop-inventory">
      <div class="inv-label">Your Items:</div>
      <div class="inv-row">
        <span class="inv-item">🥩 ${game.powerups.speed}</span>
        <span class="inv-item">🧊 ${game.powerups.slow}</span>
        <span class="inv-item">🍿 ${game.powerups.auto}</span>
        <span class="inv-item">🦫 ${game.powerups.mascot}</span>
      </div>
    </div>
  `;
  grid.insertAdjacentHTML('beforeend', inventoryHtml);

  // Simple item shop - buy +1 of each
  const shopHtml = `
    <div class="shop-items">
      ${ITEMS.map(item => {
        const cost = getItemCost(item);
        const canAfford = game.coins >= cost;
        return `
          <button class="shop-item ${canAfford ? '' : 'cant-afford'}" data-id="${item.id}">
            <span class="shop-icon">${item.icon}</span>
            <span class="shop-name">${item.name}</span>
            <span class="shop-desc">${item.desc}</span>
            <span class="shop-cost">🪙 ${cost}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
  grid.insertAdjacentHTML('beforeend', shopHtml);

  // Add click handlers
  grid.querySelectorAll('.shop-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.id;
      purchaseItem(itemId);
    });
  });
}

function getItemCost(item) {
  const owned = game.powerups[item.id] || 0;
  return Math.floor(item.cost * Math.pow(1.15, owned));
}

function purchaseItem(itemId) {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const cost = getItemCost(item);
  if (game.coins < cost) return;

  game.coins -= cost;
  game.powerups[itemId]++;
  playTaskComplete();
  renderSupplyShop();
}

function showUpgradeScreen() {
  // Upgrade shop is premium-only - free users see a locked overlay with continue button
  if (!isPremium()) {
    renderSupplyShop();
    showScreen('upgrade-screen');
    let overlay = $('shop-locked-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'shop-locked-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;gap:12px;border-radius:12px;';
      overlay.innerHTML = `
        <div style="font-size:2.5em;">🔒</div>
        <div style="color:#FEF117;font-size:1.2em;font-weight:bold;">Supply Shop</div>
        <div style="color:#c9a86c;font-size:0.85em;text-align:center;line-height:1.4;">Unlock with Premium ($2.99)<br>to buy items between shifts!</div>
        <button id="shop-locked-continue" class="btn" style="margin-top:8px;padding:12px 32px;font-size:1em;">Next Shift →</button>
      `;
      $('upgrade-screen').appendChild(overlay);
    }
    overlay.style.display = 'flex';
    const btn = $('shop-locked-continue');
    const handler = () => {
      btn.removeEventListener('click', handler);
      overlay.style.display = 'none';
      showShiftIntro();
    };
    btn.addEventListener('click', handler);
    return;
  }
  renderSupplyShop();
  showScreen('upgrade-screen');
}

function endShift() {
  game.running = false;
  stopMusic();
  stopAutoSave();
  clearSavedState();

  // Multiplayer: route to MP results instead of normal results
  if (game.mode === 'multiplayer' && mpState.active) {
    playWin();
    haptic('success');
    checkMPEnd();
    return;
  }
  playWin();
  haptic('success'); // Success pattern for shift complete

  // Clean up mascot walk if active
  if (game.mascotWalk || game.effects.mascot > 0) {
    endMascotWalk();
  }

  // Clean up inspector if still present
  game.inspector = null;
  const inspectorEl = $('floor-area').querySelector('.inspector');
  if (inspectorEl) inspectorEl.remove();
  $('inspector-warning').style.display = 'none';
  cleanupFight();

  const narrative = SHIFT_NARRATIVES[game.shift] || SHIFT_NARRATIVES[0];
  $('result-title').textContent = `${narrative.name} Complete!`;

  const abandoned = game.stats.abandoned || 0;
  $('result-stats').innerHTML = `
    <div class="stat"><div class="num">${game.stats.cleaned}</div><div class="lbl">Stalls Cleaned</div></div>
    <div class="stat"><div class="num">${game.stats.served}</div><div class="lbl">Customers</div></div>
    <div class="stat"><div class="num">${game.maxCombo}x</div><div class="lbl">Best Combo</div></div>
    <div class="stat"><div class="num">${Math.floor(game.score)}</div><div class="lbl">Score</div></div>
  `;

  const shiftsLeft = CONFIG.shifts.length - game.shift - 1;
  const grade = getGrade();
  let comment;
  if (grade === 'S') comment = shiftsLeft > 0 ? 'PERFECT! That Golden Plunger is calling your name!' : 'PERFECT! You earned it, rookie!';
  else if (grade === 'A') comment = shiftsLeft > 0 ? 'Great work! Keep it up!' : 'Almost perfect! Well done!';
  else if (grade === 'B') comment = shiftsLeft > 0 ? `Solid shift. ${shiftsLeft} more to go!` : 'Respectable finish, rookie!';
  else if (grade === 'C') comment = shiftsLeft > 0 ? "The manager's watching... step it up!" : 'Made it... barely!';
  else if (grade === 'D') comment = "Room for improvement. Keep pushing!";
  else comment = "That was rough. Don't let it happen again!";

  $('result-grade').textContent = grade;
  $('result-grade').className = 'grade ' + grade;

  // Result screen beaver — show equipped cosmetic with grade-based animation
  const resultBeaver = $('result-beaver');
  const resultBeaverImg = $('result-beaver-img');
  if (resultBeaver && resultBeaverImg) {
    const beaverSrc = getComboSpriteSrc();
    resultBeaverImg.src = beaverSrc;
    resultBeaver.className = 'result-beaver';
    if (grade === 'S' || grade === 'A') {
      resultBeaver.classList.add('celebrate');
    } else if (grade === 'F') {
      resultBeaver.classList.add('sad');
    }
  }

  // Add Beaver premium hint after Shift 3 for free users (once per playthrough)
  if (game.shift === 2 && !isPremium() && !localStorage.getItem('beaverPremiumHintShown')) {
    comment = "🦫 Great progress! Premium unlocks 3 more shifts & the Golden Plunger ending!";
    localStorage.setItem('beaverPremiumHintShown', 'true');
  }
  $('result-comment').textContent = comment;
  $('result-comment').classList.remove('ai-review');

  // Track shift completion
  trackEvent('shift_complete', {
    mode: game.mode,
    shift: game.shift + 1,
    score: Math.floor(game.score),
    grade,
    cleaned: game.stats.cleaned,
    served: game.stats.served,
    maxCombo: game.maxCombo,
  });

  // Update achievement stats
  achievementStats.shiftsCompleted++;
  achievementStats.totalCleaned += game.stats.cleaned;
  achievementStats.totalServed += game.stats.served;
  achievementStats.totalSaves += game.stats.saves;
  if (game.maxCombo > achievementStats.maxCombo) achievementStats.maxCombo = game.maxCombo;
  if (game.score > (achievementStats.highestScore || 0)) achievementStats.highestScore = Math.floor(game.score);
  if (game.rating >= 5.0) achievementStats.perfectShifts = (achievementStats.perfectShifts || 0) + 1;
  if (grade === 'S') achievementStats.sGrades++;
  // Track insane difficulty shift 6 completion
  if (game.difficulty === 'insane' && game.shift >= 5) {
    localStorage.setItem('beaverInsane6', 'true');
  }
  saveAchievementData();
  checkAchievements();
  const cosmeticUnlocks = checkCosmeticUnlocks();

  // Show cosmetic unlock reveal card on result screen
  const unlockSection = $('cosmetic-unlock-section');
  if (unlockSection) {
    if (cosmeticUnlocks && cosmeticUnlocks.length > 0) {
      const first = cosmeticUnlocks[0];
      const moreCount = cosmeticUnlocks.length - 1;
      $('cosmetic-unlock-card').innerHTML = `
        <img src="/images/cosmetics/${first.id}.png" alt="${first.name}">
        <div class="unlock-info">
          <div class="unlock-label">🎉 NEW UNLOCK${moreCount > 0 ? ` +${moreCount} more` : ''}</div>
          <div class="unlock-name">${first.icon} ${first.name}</div>
          <div class="unlock-cta">Tap to try on!</div>
        </div>
      `;
      unlockSection.style.display = 'block';
      // Re-trigger animation
      unlockSection.style.animation = 'none';
      void unlockSection.offsetWidth;
      unlockSection.style.animation = '';
      // Play unlock reveal sound after delay matching the slide-in
      setTimeout(() => playCosmeticUnlockSound(), 800);
      haptic('success');
      $('cosmetic-unlock-card').onclick = () => {
        showOutfitter();
      };
    } else {
      unlockSection.style.display = 'none';
    }
  }

  // Award coins based on performance
  const coinsEarned = calculateCoins(game.score, grade);
  game.coins += coinsEarned;
  if (coinsEarned > 0) playCoinEarned();

  // Award XP for rank progression (skill-weighted, not same as coins)
  const xpEarned = calculateXP(game.score, grade);
  addEmployeeXP(xpEarned);

  // Unlock next skill based on completed shift
  const unlockedSkill = unlockNextSkill();

  // Show rewards in pick-section
  if (game.shift + 1 < CONFIG.shifts.length) {
    $('pick-section').style.display = 'block';

    let rewardsHtml = `
      <div class="rewards-row">
        <div class="reward-item coins-reward">
          <div class="reward-icon">🪙</div>
          <div class="reward-val">+${coinsEarned}</div>
          <div class="reward-lbl">Coins</div>
        </div>
        <div class="reward-item xp-reward">
          <div class="reward-icon">⭐</div>
          <div class="reward-val">+${xpEarned}</div>
          <div class="reward-lbl">XP</div>
        </div>
    `;

    if (unlockedSkill) {
      const newLevel = game.skills[unlockedSkill.id];
      rewardsHtml += `
        <div class="reward-item skill-reward">
          <div class="reward-icon">${unlockedSkill.icon}</div>
          <div class="reward-val">${unlockedSkill.name}</div>
          <div class="reward-lbl">${newLevel === 1 ? 'Unlocked!' : `Level ${newLevel}!`}</div>
        </div>
      `;
    }

    rewardsHtml += '</div>';
    $('pick-row').innerHTML = rewardsHtml;
    $('next-btn').textContent = 'Supply Shop →';
  } else {
    $('pick-section').style.display = 'block';
    $('pick-row').innerHTML = `
      <div class="rewards-row">
        <div class="reward-item coins-reward">
          <div class="reward-icon">🪙</div>
          <div class="reward-val">+${coinsEarned}</div>
          <div class="reward-lbl">Final Bonus</div>
        </div>
        <div class="reward-item xp-reward">
          <div class="reward-icon">⭐</div>
          <div class="reward-val">+${xpEarned}</div>
          <div class="reward-lbl">XP</div>
        </div>
      </div>
    `;
    $('next-btn').textContent = 'Final Results';
  }


  showScreen('result-screen');
}

function gameOver() {
  game.running = false;
  stopMusic();
  stopAutoSave();
  clearSavedState();

  // Multiplayer: route to MP results instead of normal game over
  if (game.mode === 'multiplayer' && mpState.active) {
    haptic('error');
    checkMPEnd();
    return;
  }

  const won = game.shift >= CONFIG.shifts.length - 1;
  haptic(won ? 'success' : 'error'); // Victory or defeat feedback

  // Clean up mascot walk if active
  if (game.mascotWalk || game.effects.mascot > 0) {
    endMascotWalk();
  }

  // Clean up inspector if still present
  game.inspector = null;
  const inspectorEl = $('floor-area').querySelector('.inspector');
  if (inspectorEl) inspectorEl.remove();
  $('inspector-warning').style.display = 'none';
  cleanupFight();

  const finalScore = Math.floor(game.score);
  const isNewRecord = finalScore > highScore;

  const grade = getGrade();

  // Track game over
  trackEvent('game_over', {
    mode: game.mode,
    won,
    finalShift: game.shift + 1,
    score: finalScore,
    grade,
    isNewRecord,
  });

  if (isNewRecord) {
    highScore = finalScore;
    localStorage.setItem('beaverHighScore', highScore);
    updateHighScoreDisplay();
  }

  // Unlock endless mode when beating the campaign
  if (won && !endlessUnlocked) {
    unlockEndless();
  }

  $('go-icon').textContent = won ? '🏆' : '📦';
  $('go-title').textContent = won ? 'GOLDEN PLUNGER EARNED!' : 'FIRED!';
  $('go-msg').textContent = won ? pick(WIN_MESSAGES) : pick(GAME_OVER_MESSAGES);
  $('go-score').textContent = finalScore + (isNewRecord ? ' 🎉 NEW RECORD!' : '');
  $('go-high-score-val').textContent = highScore;

  $('go-stats').innerHTML = `
    <div class="stat"><div class="num grade-${grade}">${grade}</div><div class="lbl">Grade</div></div>
    <div class="stat"><div class="num">${game.stats.cleaned}</div><div class="lbl">Cleaned</div></div>
    <div class="stat"><div class="num">${game.stats.served}</div><div class="lbl">Served</div></div>
    <div class="stat"><div class="num">${game.maxCombo}x</div><div class="lbl">Best Combo</div></div>
  `;

  // Show name input for leaderboard (premium only)
  const nameSection = $('go-name-section');
  const nameInput = $('go-name-input');
  if (nameSection && nameInput) {
    if (isPremium()) {
      nameInput.value = playerName;
      nameSection.style.display = 'block';
    } else {
      nameSection.style.display = 'none';
    }
  }

  // Store score info for submission
  window.pendingScore = { score: finalScore, shift: game.shift + 1, grade };

  if (won) playWin();
  else playBad();
  showScreen('gameover-screen');
}

// Restroom selector
document.querySelectorAll('.restroom-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.restroom-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedGender = btn.dataset.gender;
    playClick();
  });
});

// Difficulty is always "normal" for MP now
// (removed difficulty selector from host settings)

// How to Play (now accessible from settings too)
$('settings-how-to-play')?.addEventListener('click', () => {
  $('settings-modal').classList.remove('active');
  $('tutorial-modal').classList.add('active');
});

$('settings-whats-new')?.addEventListener('click', () => {
  $('settings-modal').classList.remove('active');
  titleScreenController.openWhatsNewModal();
});

// Tutorial modal (kept for settings access)
$('tutorial-modal')?.addEventListener('click', e => {
  if (e.target === $('tutorial-modal')) $('tutorial-modal').classList.remove('active');
});
$('close-tutorial').addEventListener('click', () => {
  $('tutorial-modal').classList.remove('active');
  localStorage.setItem('beaverTutorialSeen', 'true');
});
$('tutorial-got-it').addEventListener('click', () => {
  $('tutorial-modal').classList.remove('active');
  localStorage.setItem('beaverTutorialSeen', 'true');
});

// Auto-show tutorial on first visit
if (!localStorage.getItem('beaverTutorialSeen')) {
  $('tutorial-modal').classList.add('active');
}

// Show high score on title screen if exists
function updateHighScoreDisplay() {
  if (highScore > 0) {
    $('high-score-val').textContent = highScore;
    $('title-high-score').classList.add('visible');
  }
}
updateHighScoreDisplay();
updateRankDisplay();
updateOvertimeButton();
updateDailyButton();
updatePremiumUI();
applyCosmeticsToBeaver();
try { checkCosmeticUnlocks(); } catch(e) { /* safe to skip on init */ }
updateOutfitterBadge();
// Show premium unlock button only if not premium
if (!isPremium()) {
  const premBtn = $('unlock-premium-btn');
  if (premBtn) premBtn.style.display = '';
}

// Achievements modal - show preview for free users
$('achievements-btn').addEventListener('click', () => {
  if (isPremium()) {
    openAchievementsModal();
  } else {
    titleScreenController.showPreviewModal('achievements');
  }
});
$('close-achievements').addEventListener('click', closeAchievementsModal);
$('achievements-modal').addEventListener('click', e => {
  if (e.target === $('achievements-modal')) closeAchievementsModal();
});

// Update title button states on load
titleScreenController.updateTitleButtonStates();

// Daily reward modal
$('dr-claim-btn')?.addEventListener('click', () => {
  playClick();
  claimDailyReward();
});
$('daily-reward-modal')?.addEventListener('click', e => {
  // Don't close on background click - must claim
});

// Check for daily reward (after tutorial, so it doesn't stack)
setTimeout(() => {
  if (!$('tutorial-modal').classList.contains('active')) {
    showDailyRewardModal();
  }
}, 500);

// Title screen Google Sign-In button
$('title-google-signin')?.addEventListener('click', () => {
  triggerGoogleSignIn();
});

function triggerGoogleSignIn() {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '237959676363-193pgpvofkbk19ndtt4bjnpn8abhr564.apps.googleusercontent.com');
  const redirectUri = window.location.origin + '/';
  const scope = 'openid email profile';
  // Store current state so we can resume after redirect
  localStorage.setItem('beaverGoogleAuthPending', 'true');
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=token' +
    '&scope=' + encodeURIComponent(scope) +
    '&prompt=select_account';
  window.location.href = authUrl;
}

// Handle OAuth redirect - check for access_token in URL hash on page load
function handleOAuthRedirect() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return;
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  if (!accessToken) return;
  // Clear the hash from URL
  history.replaceState(null, '', window.location.pathname);
  localStorage.removeItem('beaverGoogleAuthPending');
  // Fetch user profile with the token
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken }
  })
    .then(res => res.json())
    .then(profile => {
      console.log('Google profile:', profile);
      handleGoogleSignInFromProfile(profile);
    })
    .catch(e => console.error('Failed to get user info:', e));
}

// Run on page load
handleOAuthRedirect();

// Legacy GIS callback (kept for modal flow)
function _legacyTriggerGoogleSignIn() {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '237959676363-193pgpvofkbk19ndtt4bjnpn8abhr564.apps.googleusercontent.com');
  if (typeof google === 'undefined' || !google.accounts) {
    console.error('Google accounts library not loaded');
    return;
  }
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'openid email profile',
    callback: async (tokenResponse) => {
      console.log('Google token response:', tokenResponse);
      if (tokenResponse.error) {
        console.error('Google auth error:', tokenResponse.error);
        return;
      }
      if (tokenResponse.access_token) {
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          });
          const profile = await res.json();
          console.log('Google profile:', profile);
          await handleGoogleSignInFromProfile(profile);
        } catch (e) {
          console.error('Failed to get user info:', e);
        }
      }
    },
  });
  tokenClient.requestAccessToken();
}

// Google Sign-Out button
$('title-google-signout')?.addEventListener('click', () => {
  localStorage.removeItem('beaverGoogleId');
  localStorage.removeItem('beaverGoogleEmail');
  localStorage.removeItem('beaverAvatarUrl');
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  updateAuthUI();
});

// Beaver Outfitter
$('outfitter-btn').addEventListener('click', () => {
  initAudio();
  playClick();
  showOutfitter();
});
$('title-avatar-btn').addEventListener('click', () => {
  initAudio();
  playClick();
  showOutfitter();
});
$('close-outfitter').addEventListener('click', () => {
  playClick();
  $('outfitter-modal').classList.remove('active');
  returnToMPHostIfNeeded();
});
$('outfitter-modal').addEventListener('click', e => {
  if (e.target === $('outfitter-modal')) {
    $('outfitter-modal').classList.remove('active');
    returnToMPHostIfNeeded();
  }
});

function returnToMPHostIfNeeded() {
  if (mpState._returnToMP) {
    mpState._returnToMP = false;
    // Restore host settings view if that's where we were
    if (mpState._wasInHostSettings) {
      $('mp-host-settings')?.classList.remove('hidden');
      $('mp-main-buttons')?.classList.add('hidden');
    }
    // Update avatar
    const mainAvatar = $('mp-avatar-main-img');
    if (mainAvatar) mainAvatar.src = getComboSpriteSrc();
    $('multiplayer-modal').classList.add('active');
  }
}

function updateOutfitterPreview() {
  const img = $('outfitter-beaver-img');
  if (img) {
    const e = cosmeticState.equipped;
    const src = getComboSpriteSrc();
    const fallbacks = [
      `${BASE}images/cosmetics/shirt-base-${e.shirt || 'shirt-polo'}.png`,
      `${BASE}images/cosmetics/${e.hat || 'hat-cap'}.png`,
      `${BASE}images/cosmetics/base.png`,
    ];
    let idx = 0;
    img.onerror = () => {
      if (idx < fallbacks.length) { img.src = fallbacks[idx++]; }
      else { img.onerror = null; }
    };
    img.src = src;
  }
  const label = $('outfitter-active-label');
  if (label) {
    const e = cosmeticState.equipped;
    const parts = [];
    if (e.special) {
      const s = COSMETICS.find(c => c.id === e.special);
      parts.push(s ? s.name : 'Special');
    } else {
      const h = COSMETICS.find(c => c.id === e.hat);
      const s = COSMETICS.find(c => c.id === e.shirt);
      if (h && h.id !== 'hat-none') parts.push(h.name);
      if (s && s.id !== 'shirt-none') parts.push(s.name);
      if (parts.length === 0) parts.push('Default Look');
    }
    label.textContent = parts.join(' · ');
  }
}

function showOutfitter() {
  $('outfitter-modal').classList.add('active');
  $('outfitter-coins').textContent = (game.coins || parseInt(localStorage.getItem('beaverCoins')) || 0);
  checkCosmeticUnlocks();
  markOutfitterSeen();
  trackEvent('outfitter_open', { unlocked: cosmeticState.unlocked.length, equipped: cosmeticState.equipped });
  updateOutfitterPreview();
  renderOutfitterTab('uniforms');
  // Tab switching
  document.querySelectorAll('.outfitter-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.outfitter-tab').forEach(t => t.classList.remove('selected'));
      tab.classList.add('selected');
      playClick();
      renderOutfitterTab(tab.dataset.tab);
    };
  });
}

function isTierUnlocked(tier) {
  if (tier <= 0) return true;
  const tierInfo = COSMETIC_TIERS[tier];
  if (!tierInfo) return true;
  const reqRank = EMPLOYEE_RANKS.find(r => r.name === tierInfo.rankRequired);
  if (!reqRank) return true;
  return employeeXP >= reqRank.xp;
}

function showLockedPreview(cosmetic) {
  // Remove any existing preview
  const existing = document.querySelector('.locked-preview-overlay');
  if (existing) existing.remove();

  // Build sprite src
  let spriteSrc;
  if (cosmetic.category === 'uniforms') {
    spriteSrc = `${BASE}images/cosmetics/shirt-base-${cosmetic.id}.png`;
  } else if (cosmetic.category === 'headgear') {
    spriteSrc = `${BASE}images/cosmetics/combo-${cosmetic.id}-shirt-polo.png`;
  } else {
    spriteSrc = `${BASE}images/cosmetics/${cosmetic.id}.png`;
  }

  // Build unlock requirement text
  const tierInfo = COSMETIC_TIERS[cosmetic.tier || 0];
  const reqRank = tierInfo ? EMPLOYEE_RANKS.find(r => r.name === tierInfo.rankRequired) : null;
  const tierOpen = isTierUnlocked(cosmetic.tier || 0);
  let reqText = '';
  if (!tierOpen && reqRank) {
    reqText = `<div class="lp-req">🔒 Requires <strong>${reqRank.name}</strong> rank (${reqRank.xp.toLocaleString()} XP)</div>
      <div class="lp-progress">You have ${employeeXP.toLocaleString()} / ${reqRank.xp.toLocaleString()} XP</div>`;
  } else if (cosmetic.cost) {
    const coins = game.coins || parseInt(localStorage.getItem('beaverCoins')) || 0;
    reqText = `<div class="lp-req">🪙 ${cosmetic.cost} coins</div>
      <div class="lp-progress">You have ${coins} coins</div>`;
  } else if (cosmetic.desc) {
    reqText = `<div class="lp-req">🔒 ${cosmetic.desc}</div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'locked-preview-overlay';
  overlay.innerHTML = `
    <div class="locked-preview-card">
      <img src="${spriteSrc}" onerror="this.onerror=null;this.src='${BASE}images/cosmetics/base.png'" alt="${cosmetic.name}">
      <div class="lp-name">${cosmetic.icon} ${cosmetic.name}</div>
      ${reqText}
      <div class="lp-dismiss">Tap to close</div>
    </div>
  `;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
  haptic('light');
}

function renderOutfitterTab(category) {
  const grid = $('outfitter-grid');
  const items = COSMETICS.filter(c => c.category === category);

  // Group items by tier
  const tiers = {};
  for (const c of items) {
    const t = c.tier || 0;
    if (!tiers[t]) tiers[t] = [];
    tiers[t].push(c);
  }

  let html = '';
  for (const t of Object.keys(tiers).sort((a,b) => a - b)) {
    const tierNum = parseInt(t);
    const tierInfo = COSMETIC_TIERS[tierNum];
    const tierOpen = isTierUnlocked(tierNum);
    if (tierNum > 0) {
      const reqRank = tierInfo ? EMPLOYEE_RANKS.find(r => r.name === tierInfo.rankRequired) : null;
      const reqXP = reqRank ? reqRank.xp : 0;
      let tierStatus = '';
      if (!tierOpen && reqRank) {
        const progress = Math.min(100, Math.round((employeeXP / reqXP) * 100));
        tierStatus = `<span class="tier-req">🔒 ${reqRank.name} rank (${reqXP.toLocaleString()} XP) — ${progress}%</span>`;
      } else {
        tierStatus = `<span class="tier-unlocked">✓ Unlocked</span>`;
      }
      html += `<div class="outfitter-tier-header ${tierOpen ? '' : 'tier-locked'}">
        <span class="tier-icon">${tierInfo ? tierInfo.icon : ''}</span>
        Tier ${tierNum} — ${tierInfo ? tierInfo.name : ''}
        ${tierStatus}
      </div>`;
    }
    for (const c of tiers[t]) {
      const owned = cosmeticState.unlocked.includes(c.id);
      const e = cosmeticState.equipped;
      const isActive = e.hat === c.id || e.shirt === c.id || e.special === c.id;
      const coins = game.coins || parseInt(localStorage.getItem('beaverCoins')) || 0;
      const canBuy = !owned && c.cost && !c.premium && coins >= c.cost;
      const locked = !owned && !canBuy;
      const tierLocked = !tierOpen && tierNum > 0;
      // Check if item is "new" (unlocked but not yet seen when outfitter was last opened)
      const isNew = owned && c.unlock !== 'default' && !isActive;

      let status = '';
      if (isActive) status = '✓ ACTIVE';
      else if (owned) status = 'Owned';
      else if (tierLocked) status = `🔒 ${tierInfo ? tierInfo.rankRequired : 'Locked'}`;
      else if (c.cost && !c.premium) status = `🪙 ${c.cost}`;
      else if (c.premium && !isPremium()) status = '🔒 Premium';
      else if (c.desc) status = c.desc;
      else status = '🔒';

      const classes = [
        'outfitter-item',
        isActive ? 'active' : '',
        owned && !isActive ? 'owned' : '',
        canBuy ? 'buyable' : '',
        locked && !tierLocked && !canBuy ? 'locked' : '',
        tierLocked ? 'locked-tier' : '',
      ].filter(Boolean).join(' ');

      // Show best available preview for each category
      let thumbSrc;
      if (c.category === 'uniforms') {
        // Shirt-base: beaver wearing this shirt, no hat — consistent
        thumbSrc = `${BASE}images/cosmetics/shirt-base-${c.id}.png`;
      } else if (c.category === 'headgear') {
        // Hat on default polo — consistent, doesn't shift with equipped shirt
        thumbSrc = `${BASE}images/cosmetics/combo-${c.id}-shirt-polo.png`;
      } else {
        // Accessories, specials — show item sprite
        thumbSrc = `${BASE}images/cosmetics/${c.id}.png`;
      }

      html += `<div class="${classes}" data-id="${c.id}">
        ${isNew ? '<span class="new-badge">NEW</span>' : ''}
        <img class="outfitter-item-sprite" src="${thumbSrc}" onerror="this.onerror=null;this.src='${BASE}images/cosmetics/base.png'" alt="${c.name}" loading="lazy">
        <span class="outfitter-item-name">${c.name}</span>
        <span class="outfitter-item-status">${status}</span>
      </div>`;
    }
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.outfitter-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const cosmetic = COSMETICS.find(c => c.id === id);
      if (!cosmetic) return;
      // Preview locked/tier-locked items on tap
      if (!isTierUnlocked(cosmetic.tier || 0) || (!cosmeticState.unlocked.includes(id) && !cosmetic.cost)) {
        showLockedPreview(cosmetic);
        return;
      }
      const owned = cosmeticState.unlocked.includes(id);

      if (!owned) {
        // Try to purchase with coins
        if (cosmetic.cost) {
          const coins = game.coins || parseInt(localStorage.getItem('beaverCoins')) || 0;
          if (coins >= cosmetic.cost) {
            // Show confirmation before purchasing
            if (!el.dataset.confirming) {
              el.dataset.confirming = 'true';
              const origHTML = el.innerHTML;
              el.innerHTML = `<div style="text-align:center;padding:4px"><div style="font-size:0.8em;color:#fdd835">Buy ${cosmetic.name}?</div><div style="font-size:1.1em;margin:4px 0">🪙 ${cosmetic.cost}</div><div style="font-size:0.7em;color:#aaa">Tap again to confirm</div></div>`;
              el.classList.add('confirming');
              setTimeout(() => {
                if (el.dataset.confirming) {
                  delete el.dataset.confirming;
                  el.classList.remove('confirming');
                  el.innerHTML = origHTML;
                }
              }, 3000);
              return;
            }
            // Confirmed — purchase
            delete el.dataset.confirming;
            el.classList.remove('confirming');
            if (game.coins !== undefined) game.coins -= cosmetic.cost;
            localStorage.setItem('beaverCoins', coins - cosmetic.cost);
            cosmeticState.unlocked.push(id);
            saveCosmeticState();
            trackEvent('outfitter_purchase', { item: id, cost: cosmetic.cost, category: cosmetic.category, totalUnlocked: cosmeticState.unlocked.length });
            playTaskComplete();
            haptic('success');
            $('outfitter-coins').textContent = (game.coins || parseInt(localStorage.getItem('beaverCoins')) || 0);
          } else {
            showLockedPreview(cosmetic);
            return; // Can't afford — show preview
          }
        } else if (cosmetic.premium && !isPremium()) {
          showPaywallModal();
          return;
        } else {
          showLockedPreview(cosmetic);
          return; // Not yet earned — show preview
        }
      }

      // Equip in the appropriate slot
      if (cosmetic.category === 'headgear') {
        cosmeticState.equipped.hat = id;
        cosmeticState.equipped.special = null; // Clear special override
      } else if (cosmetic.category === 'uniforms') {
        cosmeticState.equipped.shirt = id;
        cosmeticState.equipped.special = null;
      } else if (cosmetic.category === 'special') {
        // Toggle special — tap again to revert to hat+shirt
        cosmeticState.equipped.special = cosmeticState.equipped.special === id ? null : id;
      }
      saveCosmeticState();
      updateOutfitterPreview();
      applyCosmeticsToBeaver();
      playClick();
      trackEvent('outfitter_equip', { item: id, category: cosmetic.category, equipped: cosmeticState.equipped });
      renderOutfitterTab(cosmetic.category);
    });
  });
}

$('shift-start-btn').addEventListener('click', () => {
  startShift();
});

$('next-btn').addEventListener('click', () => {
  // Check for mini-game triggers BEFORE incrementing shift
  const shouldSpeedClean = shouldTriggerMinigame();
  const shouldSupplyRun = shouldTriggerSupplyRun();
  game.shift++;

  // Google sign-in gate after Shift 1 (game.shift is now 1)
  if (game.shift === 1 && !isGoogleSignedIn()) {
    showSignInModal(() => {
      continueAfterShift(shouldSpeedClean, shouldSupplyRun);
    });
    return;
  }

  continueAfterShift(shouldSpeedClean, shouldSupplyRun);
});

function continueAfterShift(shouldSpeedClean, shouldSupplyRun) {
  // Paywall after Shift 3 (game.shift is now 3, about to start Shift 4)
  // Only show for non-premium users
  if (game.shift === 3 && !isPremium()) {
    showPaywallModal();
    return;
  }

  if (game.shift >= CONFIG.shifts.length) {
    // Last shift completed - check minigames before final results
    if (shouldSpeedClean) {
      showMinigameIntro();
    } else if (shouldSupplyRun) {
      showSupplyRunIntro();
    } else {
      gameOver();
    }
  } else {
    // More shifts to go
    if (shouldSpeedClean) {
      showMinigameIntro();
    } else if (shouldSupplyRun) {
      showSupplyRunIntro();
    } else {
      showUpgradeScreen();
    }
  }
}

$('skip-upgrades').addEventListener('click', () => {
  showShiftIntro();
});

// Result screen premium button handlers (show preview for locked features)
$('result-shop-btn')?.addEventListener('click', () => {
  titleScreenController.showPreviewModal('shop');
});
$('result-badges-btn')?.addEventListener('click', () => {
  titleScreenController.showPreviewModal('badges');
});

$('retry-btn').addEventListener('click', () => {
  if (game.mode === 'endless') {
    // Restart endless mode directly
    startEndlessMode();
  } else if (game.mode === 'daily') {
    // Restart daily mode
    startDailyMode();
  } else {
    showScreen('title-screen');
  }
});

// Mini-game buttons
$('minigame-start-btn').addEventListener('click', () => {
  startMinigame();
});

$('minigame-continue-btn').addEventListener('click', () => {
  continueFromMinigame();
});

// Supply Run mini-game buttons
$('supplyrun-start-btn').addEventListener('click', () => {
  startSupplyRun();
});

$('supplyrun-continue-btn').addEventListener('click', () => {
  continueFromSupplyRun();
});

// Keyboard
document.addEventListener('keydown', e => {
  if (!game.running) return;
  const keys = ['q','w','e','r','t','y','u','i','o','p'];
  const idx = keys.indexOf(e.key.toLowerCase());
  if (idx >= 0 && idx < game.stalls.length) clickStall(idx);
  if (e.key === '1') $('pow-speed').click();
  if (e.key === '2') $('pow-slow').click();
  if (e.key === '3') $('pow-auto').click();

  // Space bar to click active task rapidly
  if (e.key === ' ' && game.activeTask >= 0) {
    e.preventDefault();
    const btn = $('task-buttons').querySelector('.task-btn.active');
    if (btn) btn.click();
  }
});

// Leaderboard submit
const submitBtn = $('go-submit-score');
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const nameInput = $('go-name-input');
    const name = nameInput?.value?.trim();
    if (!name) {
      nameInput?.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    // Create or update user account with their name
    await createOrUpdateUser(name);

    if (window.pendingScore) {
      submitBtn.textContent = 'Submitting score...';
      await submitScore(window.pendingScore.score, window.pendingScore.shift, window.pendingScore.grade);
      submitBtn.textContent = 'Submitted!';
      $('go-name-section').style.display = 'none';
      $('leaderboard-section').style.display = 'block';
      // Refresh leaderboard to show the new score
      await fetchLeaderboard();
    }
  });
}

titleScreenController.bindEvents();

// ==================== SHARE SCORE SYSTEM ====================

// Store share data for canvas generation
let shareData = {
  score: 0,
  grade: 'C',
  shift: 1,
  cleaned: 0,
  served: 0,
  maxCombo: 1,
  isWin: false
};

// Generate score card on canvas (9:16 ratio for Instagram Stories)
function generateShareCanvas() {
  const canvas = $('share-canvas');
  const ctx = canvas.getContext('2d');
  const w = 540;
  const h = 960;

  // Load player's equipped cosmetic avatar
  const avatarImg = new Image();
  avatarImg.src = getComboSpriteSrc();
  avatarImg.onload = () => drawShareContent(ctx, w, h, avatarImg);
  avatarImg.onerror = () => {
    // Fallback to beaver logo
    const fallback = new Image();
    fallback.src = 'images/beaver-logo.png';
    fallback.onload = () => drawShareContent(ctx, w, h, fallback);
    fallback.onerror = () => drawShareContent(ctx, w, h, null);
  };

  // Draw immediately in case image is cached
  if (avatarImg.complete && avatarImg.naturalWidth > 0) drawShareContent(ctx, w, h, avatarImg);
}

function drawShareContent(ctx, w, h, beaverImg) {
  // Background - rich wood gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#4a3020');
  bgGrad.addColorStop(0.3, '#3d2814');
  bgGrad.addColorStop(0.7, '#2d1f0f');
  bgGrad.addColorStop(1, '#1a0e05');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle radial glow behind beaver
  const glowGrad = ctx.createRadialGradient(w / 2, 180, 20, w / 2, 180, 200);
  glowGrad.addColorStop(0, 'rgba(245, 166, 35, 0.15)');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, w, 400);

  // Decorative border
  ctx.strokeStyle = '#f5a623';
  ctx.lineWidth = 6;
  roundRect(ctx, 16, 16, w - 32, h - 32, 20);
  ctx.stroke();

  // Inner decorative line
  ctx.strokeStyle = 'rgba(245, 166, 35, 0.2)';
  ctx.lineWidth = 2;
  roundRect(ctx, 30, 30, w - 60, h - 60, 16);
  ctx.stroke();

  // Beaver avatar
  if (beaverImg) {
    const logoSize = 160;
    const logoX = (w - logoSize) / 2;
    const logoY = 60;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(beaverImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  // Title
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#f5a623';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText("Beaver's Bathroom Blitz", w / 2, 260);
  ctx.shadowBlur = 0;

  // Result label
  ctx.fillStyle = shareData.isWin ? '#ffd700' : '#e8c47a';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(shareData.isWin ? 'SHIFT COMPLETE!' : 'SHIFT REPORT', w / 2, 310);

  // Score display with glow
  ctx.save();
  ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
  ctx.shadowBlur = 25;
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 90px system-ui, sans-serif';
  ctx.fillText(shareData.score.toLocaleString(), w / 2, 410);
  ctx.restore();

  ctx.fillStyle = '#c9a86c';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('POINTS', w / 2, 445);

  // Grade circle
  const gradeY = 530;
  const gradeRadius = 55;

  const gradeColors = {
    S: { bg: '#ffd700', border: '#ffeb3b', glow: 'rgba(255, 215, 0, 0.6)' },
    A: { bg: '#4caf50', border: '#66bb6a', glow: 'rgba(76, 175, 80, 0.5)' },
    B: { bg: '#2196f3', border: '#42a5f5', glow: 'rgba(33, 150, 243, 0.5)' },
    C: { bg: '#ff9800', border: '#ffa726', glow: 'rgba(255, 152, 0, 0.5)' },
    F: { bg: '#f44336', border: '#ef5350', glow: 'rgba(244, 67, 54, 0.5)' }
  };
  const gc = gradeColors[shareData.grade] || gradeColors.C;

  // Grade glow
  ctx.save();
  ctx.shadowColor = gc.glow;
  ctx.shadowBlur = 30;

  // Grade circle fill
  const gradeGrad = ctx.createRadialGradient(w / 2, gradeY, 0, w / 2, gradeY, gradeRadius);
  gradeGrad.addColorStop(0, gc.border);
  gradeGrad.addColorStop(1, gc.bg);
  ctx.fillStyle = gradeGrad;
  ctx.beginPath();
  ctx.arc(w / 2, gradeY, gradeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Grade border
  ctx.strokeStyle = gc.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Grade letter
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(shareData.grade, w / 2, gradeY + 22);

  // Grade label
  ctx.fillStyle = '#a08060';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('GRADE', w / 2, gradeY + gradeRadius + 30);

  // Stats section
  const statsY = 650;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, 50, statsY - 25, w - 100, 150, 16);
  ctx.fill();

  // Stat boxes
  const stats = [
    { icon: '🧹', value: shareData.cleaned, label: 'Cleaned' },
    { icon: '👥', value: shareData.served, label: 'Served' },
    { icon: '🔥', value: shareData.maxCombo + 'x', label: 'Combo' }
  ];

  stats.forEach((stat, i) => {
    const x = 130 + i * 140;
    ctx.textAlign = 'center';
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(stat.icon, x, statsY + 20);
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillStyle = '#f5a623';
    ctx.fillText(String(stat.value), x, statsY + 65);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#a08060';
    ctx.fillText(stat.label, x, statsY + 90);
  });

  // Shift info
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a86c';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`Shift ${shareData.shift} of 6`, w / 2, 860);

  // CTA with slight highlight
  ctx.fillStyle = 'rgba(245, 166, 35, 0.15)';
  roundRect(ctx, 80, 880, w - 160, 45, 10);
  ctx.fill();

  ctx.fillStyle = '#f5a623';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('beaversbathroomblitz.com', w / 2, 910);
}

// Helper function for rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Open share modal with score data
function openShareModal(source) {
  // Populate share data based on source
  if (source === 'result') {
    shareData = {
      score: Math.floor(game.score),
      grade: getGrade(),
      shift: game.shift + 1,
      cleaned: game.stats.cleaned,
      served: game.stats.served,
      maxCombo: game.maxCombo,
      isWin: false
    };
  } else if (source === 'gameover') {
    const won = game.shift >= CONFIG.shifts.length - 1;
    shareData = {
      score: Math.floor(game.score),
      grade: getGrade(),
      shift: game.shift + 1,
      cleaned: game.stats.cleaned,
      served: game.stats.served,
      maxCombo: game.maxCombo,
      isWin: won
    };
  }

  generateShareCanvas();
  $('share-modal').classList.add('active');

  // Show/hide native share button based on support
  const nativeBtn = $('share-native');
  if (navigator.share && navigator.canShare) {
    nativeBtn.style.display = 'block';
  } else {
    nativeBtn.style.display = 'none';
  }
}

function closeShareModal() {
  $('share-modal').classList.remove('active');
}

// Native Web Share API
async function shareNative() {
  const canvas = $('share-canvas');

  try {
    // Convert canvas to blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'beaver-bathroom-score.png', { type: 'image/png' });

    // Check if we can share files
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Beaver's Bathroom Blitz",
        text: `I scored ${shareData.score} points in Beaver's Bathroom Blitz! 🦫🚽`,
        files: [file]
      });
      haptic('success');
    } else {
      // Fall back to URL share only
      await navigator.share({
        title: "Beaver's Bathroom Blitz",
        text: `I scored ${shareData.score} points in Beaver's Bathroom Blitz! 🦫🚽\nPlay at beaverbathroomblitz.com`,
        url: 'https://beaverbathroomblitz.com'
      });
      haptic('success');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
      // Fall back to download
      downloadShareImage();
    }
  }
}

// Download image fallback
function downloadShareImage() {
  const canvas = $('share-canvas');
  const link = document.createElement('a');
  link.download = `beaver-bathroom-${shareData.score}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  haptic('medium');
}

// Share button event listeners
$('share-result')?.addEventListener('click', () => {
  playClick();
  openShareModal('result');
});

$('share-gameover')?.addEventListener('click', () => {
  playClick();
  openShareModal('gameover');
});

$('close-share')?.addEventListener('click', closeShareModal);
$('share-modal')?.addEventListener('click', e => {
  if (e.target === $('share-modal')) closeShareModal();
});

$('share-native')?.addEventListener('click', () => {
  playClick();
  shareNative();
});

$('share-download')?.addEventListener('click', () => {
  playClick();
  downloadShareImage();
});

// ==================== PAYWALL / PREMIUM ====================

// Paywall button handlers
$('pw-purchase-btn')?.addEventListener('click', () => {
  playClick();
  handlePurchase();
});

$('pw-restore-btn')?.addEventListener('click', () => {
  playClick();
  showRestoreView();
});

// Back button in checkout view
$('pw-back-btn')?.addEventListener('click', () => {
  playClick();
  handleCheckoutBack();
});

// Restore view - back button
$('pw-restore-back-btn')?.addEventListener('click', () => {
  playClick();
  hideRestoreView();
});

// Restore view - check button
$('pw-restore-check-btn')?.addEventListener('click', () => {
  playClick();
  handleRestoreCheck();
});

// Restore view - Enter key to submit
$('pw-restore-email')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    playClick();
    handleRestoreCheck();
  }
});

// Coupon code toggle button
$('pw-show-code-btn')?.addEventListener('click', () => {
  playClick();
  toggleCouponInput();
});

// Coupon code redeem button
$('pw-redeem-btn')?.addEventListener('click', () => {
  playClick();
  redeemCoupon();
});

// Allow Enter key to submit coupon code
$('pw-coupon-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    redeemCoupon();
  }
});

// Unlock Premium button on title screen (opens paywall modal)
$('unlock-premium-btn')?.addEventListener('click', () => {
  playClick();
  showPaywallModal('landing');
});

// Close paywall modal on background click (only in info view, not checkout)
$('paywall-modal')?.addEventListener('click', e => {
  if (e.target === $('paywall-modal') && $('pw-info-view').style.display !== 'none') {
    closePaywallModal();
  }
});

// Check for Stripe return on page load
checkStripeReturn();

// ==================== SESSION PERSISTENCE ====================
const saveStateController = createSaveStateController({
  $,
  tasks: TASKS,
  getGame: () => game,
  isMinigameActive: () => minigame.active,
  initGame: init,
  setSelectedGender: (gender) => { selectedGender = gender; },
  syncSelectedGenderUI: () => {
    document.querySelectorAll('.restroom-btn').forEach((button) => {
      button.classList.toggle('selected', button.dataset.gender === selectedGender);
    });
  },
  buildStalls,
  buildSinks,
  updateStallDOM,
  updateSinkDOM,
  updateHUD,
  showScreen,
  startMusic,
  isMusicMuted: () => isMusicMuted,
  floatMessage,
  playClick,
  scheduleGameLoop: () => requestAnimationFrame(gameLoop),
});

const saveGameState = (...args) => saveStateController.saveGameState(...args);
const loadGameState = (...args) => saveStateController.loadGameState(...args);
const clearSavedState = (...args) => saveStateController.clearSavedState(...args);
const checkForSavedGame = (...args) => saveStateController.checkForSavedGame(...args);
const resumeGame = (...args) => saveStateController.resumeGame(...args);
const startNewGame = (...args) => saveStateController.startNewGame(...args);
const closeResumeModal = (...args) => saveStateController.closeResumeModal(...args);
const startAutoSave = (...args) => saveStateController.startAutoSave(...args);
const stopAutoSave = (...args) => saveStateController.stopAutoSave(...args);

saveStateController.bindEvents();

const resetApp = () => {
  localStorage.removeItem('beaverHighScore');
  localStorage.removeItem('beaverCoins');
  localStorage.removeItem('beaverAchievements');
  localStorage.removeItem('beaverAchievementStats');
  localStorage.removeItem('beaverDailyHighScore');
  localStorage.removeItem('beaverDailyDate');
  localStorage.removeItem('beaverDailyAttempts');
  localStorage.removeItem('beaverPremiumHintShown');
  localStorage.removeItem('beaverEmployeeRank');
  localStorage.removeItem('beaverEmployeeXP');
  localStorage.removeItem('beaverDailyReward');
  localStorage.removeItem('beaverSavedGame');
  location.reload();
};

const settingsController = createSettingsController({
  $,
  initAudio,
  updateSettingsUI,
  getGame: () => game,
  showPauseOverlay: () => $('pause-overlay').classList.add('active'),
  hidePauseOverlay: () => $('pause-overlay').classList.remove('active'),
  stopMusic,
  startMusic,
  isMuted: () => isMuted,
  isMusicMuted: () => isMusicMuted,
  playClick,
  setSfxVolume,
  setMusicVolume,
  toggleSfx,
  toggleMusic,
  toggleHaptics,
  togglePerfMode,
  showScreen,
  stopAutoSave,
  clearSavedState,
  processNotificationQueue,
  setPaymentModalActive: (active) => { paymentModalActive = active; },
  resetApp,
});

const openSettings = (...args) => settingsController.openSettings(...args);
const closeSettings = (...args) => settingsController.closeSettings(...args);
const showPaymentSuccessModal = (...args) => settingsController.showPaymentSuccessModal(...args);
const closePaymentSuccessModal = (...args) => settingsController.closePaymentSuccessModal(...args);

settingsController.bindEvents();

const dailyChallengeController = createDailyChallengeController({
  $,
  initAudio,
  playClick,
  isDailyUnlocked,
  showPaywallModal,
  checkDailyReset,
  getDailySeed,
  generateDailyConfig,
  getDailyHighScore: () => dailyHighScore,
  getDailyAttempts: () => dailyAttempts,
  startDailyMode,
});

dailyChallengeController.bindEvents();

// ============================================================
// MULTIPLAYER (1v1 Battle Mode)
// ============================================================

const MP_FREE_GAME_LIMIT = 3;

let mpState = {
  active: false,
  isHost: false,
  roomCode: null,
  opponentName: '',
  opponentCosmetics: null,
  loadout: [null, null, null],
  lobbyPollTimer: null,
  scoreSyncTimer: null,
  gamesPlayed: parseInt(localStorage.getItem('beaverMPGamesPlayed') || '0'),
  mpCreatedAt: 0, // Room creation timestamp (used as RNG seed)
  // Quick Match
  isSearching: false,
  searchStartTime: null,
  isRandomMatch: false,
  queuePollTimer: null,
  searchTimerInterval: null,
  myReady: false,
  challengeSent: false,
  challengeShown: null, // deviceId of challenger whose popup is showing
};

const MP_CHAT_MESSAGES = {
  bring_it: "Bring it! 💪",
  too_slow: "Too slow! 🐢",
  clean_machine: "I'm a clean machine! 🧹",
  eww: "Ewww! 🤢",
  not_bad: "Not bad... 👀",
  gg: "GG! 🤝",
  panic: "HELP! 😱",
  flex: "Easy money 💰",
};

const MP_LOADOUT_ITEMS = [
  { id: 'speed', icon: '⚡', name: 'Speed Boost', desc: '2x cleaning speed for 12s' },
  { id: 'slow', icon: '🐢', name: 'Slow Down', desc: '2x slower arrivals for 12s' },
  { id: 'auto', icon: '✨', name: 'Auto Clean', desc: 'Instantly clean one dirty stall' },
];

function getMPGamesPlayed() {
  return parseInt(localStorage.getItem('beaverMPGamesPlayed') || '0');
}

function incrementMPGames() {
  const count = getMPGamesPlayed() + 1;
  localStorage.setItem('beaverMPGamesPlayed', count.toString());
  mpState.gamesPlayed = count;
}

function canPlayMultiplayer() {
  return isPremium() || getMPGamesPlayed() < MP_FREE_GAME_LIMIT;
}

let mpHostShift = 0;

const multiplayerPregameController = createMultiplayerPregameController({
  $,
  convex,
  api,
  BASE,
  mpState,
  getDeviceId: () => deviceId,
  getPlayerName: () => playerName,
  setPlayerName: (name) => { playerName = name; },
  persistPlayerName: (name) => localStorage.setItem('beaverPlayerName', name),
  createOrUpdateUser,
  getCosmeticState: () => cosmeticState,
  getSelectedGender: () => selectedGender,
  setSelectedGender: (gender) => { selectedGender = gender; },
  syncSelectedGenderUI: () => {
    document.querySelectorAll('.restroom-btn').forEach((button) => {
      button.classList.toggle('selected', button.dataset.gender === selectedGender);
    });
  },
  getSelectedDifficulty: () => selectedDifficulty,
  setSelectedDifficulty: (difficulty) => { selectedDifficulty = difficulty; },
  getMPHostShift: () => mpHostShift,
  setMPHostShift: (shift) => { mpHostShift = shift; },
  canPlayMultiplayer,
  showPaywallModal,
  initAudio,
  playClick,
  showOutfitter,
  getComboSpriteSrc,
  getOpponentSpriteSrc,
  showScreen,
  startMPGame,
});

multiplayerPregameController.bindEvents();

// Loadout UI
function initLoadoutUI() {
  // Reset slots
  for (let i = 0; i < 3; i++) {
    const slot = $('loadout-slot-' + i);
    if (slot) {
      slot.textContent = 'Empty';
      slot.className = 'mp-loadout-slot';
    }
  }

  // Build item picker
  const container = $('loadout-items');
  if (!container) return;
  container.innerHTML = '';

  MP_LOADOUT_ITEMS.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'mp-loadout-item-btn';
    btn.innerHTML = `<span class="mp-loadout-item-icon">${item.icon}</span><span class="mp-loadout-item-name">${item.name}</span>`;
    btn.title = item.desc;
    btn.addEventListener('click', () => {
      playClick();
      addToLoadout(item.id, item.icon, item.name);
    });
    container.appendChild(btn);
  });

  // Hide opponent loadout
  const oppSection = $('mp-opponent-loadout');
  if (oppSection) oppSection.classList.add('hidden');
}

function addToLoadout(itemId, icon, name) {
  if (!Array.isArray(mpState.loadout)) {
    mpState.loadout = [null, null, null];
  }
  // Find first empty slot
  const emptyIdx = mpState.loadout.indexOf(null);
  if (emptyIdx === -1) return; // All slots full

  mpState.loadout[emptyIdx] = itemId;
  const slot = $('loadout-slot-' + emptyIdx);
  if (slot) {
    slot.textContent = icon + ' ' + name;
    slot.className = 'mp-loadout-slot filled';
  }

  syncLoadout();
}

// Click slot to remove item
for (let i = 0; i < 3; i++) {
  $('loadout-slot-' + i)?.addEventListener('click', () => {
    if (mpState.loadout[i] === null) return;
    playClick();
    mpState.loadout[i] = null;
    const slot = $('loadout-slot-' + i);
    if (slot) {
      slot.textContent = 'Empty';
      slot.className = 'mp-loadout-slot';
    }
    syncLoadout();
  });
}

async function syncLoadout() {
  if (!mpState.roomCode) return;
  const loadout = Array.isArray(mpState.loadout) ? mpState.loadout.filter(x => x !== null) : [];
  try {
    await convex.mutation(api.matchmaking.setLoadout, {
      code: mpState.roomCode,
      deviceId,
      loadout,
    });
  } catch (e) {
    console.log('Loadout sync failed:', e);
  }
}

// Ready system
$('mp-ready-btn')?.addEventListener('click', async () => {
  playClick();
  mpState.myReady = !mpState.myReady;
  updateReadyUI();

  try {
    await convex.mutation(api.matchmaking.setReady, {
      code: mpState.roomCode,
      deviceId,
      ready: mpState.myReady,
    });
  } catch (e) {
    console.log('Ready sync failed:', e);
  }
});

function updateReadyUI() {
  const btn = $('mp-ready-btn');
  if (!btn) return;
  if (mpState.myReady) {
    btn.textContent = '✅ Ready!';
    btn.classList.add('mp-ready-active');
  } else {
    btn.textContent = 'Ready!';
    btn.classList.remove('mp-ready-active');
  }
}

// Start multiplayer game
function startMPGame() {
  setupGameTouchGuards();
  init();
  game.mode = 'multiplayer';
  game.isMultiplayer = true;
  game.shift = mpState.isHost ? mpHostShift : (mpState.mpShift || 0);

  // Seed RNG from room code so both players get identical random sequences
  const roomSeed = parseInt(mpState.roomCode || '1234') + (mpState.mpCreatedAt || 0);
  seedRng(roomSeed);

  // Multiplayer starts from a clean inventory, then applies each player's saved loadout.
  game.powerups = {speed: 0, slow: 0, auto: 0, mascot: 0};
  applyLoadout();
  const puBar = $('powerups');
  if (puBar) {
    const hasLoadoutItems = Object.values(game.powerups).some(count => count > 0);
    puBar.style.display = hasLoadoutItems ? '' : 'none';
  }

  // Show opponent HUD
  $('mp-opponent-hud')?.classList.remove('hidden');
  $('mp-opp-hud-name').textContent = mpState.opponentName;
  $('mp-opp-hud-score').textContent = '0';
  $('mp-opp-hud-rating').textContent = '⭐⭐⭐⭐⭐';
  const oppBeaver = $('mp-opp-hud-beaver');
  if (oppBeaver) oppBeaver.src = getOpponentSpriteSrc();

  startShift();
  startScoreSync();
}

// Apply loadout items as extra power-ups at game start
function applyLoadout() {
  const loadout = Array.isArray(mpState.loadout) ? mpState.loadout.filter(x => x !== null) : [];
  if (loadout.length === 0) return;
  for (const itemId of loadout) {
    if (game.powerups && game.powerups[itemId] !== undefined) {
      game.powerups[itemId]++;
    }
  }
}

// Chat system (in lobby)
function initChatUI() {
  const btnContainer = $('mp-chat-buttons');
  if (!btnContainer) return;

  mpState.chatLastFetch = Date.now();
  mpState.chatCooldown = 0;

  // Build preset message buttons
  btnContainer.innerHTML = '';
  Object.entries(MP_CHAT_MESSAGES).forEach(([id, text]) => {
    const btn = document.createElement('button');
    btn.className = 'mp-chat-msg-btn';
    btn.textContent = text;
    btn.addEventListener('click', () => sendChatMessage(id));
    btnContainer.appendChild(btn);
  });

  // Clear messages area
  const msgs = $('mp-chat-messages');
  if (msgs) msgs.innerHTML = '';
}

async function sendChatMessage(messageId) {
  if (!mpState.roomCode || !mpState.active) return;
  if (Date.now() < mpState.chatCooldown) return; // Rate limit

  mpState.chatCooldown = Date.now() + 2000;

  // Show locally immediately
  showChatBubble(MP_CHAT_MESSAGES[messageId], true);

  try {
    await convex.mutation(api.matchmaking.sendChat, {
      roomCode: mpState.roomCode,
      senderDeviceId: deviceId,
      messageId,
    });
  } catch (e) {
    console.log('Chat send failed:', e);
  }
}

function showChatBubble(text, isSelf) {
  const container = $('mp-chat-messages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = 'mp-chat-bubble ' + (isSelf ? 'mp-chat-self' : 'mp-chat-opp');
  bubble.textContent = text;
  container.appendChild(bubble);

  // Auto-scroll
  container.scrollTop = container.scrollHeight;

  // Fade out after 4s
  setTimeout(() => {
    bubble.classList.add('mp-chat-fade');
    setTimeout(() => bubble.remove(), 500);
  }, 4000);
}

async function fetchChatMessages() {
  if (!mpState.roomCode || !mpState.active) return;
  try {
    const messages = await convex.query(api.matchmaking.getChat, {
      roomCode: mpState.roomCode,
      since: mpState.chatLastFetch,
    });

    for (const msg of messages) {
      if (msg.senderDeviceId !== deviceId && msg.sentAt > mpState.chatLastFetch) {
        const text = MP_CHAT_MESSAGES[msg.messageId] || msg.messageId;
        showChatBubble(text, false);
      }
    }

    if (messages.length > 0) {
      mpState.chatLastFetch = Math.max(...messages.map(m => m.sentAt));
    }
  } catch (e) {
    // silent
  }
}

// Sync scores during gameplay
function startScoreSync() {
  stopScoreSync();
  mpState.scoreSyncTimer = setInterval(syncScores, 1000);
}

function stopScoreSync() {
  if (mpState.scoreSyncTimer) {
    clearInterval(mpState.scoreSyncTimer);
    mpState.scoreSyncTimer = null;
  }
}

async function syncScores() {
  if (!mpState.roomCode || !mpState.active) return;

  try {
    // Send my score
    await convex.mutation(api.multiplayer.updateScore, {
      code: mpState.roomCode,
      deviceId,
      score: Math.floor(game.score),
      rating: game.rating,
      combo: game.combo,
      cleaned: game.stats.cleaned,
    });

    // Get opponent's score
    const room = await convex.query(api.multiplayer.getRoom, { code: mpState.roomCode });
    if (!room) return;

    const isHost = room.hostDeviceId === deviceId;
    const oppScore = isHost ? room.guestScore : room.hostScore;
    const oppRating = isHost ? room.guestRating : room.hostRating;

    // Update opponent HUD
    $('mp-opp-hud-score').textContent = Math.floor(oppScore).toLocaleString();
    let oppStars = '';
    for (let i = 0; i < 5; i++) oppStars += oppRating >= i + 0.75 ? '⭐' : (oppRating >= i + 0.25 ? '🌟' : '☆');
    $('mp-opp-hud-rating').textContent = oppStars;

    // Color indicator: green if winning, red if losing
    const hud = $('mp-opponent-hud');
    if (hud) {
      hud.classList.toggle('mp-losing', game.score < oppScore);
      hud.classList.toggle('mp-winning', game.score > oppScore);
    }

  } catch (e) {
    console.log('Score sync failed:', e);
  }
}

// Override endShift for multiplayer
const originalEndShift = endShift;
// We'll hook into endShift via a check in the existing function
// Instead, let's patch the flow after the shift ends

// Watch for game.running to transition and handle MP end
function checkMPEnd() {
  if (!mpState.active || game.mode !== 'multiplayer') return;

  stopScoreSync();

  // Send final scores
  convex.mutation(api.multiplayer.finishGame, {
    code: mpState.roomCode,
    deviceId,
    score: Math.floor(game.score),
    rating: game.rating,
    cleaned: game.stats.cleaned,
    grade: getGrade(),
  }).catch(e => console.log('Finish game failed:', e));

  // Count this as a multiplayer game played
  incrementMPGames();

  // Hide opponent HUD, restore powerups bar
  $('mp-opponent-hud')?.classList.add('hidden');
  const puBar = $('powerups');
  if (puBar) puBar.style.display = '';

  // Poll for final results — wait until both players have finished
  pollForMPResults();
}

async function pollForMPResults() {
  try {
    const room = await convex.query(api.multiplayer.getRoom, { code: mpState.roomCode });
    if (!room) {
      mpState.active = false;
      showScreen('title-screen');
      return;
    }

    // Wait until room is "finished" (both players reported scores)
    if (room.status !== 'finished') {
      setTimeout(pollForMPResults, 1000);
      return;
    }

    showMPResults(room);
  } catch (e) {
    console.error('Failed to poll MP results:', e);
    // Retry a few times
    setTimeout(pollForMPResults, 2000);
  }
}

async function showMPResults(room) {
  try {
    if (!room) {
      room = await convex.query(api.multiplayer.getRoom, { code: mpState.roomCode });
    }
    if (!room) {
      mpState.active = false;
      return;
    }

    const isHost = room.hostDeviceId === deviceId;
    // Use local game state for own score (always current; room may be stale from last sync)
    const myScore = Math.floor(game.score);
    const myRating = game.rating;
    const myCleaned = game.stats.cleaned;
    const oppScore = isHost ? room.guestScore : room.hostScore;
    const oppRating = isHost ? room.guestRating : room.hostRating;
    const oppCleaned = isHost ? room.guestCleaned : room.hostCleaned;
    const oppName = isHost ? (room.guestName || 'Opponent') : room.hostName;

    // Determine winner
    const won = myScore > oppScore;
    const tied = myScore === oppScore;

    $('mp-result-badge').textContent = won ? '🏆 VICTORY 🏆' : (tied ? '🤝 TIE 🤝' : '💪 DEFEATED 💪');
    $('mp-result-title').textContent = won ? 'You Win!' : (tied ? "It's a Tie!" : 'Better Luck Next Time!');

    // Avatars
    $('mp-result-your-avatar').src = getComboSpriteSrc();
    $('mp-result-opp-avatar').src = getOpponentSpriteSrc();

    $('mp-result-your-name').textContent = playerName || 'You';
    $('mp-result-your-score').textContent = Math.floor(myScore).toLocaleString();
    const myGrade = getGrade();
    $('mp-result-your-grade').textContent = myGrade;
    $('mp-result-your-grade').className = 'mp-result-grade grade ' + myGrade;
    $('mp-result-your-cleaned').textContent = myCleaned + ' cleaned';

    $('mp-result-opp-name').textContent = oppName;
    $('mp-result-opp-score').textContent = Math.floor(oppScore).toLocaleString();
    const oppGrade = isHost ? (room.guestGrade || '?') : (room.hostGrade || '?');
    $('mp-result-opp-grade').textContent = oppGrade;
    $('mp-result-opp-grade').className = 'mp-result-grade grade ' + oppGrade;
    $('mp-result-opp-cleaned').textContent = oppCleaned + ' cleaned';

    // Highlight winner
    const youEl = document.querySelector('.mp-result-you');
    const oppEl = document.querySelector('.mp-result-opponent');
    if (youEl) youEl.classList.toggle('mp-winner', won);
    if (oppEl) oppEl.classList.toggle('mp-winner', !won && !tied);

    // Show remaining free games for non-premium users
    if (!isPremium()) {
      const remaining = MP_FREE_GAME_LIMIT - getMPGamesPlayed();
      if (remaining > 0) {
        $('mp-result-title').textContent += ` (${remaining} free games left)`;
      } else {
        $('mp-result-title').textContent += ' (Premium required for more)';
      }
    }

    showScreen('mp-result');
  } catch (e) {
    console.error('Failed to show MP results:', e);
    mpState.active = false;
    showScreen('title-screen');
  }
}

// Back to menu from MP results
$('mp-result-done')?.addEventListener('click', () => {
  playClick();
  mpState.active = false;
  mpState.roomCode = null;
  mpState.isRandomMatch = false;
  showScreen('title-screen');
});
