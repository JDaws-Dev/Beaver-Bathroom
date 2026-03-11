export function createSaveStateController({
  $,
  tasks,
  getGame,
  isMinigameActive,
  initGame,
  setSelectedGender,
  syncSelectedGenderUI,
  buildStalls,
  buildSinks,
  updateStallDOM,
  updateSinkDOM,
  updateHUD,
  showScreen,
  startMusic,
  isMusicMuted,
  floatMessage,
  playClick,
  scheduleGameLoop,
}) {
  const gameStateKey = 'beaverGameState';
  const stateExpiryMs = 60 * 60 * 1000;
  let autoSaveInterval = null;

  function saveGameState() {
    const game = getGame();
    if (!game.running || game.paused) return;
    if (isMinigameActive()) return;

    const state = {
      timestamp: Date.now(),
      mode: game.mode,
      shift: game.shift,
      score: game.score,
      rating: game.rating,
      combo: game.combo,
      maxCombo: game.maxCombo,
      time: game.time,
      elapsed: game.elapsed,
      coins: game.coins,
      towels: game.towels,
      gender: game.gender,
      skills: { ...game.skills },
      powerups: { ...game.powerups },
      effects: { ...game.effects },
      stats: { ...game.stats },
      stalls: game.stalls.map((stall) => ({
        state: stall.state,
        tasks: stall.tasks.map((task) => ({ id: task.id, done: task.done })),
        wasVip: stall.wasVip,
      })),
      sinks: game.sinks.map((sink) => ({
        dirty: sink.dirty,
        cleaning: sink.cleaning,
        progress: sink.progress,
      })),
      rushMode: game.rushMode,
      rushTimer: game.rushTimer,
      dailyShiftOverride: game.dailyShiftOverride || null,
    };

    localStorage.setItem(gameStateKey, JSON.stringify(state));
  }

  function clearSavedState() {
    localStorage.removeItem(gameStateKey);
  }

  function loadGameState() {
    const saved = localStorage.getItem(gameStateKey);
    if (!saved) return null;

    try {
      const state = JSON.parse(saved);
      if (Date.now() - state.timestamp > stateExpiryMs) {
        clearSavedState();
        return null;
      }
      return state;
    } catch (error) {
      clearSavedState();
      return null;
    }
  }

  function closeResumeModal() {
    $('resume-modal')?.classList.remove('active');
  }

  function checkForSavedGame() {
    const state = loadGameState();
    if (!state) return;

    const modal = $('resume-modal');
    if (!modal) return;

    const modeText = state.mode === 'endless'
      ? 'Overtime'
      : state.mode === 'daily'
        ? 'Daily Challenge'
        : `Shift ${state.shift + 1}`;

    $('resume-mode').textContent = modeText;
    $('resume-score').textContent = state.score.toLocaleString();
    $('resume-rating').textContent = '⭐'.repeat(Math.floor(state.rating));
    modal.classList.add('active');
  }

  function resumeGame() {
    const state = loadGameState();
    if (!state) {
      closeResumeModal();
      return;
    }

    closeResumeModal();
    setSelectedGender(state.gender || 'female');
    syncSelectedGenderUI();

    initGame();
    const game = getGame();

    game.mode = state.mode;
    game.shift = state.shift;
    game.score = state.score;
    game.rating = state.rating;
    game.combo = state.combo;
    game.maxCombo = state.maxCombo;
    game.time = state.time;
    game.elapsed = state.elapsed;
    game.coins = state.coins;
    game.towels = state.towels;
    game.gender = state.gender;
    game.skills = state.skills;
    game.powerups = state.powerups;
    game.effects = state.effects;
    game.stats = state.stats;
    game.rushMode = state.rushMode;
    game.rushTimer = state.rushTimer;
    game.dailyShiftOverride = state.dailyShiftOverride;

    buildStalls();
    buildSinks();

    state.stalls.forEach((savedStall, index) => {
      if (index >= game.stalls.length) return;
      game.stalls[index].state = savedStall.state;
      game.stalls[index].wasVip = savedStall.wasVip;
      if (savedStall.tasks?.length) {
        game.stalls[index].tasks = savedStall.tasks.map((taskState) => ({
          ...tasks.find((task) => task.id === taskState.id),
          done: taskState.done,
        }));
      }
      updateStallDOM(index);
    });

    state.sinks.forEach((savedSink, index) => {
      if (index >= game.sinks.length) return;
      game.sinks[index].dirty = savedSink.dirty;
      game.sinks[index].cleaning = savedSink.cleaning;
      game.sinks[index].progress = savedSink.progress;
      updateSinkDOM(index);
    });

    updateHUD();
    clearSavedState();

    showScreen('game-screen');
    game.running = true;
    game.paused = false;
    game.lastTime = performance.now();
    startAutoSave();
    scheduleGameLoop();

    if (!isMusicMuted()) startMusic();
    floatMessage('Autosave Restored!', window.innerWidth / 2, 100, 'good');
  }

  function startNewGame() {
    clearSavedState();
    closeResumeModal();
  }

  function startAutoSave() {
    stopAutoSave();
    autoSaveInterval = setInterval(() => {
      const game = getGame();
      if (game.running && !game.paused) saveGameState();
    }, 30000);
  }

  function stopAutoSave() {
    if (!autoSaveInterval) return;
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }

  function bindEvents() {
    window.addEventListener('beforeunload', (event) => {
      const game = getGame();
      if (game.running && !game.paused) {
        saveGameState();
        event.preventDefault();
        return '';
      }
      return undefined;
    });

    document.addEventListener('visibilitychange', () => {
      const game = getGame();
      if (document.hidden && game.running) saveGameState();
    });

    $('resume-yes')?.addEventListener('click', () => {
      playClick();
      resumeGame();
    });

    $('resume-no')?.addEventListener('click', () => {
      playClick();
      startNewGame();
    });

    $('resume-modal')?.addEventListener('click', (event) => {
      if (event.target === $('resume-modal')) startNewGame();
    });

    setTimeout(checkForSavedGame, 300);
  }

  return {
    bindEvents,
    saveGameState,
    loadGameState,
    clearSavedState,
    checkForSavedGame,
    resumeGame,
    startNewGame,
    closeResumeModal,
    startAutoSave,
    stopAutoSave,
  };
}
