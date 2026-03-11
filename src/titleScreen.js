export function createTitleScreenController({
  $,
  achievements,
  isPremium,
  playClick,
  fetchLeaderboard,
  handlePurchase,
  initAudio,
  initGame,
  getCurrentShift,
  startShift,
  showShiftIntro,
}) {
  let whatsNewOnClose = null;

  const previewContent = {
    achievements: {
      icon: '🎖️',
      title: 'Badges',
      desc: 'Earn badges for completing challenges and milestones!',
      count: `${achievements.length} achievements to earn!`,
      items: achievements.slice(0, 5).map((achievement) => ({
        icon: achievement.icon,
        name: achievement.name,
        desc: achievement.desc,
      })),
    },
    leaderboard: {
      icon: '🏆',
      title: 'Leaderboard',
      desc: 'Compete with players worldwide for the highest scores!',
      count: 'Global rankings updated in real-time!',
      items: [
        { icon: '🥇', name: 'Gold Trophy', desc: 'Top 1 worldwide' },
        { icon: '🥈', name: 'Silver Trophy', desc: 'Top 2-3 worldwide' },
        { icon: '🥉', name: 'Bronze Trophy', desc: 'Top 4-10 worldwide' },
        { icon: '📊', name: 'Your Rank', desc: 'See where you stand' },
        { icon: '🔄', name: 'Live Updates', desc: 'Real-time score tracking' },
      ],
    },
    shop: {
      icon: '🛒',
      title: 'Supply Shop',
      desc: 'Purchase permanent upgrades to boost your bathroom cleaning skills!',
      count: '12 upgrades available!',
      items: [
        { icon: '🧹', name: 'Quick Scrub', desc: 'Faster cleaning speed' },
        { icon: '🕐', name: 'Patience Plus', desc: 'Customers wait longer' },
        { icon: '🎯', name: 'Auto-Assist', desc: 'Tasks auto-complete sometimes' },
        { icon: '⚡', name: 'Speed Boost', desc: '2x cleaning for 10s' },
        { icon: '🧊', name: 'Icee Freeze', desc: 'Slow down spawns' },
      ],
    },
    badges: {
      icon: '🎖️',
      title: 'Badges',
      desc: 'Earn badges for completing challenges and milestones!',
      count: `${achievements.length} achievements to earn!`,
      items: achievements.slice(0, 5).map((achievement) => ({
        icon: achievement.icon,
        name: achievement.name,
        desc: achievement.desc,
      })),
    },
  };

  function showPreviewModal(feature) {
    const content = previewContent[feature];
    if (!content) return;

    $('preview-icon').textContent = content.icon;
    $('preview-title').textContent = content.title;
    $('preview-desc').textContent = content.desc;
    $('preview-count').textContent = content.count;

    const list = $('preview-list');
    list.innerHTML = content.items.map((item) => `
      <div class="preview-item">
        <span class="preview-item-icon">${item.icon}</span>
        <span class="preview-item-name">${item.name}</span>
        <span class="preview-item-lock">🔒</span>
      </div>
    `).join('');

    $('preview-modal').classList.add('active');
    playClick();
  }

  function closePreviewModal() {
    $('preview-modal').classList.remove('active');
  }

  function updateTitleButtonStates() {
    const achievementsBtn = $('achievements-btn');
    const leaderboardBtn = $('leaderboard-btn');
    const unlockPremiumBtn = $('unlock-premium-btn');

    if (isPremium()) {
      achievementsBtn?.classList.remove('locked');
      leaderboardBtn?.classList.remove('locked');
      unlockPremiumBtn?.classList.add('hidden');
      return;
    }

    achievementsBtn?.classList.add('locked');
    leaderboardBtn?.classList.remove('locked');
    unlockPremiumBtn?.classList.remove('hidden');
  }

  function closeWhatsNewModal() {
    localStorage.setItem('beaverSeasonSeen', '2');
    $('whats-new-modal')?.classList.remove('active');
    const onClose = whatsNewOnClose;
    whatsNewOnClose = null;
    if (typeof onClose === 'function') onClose();
  }

  function openWhatsNewModal(onClose = null) {
    whatsNewOnClose = onClose;
    $('whats-new-modal')?.classList.add('active');
  }

  function startFromTitle() {
    initAudio();
    initGame();

    if (getCurrentShift() === 0) {
      localStorage.setItem('beaverSeasonSeen', '2');
      startShift();
      return;
    }

    showShiftIntro();
  }

  function bindEvents() {
    $('preview-close-btn')?.addEventListener('click', closePreviewModal);
    $('preview-unlock-btn')?.addEventListener('click', () => {
      closePreviewModal();
      handlePurchase();
    });
    $('preview-modal')?.addEventListener('click', (e) => {
      if (e.target === $('preview-modal')) closePreviewModal();
    });

    $('start-btn')?.addEventListener('click', () => {
      startFromTitle();
    });

    $('whats-new-ok')?.addEventListener('click', () => {
      playClick();
      closeWhatsNewModal();
    });
    $('close-whats-new')?.addEventListener('click', () => {
      playClick();
      closeWhatsNewModal();
    });
    $('whats-new-modal')?.addEventListener('click', (e) => {
      if (e.target === $('whats-new-modal')) closeWhatsNewModal();
    });

    const leaderboardButton = $('leaderboard-btn');
    if (leaderboardButton) {
      leaderboardButton.addEventListener('click', () => {
        const panel = $('leaderboard-panel');
        if (!panel) return;
        panel.classList.toggle('active');
        fetchLeaderboard();
      });
    }

    $('leaderboard-close')?.addEventListener('click', () => {
      $('leaderboard-panel')?.classList.remove('active');
    });
  }

  return {
    bindEvents,
    showPreviewModal,
    closePreviewModal,
    updateTitleButtonStates,
    openWhatsNewModal,
    closeWhatsNewModal,
    startFromTitle,
  };
}
