import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Initialize Convex client
const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

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
}

// Update auth UI elements
function updateAuthUI() {
  const nameDisplay = $('player-name-display');
  if (nameDisplay) {
    nameDisplay.textContent = currentUser ? currentUser.name : 'Guest';
  }
}

// Leaderboard state
let leaderboardData = [];

// Fetch leaderboard on load
async function fetchLeaderboard() {
  try {
    leaderboardData = await convex.query(api.scores.getTopScores, { limit: 10 });
    updateLeaderboardUI();
  } catch (e) {
    console.log('Leaderboard offline:', e);
  }
}

// Submit score to leaderboard
async function submitScore(score, shift, grade) {
  if (!playerName) return null;
  try {
    const scoreId = await convex.mutation(api.scores.submitScore, {
      playerName,
      score,
      shift,
      grade,
      userId: currentUser?.id || null,
    });
    await fetchLeaderboard();
    return scoreId;
  } catch (e) {
    console.log('Score submit failed:', e);
    return null;
  }
}

// Update leaderboard display
function updateLeaderboardUI() {
  const list = $('leaderboard-list');
  if (!list) return;

  if (leaderboardData.length === 0) {
    list.innerHTML = '<div class="lb-empty">No scores yet. Be the first!</div>';
    return;
  }

  list.innerHTML = leaderboardData.map((s, i) => `
    <div class="lb-row ${s.playerName === playerName ? 'lb-you' : ''}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${s.playerName}</span>
      <span class="lb-score">${s.score.toLocaleString()}</span>
      <span class="lb-grade">${s.grade}</span>
    </div>
  `).join('');
}

// Initialize
initAuth();
fetchLeaderboard();

const SHIFT_NARRATIVES = [
  {name: 'Training Day', desc: "Welcome to Beaver's Travel Stop, rookie! Show us what you've got.", progress: "Day 1 of 6"},
  {name: 'The Lunch Rush', desc: "You survived training! But hungry travelers are coming...", progress: "Day 2 of 6"},
  {name: 'Tour Bus Season', desc: "Three buses just pulled in. The Golden Plunger awaits!", progress: "Day 3 of 6"},
  {name: 'Health Inspector', desc: "Word is the inspector might visit. Keep it spotless!", progress: "Day 4 of 6"},
  {name: 'Festival Weekend', desc: "BBQ fest crowd incoming! You're so close to that trophy...", progress: "Day 5 of 6"},
  {name: 'Championship Sunday', desc: "FINAL SHIFT! Earn the Golden Plunger and become a legend!", progress: "Final Day"},
];

// Bucky the Beaver mentor tips - shown on shift intro
const BUCKY_TIPS = [
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
    "Use your items wisely - ⚡ Speed Boost and ✨ Insta-Clean are lifesavers!",
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
  baseTaskTime: 500,   // Base time per task
  clickBoost: 80,      // Each click reduces time by this much
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
  towelSkipChance: 0.3,  // 30% of customers skip towel drying
  // Mess spawn chances per source
  messChance: {
    sinkSplash: 0.08,    // Water puddle after sink use
    stallAccident: 0.15, // Pee puddle on angry leave
    walkwayRandom: 0.02, // Random mess during rush
    vomitSick: 0.10,     // Vomit from sick customers
  },
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
  'scrub', 'patience', 'tips', 'scrub', 'patience', 'tips'
];

// ITEMS: Consumable powerups (buy with coins for extra uses)
const ITEMS = [
  {
    id: 'speed',
    name: 'Speed Boost',
    icon: '⚡',
    desc: '2x cleaning speed',
    duration: 12000,  // 12s
    cost: 30,
  },
  {
    id: 'slow',
    name: 'Slow-Mo',
    icon: '🐢',
    desc: 'Slower spawns',
    duration: 12000,
    cost: 30,
  },
  {
    id: 'auto',
    name: 'Insta-Clean',
    icon: '✨',
    desc: 'Clean one stall',
    cost: 50,
  },
];

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

const CLEAN_MESSAGES = [
  'Sparkling! ✨', 'Spotless!', 'Super clean!', 'Fresh!', 'Pristine!',
  'Squeaky clean!', 'Like new!', 'Beaver-approved!', 'Road-trip ready!',
  'Rest stop royalty!', 'Travel stop quality!', 'Tail-slapping clean!'
];

const GAME_OVER_MESSAGES = [
  "The manager's taking your badge back...",
  "Maybe bathroom work isn't for you...",
  "Bucky looks disappointed. Real disappointed.",
  "Time to update your resume...",
  "The Golden Plunger slips away...",
];

const WIN_MESSAGES = [
  "You did it, rookie! The Golden Plunger is yours!",
  "From new hire to bathroom legend in 6 shifts!",
  "Bucky would be proud. Actually, Bucky IS proud!",
  "The cleanest restrooms this side of Texas!",
  "You've earned your place at Beaver's Travel Stop!",
];

// ACHIEVEMENTS: Badges earned for milestones
const ACHIEVEMENTS = [
  // First timer achievements
  {id:'first_shift', name:'Punch In', icon:'🎉', desc:'Complete your first shift', check: (g,s) => s.shiftsCompleted >= 1},
  {id:'golden_plunger', name:'Golden Plunger', icon:'🏆', desc:'Complete all 6 shifts', check: (g,s) => s.shiftsCompleted >= 6},

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

function showRankUp(rank) {
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
    setTimeout(() => banner.remove(), 500);
  }, 4000);
}

function playRankUpSound() {
  if (isMuted) return;
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
    setTimeout(() => banner.remove(), 500);
  }, 3000);
}

function playAchievementSound() {
  if (isMuted) return;
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
// DAILY LOGIN REWARD SYSTEM
// =============================================================================

const DAILY_REWARDS = [
  { day: 1, coins: 25,  label: '25 🪙' },
  { day: 2, coins: 50,  label: '50 🪙' },
  { day: 3, coins: 75,  label: '75 🪙' },
  { day: 4, coins: 100, label: '100 🪙' },
  { day: 5, coins: 150, label: '150 🪙' },
  { day: 6, coins: 200, label: '200 🪙' },
  { day: 7, coins: 300, label: '300 🪙 + ✨', bonus: 'instaClean' },
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
    bonusEl.textContent = '+ Free Insta-Clean!';
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

  // Save to localStorage
  localStorage.setItem('beaverDailyReward', JSON.stringify(dailyRewardState));

  // Close modal with celebration
  haptic('success');
  $('daily-reward-modal').classList.remove('active');

  // Add a coin animation to title screen
  showCoinCollect(reward.finalCoins);
}

// Apply pending coins to game start
function applyPendingDailyCoins() {
  if (dailyRewardState.pendingCoins > 0) {
    game.coins += dailyRewardState.pendingCoins;
    dailyRewardState.pendingCoins = 0;
    localStorage.setItem('beaverDailyReward', JSON.stringify(dailyRewardState));
  }
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
  if (isMuted) return;
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
  // Trigger after specific shifts (0-indexed in game.shift, but we check AFTER endShift)
  return MINIGAME_CONFIG.triggerAfterShift.includes(game.shift);
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

let game = {};
let selectedGender = 'female';
let highScore = parseInt(localStorage.getItem('beaverHighScore')) || 0;

// Audio
let audioCtx = null;
let isMuted = localStorage.getItem('beaverMuted') === 'true';
let sfxVolume = parseInt(localStorage.getItem('beaverSfxVolume') ?? '70') / 100;
let musicVolume = parseInt(localStorage.getItem('beaverMusicVolume') ?? '50') / 100;

// Haptics
let hapticsEnabled = localStorage.getItem('beaverHaptics') !== 'false'; // default ON
const canVibrate = 'vibrate' in navigator;

function haptic(type = 'light') {
  if (!canVibrate || !hapticsEnabled) return;
  const patterns = {
    light: 15,           // Quick tap - UI clicks
    medium: 40,          // Task complete, coin collect
    strong: 80,          // Stall cleaned, combo milestone
    success: [50, 30, 50], // Shift complete, achievement
    warning: [30, 20, 30, 20, 30], // Low patience, inspector
    error: 150           // Customer leaves, rating drop
  };
  try { navigator.vibrate(patterns[type] || patterns.light); } catch(e) {}
}

function toggleHaptics() {
  hapticsEnabled = !hapticsEnabled;
  localStorage.setItem('beaverHaptics', hapticsEnabled);
  updateSettingsUI();
  if (hapticsEnabled) haptic('medium'); // Feedback that haptics are on
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Resume AudioContext on user interaction (required by browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      // Reload sounds if they failed to load initially (AudioContext was suspended)
      if (!soundsLoaded) preloadSounds();
    });
  }
}

// === SAMPLE-BASED AUDIO SYSTEM ===
const soundBuffers = {}; // Cache for decoded audio buffers
// Use Vite's base URL to work in both dev and production
const BASE_URL = import.meta.env.BASE_URL;
const SOUND_FILES = {
  click: `${BASE_URL}sounds/click.wav`,
  plunge: `${BASE_URL}sounds/plunge.wav`,
  scrub: `${BASE_URL}sounds/scrub.wav`,
  mop: `${BASE_URL}sounds/mop.wav`,
  restock: `${BASE_URL}sounds/restock.wav`,
  clean: `${BASE_URL}sounds/clean.wav`,
  complete: `${BASE_URL}sounds/complete.wav`,
  flush: `${BASE_URL}sounds/flush.wav`,
  bad: `${BASE_URL}sounds/bad.wav`,
  urgent: `${BASE_URL}sounds/urgent.wav`,
  happy: `${BASE_URL}sounds/happy.wav`,
  disgusted: `${BASE_URL}sounds/disgusted.wav`,
  door: `${BASE_URL}sounds/door.wav`,
  vip: `${BASE_URL}sounds/vip.wav`,
  coin: `${BASE_URL}sounds/coin.wav`,
  combo: `${BASE_URL}sounds/combo.wav`,
  inspector: `${BASE_URL}sounds/inspector.wav`,
  powerup: `${BASE_URL}sounds/powerup.wav`,
};
let soundsLoaded = false;

// Preload all sound samples
async function preloadSounds() {
  if (soundsLoaded) return;
  initAudio();
  // Wait for AudioContext to be running before decoding
  if (audioCtx.state === 'suspended') {
    // Audio will be loaded later when initAudio is called on user interaction
    return;
  }
  const loadPromises = Object.entries(SOUND_FILES).map(async ([name, url]) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      soundBuffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn(`Failed to load sound: ${name}`, e);
    }
  });
  await Promise.all(loadPromises);
  soundsLoaded = true;
}

// Play a sample with volume control
function playSample(name, volume = 1.0, playbackRate = 1.0) {
  if (!audioCtx || isMuted || sfxVolume === 0) return;
  const buffer = soundBuffers[name];
  if (!buffer) {
    // Fallback: try to load on demand, but don't block
    return;
  }
  try {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = volume * sfxVolume;
    source.connect(gainNode).connect(audioCtx.destination);
    source.start(0);
  } catch (e) {}
}

// Start preloading sounds immediately
preloadSounds();

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
  if (musicGain) musicGain.gain.value = 0.08 * musicVolume;
}

function updateSettingsUI() {
  const muteBtn = $('master-mute');
  if (muteBtn) {
    muteBtn.textContent = isMuted ? 'ON' : 'OFF';
    muteBtn.classList.toggle('active', isMuted);
  }
  const sfxSlider = $('sfx-volume');
  const musicSlider = $('music-volume');
  if (sfxSlider) {
    sfxSlider.value = sfxVolume * 100;
    $('sfx-val').textContent = Math.round(sfxVolume * 100) + '%';
  }
  if (musicSlider) {
    musicSlider.value = musicVolume * 100;
    $('music-val').textContent = Math.round(musicVolume * 100) + '%';
  }
  // Haptics toggle
  const hapticsBtn = $('haptics-toggle');
  if (hapticsBtn) {
    hapticsBtn.textContent = hapticsEnabled ? 'ON' : 'OFF';
    hapticsBtn.classList.toggle('active', hapticsEnabled);
  }
}

function openSettings() {
  initAudio();
  updateSettingsUI();
  $('settings-modal').classList.add('active');
  // Pause game if running
  if (game.running && !game.paused) {
    game.paused = true;
    $('pause-overlay').classList.add('active');
    stopMusic();
  }
}

function closeSettings() {
  $('settings-modal').classList.remove('active');
  // Resume game if it was paused by settings
  if (game.running && game.paused) {
    game.paused = false;
    $('pause-overlay').classList.remove('active');
    // Reset lastTime to avoid large dt on resume
    game.lastTime = performance.now();
    // Resume music if not muted
    if (!isMuted && !isMusicMuted) startMusic();
  }
}

function playSound(freq, duration, type = 'sine', volume = 0.25) {
  if (!audioCtx || isMuted || sfxVolume === 0) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    const scaledVol = volume * sfxVolume;
    gain.gain.setValueAtTime(scaledVol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

function playClick() { playSample('click', 0.6); }
function playTaskComplete() { playSample('complete', 0.8); }

// Task-specific sounds - now using samples
function playPlunge() {
  // Slight pitch variation for variety
  playSample('plunge', 0.9, 0.95 + Math.random() * 0.1);
}

function playScrub() {
  playSample('scrub', 0.8, 0.98 + Math.random() * 0.04);
}

function playMop() {
  playSample('mop', 0.85, 0.96 + Math.random() * 0.08);
}

function playRestock() {
  playSample('restock', 0.8, 0.97 + Math.random() * 0.06);
}

// Map task ID to sound function
function playTaskSound(taskId) {
  switch(taskId) {
    case 'plunge': playPlunge(); break;
    case 'wipe': playScrub(); break;
    case 'mop': playMop(); break;
    case 'tp': playRestock(); break;
    default: playClick();
  }
}
function playStallClean() {
  playSample('clean', 1.0);
}
function playBad() { playSample('bad', 0.8); }
function playUrgent() { playSample('urgent', 0.7); }
function playRush() { playSample('urgent', 0.9, 1.2); } // Faster urgent for rush
function playInspector() { playSample('inspector', 0.85); }
function playInspectorBad() { playSample('bad', 0.9, 0.8); } // Lower pitch bad sound
function playInspectorGood() { playSample('clean', 1.0, 1.1); } // Higher pitch clean
function playWin() { playSample('clean', 1.0, 0.9); }
// Combo milestone sounds - escalating intensity
function playComboMilestone(level) {
  if (level >= 10) {
    playSample('combo', 1.0, 1.2); // Higher pitch for legendary
  } else if (level >= 5) {
    playSample('combo', 0.9, 1.1);
  } else {
    playSample('combo', 0.8, 1.0);
  }
}
function playComboBreak() {
  playSample('bad', 0.5, 1.3); // Quick high bad sound
}

// === TOILET FLUSH SOUNDS (3 varieties via pitch) ===
function playFlush() {
  const variety = Math.floor(Math.random() * 3);
  switch(variety) {
    case 0: playFlushNormal(); break;
    case 1: playFlushPowerful(); break;
    case 2: playFlushWeak(); break;
  }
}

function playFlushNormal() {
  playSample('flush', 0.8, 1.0);
}

function playFlushPowerful() {
  playSample('flush', 1.0, 0.85); // Lower pitch, louder
}

function playFlushWeak() {
  playSample('flush', 0.5, 1.25); // Higher pitch, quieter
}

// === CUSTOMER REACTION SOUNDS ===
function playCustomerHappy() {
  playSample('happy', 0.7, 0.95 + Math.random() * 0.1);
}

function playCustomerDisgusted() {
  playSample('disgusted', 0.75, 0.9 + Math.random() * 0.2);
}

function playCustomerImpatient() {
  playSample('urgent', 0.5, 1.4); // Higher pitch urgent as impatient
}

// === FUNNY/COMEDY SOUNDS ===
function playFart() {
  // Use low-pitch plunge as comedic toot
  playSample('plunge', 0.4, 0.6 + Math.random() * 0.2);
}

function playSplash() {
  // Use mop sound pitched up for splash
  playSample('mop', 0.6, 1.3 + Math.random() * 0.2);
}

function playBloop() {
  playSample('coin', 0.5, 0.8 + Math.random() * 0.3);
}

// === ADDITIONAL AMBIENT SOUNDS ===
function playDoorCreak() {
  playSample('door', 0.5, 0.9 + Math.random() * 0.2);
}

function playSinkWater() {
  playSample('scrub', 0.3, 1.2); // High-pitch scrub as water
}

function playFootstep() {
  playSample('click', 0.2, 0.7 + Math.random() * 0.2);
}

function playVIPFanfare() {
  playSample('vip', 0.9);
}

function playCoinEarned() {
  playSample('coin', 0.8, 1.0 + Math.random() * 0.1);
}

function playPowerup() {
  playSample('powerup', 0.85);
}

// Background Music System - Procedural Upbeat Theme
let isMusicMuted = localStorage.getItem('beaverMusicMuted') === 'true';
let musicPlaying = false;
let musicOscillators = [];
let musicGain = null;
let musicInterval = null;

// Simple major scale notes (C major)
const MUSIC_NOTES = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99
};

// Catchy melody pattern - upbeat and cartoony
const MELODY = [
  ['C5', 0.2], ['E5', 0.2], ['G5', 0.2], ['E5', 0.2],
  ['C5', 0.2], ['D5', 0.2], ['E5', 0.4],
  ['G4', 0.2], ['A4', 0.2], ['B4', 0.2], ['C5', 0.2],
  ['D5', 0.4], ['C5', 0.4],
  ['E5', 0.2], ['D5', 0.2], ['C5', 0.2], ['G4', 0.2],
  ['A4', 0.2], ['G4', 0.2], ['E4', 0.4],
  ['F4', 0.2], ['G4', 0.2], ['A4', 0.2], ['G4', 0.2],
  ['C5', 0.6], [null, 0.2]
];

// Bass pattern - simple root notes
const BASS = [
  ['C4', 0.4], [null, 0.4], ['G4', 0.4], [null, 0.4],
  ['F4', 0.4], [null, 0.4], ['G4', 0.4], [null, 0.4]
];

let melodyIndex = 0;
let bassIndex = 0;
const TEMPO = 180; // BPM - upbeat pace
const BEAT_MS = 60000 / TEMPO;

function startMusic() {
  if (!audioCtx || isMuted || isMusicMuted || musicVolume === 0 || musicPlaying) return;
  musicPlaying = true;
  melodyIndex = 0;
  bassIndex = 0;

  // Create master gain for music (lower than SFX, scaled by musicVolume)
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.08 * musicVolume;
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
const BEAVER_TIPS = {
  dirtyStall: "Click dirty stalls to clean!",
  taskMash: "Mash the buttons faster!",
  dirtySink: "Don't forget the sinks!",
  powerupReady: "Use your items! (⚡🐢✨)",
  comboStart: "Keep cleaning for combos!",
  lowTime: "Hurry! Time's running out!",
  vipCustomer: "VIP customer! Clean fast for 2x bonus!",
  inspectorComing: "Keep stalls clean for inspection!"
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
  speech.textContent = BEAVER_TIPS[tipKey];
  speech.classList.add('active');
  setBeaverMood('happy', duration);

  tipTimeout = setTimeout(() => {
    speech.classList.remove('active');
  }, duration);
}

function $(id) { return document.getElementById(id); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min, max) { return min + Math.random() * (max - min); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function screenShake() {
  $('play-area').classList.add('shake');
  setTimeout(() => $('play-area').classList.remove('shake'), 300);
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
    shift: 0,
    score: 0,
    rating: 5,
    combo: 0,
    maxCombo: 0,
    time: 0,
    running: false,
    stalls: [],
    sinks: [],
    people: [],
    puddles: [],
    towels: 10,
    powerups: {speed: 1, slow: 1, auto: 0},
    effects: {speed: 0, slow: 0},
    spawnTimer: 0,
    activeStall: -1,
    activeTask: -1,
    taskProgress: 0,
    stats: {cleaned: 0, served: 0, dirty: 0, abandoned: 0, saves: 0},
    personId: 0,
    gender: selectedGender,
    rushMode: false,
    rushTimer: 0,
    lastUrgentBeep: 0,
    inspector: null,          // Inspector object when active
    inspectorTimer: 0,        // Countdown until inspector appears
    inspectorWarning: 0,      // Warning countdown before inspector enters
    coins: 0,                 // Currency for items
    skills: {scrub: 0, patience: 0, tips: 0},  // Passive skills (earned per shift)
    comboBoost: 0,            // Remaining duration of combo speed boost
    lastMilestone: 0,         // Last milestone level achieved (to avoid re-triggering)
  };

  // Apply any pending daily reward coins
  applyPendingDailyCoins();
}

function getCustomers() {
  return game.gender === 'male' ? CUSTOMERS_MALE : CUSTOMERS_FEMALE;
}

function getShiftConfig() {
  return CONFIG.shifts[Math.min(game.shift, CONFIG.shifts.length - 1)];
}

function getEffectiveTaskTime() {
  // Quick Scrub skill reduces task time
  const scrubBonus = getSkillEffect('scrub');
  let time = CONFIG.baseTaskTime * (1 - scrubBonus);
  // Combo milestone speed boost (30% faster)
  if (game.comboBoost > 0) time *= 0.7;
  return time;
}

function getEffectivePatience() {
  // Patience skill increases customer patience
  const patienceBonus = getSkillEffect('patience');
  return CONFIG.patience * (1 + patienceBonus);
}

function getSkillEffect(skillId) {
  const skill = SKILLS.find(s => s.id === skillId);
  if (!skill) return 0;
  return skill.effect * game.skills[skillId];
}

function getItemDuration(itemId) {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item || !item.duration) return 12000;
  return item.duration;
}

function getCoinBonus() {
  // Better Tips skill increases coins earned
  return 1 + getSkillEffect('tips');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
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
      if (m.points > 0) { game.score += m.points; bumpValue('score'); }

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
  container.innerHTML = '';
  const cfg = getShiftConfig();
  game.sinks = [];

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
  $('rating').style.animation = game.rating <= 1 ? 'blink 0.3s infinite' : '';

  $('score').textContent = Math.floor(game.score);

  const comboMult = 1 + game.combo * 0.5;
  const boostIcon = game.comboBoost > 0 ? '⚡' : '';
  const comboEl = $('combo');
  const playArea = $('play-area');
  comboEl.textContent = game.combo > 0 ? `${boostIcon}x${comboMult.toFixed(1)}` : 'x1';
  comboEl.style.color = game.combo >= 10 ? '#ffd700' : (game.combo >= 5 ? '#ff5722' : (game.combo >= 3 ? '#f5a623' : '#fff'));
  comboEl.style.fontSize = game.combo >= 10 ? '1.5em' : (game.combo >= 5 ? '1.4em' : (game.combo >= 3 ? '1.3em' : '1.1em'));
  // Escalating combo visual effects
  comboEl.classList.toggle('combo-fire', game.combo >= 3 && game.combo < 5);
  comboEl.classList.toggle('combo-intense', game.combo >= 5 && game.combo < 10);
  comboEl.classList.toggle('combo-legendary', game.combo >= 10);
  playArea.classList.toggle('combo-edge-glow', game.combo >= 5 && game.combo < 10);
  playArea.classList.toggle('combo-edge-legendary', game.combo >= 10);

  const dirtyCount = getDirtyCount();
  $('dirty-count').textContent = dirtyCount > 0 ? `⚠️ ${dirtyCount}` : '✓';
  $('dirty-count').style.color = dirtyCount > 2 ? '#e53935' : (dirtyCount > 0 ? '#fdd835' : '#43a047');

  // Dirty sinks indicator
  const dirtySinks = game.sinks ? game.sinks.filter(s => s.dirty).length : 0;
  const sinksHud = $('sinks-hud');
  if (dirtySinks > 0) {
    sinksHud.style.display = '';
    $('dirty-sinks').textContent = `🚿 ${dirtySinks}`;
    $('dirty-sinks').style.color = dirtySinks >= game.sinks.length ? '#e53935' : '#64b5f6';
  } else {
    sinksHud.style.display = 'none';
  }

  const sec = Math.max(0, Math.ceil(game.time));
  $('timer').textContent = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
  $('timer').style.color = sec <= 10 ? '#e53935' : (sec <= 20 ? '#fdd835' : '#43a047');
  $('timer').style.animation = sec <= 10 ? 'blink 0.5s infinite' : '';

  // Urgent beeping when time is low
  if (sec <= 10 && sec > 0 && game.running) {
    const now = Date.now();
    if (now - game.lastUrgentBeep > 1000) {
      playUrgent();
      game.lastUrgentBeep = now;
    }
  }

  $('cnt-speed').textContent = game.powerups.speed;
  $('cnt-slow').textContent = game.powerups.slow;
  $('cnt-auto').textContent = game.powerups.auto;

  $('pow-speed').classList.toggle('disabled', game.powerups.speed <= 0 && game.effects.speed <= 0);
  $('pow-slow').classList.toggle('disabled', game.powerups.slow <= 0 && game.effects.slow <= 0);
  $('pow-auto').classList.toggle('disabled', game.powerups.auto <= 0);
  $('pow-speed').classList.toggle('active-effect', game.effects.speed > 0);
  $('pow-slow').classList.toggle('active-effect', game.effects.slow > 0);

  const towelEl = $('towels');
  towelEl.classList.toggle('low', game.towels <= 2 && game.towels > 0);
  towelEl.classList.toggle('empty', game.towels === 0);
  towelEl.children[0].textContent = game.towels > 5 ? '📄📄📄' : (game.towels > 2 ? '📄📄' : (game.towels > 0 ? '📄' : '❌'));
  towelEl.children[1].textContent = game.towels === 0 ? 'EMPTY!' : 'TOWELS';
}

function showShiftIntro() {
  const cfg = getShiftConfig();
  const narrative = SHIFT_NARRATIVES[game.shift] || SHIFT_NARRATIVES[0];
  $('intro-shift-num').textContent = narrative.progress || `SHIFT ${game.shift + 1}`;
  $('intro-title').textContent = narrative.name;
  $('intro-desc').textContent = narrative.desc;
  // Pick a random tip for this shift from Bucky
  const shiftTips = BUCKY_TIPS[game.shift] || BUCKY_TIPS[0];
  const tip = shiftTips[Math.floor(Math.random() * shiftTips.length)];
  $('intro-tip').textContent = tip;
  $('intro-stalls').textContent = cfg.stalls;
  $('intro-sinks').textContent = cfg.sinks;
  $('intro-time').textContent = cfg.duration;
  showScreen('shift-intro');
}

function startShift() {
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
  game.puddles = [];
  document.querySelectorAll('.puddle').forEach(el => el.remove());

  // Set starting item counts based on item upgrades
  // Powerups: start with 1 of each basic item
  // Extra items purchased with coins carry over between shifts
  if (!game.powerups) {
    game.powerups = {speed: 1, slow: 1, auto: 0};
  }

  // Maybe trigger inspector visit (not on first shift)
  if (Math.random() < CONFIG.inspectorChance && game.shift > 0) {
    game.inspectorTimer = rnd(20000, 40000); // Inspector arrives after 20-40 seconds
  }

  // Maybe trigger rush hour
  if (Math.random() < CONFIG.rushChance && game.shift > 0) {
    game.rushTimer = rnd(15000, 30000); // Rush starts after 15-30 seconds
  }

  buildStalls();
  buildSinks();
  hideTaskPanel();
  updateHUD();
  showScreen('game-screen');
  $('rush-warning').style.display = 'none';
  $('inspector-warning').style.display = 'none';
  $('pause-overlay').classList.remove('active');

  game.running = true;
  game.paused = false;
  game.lastTime = performance.now();
  startMusic();
  requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
  if (!game.running) return;

  // Skip game logic when paused but keep loop running
  if (game.paused) {
    game.lastTime = now;
    requestAnimationFrame(gameLoop);
    return;
  }

  const dt = Math.min(now - game.lastTime, 100);
  game.lastTime = now;

  update(dt);
  updateHUD();
  renderPeople();

  requestAnimationFrame(gameLoop);
}

function update(dt) {
  const cfg = getShiftConfig();

  game.time -= dt / 1000;
  if (game.time <= 0) {
    endShift();
    return;
  }
  // Low time warning at 15 seconds
  if (game.time <= 15 && game.time > 14.5) showBeaverTip('lowTime');

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
    // Random mess spawn during rush (chaos!)
    if (Math.random() < CONFIG.messChance.walkwayRandom * (dt / 1000)) {
      spawnRandomMess();
    }
    if (game.rushDuration <= 0) {
      game.rushMode = false;
      $('rush-warning').style.display = 'none';
      if (!game.inspector) setBeaverMood('idle', 0);
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

  // Spawn customers
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnCustomer();
    let interval = rnd(cfg.spawnMin, cfg.spawnMax);
    if (game.effects.slow > 0) interval *= 2;
    if (game.rushMode) interval *= 0.3; // Much faster during rush
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

    if (stall.doorOpen && stall.state !== 'occupied' && stall.state !== 'dirty') {
      stall.doorOpen = false;
      updateStallDOM(i);
    }
  }

  // Update active cleaning (auto-progress, but clicking is faster!)
  if (game.activeStall >= 0 && game.activeTask >= 0) {
    const speed = game.effects.speed > 0 ? 2 : 1;
    game.taskProgress += dt * 0.3 * speed; // Slow auto-progress

    if (game.taskProgress >= getEffectiveTaskTime()) {
      completeTask();
    }
    updateStallDOM(game.activeStall);
    updateTaskPanel();
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
        game.score += 25;
        playTaskComplete();
        floatMessage('+25', 400, 350, 'good');
      }
      updateSinkDOM(i);
    }
  }

  updatePeople(dt);

  if (game.effects.speed > 0) game.effects.speed -= dt;
  if (game.effects.slow > 0) game.effects.slow -= dt;
  if (game.comboBoost > 0) game.comboBoost -= dt;

  if (game.rating <= 0) {
    gameOver();
  }
}

function spawnCustomer() {
  if (game.people.filter(p => p.phase !== 'exit').length >= 12) return;

  const floor = $('floor-area');
  const rect = floor.getBoundingClientRect();
  const exitDoor = $('exit-door').getBoundingClientRect();

  // Check for special character spawn first
  const genderFilter = game.gender === 'male' ? 'male' : 'female';
  const eligibleSpecials = SPECIAL_CUSTOMERS.filter(c => c.gender === genderFilter);
  let special = null;
  for (const sc of eligibleSpecials) {
    if (Math.random() < sc.chance) {
      special = sc;
      break;
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
    isUrgent = Math.random() < 0.2; // 20% chance of urgent customer
    isVip = !isUrgent && Math.random() < 0.12; // 12% chance of VIP (not if urgent)

    // Messiness: 0 = average, -1 = clean (sparkle), 1 = messy (more tasks)
    const messRoll = Math.random();
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

  game.people.push({
    id: ++game.personId,
    icon: icon,
    x: exitDoor.left - rect.left + 15,
    y: exitDoor.top - rect.top + 20,
    phase: 'enter',
    target: -1,
    patience: patience,
    maxPatience: patience,
    urgent: isUrgent,
    vip: isVip,
    messiness: messiness,
    thought: enterThought,
    thoughtTimer: enterTimer,
    shirt: shirt,
    specialName: specialName,
    specialBadge: specialBadge,
    specialThoughts: specialThoughts,
    enterOffsetX: rnd(-30, 30), // Random X offset for natural-looking enter paths
  });

  if (isVip) {
    showBeaverTip('vipCustomer');
    playVIPFanfare();
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

    // Update thought timer
    if (p.thoughtTimer > 0) p.thoughtTimer -= dt;

    // Check if customer steps in mess (walking phases only)
    if (['enter', 'findStall', 'toStall', 'toSink', 'toTowels', 'exit'].includes(p.phase)) {
      const mess = checkCustomerInMess(p);
      if (mess && !p.steppedInMess) {
        p.steppedInMess = mess.id;
        p.thought = pick(THOUGHTS.disgusted);
        p.thoughtTimer = 1500;
        playCustomerDisgusted();
        haptic('warning');
        // Messy messes leave footprints
        if (mess.type === 'muddy' || mess.type === 'vomit') {
          p.hasMessyFeet = true;
        }
        // Small rating hit for letting customers step in mess
        game.rating = clamp(game.rating - 0.05, 0, 5);
        floatMessage('😖 Stepped in mess!', p.x, p.y - 30, 'bad');
      }
    }

    // Messy feet leave occasional footprints
    if (p.hasMessyFeet && Math.random() < 0.002 * (dt / 16)) {
      spawnPuddle(p.x + rnd(-5, 5), p.y + rnd(15, 25), 'muddy');
      // Feet get cleaner over time
      if (Math.random() < 0.3) p.hasMessyFeet = false;
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
        p.thoughtTimer = 2000;
      }

      if (p.patience <= 0) {
        const ratingLoss = p.vip ? 0.6 : 0.3; // VIP = 2x rating impact
        game.rating = clamp(game.rating - ratingLoss, 0, 5);
        game.stats.abandoned++;
        const hadCombo = game.combo;
        game.combo = 0;
        showComboBreak(hadCombo);
        playBad();
        haptic('error'); // Negative feedback for customer leaving
        screenShake();
        setBeaverMood('sad', 1500);
        const msg = p.vip ? '⭐ VIP LEFT! -' + ratingLoss.toFixed(1) + '⭐' : '😤 LEFT!';
        floatMessage(msg, p.x, p.y - 20, 'bad');

        // Pee accident when customer gives up!
        spawnPuddle(p.x + rnd(-10, 10), p.y + rnd(20, 35), 'pee');

        p.phase = 'exit';
        continue;
      }
    }

    if (p.phase === 'enter') {
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
    }
    else if (p.phase === 'findStall') {
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
    }
    else if (p.phase === 'toStall') {
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

      if (dist < 10) {
        const stall = game.stalls[p.target];

        // If stall is being cleaned, redirect customer to find another stall
        if (stall.state === 'cleaning') {
          stall.reservedBy = null; // Release reservation
          p.phase = 'findStall';
          p.target = -1;
          continue;
        }

        p.phase = 'entering';
        p.enterTimer = 350;

        if (stall.state === 'dirty') {
          // Start grace period - player has 200ms to finish cleaning
          p.gracePending = true;
          p.graceTimer = 200;
        }

        stall.doorOpen = true;
        updateStallDOM(p.target);
      } else {
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
      }
    }
    else if (p.phase === 'entering') {
      p.enterTimer -= dt;
      p.y -= speed * 0.6;

      // Grace period handling - check if stall was cleaned in time
      if (p.gracePending) {
        const stall = game.stalls[p.target];
        if (stall.state === 'empty' || stall.state === 'cleaning') {
          // Cleaned in time (or actively cleaning)! Award save bonus
          p.gracePending = false;
          game.stats.saves++;
          game.score += 50;
          floatMessage('JUST IN TIME! +50', p.x, p.y - 30, 'save');
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
            game.combo = 0;
            showComboBreak(hadCombo);
            playBad();
            playCustomerDisgusted();
            screenShake();
            setBeaverMood('sad', 1500);
            p.thought = pick(THOUGHTS.disgusted);
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
          stall.doorOpen = false;
          updateStallDOM(p.target);
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
        stall.doorOpen = false;
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
      // Stand in front of sink (above it), not inside it
      const ty = sinkRect.top - floorRect.top - 35;
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 12) {
        p.phase = 'washing';
        p.washTime = 1000;
        p.sinkIdx = sinkIdx;
        playSinkWater();
      } else {
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
      }
    }
    else if (p.phase === 'washing') {
      p.washTime -= dt;
      if (p.washTime <= 0) {
        if (Math.random() < 0.25) {
          game.sinks[p.sinkIdx].dirty = true;
          showBeaverTip('dirtySink');
        }
        updateSinkDOM(p.sinkIdx);
        // Chance of water splash on floor
        if (Math.random() < CONFIG.messChance.sinkSplash) {
          const sinkEl = $('sinks-area').children[p.sinkIdx];
          if (sinkEl) {
            const sinkRect = sinkEl.getBoundingClientRect();
            const x = sinkRect.left - floorRect.left + rnd(-15, 15);
            const y = sinkRect.top - floorRect.top - rnd(30, 50);
            spawnPuddle(x, y, 'water');
          }
        }

        // Customer wants to dry hands (configurable skip chance)
        const skipTowel = Math.random() < CONFIG.towelSkipChance;
        if (skipTowel) {
          // Didn't need towel, still happy
          if (p.specialThoughts && p.specialThoughts.happy) {
            p.thought = p.specialThoughts.happy;
          } else {
            p.thought = pick(THOUGHTS.happy);
          }
          playCustomerHappy();
          p.thoughtTimer = 1500;
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
      // Stand in front of towels (above them), not inside them
      const ty = towelRect.top - floorRect.top - 35;
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 15) {
        // Arrived at towels
        if (game.towels > 0) {
          game.towels--;
          // Happy - got a towel
          if (p.specialThoughts && p.specialThoughts.happy) {
            p.thought = p.specialThoughts.happy;
          } else {
            p.thought = pick(THOUGHTS.happy);
          }
          playCustomerHappy();
          p.thoughtTimer = 1500;
        } else {
          // No towels! Customer is unhappy
          p.thought = pick(['No towels?!', 'Wet hands...', 'Seriously?', 'Ugh, drip dry...']);
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
      }
    }
    else if (p.phase === 'exit') {
      const exitDoor = $('exit-door').getBoundingClientRect();
      const sinkTowelArea = $('sink-towel-area');
      const sinkTowelRect = sinkTowelArea ? sinkTowelArea.getBoundingClientRect() : null;

      // Define a safe Y threshold above the sink-towel area to avoid clipping
      const safeY = sinkTowelRect
        ? sinkTowelRect.top - floorRect.top - 45
        : floorRect.height - 100;

      // If customer is below safe threshold (too close to sinks/towels), walk up first
      if (p.y > safeY) {
        // Walk straight up to clear the sink-towel area
        p.y -= speed * 1.2;
      } else {
        // Now walk to exit door
        const tx = exitDoor.left - floorRect.left + 15;
        const ty = exitDoor.top - floorRect.top + 20;
        const dx = tx - p.x, dy = ty - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < 20) {
          game.people.splice(i, 1);
        } else {
          p.x += (dx / dist) * speed * 1.2;
          p.y += (dy / dist) * speed * 1.2;
        }
      }
    }
  }
}

function customerLeaves(stallIdx) {
  const stall = game.stalls[stallIdx];
  stall.state = 'dirty';
  stall.doorOpen = true;
  playFlush(); // Toilet flush sound
  playDoorCreak(); // Door opening

  // Generate tasks based on customer messiness
  // Clean customers (-1): lower chance of each task, min 1 task
  // Average customers (0): normal behavior
  // Messy customers (1): higher chance of each task, likely 3-4 tasks
  const messiness = stall.messiness || 0;
  const chanceModifier = messiness === -1 ? 0.4 : (messiness === 1 ? 1.5 : 1);

  // Occasional comedy sound (8% chance for fart, higher for messy customers)
  if (Math.random() < (messiness === 1 ? 0.15 : 0.08)) {
    setTimeout(() => playFart(), 150);
  }

  stall.tasks = TASKS.filter(t => Math.random() < (t.chance * chanceModifier)).map(t => ({...t, done: false}));

  // Ensure minimum tasks based on messiness
  if (messiness === 1 && stall.tasks.length < 3) {
    // Messy customers: guarantee at least 3 tasks
    const remaining = TASKS.filter(t => !stall.tasks.find(st => st.id === t.id));
    while (stall.tasks.length < 3 && remaining.length > 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      stall.tasks.push({...remaining.splice(idx, 1)[0], done: false});
    }
  } else if (stall.tasks.length === 0) {
    // At least 1 task for everyone
    stall.tasks.push({...TASKS[1], done: false});
  }


  updateStallDOM(stallIdx);
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

    // Chance of vomit - messy customers more likely
    const vomitChance = person.messiness === 1 ? 0.25 : (person.messiness === -1 ? 0.05 : 0.12);
    if (Math.random() < vomitChance) {
      spawnPuddle(person.x + rnd(-20, 20), person.y + rnd(30, 50), 'vomit');
    }
  }
}

function spawnPuddle(x, y, type) {
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

// Spawn random mess in bathroom area (for rush hour chaos)
function spawnRandomMess() {
  const floor = $('floor-area');
  const rect = floor.getBoundingClientRect();
  // Random walkway location (middle area of floor)
  const x = rnd(80, rect.width - 80);
  const y = rnd(100, rect.height - 100);
  // Random mess type weighted by frequency
  const roll = Math.random();
  let type = 'water';
  if (roll < 0.15) type = 'muddy';
  else if (roll < 0.35) type = 'vomit';
  else if (roll < 0.65) type = 'pee';
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
  const boost = game.effects.speed > 0 ? 80 : 50;
  puddle.cleanProgress += boost;
  playMop();
  haptic('light');

  // Check if cleaned
  if (puddle.cleanProgress >= messType.cleanTime) {
    game.score += messType.points;
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
  if (!audioCtx) initAudio();
  const now = audioCtx.currentTime;
  // Gross splat sound - low freq burst with wobble
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  gain.gain.setValueAtTime(0.25 * sfxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Play squish sound for muddy footprints
function playSquish() {
  if (!audioCtx) initAudio();
  const now = audioCtx.currentTime;
  // Squelchy mud sound
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.1);
  gain.gain.setValueAtTime(0.15 * sfxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
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
  game.score += points;
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
    game.score += CONFIG.inspectorBonus;
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
      // CSS art body with emoji head - custom shirt color
      const shirt = p.shirt || {top:'#5a8dd8',bot:'#3d6cb8',border:'#2d5090'};
      el.innerHTML = `
        <div class="person-body">
          <div class="person-icon">${p.icon}</div>
          <div class="person-torso" style="background:linear-gradient(180deg,${shirt.top} 0%,${shirt.bot} 100%);border-color:${shirt.border}"></div>
          <div class="person-legs"><div class="person-leg"></div><div class="person-leg"></div></div>
        </div>
        <div class="patience-bar"><div class="patience-fill"></div></div>
        <div class="thought"></div>`;
      floor.appendChild(el);
    }

    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';

    const isWalking = p.phase !== 'washing' && p.phase !== 'entering';
    el.classList.toggle('walking', isWalking);
    el.classList.toggle('entering', p.phase === 'entering');
    el.classList.toggle('urgent', p.urgent);
    el.classList.toggle('vip', p.vip);

    // Add VIP badge if needed
    if (p.vip && !el.querySelector('.vip-badge')) {
      const badge = document.createElement('div');
      badge.className = 'vip-badge';
      badge.textContent = '⭐';
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

    // Mood states based on thoughts
    // Check both generic thoughts and special character happy thoughts
    const isHappy = p.thought && (THOUGHTS.happy.includes(p.thought) ||
      (p.specialThoughts && p.thought === p.specialThoughts.happy));
    const isDisgusted = p.thought && THOUGHTS.disgusted.includes(p.thought);
    el.classList.toggle('happy', isHappy && p.thoughtTimer > 0);
    el.classList.toggle('disgusted', isDisgusted && p.thoughtTimer > 0);

    const patienceRatio = p.patience / p.maxPatience;
    el.classList.toggle('impatient', p.thoughtTimer > 0);

    const thoughtEl = el.querySelector('.thought');
    thoughtEl.textContent = p.thoughtTimer > 0 ? p.thought : '';

    const pct = patienceRatio * 100;
    const fill = el.querySelector('.patience-fill');
    fill.style.width = pct + '%';
    fill.style.background = pct > 50 ? '#43a047' : (pct > 25 ? '#fdd835' : '#e53935');
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
    if (game.activeTask < 0) {
      // Auto-select first incomplete task
      const firstTask = stall.tasks.findIndex(t => !t.done);
      if (firstTask >= 0) {
        game.activeTask = firstTask;
        game.taskProgress = 0;
      }
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
    const progress = game.activeTask === ti ? (game.taskProgress / getEffectiveTaskTime()) * 100 : 0;
    return `<div class="task-btn ${t.done ? 'done' : ''} ${game.activeTask === ti ? 'active' : ''}" data-idx="${ti}">
      ${t.icon} ${t.label}
      <div class="progress" style="width:${progress}%"></div>
    </div>`;
  }).join('');

  btns.querySelectorAll('.task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ti = parseInt(btn.dataset.idx);
      if (!stall.tasks[ti].done) {
        // Visual click feedback
        btn.classList.remove('clicked');
        void btn.offsetWidth; // Force reflow
        btn.classList.add('clicked');
        haptic('light'); // Quick tap feedback on task mashing

        if (game.activeTask === ti) {
          // Clicking active task = boost progress!
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
          playTaskSound(stall.tasks[ti].id);
          showTaskPanel(stallIdx);
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
  const btns = $('task-buttons').querySelectorAll('.task-btn');

  btns.forEach((btn, ti) => {
    const progress = game.activeTask === ti ? (game.taskProgress / getEffectiveTaskTime()) * 100 : 0;
    btn.querySelector('.progress').style.width = Math.min(100, progress) + '%';
    btn.classList.toggle('active', game.activeTask === ti && !stall.tasks[ti].done);
  });
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
    checkComboMilestone();
    bumpValue('combo');

    const comboMult = 1 + game.combo * 0.5;
    const vipMult = wasVip ? 2 : 1; // VIP stalls give 2x score!
    const points = Math.floor(100 * comboMult * vipMult);
    game.score += points;
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

      // Sparkle burst effect - more particles at higher combos
      const sparkleCount = game.combo >= 10 ? 24 : (game.combo >= 5 ? 20 : (game.combo >= 3 ? 14 : (wasVip ? 16 : 10)));
      spawnSparkles(x, y + 40, sparkleCount);

      let msg;
      if (game.combo >= 10) {
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
      const confettiCount = game.combo >= 10 ? 22 : (game.combo >= 5 ? 18 : (game.combo >= 3 ? 12 : (wasVip ? 14 : 6)));
      spawnConfetti(x, y + 30, confettiCount);
    }

    playStallClean();
    // Extra bloop sound at high combos for extra fun
    if (game.combo >= 5) playBloop();
    // Beaver always gets excited for a clean stall!
    if (wasVip || game.combo >= 3) {
      screenShake();
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
    game.score += 20;
    floatMessage('+20 Restocked!', 60, 300, 'good');
    playTaskComplete();
  }
});

$('pow-speed').addEventListener('click', () => {
  const el = $('pow-speed');
  el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
  if (game.powerups.speed > 0 && game.effects.speed <= 0) {
    game.powerups.speed--;
    game.effects.speed = getItemDuration('speed');
    playPowerup();
    haptic('strong'); // Powerup activation feedback
    floatMessage('⚡ SPEED BOOST!', 400, 200, 'combo');
  }
});

$('pow-slow').addEventListener('click', () => {
  const el = $('pow-slow');
  el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
  if (game.powerups.slow > 0 && game.effects.slow <= 0) {
    game.powerups.slow--;
    game.effects.slow = getItemDuration('slow');
    playPowerup();
    haptic('strong'); // Powerup activation feedback
    floatMessage('🐢 SLOW MODE!', 400, 200, 'combo');
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
      game.score += 75;
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
        floatMessage('✨ AUTO CLEAN!', rect.left - playRect.left, y, 'combo');
      }
      playStallClean();
      haptic('strong'); // Powerup activation feedback
      setBeaverMood('excited', 1000);
    }
  }
});

// Supply Shop system - simplified item purchases
function calculateCoins(score, grade) {
  // Base coins from score
  let coins = Math.floor(score / 10);
  // Grade bonus multiplier
  const gradeBonus = {S: 2, A: 1.5, B: 1.2, C: 1, F: 0.5};
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
        <span class="inv-item">⚡ ${game.powerups.speed}</span>
        <span class="inv-item">🐢 ${game.powerups.slow}</span>
        <span class="inv-item">✨ ${game.powerups.auto}</span>
      </div>
    </div>
  `;
  grid.insertAdjacentHTML('beforeend', inventoryHtml);

  // Simple item shop - buy +1 of each
  const shopHtml = `
    <div class="shop-items">
      ${ITEMS.map(item => {
        const canAfford = game.coins >= item.cost;
        return `
          <button class="shop-item ${canAfford ? '' : 'cant-afford'}" data-id="${item.id}">
            <span class="shop-icon">${item.icon}</span>
            <span class="shop-name">${item.name}</span>
            <span class="shop-desc">${item.desc}</span>
            <span class="shop-cost">🪙 ${item.cost}</span>
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

function purchaseItem(itemId) {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return;

  if (game.coins < item.cost) return;

  game.coins -= item.cost;
  game.powerups[itemId]++;
  playTaskComplete();
  renderSupplyShop();
}

function showUpgradeScreen() {
  renderSupplyShop();
  showScreen('upgrade-screen');
}

function endShift() {
  game.running = false;
  stopMusic();
  playWin();
  haptic('success'); // Success pattern for shift complete

  // Clean up inspector if still present
  game.inspector = null;
  const inspectorEl = $('floor-area').querySelector('.inspector');
  if (inspectorEl) inspectorEl.remove();
  $('inspector-warning').style.display = 'none';

  const narrative = SHIFT_NARRATIVES[game.shift] || SHIFT_NARRATIVES[0];
  $('result-title').textContent = `${narrative.name} Complete!`;

  let stars = '';
  for (let i = 0; i < 5; i++) stars += game.rating >= i + 0.75 ? '⭐' : (game.rating >= i + 0.25 ? '🌟' : '☆');
  $('result-rating').innerHTML = `<span style="font-size:1.6em">${stars}</span>`;

  $('result-stats').innerHTML = `
    <div class="stat"><div class="num">${game.stats.cleaned}</div><div class="lbl">Stalls Cleaned</div></div>
    <div class="stat"><div class="num">${game.stats.served}</div><div class="lbl">Customers</div></div>
    <div class="stat"><div class="num">${game.maxCombo}x</div><div class="lbl">Best Combo</div></div>
    <div class="stat"><div class="num">${Math.floor(game.score)}</div><div class="lbl">Score</div></div>
  `;

  const ratio = game.stats.dirty / Math.max(1, game.stats.served);
  const shiftsLeft = CONFIG.shifts.length - game.shift - 1;
  let grade, comment;
  if (ratio === 0 && game.stats.abandoned === 0) { grade = 'S'; comment = shiftsLeft > 0 ? 'PERFECT! That Golden Plunger is calling your name!' : 'PERFECT! You earned it, rookie!'; }
  else if (ratio <= 0.1) { grade = 'A'; comment = shiftsLeft > 0 ? 'Great work! Keep it up!' : 'Almost perfect! Well done!'; }
  else if (ratio <= 0.2) { grade = 'B'; comment = shiftsLeft > 0 ? `Solid shift. ${shiftsLeft} more to go!` : 'Respectable finish, rookie!'; }
  else if (ratio <= 0.35) { grade = 'C'; comment = shiftsLeft > 0 ? "The manager's watching... step it up!" : 'Made it... barely!'; }
  else { grade = 'F'; comment = "That was rough. Don't let it happen again!"; }

  $('result-grade').textContent = grade;
  $('result-grade').className = 'grade ' + grade;
  $('result-comment').textContent = comment;

  // Update achievement stats
  achievementStats.shiftsCompleted++;
  achievementStats.totalCleaned += game.stats.cleaned;
  achievementStats.totalServed += game.stats.served;
  achievementStats.totalSaves += game.stats.saves;
  if (game.maxCombo > achievementStats.maxCombo) achievementStats.maxCombo = game.maxCombo;
  if (grade === 'S') achievementStats.sGrades++;
  saveAchievementData();
  checkAchievements();

  // Award coins based on performance
  const coinsEarned = calculateCoins(game.score, grade);
  game.coins += coinsEarned;
  if (coinsEarned > 0) playCoinEarned();

  // Award XP for rank progression (same formula as coins)
  const xpEarned = calculateCoins(game.score, grade);
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
  const won = game.shift >= CONFIG.shifts.length - 1;
  haptic(won ? 'success' : 'error'); // Victory or defeat feedback

  // Clean up inspector if still present
  game.inspector = null;
  const inspectorEl = $('floor-area').querySelector('.inspector');
  if (inspectorEl) inspectorEl.remove();
  $('inspector-warning').style.display = 'none';

  const finalScore = Math.floor(game.score);
  const isNewRecord = finalScore > highScore;

  // Calculate grade for leaderboard
  const ratio = game.stats.dirty / Math.max(1, game.stats.served);
  let grade;
  if (ratio === 0 && game.stats.abandoned === 0) grade = 'S';
  else if (ratio <= 0.1) grade = 'A';
  else if (ratio <= 0.2) grade = 'B';
  else if (ratio <= 0.35) grade = 'C';
  else grade = 'F';

  if (isNewRecord) {
    highScore = finalScore;
    localStorage.setItem('beaverHighScore', highScore);
    updateHighScoreDisplay();
  }

  $('go-icon').textContent = won ? '🏆' : '📦';
  $('go-title').textContent = won ? 'GOLDEN PLUNGER EARNED!' : 'FIRED!';
  $('go-msg').textContent = won ? pick(WIN_MESSAGES) : pick(GAME_OVER_MESSAGES);
  $('go-score').textContent = finalScore + (isNewRecord ? ' 🎉 NEW RECORD!' : '');
  $('go-high-score-val').textContent = highScore;

  $('go-stats').innerHTML = `
    <div class="stat"><div class="num">${game.stats.cleaned}</div><div class="lbl">Cleaned</div></div>
    <div class="stat"><div class="num">${game.stats.served}</div><div class="lbl">Served</div></div>
    <div class="stat"><div class="num">${game.maxCombo}x</div><div class="lbl">Best Combo</div></div>
    <div class="stat"><div class="num">${game.stats.saves}</div><div class="lbl">Close Calls</div></div>
  `;

  // Show name input for leaderboard
  const nameSection = $('go-name-section');
  const nameInput = $('go-name-input');
  if (nameSection && nameInput) {
    nameInput.value = playerName;
    nameSection.style.display = 'block';
  }

  // Store score info for submission
  window.pendingScore = { score: finalScore, shift: game.shift + 1, grade };

  // Show tip jar on win
  const tipSection = $('tip-section');
  if (tipSection) {
    tipSection.style.display = won ? 'block' : 'none';
  }

  if (won) playWin();
  else playBad();
  showScreen('gameover-screen');
}

// Gender toggle
document.querySelectorAll('.gender-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedGender = btn.dataset.gender;
    playClick();
  });
});

// Tutorial modal
$('help-btn').addEventListener('click', () => {
  $('tutorial-modal').classList.add('active');
});
$('close-tutorial').addEventListener('click', () => {
  $('tutorial-modal').classList.remove('active');
  localStorage.setItem('beaverTutorialSeen', 'true');
});
$('tutorial-got-it').addEventListener('click', () => {
  $('tutorial-modal').classList.remove('active');
  localStorage.setItem('beaverTutorialSeen', 'true');
});
$('tutorial-modal').addEventListener('click', (e) => {
  if (e.target.id === 'tutorial-modal') {
    $('tutorial-modal').classList.remove('active');
    localStorage.setItem('beaverTutorialSeen', 'true');
  }
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

// Achievements modal
$('achievements-btn').addEventListener('click', openAchievementsModal);
$('close-achievements').addEventListener('click', closeAchievementsModal);
$('achievements-modal').addEventListener('click', e => {
  if (e.target === $('achievements-modal')) closeAchievementsModal();
});

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

// Settings modal
$('settings-btn').addEventListener('click', openSettings);
$('title-settings-btn').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
$('settings-modal').addEventListener('click', e => {
  if (e.target === $('settings-modal')) closeSettings();
});
$('sfx-volume').addEventListener('input', e => setSfxVolume(e.target.value));
$('music-volume').addEventListener('input', e => setMusicVolume(e.target.value));
$('master-mute').addEventListener('click', toggleMasterMute);
$('haptics-toggle').addEventListener('click', toggleHaptics);
updateSettingsUI();

$('start-btn').addEventListener('click', () => {
  initAudio();
  init();
  showShiftIntro();
});

$('shift-start-btn').addEventListener('click', () => {
  startShift();
});

$('next-btn').addEventListener('click', () => {
  // Check for mini-game trigger BEFORE incrementing shift
  const shouldMinigame = shouldTriggerMinigame();
  game.shift++;

  if (game.shift >= CONFIG.shifts.length) {
    // Last shift completed - check minigame before final results
    if (shouldMinigame) {
      showMinigameIntro();
    } else {
      gameOver();
    }
  } else {
    // More shifts to go
    if (shouldMinigame) {
      showMinigameIntro();
    } else {
      showUpgradeScreen();
    }
  }
});

$('skip-upgrades').addEventListener('click', () => {
  showShiftIntro();
});

$('retry-btn').addEventListener('click', () => {
  showScreen('title-screen');
});

// Mini-game buttons
$('minigame-start-btn').addEventListener('click', () => {
  startMinigame();
});

$('minigame-continue-btn').addEventListener('click', () => {
  continueFromMinigame();
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
    }
  });
}

// Leaderboard toggle on title screen
const lbBtn = $('leaderboard-btn');
if (lbBtn) {
  lbBtn.addEventListener('click', () => {
    const panel = $('leaderboard-panel');
    if (panel) {
      panel.classList.toggle('active');
      fetchLeaderboard();
    }
  });
}

const lbClose = $('leaderboard-close');
if (lbClose) {
  lbClose.addEventListener('click', () => {
    $('leaderboard-panel')?.classList.remove('active');
  });
}

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

  // Background - wood grain texture effect
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#5a4030');
  bgGrad.addColorStop(0.5, '#3d2814');
  bgGrad.addColorStop(1, '#2d1f0f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Decorative border
  ctx.strokeStyle = '#f5a623';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  // Inner decorative line
  ctx.strokeStyle = 'rgba(245, 166, 35, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 35, w - 70, h - 70);

  // Title - Beaver emoji + game name
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5a623';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText("🦫 Beaver's", w / 2, 120);
  ctx.fillText('Bathroom Blitz', w / 2, 175);

  // Tagline
  ctx.fillStyle = '#fdd835';
  ctx.font = 'italic 22px system-ui, sans-serif';
  ctx.fillText('Cleanest Restrooms in Texas!', w / 2, 215);

  // Result badge
  const badgeY = 300;
  const badgeRadius = 70;

  // Badge glow
  ctx.shadowColor = shareData.isWin ? 'rgba(255, 215, 0, 0.6)' : 'rgba(245, 166, 35, 0.5)';
  ctx.shadowBlur = 30;

  // Badge background
  const badgeGrad = ctx.createRadialGradient(w / 2, badgeY, 0, w / 2, badgeY, badgeRadius);
  if (shareData.isWin) {
    badgeGrad.addColorStop(0, '#ffd700');
    badgeGrad.addColorStop(1, '#b8860b');
  } else {
    badgeGrad.addColorStop(0, '#e53935');
    badgeGrad.addColorStop(1, '#b71c1c');
  }
  ctx.fillStyle = badgeGrad;
  ctx.beginPath();
  ctx.arc(w / 2, badgeY, badgeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Badge border
  ctx.strokeStyle = shareData.isWin ? '#ffd700' : '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Badge icon
  ctx.font = '60px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(shareData.isWin ? '🏆' : '🚽', w / 2, badgeY + 20);

  // Score display
  ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 80px system-ui, sans-serif';
  ctx.fillText(shareData.score.toLocaleString(), w / 2, 450);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#c9a86c';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('POINTS', w / 2, 485);

  // Grade badge
  const gradeColors = {
    S: '#ffd700',
    A: '#4caf50',
    B: '#2196f3',
    C: '#ff9800',
    F: '#f44336'
  };

  ctx.fillStyle = gradeColors[shareData.grade] || '#ff9800';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(shareData.grade, w / 2, 570);

  ctx.fillStyle = '#a08060';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('GRADE', w / 2, 600);

  // Stats section
  const statsY = 660;
  const statSpacing = 85;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, 60, statsY - 20, w - 120, 160, 15);
  ctx.fill();

  // Stat boxes
  const stats = [
    { icon: '🧹', value: shareData.cleaned, label: 'Cleaned' },
    { icon: '👥', value: shareData.served, label: 'Served' },
    { icon: '🔥', value: shareData.maxCombo + 'x', label: 'Combo' }
  ];

  stats.forEach((stat, i) => {
    const x = 120 + i * (w - 240) / 2.5;
    ctx.textAlign = 'center';
    ctx.font = '32px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(stat.icon, x, statsY + 30);
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillStyle = '#f5a623';
    ctx.fillText(String(stat.value), x, statsY + 75);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#a08060';
    ctx.fillText(stat.label, x, statsY + 100);
  });

  // Shift info
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a86c';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText(`Day ${shareData.shift} of 6`, w / 2, 870);

  // CTA
  ctx.fillStyle = '#f5a623';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Play at beaverbathroomblitz.com', w / 2, 915);
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
    const ratio = game.stats.dirty / Math.max(1, game.stats.served);
    let grade;
    if (ratio === 0 && game.stats.abandoned === 0) grade = 'S';
    else if (ratio <= 0.1) grade = 'A';
    else if (ratio <= 0.2) grade = 'B';
    else if (ratio <= 0.35) grade = 'C';
    else grade = 'F';

    shareData = {
      score: Math.floor(game.score),
      grade: grade,
      shift: game.shift + 1,
      cleaned: game.stats.cleaned,
      served: game.stats.served,
      maxCombo: game.maxCombo,
      isWin: false
    };
  } else if (source === 'gameover') {
    const won = game.shift >= CONFIG.shifts.length - 1;
    const ratio = game.stats.dirty / Math.max(1, game.stats.served);
    let grade;
    if (ratio === 0 && game.stats.abandoned === 0) grade = 'S';
    else if (ratio <= 0.1) grade = 'A';
    else if (ratio <= 0.2) grade = 'B';
    else if (ratio <= 0.35) grade = 'C';
    else grade = 'F';

    shareData = {
      score: Math.floor(game.score),
      grade: grade,
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
