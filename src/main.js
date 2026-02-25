import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Initialize Convex client
const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

// Auth state
let currentUser = null;
let playerName = localStorage.getItem('beaverPlayerName') || '';

// Sign in anonymously (creates persistent session)
async function signInAnonymous(name) {
  try {
    const result = await convex.mutation(api.auth.signIn, {
      provider: "anonymous",
      params: { name }
    });
    if (result?.userId) {
      currentUser = { id: result.userId, name };
      playerName = name;
      localStorage.setItem('beaverPlayerName', name);
      localStorage.setItem('beaverUserId', result.userId);
      updateAuthUI();
      return result;
    }
  } catch (e) {
    console.log('Sign in failed, using guest mode:', e);
    // Fallback: just save name locally
    playerName = name;
    localStorage.setItem('beaverPlayerName', name);
  }
  return null;
}

// Check if user is signed in
function initAuth() {
  const savedUserId = localStorage.getItem('beaverUserId');
  const savedName = localStorage.getItem('beaverPlayerName');
  if (savedUserId && savedName) {
    currentUser = { id: savedUserId, name: savedName };
    playerName = savedName;
  }
  updateAuthUI();
}

// Update auth UI elements
function updateAuthUI() {
  const authStatus = $('auth-status');
  const signInSection = $('signin-section');

  if (authStatus) {
    if (currentUser) {
      authStatus.innerHTML = `<span class="auth-user">🦫 ${currentUser.name}</span>`;
    } else {
      authStatus.innerHTML = '<span class="auth-guest">Guest</span>';
    }
  }

  if (signInSection) {
    signInSection.style.display = currentUser ? 'none' : 'block';
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
    "Use your powerups wisely - ⚡ Speed and ✨ Auto-clean are lifesavers!",
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
    "Almost there! Spend coins on upgrades between shifts.",
    "Speed Scrub upgrade makes a HUGE difference late game.",
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
};

const UPGRADES = [
  {
    id: 'speed',
    name: 'Speed Scrub',
    icon: '⚡',
    desc: 'Clean tasks complete faster',
    maxLevel: 5,
    baseCost: 50,
    costScale: 1.8,  // Each level costs 1.8x more
    effect: 0.12,    // 12% faster per level
  },
  {
    id: 'patience',
    name: 'Patience Plus',
    icon: '🕐',
    desc: 'Customers wait longer',
    maxLevel: 5,
    baseCost: 60,
    costScale: 1.7,
    effect: 0.15,    // 15% more patience per level
  },
  {
    id: 'automop',
    name: 'Auto-Mop',
    icon: '🤖',
    desc: 'Tasks auto-complete sometimes',
    maxLevel: 3,
    baseCost: 100,
    costScale: 2.0,
    effect: 0.08,    // 8% chance per level to auto-complete
  },
  {
    id: 'supplies',
    name: 'Better Supplies',
    icon: '📦',
    desc: '+1 of each power-up per shift',
    maxLevel: 3,
    baseCost: 80,
    costScale: 2.2,
    effect: 1,       // +1 power-up per level
  },
];

const TASKS = [
  {id:'plunge', icon:'🪠', label:'Plunge', chance:0.3},
  {id:'wipe', icon:'🧽', label:'Scrub', chance:0.75},
  {id:'mop', icon:'🧹', label:'Mop', chance:0.45},
  {id:'tp', icon:'🧻', label:'Restock', chance:0.4},
];

const THOUGHTS = {
  impatient: ['Hurry up!', 'Come ON!', '😤', 'Ugh...', '🙄', 'NEED TO GO!'],
  desperate: ['EMERGENCY! 🚨', 'HURRY!!!', '😱', 'CAN\'T WAIT!', '💀'],
  happy: ['Ahh! 😌', 'Nice & clean!', '✨', 'Perfect!', '👍'],
  disgusted: ['Gross! 🤢', 'Ewww!', 'Nasty...', '😖', 'Really?!'],
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
   thoughts:{enter:'Is this THE Buc-ee\'s?!',happy:'Instagram perfect!',impatient:'One more pic...'}},
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

let game = {};
let selectedGender = 'female';
let highScore = parseInt(localStorage.getItem('beaverHighScore')) || 0;

// Audio
let audioCtx = null;
let isMuted = localStorage.getItem('beaverMuted') === 'true';

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem('beaverMuted', isMuted);
  updateMuteButton();
}

function updateMuteButton() {
  const btn = $('mute-btn');
  if (btn) {
    btn.textContent = isMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', isMuted);
  }
}

function playSound(freq, duration, type = 'sine', volume = 0.25) {
  if (!audioCtx || isMuted) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

function playClick() { playSound(500, 0.05, 'square', 0.15); }
function playTaskComplete() { playSound(700, 0.08); setTimeout(() => playSound(900, 0.1), 60); }

// Task-specific sounds for cartoony feel
function playPlunge() {
  // Comedic 'plop' - low burst with pop
  playSound(80 + Math.random()*20, 0.12, 'sine', 0.3);
  setTimeout(() => playSound(200 + Math.random()*50, 0.06, 'triangle', 0.2), 80);
}

function playScrub() {
  // Satisfying spray/scrub - layered high freq bursts
  const base = 1800 + Math.random()*400;
  playSound(base, 0.04, 'sawtooth', 0.08);
  setTimeout(() => playSound(base + 200, 0.03, 'sawtooth', 0.06), 20);
  setTimeout(() => playSound(base - 100, 0.05, 'sawtooth', 0.07), 40);
}

function playMop() {
  // Squeaky clean - high pitch wobble
  const freq = 800 + Math.random()*200;
  playSound(freq, 0.06, 'sine', 0.12);
  setTimeout(() => playSound(freq + 150, 0.05, 'sine', 0.1), 50);
}

function playRestock() {
  // Paper rustle - quick random crinkle bursts
  for(let i=0; i<3; i++) {
    setTimeout(() => playSound(3000 + Math.random()*2000, 0.02, 'sawtooth', 0.05), i*25);
  }
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
  // Layered celebration: base arpeggio + sparkle shimmer
  playSound(523, 0.12, 'sine', 0.25);
  setTimeout(() => playSound(659, 0.12, 'sine', 0.25), 70);
  setTimeout(() => playSound(784, 0.14, 'sine', 0.25), 140);
  setTimeout(() => playSound(1047, 0.25, 'sine', 0.3), 220);
  // Add sparkle overlay (high frequency shimmer)
  setTimeout(() => playSound(2093, 0.08, 'sine', 0.12), 180);
  setTimeout(() => playSound(2349, 0.06, 'sine', 0.1), 240);
  setTimeout(() => playSound(2637, 0.05, 'sine', 0.08), 280);
}
function playBad() { playSound(200, 0.25, 'sawtooth', 0.2); }
function playUrgent() { playSound(800, 0.08, 'square', 0.1); setTimeout(() => playSound(600, 0.08, 'square', 0.1), 100); }
function playRush() { for(let i=0;i<3;i++) setTimeout(() => playSound(1000, 0.1, 'square', 0.2), i*100); }
function playInspector() { playSound(600, 0.15, 'sine', 0.2); setTimeout(() => playSound(800, 0.15, 'sine', 0.2), 150); setTimeout(() => playSound(1000, 0.2, 'sine', 0.25), 300); }
function playInspectorBad() { playSound(300, 0.3, 'sawtooth', 0.25); setTimeout(() => playSound(200, 0.4, 'sawtooth', 0.2), 200); }
function playInspectorGood() { [784, 988, 1175, 1319].forEach((f,i) => setTimeout(() => playSound(f, 0.12, 'sine', 0.2), i*80)); }
function playWin() {
  [523,659,784,1047].forEach((f,i) => setTimeout(() => playSound(f, 0.15), i*120));
}
// Combo milestone sounds - escalating intensity
function playComboMilestone(level) {
  if (level >= 10) {
    // Legendary: grand fanfare
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => playSound(f, 0.2, 'sine', 0.3), i * 60));
  } else if (level >= 5) {
    // Unstoppable: power chord
    [392, 523, 659, 784].forEach((f, i) => setTimeout(() => playSound(f, 0.15, 'sine', 0.25), i * 70));
  } else {
    // On fire: quick hit
    [523, 659, 784].forEach((f, i) => setTimeout(() => playSound(f, 0.1, 'sine', 0.2), i * 60));
  }
}
function playComboBreak() {
  playSound(400, 0.15, 'triangle', 0.15);
  setTimeout(() => playSound(300, 0.2, 'triangle', 0.1), 100);
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

function toggleMusic() {
  isMusicMuted = !isMusicMuted;
  localStorage.setItem('beaverMusicMuted', isMusicMuted);
  updateMusicButton();
  if (isMusicMuted) {
    stopMusic();
  } else if (game.running) {
    startMusic();
  }
}

function updateMusicButton() {
  const btn = $('music-btn');
  if (btn) {
    btn.textContent = '🎵';
    btn.classList.toggle('muted', isMusicMuted);
  }
}

function startMusic() {
  if (!audioCtx || isMusicMuted || musicPlaying) return;
  musicPlaying = true;
  melodyIndex = 0;
  bassIndex = 0;

  // Create master gain for music (lower than SFX)
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.08;
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
  powerupReady: "Use your powerups! (⚡🐢✨)",
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
    coins: 0,                 // Currency for upgrades
    upgrades: {speed: 0, patience: 0, automop: 0, supplies: 0},
    comboBoost: 0,            // Remaining duration of combo speed boost
    lastMilestone: 0,         // Last milestone level achieved (to avoid re-triggering)
  };
}

function getCustomers() {
  return game.gender === 'male' ? CUSTOMERS_MALE : CUSTOMERS_FEMALE;
}

function getShiftConfig() {
  return CONFIG.shifts[Math.min(game.shift, CONFIG.shifts.length - 1)];
}

function getEffectiveTaskTime() {
  // Speed upgrade reduces task time
  const speedBonus = getUpgradeEffect('speed');
  let time = CONFIG.baseTaskTime * (1 - speedBonus);
  // Combo milestone speed boost (30% faster)
  if (game.comboBoost > 0) time *= 0.7;
  return time;
}

function getEffectivePatience() {
  // Patience upgrade increases customer patience
  const patienceBonus = getUpgradeEffect('patience');
  return CONFIG.patience * (1 + patienceBonus);
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

      // Sound
      playComboMilestone(m.level);

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

  $('towels').style.background = game.towels <= 2 ? '#c62828' : '#a67c52';
  $('towels').classList.toggle('low', game.towels <= 2);
  $('towels').children[0].textContent = game.towels > 5 ? '📄📄📄' : (game.towels > 2 ? '📄📄' : (game.towels > 0 ? '📄' : '❌'));
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

  // Apply supplies upgrade bonus to starting powerups
  const suppliesBonus = game.upgrades.supplies;
  game.powerups = {
    speed: 1 + suppliesBonus,
    slow: 1 + suppliesBonus,
    auto: 0 + suppliesBonus
  };

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

  game.running = true;
  game.lastTime = performance.now();
  startMusic();
  requestAnimationFrame(gameLoop);

  // Start interactive tutorial on first shift
  if (game.shift === 0 && !localStorage.getItem('beaverInteractiveTutorial')) {
    setTimeout(() => startInteractiveTutorial(), 500);
  }
}

function gameLoop(now) {
  if (!game.running) return;

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
  });

  if (isVip) showBeaverTip('vipCustomer');
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
      const tx = floorRect.width / 2 - 15 + rnd(-30, 30);
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
        p.phase = 'entering';
        p.enterTimer = 350;

        const stall = game.stalls[p.target];

        // Check if we're cleaning it right now (SAVE!)
        if (stall.state === 'cleaning') {
          // Close call save!
          game.stats.saves++;
          game.score += 50;
          floatMessage('JUST IN TIME! +50', p.x, p.y - 30, 'save');
          playStallClean();
          setBeaverMood('excited', 1200);

          // Complete cleaning instantly with celebration
          stall.state = 'empty';
          stall.tasks = [];
          if (game.activeStall === p.target) {
            game.activeStall = -1;
            game.activeTask = -1;
            hideTaskPanel();
          }

          // Celebrate the save!
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
        }
        else if (stall.state === 'dirty') {
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
            const ratingLoss = p.vip ? 0.8 : 0.4;
            game.rating = clamp(game.rating - ratingLoss, 0, 5);
            game.stats.dirty++;
            const hadCombo = game.combo;
            game.combo = 0;
            showComboBreak(hadCombo);
            playBad();
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
      const ty = sinkRect.top - floorRect.top - 30;
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 12) {
        p.phase = 'washing';
        p.washTime = 1000;
        p.sinkIdx = sinkIdx;
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
        if (Math.random() < 0.5 && game.towels > 0) game.towels--;
        updateSinkDOM(p.sinkIdx);
        // Special characters have their own happy line
        if (p.specialThoughts && p.specialThoughts.happy) {
          p.thought = p.specialThoughts.happy;
        } else {
          p.thought = pick(THOUGHTS.happy);
        }
        p.thoughtTimer = 1500;
        p.phase = 'exit';
      }
    }
    else if (p.phase === 'exit') {
      const exitDoor = $('exit-door').getBoundingClientRect();
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

function customerLeaves(stallIdx) {
  const stall = game.stalls[stallIdx];
  stall.state = 'dirty';
  stall.doorOpen = true;

  // Generate tasks based on customer messiness
  // Clean customers (-1): lower chance of each task, min 1 task
  // Average customers (0): normal behavior
  // Messy customers (1): higher chance of each task, likely 3-4 tasks
  const messiness = stall.messiness || 0;
  const chanceModifier = messiness === -1 ? 0.4 : (messiness === 1 ? 1.5 : 1);

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

  // Auto-mop upgrade: chance to auto-complete some tasks
  const automopChance = getUpgradeEffect('automop');
  if (automopChance > 0) {
    stall.tasks.forEach(task => {
      if (!task.done && Math.random() < automopChance) {
        task.done = true;
      }
    });
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
  const id = Date.now() + Math.random();
  game.puddles.push({ id, x, y, type, age: 0 });
  renderPuddles();
  playBad();
  floatMessage(type === 'vomit' ? '🤮 MESS!' : '💦 ACCIDENT!', x, y - 20, 'bad');
}

function renderPuddles() {
  // Remove old puddle elements
  document.querySelectorAll('.puddle').forEach(el => el.remove());

  const floor = $('floor-area');
  game.puddles.forEach(puddle => {
    const el = document.createElement('div');
    el.className = 'puddle ' + puddle.type;
    el.style.left = puddle.x + 'px';
    el.style.top = puddle.y + 'px';
    el.innerHTML = `<div class="puddle-stink"><div class="stink-line"></div><div class="stink-line"></div><div class="stink-line"></div></div>`;
    el.addEventListener('click', () => clickPuddle(puddle.id));
    floor.appendChild(el);
  });
}

function clickPuddle(id) {
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

  if (stall.state === 'dirty' || stall.state === 'cleaning') {
    if (stall.state === 'dirty') {
      stall.state = 'cleaning';
      updateStallDOM(i);
      // Tutorial: advance when clicking dirty stall
      if (tutorialActive) advanceTutorial('stall-click');
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
  stall.tasks[game.activeTask].done = true;
  game.taskProgress = 0;
  playTaskComplete();

  // Check if all done
  if (stall.tasks.every(t => t.done)) {
    const wasVip = stall.wasVip;
    stall.state = 'empty';
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
    // Tutorial: advance when stall fully cleaned
    if (tutorialActive) advanceTutorial('task-complete');
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
    game.effects.speed = 12000;
    playClick();
    floatMessage('⚡ SPEED BOOST!', 400, 200, 'combo');
  }
});

$('pow-slow').addEventListener('click', () => {
  const el = $('pow-slow');
  el.classList.remove('clicked'); void el.offsetWidth; el.classList.add('clicked');
  if (game.powerups.slow > 0 && game.effects.slow <= 0) {
    game.powerups.slow--;
    game.effects.slow = 12000;
    playClick();
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
      setBeaverMood('excited', 1000);
    }
  }
});

// Upgrade system functions
function getUpgradeCost(upgrade, level) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScale, level));
}

function getUpgradeEffect(upgradeId) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return 0;
  return upgrade.effect * game.upgrades[upgradeId];
}

function calculateCoins(score, grade) {
  // Base coins from score
  let coins = Math.floor(score / 10);
  // Grade bonus multiplier
  const gradeBonus = {S: 2, A: 1.5, B: 1.2, C: 1, F: 0.5};
  coins = Math.floor(coins * (gradeBonus[grade] || 1));
  return coins;
}

function renderUpgradeShop() {
  const grid = $('upgrades-grid');
  grid.innerHTML = '';
  $('coins').textContent = game.coins;

  UPGRADES.forEach(upgrade => {
    const level = game.upgrades[upgrade.id];
    const maxed = level >= upgrade.maxLevel;
    const cost = getUpgradeCost(upgrade, level);
    const canAfford = game.coins >= cost;

    const card = document.createElement('div');
    card.className = 'upgrade-card' + (maxed ? ' maxed' : '');
    card.innerHTML = `
      <div class="upgrade-icon">${upgrade.icon}</div>
      <div class="upgrade-name">${upgrade.name}</div>
      <div class="upgrade-desc">${upgrade.desc}</div>
      <div class="upgrade-level">
        <span class="current">Lv.${level}</span>/<span class="max">${upgrade.maxLevel}</span>
      </div>
      ${maxed
        ? '<div class="upgrade-maxed">✓ MAXED</div>'
        : `<button class="upgrade-cost ${canAfford ? '' : 'cant-afford'}" data-id="${upgrade.id}">
            🪙 ${cost}
          </button>`
      }
    `;

    if (!maxed) {
      const btn = card.querySelector('.upgrade-cost');
      btn.addEventListener('click', () => purchaseUpgrade(upgrade.id));
    }

    grid.appendChild(card);
  });
}

function purchaseUpgrade(upgradeId) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return;

  const level = game.upgrades[upgradeId];
  if (level >= upgrade.maxLevel) return;

  const cost = getUpgradeCost(upgrade, level);
  if (game.coins < cost) return;

  game.coins -= cost;
  game.upgrades[upgradeId]++;
  playTaskComplete();
  renderUpgradeShop();
}

function showUpgradeScreen() {
  renderUpgradeShop();
  showScreen('upgrade-screen');
}

function endShift() {
  game.running = false;
  stopMusic();
  playWin();

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

  // Award coins based on performance
  const coinsEarned = calculateCoins(game.score, grade);
  game.coins += coinsEarned;

  // Show coins earned in pick-section
  if (game.shift + 1 < CONFIG.shifts.length) {
    $('pick-section').style.display = 'block';
    $('pick-row').innerHTML = `
      <div class="stat" style="grid-column: span 2; margin: 0 auto;">
        <div class="num" style="color:#fdd835">🪙 +${coinsEarned}</div>
        <div class="lbl">Coins Earned</div>
      </div>
    `;
    $('next-btn').textContent = 'Visit Supply Shop →';
  } else {
    $('pick-section').style.display = 'block';
    $('pick-row').innerHTML = `
      <div class="stat" style="grid-column: span 2; margin: 0 auto;">
        <div class="num" style="color:#fdd835">🪙 +${coinsEarned}</div>
        <div class="lbl">Coins Earned</div>
      </div>
    `;
    $('next-btn').textContent = 'Final Results';
  }

  showScreen('result-screen');
}

function gameOver() {
  game.running = false;
  stopMusic();

  // Clean up inspector if still present
  game.inspector = null;
  const inspectorEl = $('floor-area').querySelector('.inspector');
  if (inspectorEl) inspectorEl.remove();
  $('inspector-warning').style.display = 'none';

  const won = game.shift >= CONFIG.shifts.length - 1;
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

// Interactive tutorial system
const TUTORIAL_STEPS = [
  {
    target: 'stalls-row',
    text: "See those stalls? When the light turns YELLOW, click to clean it!",
    arrow: 'down',
    waitFor: 'stall-click'
  },
  {
    target: 'task-panel',
    text: "MASH these task buttons to clean faster! The more you click, the quicker you finish!",
    arrow: 'up',
    waitFor: 'task-complete'
  },
  {
    target: 'sinks-area',
    text: "Don't forget the sinks! Click dirty sinks to scrub them clean.",
    arrow: 'up',
    waitFor: 'next'
  },
  {
    target: 'powerups',
    text: "Use powerups when things get hectic! ⚡ Speed and ✨ Auto-clean are lifesavers!",
    arrow: 'up',
    waitFor: 'next'
  }
];

let tutorialStep = 0;
let tutorialActive = false;
let tutorialHighlight = null;

function startInteractiveTutorial() {
  if (localStorage.getItem('beaverInteractiveTutorial')) return;
  tutorialActive = true;
  tutorialStep = 0;
  game.running = false; // Pause game during tutorial

  // Create initial dirty stall for tutorial (just one easy task)
  if (game.stalls.length > 0) {
    const stall = game.stalls[0];
    stall.state = 'dirty';
    stall.tasks = [{...TASKS[1], done: false}]; // Just "Scrub" task for tutorial
    updateStallDOM(0);
  }

  // Make first sink dirty
  if (game.sinks.length > 0) {
    game.sinks[0].dirty = true;
    updateSinkDOM(0);
  }

  showTutorialStep();
}

function showTutorialStep() {
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    endTutorial();
    return;
  }

  const step = TUTORIAL_STEPS[tutorialStep];
  const overlay = $('tutorial-overlay');
  const speech = $('tutorial-speech');
  const arrow = $('tutorial-arrow');
  const nextBtn = $('tutorial-next');
  const textEl = $('tutorial-text');

  // Clear previous highlight
  if (tutorialHighlight) {
    tutorialHighlight.classList.remove('tutorial-highlight');
  }

  // Find and highlight target
  const target = $(step.target);
  if (target) {
    target.classList.add('tutorial-highlight');
    tutorialHighlight = target;

    // Position arrow
    const rect = target.getBoundingClientRect();
    if (step.arrow === 'down') {
      arrow.textContent = '👇';
      arrow.style.top = (rect.top - 50) + 'px';
      arrow.style.left = (rect.left + rect.width/2 - 16) + 'px';
    } else {
      arrow.textContent = '👆';
      arrow.style.top = (rect.bottom + 10) + 'px';
      arrow.style.left = (rect.left + rect.width/2 - 16) + 'px';
    }
    arrow.style.display = 'block';
  }

  textEl.textContent = step.text;
  nextBtn.style.display = step.waitFor === 'next' ? 'block' : 'none';
  overlay.classList.add('active');

  // Enable limited game interaction for tutorial
  if (step.waitFor === 'stall-click' || step.waitFor === 'task-complete') {
    game.running = true;
  }
}

function advanceTutorial(trigger) {
  if (!tutorialActive) return;

  const step = TUTORIAL_STEPS[tutorialStep];
  if (step.waitFor === trigger || trigger === 'skip') {
    tutorialStep++;
    if (tutorialStep >= TUTORIAL_STEPS.length) {
      endTutorial();
    } else {
      showTutorialStep();
    }
  }
}

function endTutorial() {
  tutorialActive = false;
  $('tutorial-overlay').classList.remove('active');
  if (tutorialHighlight) {
    tutorialHighlight.classList.remove('tutorial-highlight');
    tutorialHighlight = null;
  }
  localStorage.setItem('beaverInteractiveTutorial', 'true');
  game.running = true;
}

$('tutorial-skip').addEventListener('click', () => {
  advanceTutorial('skip');
  endTutorial();
});

$('tutorial-next').addEventListener('click', () => {
  advanceTutorial('next');
});

// Show high score on title screen if exists
function updateHighScoreDisplay() {
  if (highScore > 0) {
    $('high-score-val').textContent = highScore;
    $('title-high-score').classList.add('visible');
  }
}
updateHighScoreDisplay();

// Mute button
$('mute-btn').addEventListener('click', () => {
  initAudio();
  toggleMute();
});
updateMuteButton();

// Music button
$('music-btn').addEventListener('click', () => {
  initAudio();
  toggleMusic();
});
updateMusicButton();

$('start-btn').addEventListener('click', () => {
  initAudio();
  init();
  showShiftIntro();
});

$('shift-start-btn').addEventListener('click', () => {
  startShift();
});

$('next-btn').addEventListener('click', () => {
  game.shift++;
  if (game.shift >= CONFIG.shifts.length) {
    gameOver();
  } else {
    showUpgradeScreen();
  }
});

$('skip-upgrades').addEventListener('click', () => {
  showShiftIntro();
});

$('retry-btn').addEventListener('click', () => {
  showScreen('title-screen');
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
    playerName = name;
    localStorage.setItem('beaverPlayerName', playerName);

    if (window.pendingScore) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
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
