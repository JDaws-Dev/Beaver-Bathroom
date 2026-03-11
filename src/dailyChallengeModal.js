function renderModifiers(container, modifiers) {
  if (!container) return;
  container.textContent = '';

  modifiers.forEach((modifier) => {
    const item = document.createElement('div');
    item.className = `dc-mod ${modifier.active ? 'active' : 'inactive'}`;
    item.textContent = modifier.name;
    container.appendChild(item);
  });
}

export function createDailyChallengeController({
  $,
  initAudio,
  playClick,
  isDailyUnlocked,
  showPaywallModal,
  checkDailyReset,
  getDailySeed,
  generateDailyConfig,
  getDailyHighScore,
  getDailyAttempts,
  startDailyMode,
}) {
  function showDailyChallengeModal() {
    if (!isDailyUnlocked()) {
      showPaywallModal('landing');
      return;
    }

    checkDailyReset();

    const config = generateDailyConfig(getDailySeed());
    $('dc-stalls').textContent = config.stalls;
    $('dc-duration').textContent = `${config.duration}s`;
    $('dc-sinks').textContent = config.sinks;
    $('dc-high-score').textContent = getDailyHighScore();
    $('dc-attempts').textContent = getDailyAttempts();

    renderModifiers($('dc-modifiers'), [
      { name: '🔍 Inspector', active: config.hasInspector },
      { name: '🏃 Rush Hour', active: config.hasRushHour },
      { name: '👑 VIP Boost', active: config.vipBoost },
    ]);

    $('daily-challenge-modal')?.classList.add('active');
  }

  function closeDailyChallengeModal() {
    $('daily-challenge-modal')?.classList.remove('active');
  }

  function bindEvents() {
    $('daily-btn')?.addEventListener('click', () => {
      initAudio();
      playClick();
      showDailyChallengeModal();
    });

    $('close-daily-challenge')?.addEventListener('click', closeDailyChallengeModal);
    $('daily-challenge-modal')?.addEventListener('click', (event) => {
      if (event.target === $('daily-challenge-modal')) closeDailyChallengeModal();
    });

    $('dc-start-btn')?.addEventListener('click', () => {
      playClick();
      closeDailyChallengeModal();
      startDailyMode();
    });
  }

  return {
    showDailyChallengeModal,
    closeDailyChallengeModal,
    bindEvents,
  };
}
