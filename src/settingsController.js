export function createSettingsController({
  $,
  initAudio,
  updateSettingsUI,
  getGame,
  showPauseOverlay,
  hidePauseOverlay,
  stopMusic,
  startMusic,
  isMuted,
  isMusicMuted,
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
  setPaymentModalActive,
  resetApp,
}) {
  function openSettings() {
    initAudio();
    updateSettingsUI();
    $('settings-modal')?.classList.add('active');

    const game = getGame();
    if (game.running && !game.paused) {
      game.paused = true;
      showPauseOverlay();
      stopMusic();
    }
  }

  function closeSettings() {
    $('settings-modal')?.classList.remove('active');

    const game = getGame();
    if (game.running && game.paused) {
      game.paused = false;
      hidePauseOverlay();
      game.lastTime = performance.now();
      if (!isMuted() && !isMusicMuted()) startMusic();
    }
  }

  function resetProgress() {
    $('reset-modal')?.classList.add('active');
  }

  function confirmReset() {
    resetApp();
  }

  function closeResetModal() {
    $('reset-modal')?.classList.remove('active');
  }

  function closeQuitModal() {
    $('quit-modal')?.classList.remove('active');
  }

  function confirmQuit() {
    const game = getGame();
    closeQuitModal();
    closeSettings();
    game.running = false;
    game.paused = false;
    stopMusic();
    stopAutoSave();
    clearSavedState();
    hidePauseOverlay();
    showScreen('title-screen');
  }

  function openPrivacyModal() {
    $('privacy-modal')?.classList.add('active');
  }

  function closePrivacyModal() {
    $('privacy-modal')?.classList.remove('active');
  }

  function openTermsModal() {
    $('terms-modal')?.classList.add('active');
  }

  function closeTermsModal() {
    $('terms-modal')?.classList.remove('active');
  }

  function showPaymentSuccessModal() {
    setPaymentModalActive(true);
    $('payment-success-modal')?.classList.add('active');
  }

  function closePaymentSuccessModal() {
    $('payment-success-modal')?.classList.remove('active');
    setPaymentModalActive(false);
    processNotificationQueue();
  }

  function bindEvents() {
    $('settings-btn')?.addEventListener('click', openSettings);
    $('title-settings-btn')?.addEventListener('click', openSettings);
    $('close-settings')?.addEventListener('click', closeSettings);
    $('settings-modal')?.addEventListener('click', (event) => {
      if (event.target === $('settings-modal')) closeSettings();
    });
    $('sfx-volume')?.addEventListener('input', (event) => setSfxVolume(event.target.value));
    $('music-volume')?.addEventListener('input', (event) => setMusicVolume(event.target.value));
    $('sfx-toggle')?.addEventListener('click', toggleSfx);
    $('music-toggle')?.addEventListener('click', toggleMusic);
    $('haptics-toggle')?.addEventListener('click', toggleHaptics);
    $('perf-toggle')?.addEventListener('click', togglePerfMode);
    $('reset-progress')?.addEventListener('click', resetProgress);

    $('pause-resume')?.addEventListener('click', () => {
      playClick();
      const game = getGame();
      if (game.running && game.paused) {
        game.paused = false;
        hidePauseOverlay();
        game.lastTime = performance.now();
        if (!isMuted() && !isMusicMuted()) startMusic();
      }
    });

    updateSettingsUI();

    $('settings-main-menu')?.addEventListener('click', () => {
      playClick();
      if (getGame().running) {
        $('quit-modal')?.classList.add('active');
      } else {
        closeSettings();
        showScreen('title-screen');
      }
    });

    $('quit-cancel')?.addEventListener('click', () => {
      playClick();
      closeQuitModal();
    });
    $('quit-confirm')?.addEventListener('click', () => {
      playClick();
      confirmQuit();
    });
    $('quit-modal')?.addEventListener('click', (event) => {
      if (event.target === $('quit-modal')) closeQuitModal();
    });

    $('pause-menu')?.addEventListener('click', () => {
      playClick();
      $('quit-modal')?.classList.add('active');
    });

    $('payment-success-close')?.addEventListener('click', closePaymentSuccessModal);
    $('payment-success-modal')?.addEventListener('click', (event) => {
      if (event.target === $('payment-success-modal')) closePaymentSuccessModal();
    });

    $('privacy-btn')?.addEventListener('click', openPrivacyModal);
    $('close-privacy')?.addEventListener('click', closePrivacyModal);
    $('privacy-modal')?.addEventListener('click', (event) => {
      if (event.target === $('privacy-modal')) closePrivacyModal();
    });

    $('terms-btn')?.addEventListener('click', openTermsModal);
    $('close-terms')?.addEventListener('click', closeTermsModal);
    $('terms-modal')?.addEventListener('click', (event) => {
      if (event.target === $('terms-modal')) closeTermsModal();
    });

    $('reset-cancel')?.addEventListener('click', closeResetModal);
    $('reset-confirm')?.addEventListener('click', confirmReset);
    $('reset-modal')?.addEventListener('click', (event) => {
      if (event.target === $('reset-modal')) closeResetModal();
    });
  }

  return {
    openSettings,
    closeSettings,
    resetProgress,
    confirmReset,
    closeResetModal,
    closeQuitModal,
    confirmQuit,
    showPaymentSuccessModal,
    closePaymentSuccessModal,
    bindEvents,
  };
}
