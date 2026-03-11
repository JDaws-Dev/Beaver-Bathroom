function getCosmeticsPayload(cosmeticState) {
  return {
    hat: cosmeticState.equipped.hat || undefined,
    shirt: cosmeticState.equipped.shirt || undefined,
    special: cosmeticState.equipped.special || null,
  };
}

function shakeNameInput(input) {
  if (!input) return;
  input.classList.add('shake');
  setTimeout(() => input.classList.remove('shake'), 400);
}

function getAvatarSrc(BASE, cosmetics) {
  if (!cosmetics) return BASE + 'images/cosmetics/combo-hat-cap-shirt-polo.png';
  if (cosmetics.special) return BASE + 'images/cosmetics/' + cosmetics.special + '.png';
  const hat = cosmetics.hat || 'hat-cap';
  const shirt = cosmetics.shirt || 'shirt-polo';
  return BASE + 'images/cosmetics/combo-' + hat + '-' + shirt + '.png';
}

export function createMultiplayerPregameController({
  $,
  convex,
  api,
  BASE,
  mpState,
  getDeviceId,
  getPlayerName,
  setPlayerName,
  persistPlayerName,
  createOrUpdateUser,
  getCosmeticState,
  getSelectedGender,
  setSelectedGender,
  syncSelectedGenderUI,
  getSelectedDifficulty,
  setSelectedDifficulty,
  getMPHostShift,
  setMPHostShift,
  canPlayMultiplayer,
  showPaywallModal,
  initAudio,
  playClick,
  showOutfitter,
  getComboSpriteSrc,
  getOpponentSpriteSrc,
  showScreen,
  startMPGame,
}) {
  function openMultiplayerModal() {
    initAudio();
    playClick();

    if (!canPlayMultiplayer()) {
      showPaywallModal('landing');
      return;
    }

    const nameInput = $('mp-name-input');
    const playerName = getPlayerName();
    if (nameInput && playerName) nameInput.value = playerName;

    $('mp-host-settings')?.classList.add('hidden');
    $('mp-main-buttons')?.classList.remove('hidden');

    const mainAvatar = $('mp-avatar-main-img');
    if (mainAvatar) mainAvatar.src = getComboSpriteSrc();

    $('multiplayer-modal')?.classList.add('active');
  }

  function closeMultiplayerModal() {
    $('multiplayer-modal')?.classList.remove('active');
  }

  function ensurePlayerName(input) {
    const name = input?.value?.trim();
    if (!name) {
      shakeNameInput(input);
      return null;
    }

    if (name !== getPlayerName()) {
      setPlayerName(name);
      persistPlayerName(name);
      createOrUpdateUser(name);
    }

    return name;
  }

  function showHostSettings() {
    playClick();
    const nameInput = $('mp-name-input');
    if (!ensurePlayerName(nameInput)) {
      return;
    }

    $('mp-main-buttons')?.classList.add('hidden');
    $('mp-host-settings')?.classList.remove('hidden');

    document.querySelectorAll('.mp-gender-btn').forEach((button) => {
      button.classList.toggle('selected', button.dataset.mpGender === getSelectedGender());
    });
  }

  function returnToMainButtons() {
    playClick();
    $('mp-host-settings')?.classList.add('hidden');
    $('mp-main-buttons')?.classList.remove('hidden');
  }

  async function createRoom() {
    playClick();

    try {
      const result = await convex.mutation(api.multiplayer.createRoom, {
        hostDeviceId: getDeviceId(),
        hostName: getPlayerName(),
        shift: getMPHostShift(),
        gender: getSelectedGender(),
        difficulty: getSelectedDifficulty(),
        hostCosmetics: getCosmeticsPayload(getCosmeticState()),
      });

      mpState.active = true;
      mpState.isHost = true;
      mpState.roomCode = result.code;
      mpState.opponentName = '';

      $('mp-host-settings')?.classList.add('hidden');
      $('mp-main-buttons')?.classList.remove('hidden');

      closeMultiplayerModal();
      showMPLobby(result.code, getPlayerName(), true);
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  }

  async function startQuickMatch() {
    playClick();
    const name = ensurePlayerName($('mp-name-input'));
    if (!name) return;

    closeMultiplayerModal();
    mpState.isSearching = true;
    mpState.searchStartTime = Date.now();
    mpState.autoMatch = false;
    const autoToggle = $('mp-auto-match-toggle');
    if (autoToggle) autoToggle.checked = false;
    $('waiting-status').textContent = 'Choose an opponent or enable auto-match';
    $('waiting-timer').textContent = '0:00';
    showScreen('mp-waiting');

    mpState.searchTimerInterval = setInterval(() => {
      if (!mpState.isSearching) return;
      const elapsed = Math.floor((Date.now() - mpState.searchStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      $('waiting-timer').textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;

      if (elapsed >= 300) {
        cancelQuickMatch();
        $('waiting-status').textContent = 'No opponents found. Try again later!';
        setTimeout(() => showScreen('title-screen'), 2000);
      }
    }, 1000);

    try {
      const result = await convex.mutation(api.matchmaking.joinQueue, {
        deviceId: getDeviceId(),
        playerName: name,
        cosmetics: getCosmeticsPayload(getCosmeticState()),
        autoMatch: false,
      });

      if (result.status === 'matched') {
        foundQuickMatch(result.roomCode);
      } else {
        startQueuePolling();
      }
    } catch (error) {
      console.error('Failed to join queue:', error);
      cancelQuickMatch();
      showScreen('title-screen');
    }
  }

  function startQueuePolling() {
    stopQueuePolling();
    mpState.queuePollTimer = setInterval(pollQueue, 1500);
  }

  function stopQueuePolling() {
    if (mpState.queuePollTimer) {
      clearInterval(mpState.queuePollTimer);
      mpState.queuePollTimer = null;
    }
  }

  function showChallengePopup(challengerName, challengerCosmetics) {
    const popup = $('mp-challenge-popup');
    if (!popup) return;

    $('mp-challenge-name').textContent = challengerName || 'Someone';
    $('mp-challenge-avatar').src = getAvatarSrc(BASE, challengerCosmetics);
    popup.classList.remove('hidden');
    popup.classList.add('mp-challenge-popup-show');
  }

  function hideChallengePopup() {
    const popup = $('mp-challenge-popup');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.classList.remove('mp-challenge-popup-show');
  }

  function updateQueuePlayersList(players) {
    const container = $('mp-queue-players');
    if (!container) return;

    const others = players.filter((player) => player.deviceId !== getDeviceId());
    if (others.length === 0) {
      container.innerHTML = '<div class="mp-queue-empty">No other players online yet...</div>';
      return;
    }

    container.textContent = '';
    others.forEach((player) => {
      const row = document.createElement('div');
      row.className = 'mp-queue-player-row';

      const avatar = document.createElement('img');
      avatar.className = 'mp-queue-avatar';
      avatar.src = getAvatarSrc(BASE, player.cosmetics);
      avatar.alt = '';
      avatar.style.width = '36px';
      avatar.style.height = '36px';
      avatar.style.imageRendering = 'pixelated';

      const info = document.createElement('div');
      info.className = 'mp-queue-player-info';

      const name = document.createElement('span');
      name.className = 'mp-queue-player-name';
      name.textContent = player.playerName || 'Anonymous';

      const score = document.createElement('span');
      score.className = 'mp-queue-player-score';
      score.textContent = player.bestScore > 0 ? `⭐ ${player.bestScore.toLocaleString()} pts` : '⭐ New player';

      const button = document.createElement('button');
      button.className = 'btn mp-challenge-btn';
      button.textContent = 'Challenge';
      button.addEventListener('click', () => {
        playClick();
        challengePlayer(player.deviceId);
      });

      info.append(name, score);
      row.append(avatar, info, button);
      container.appendChild(row);
    });
  }

  async function challengePlayer(targetDeviceId) {
    if (!mpState.isSearching) return;
    mpState.challengeSent = true;
    $('waiting-status').textContent = 'Challenge sent! Waiting for response...';

    document.querySelectorAll('.mp-challenge-btn').forEach((button) => {
      button.disabled = true;
      button.style.opacity = '0.5';
    });

    try {
      const result = await convex.mutation(api.matchmaking.challengePlayer, {
        deviceId: getDeviceId(),
        playerName: getPlayerName(),
        cosmetics: getCosmeticsPayload(getCosmeticState()),
        targetDeviceId,
      });

      if (result.error) {
        mpState.challengeSent = false;
        $('waiting-status').textContent = result.error + ' Pick another player.';
        document.querySelectorAll('.mp-challenge-btn').forEach((button) => {
          button.disabled = false;
          button.style.opacity = '1';
        });
      }
    } catch (error) {
      console.error('Challenge failed:', error);
      mpState.challengeSent = false;
      $('waiting-status').textContent = 'Challenge failed. Try another player.';
      document.querySelectorAll('.mp-challenge-btn').forEach((button) => {
        button.disabled = false;
        button.style.opacity = '1';
      });
    }
  }

  async function pollQueue() {
    if (!mpState.isSearching) return;

    try {
      const result = await convex.query(api.matchmaking.pollQueue, { deviceId: getDeviceId() });
      if (result.status === 'matched' && result.roomCode) {
        foundQuickMatch(result.roomCode);
        return;
      }

      if (result.challengeFrom && !mpState.challengeShown) {
        mpState.challengeShown = result.challengeFrom;
        showChallengePopup(result.challengeFromName, result.challengeFromCosmetics);
      } else if (!result.challengeFrom && mpState.challengeShown) {
        mpState.challengeShown = null;
        hideChallengePopup();
      }

      const players = await convex.query(api.matchmaking.getWaitingPlayers, {});
      updateQueuePlayersList(players);
    } catch (error) {
      console.log('Queue poll failed:', error);
    }
  }

  async function foundQuickMatch(roomCode) {
    stopQueuePolling();
    if (mpState.searchTimerInterval) {
      clearInterval(mpState.searchTimerInterval);
      mpState.searchTimerInterval = null;
    }
    mpState.isSearching = false;
    mpState.isRandomMatch = true;
    $('waiting-status').textContent = 'Opponent found! 🎉';

    try {
      const room = await convex.query(api.multiplayer.getRoom, { code: roomCode });
      if (!room) {
        showScreen('title-screen');
        return;
      }

      const isHost = room.hostDeviceId === getDeviceId();
      mpState.active = true;
      mpState.isHost = isHost;
      mpState.roomCode = roomCode;
      mpState.opponentName = isHost ? (room.guestName || '') : room.hostName;
      mpState.opponentCosmetics = isHost ? (room.guestCosmetics || null) : (room.hostCosmetics || null);

      setSelectedGender(room.gender);
      setSelectedDifficulty(room.difficulty || 'normal');
      mpState.mpShift = room.shift || 0;
      mpState.mpCreatedAt = room.createdAt || 0;
      if (isHost) setMPHostShift(room.shift || 0);

      setTimeout(() => showMPLobby(roomCode, getPlayerName(), isHost), 800);
    } catch (error) {
      console.error('Failed to get room after match:', error);
      showScreen('title-screen');
    }
  }

  function cancelQuickMatch() {
    stopQueuePolling();
    if (mpState.searchTimerInterval) {
      clearInterval(mpState.searchTimerInterval);
      mpState.searchTimerInterval = null;
    }
    mpState.isSearching = false;
    mpState.isRandomMatch = false;
    mpState.challengeSent = false;
    mpState.challengeShown = null;
    hideChallengePopup();

    convex.mutation(api.matchmaking.leaveQueue, { deviceId: getDeviceId() }).catch(() => {});
  }

  async function acceptIncomingChallenge() {
    hideChallengePopup();
    $('waiting-status').textContent = 'Accepting challenge...';

    try {
      const result = await convex.mutation(api.matchmaking.acceptChallenge, { deviceId: getDeviceId() });
      if (result.error) {
        $('waiting-status').textContent = result.error;
        return;
      }
      if (result.status === 'matched' && result.roomCode) {
        foundQuickMatch(result.roomCode);
      }
    } catch (error) {
      console.error('Accept challenge failed:', error);
      $('waiting-status').textContent = 'Failed to accept. Try again.';
    }
  }

  async function declineIncomingChallenge() {
    hideChallengePopup();
    try {
      await convex.mutation(api.matchmaking.declineChallenge, { deviceId: getDeviceId() });
    } catch (error) {
      console.error('Decline challenge failed:', error);
    }
  }

  async function openJoinRoomModal() {
    playClick();
    const name = ensurePlayerName($('mp-name-input'));
    if (!name) return;

    closeMultiplayerModal();
    $('mp-code-input').value = '';
    $('mp-join-error').classList.add('hidden');
    $('mp-join-modal').classList.add('active');
    $('mp-code-input').focus();
  }

  function closeJoinRoomModal() {
    $('mp-join-modal').classList.remove('active');
  }

  function backToMultiplayerModal() {
    closeJoinRoomModal();
    $('multiplayer-modal').classList.add('active');
  }

  async function submitJoinCode() {
    playClick();
    const code = $('mp-code-input')?.value?.trim();
    if (!code || code.length !== 4) {
      $('mp-join-error').textContent = 'Please enter a 4-digit code.';
      $('mp-join-error').classList.remove('hidden');
      return;
    }

    try {
      const result = await convex.mutation(api.multiplayer.joinRoom, {
        code,
        guestDeviceId: getDeviceId(),
        guestName: getPlayerName(),
        guestCosmetics: getCosmeticsPayload(getCosmeticState()),
      });

      if (result.error) {
        $('mp-join-error').textContent = result.error;
        $('mp-join-error').classList.remove('hidden');
        return;
      }

      mpState.active = true;
      mpState.isHost = false;
      mpState.roomCode = code;
      mpState.opponentName = result.hostName;
      mpState.opponentCosmetics = result.hostCosmetics || null;
      setSelectedGender(result.gender);
      syncSelectedGenderUI();
      setSelectedDifficulty(result.difficulty || 'normal');
      mpState.mpShift = result.shift || 0;
      mpState.mpCreatedAt = result.createdAt || 0;

      closeJoinRoomModal();
      showMPLobby(code, getPlayerName(), false);
    } catch (error) {
      console.error('Failed to join room:', error);
      $('mp-join-error').textContent = 'Connection failed. Try again.';
      $('mp-join-error').classList.remove('hidden');
    }
  }

  function showMPLobby(code, myName, isHost) {
    $('mp-lobby-code').textContent = code;
    $('mp-host-name').textContent = isHost ? myName : mpState.opponentName;
    const shiftNum = (mpState.isHost ? getMPHostShift() : (mpState.mpShift || 0)) + 1;
    $('mp-lobby-shift').textContent = 'Shift ' + shiftNum;
    $('mp-lobby-gender').textContent = getSelectedGender() === 'male' ? "Men's" : "Women's";
    const diffLabel = getSelectedDifficulty().charAt(0).toUpperCase() + getSelectedDifficulty().slice(1);
    if ($('mp-lobby-difficulty')) $('mp-lobby-difficulty').textContent = diffLabel;

    if (isHost) {
      $('mp-guest-name').textContent = 'Waiting...';
      $('mp-guest-slot').classList.remove('mp-player-ready');
      $('mp-guest-status').textContent = '--';
      $('mp-guest-status').classList.remove('mp-ready');
      $('mp-start-btn').disabled = true;
      $('mp-start-btn').textContent = 'Waiting for opponent...';
    } else {
      $('mp-guest-name').textContent = myName;
      $('mp-guest-slot').classList.add('mp-player-ready');
      $('mp-guest-status').textContent = 'Ready';
      $('mp-guest-status').classList.add('mp-ready');
      $('mp-start-btn').disabled = true;
      $('mp-start-btn').textContent = 'Waiting for host to start...';
    }

    if (isHost) {
      const hostEl = $('mp-lobby-host-beaver');
      if (hostEl) hostEl.src = getComboSpriteSrc();
      const guestEl = $('mp-lobby-guest-beaver');
      if (guestEl) {
        guestEl.src = '';
        guestEl.style.display = 'none';
      }
    } else {
      const hostEl = $('mp-lobby-host-beaver');
      if (hostEl) {
        hostEl.src = mpState.opponentCosmetics
          ? getOpponentSpriteSrc()
          : (BASE + 'images/cosmetics/combo-hat-cap-shirt-polo.png');
      }
      const guestEl = $('mp-lobby-guest-beaver');
      if (guestEl) guestEl.src = getComboSpriteSrc();
    }

    mpState.myReady = false;
    const codeSection = document.querySelector('.mp-lobby-code-section');
    if (codeSection) codeSection.style.display = mpState.isRandomMatch ? 'none' : '';

    showScreen('mp-lobby');
    startLobbyPolling();
  }

  function startLobbyPolling() {
    stopLobbyPolling();
    mpState.lobbyPollTimer = setInterval(pollLobby, 1500);
  }

  function stopLobbyPolling() {
    if (mpState.lobbyPollTimer) {
      clearInterval(mpState.lobbyPollTimer);
      mpState.lobbyPollTimer = null;
    }
  }

  async function pollLobby() {
    if (!mpState.roomCode) return;

    try {
      const room = await convex.query(api.multiplayer.getRoom, { code: mpState.roomCode });
      if (!room || room.status === 'finished') {
        stopLobbyPolling();
        mpState.active = false;
        showScreen('title-screen');
        return;
      }

      if (mpState.isHost) {
        if (room.guestName) {
          $('mp-guest-name').textContent = room.guestName;
          $('mp-guest-slot').classList.add('mp-player-ready');
          $('mp-guest-status').textContent = 'Joined';
          mpState.opponentName = room.guestName;
          mpState.opponentCosmetics = room.guestCosmetics || null;
          const guestEl = $('mp-lobby-guest-beaver');
          if (guestEl) {
            guestEl.style.display = '';
            guestEl.src = getOpponentSpriteSrc();
          }
          $('mp-start-btn').disabled = false;
          $('mp-start-btn').textContent = 'Start Battle!';
        } else {
          $('mp-guest-name').textContent = 'Waiting...';
          $('mp-guest-slot').classList.remove('mp-player-ready');
          $('mp-guest-status').textContent = '--';
          $('mp-start-btn').disabled = true;
          $('mp-start-btn').textContent = 'Waiting for opponent...';
        }
      } else {
        $('mp-host-name').textContent = room.hostName;
        if (room.status === 'playing') {
          stopLobbyPolling();
          startMPGame();
        }
      }
    } catch (error) {
      console.log('Lobby poll failed:', error);
    }
  }

  async function leaveRoom() {
    playClick();
    stopLobbyPolling();
    if (mpState.roomCode) {
      try {
        await convex.mutation(api.multiplayer.leaveRoom, {
          code: mpState.roomCode,
          deviceId: getDeviceId(),
        });
      } catch (error) {
        console.log('Leave room failed:', error);
      }
    }
    mpState.active = false;
    mpState.roomCode = null;
    mpState.opponentCosmetics = null;
    mpState.isRandomMatch = false;
    showScreen('title-screen');
  }

  async function hostStartGame() {
    if (!mpState.isHost || $('mp-start-btn').disabled) return;
    playClick();

    try {
      const result = await convex.mutation(api.multiplayer.startGame, {
        code: mpState.roomCode,
        hostDeviceId: getDeviceId(),
      });

      if (result.error) {
        console.log('Start game error:', result.error);
        return;
      }

      stopLobbyPolling();
      startMPGame();
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  }

  function bindEvents() {
    $('multiplayer-btn')?.addEventListener('click', openMultiplayerModal);
    $('close-multiplayer')?.addEventListener('click', closeMultiplayerModal);
    $('multiplayer-modal')?.addEventListener('click', (event) => {
      if (event.target === $('multiplayer-modal')) closeMultiplayerModal();
    });

    $('mp-host-btn')?.addEventListener('click', showHostSettings);
    $('mp-change-avatar-main')?.addEventListener('click', () => {
      playClick();
      mpState._wasInHostSettings = !$('mp-host-settings')?.classList.contains('hidden');
      closeMultiplayerModal();
      showOutfitter();
      mpState._returnToMP = true;
    });
    $('mp-host-back')?.addEventListener('click', returnToMainButtons);

    document.querySelectorAll('.mp-gender-btn').forEach((button) => {
      button.addEventListener('click', () => {
        playClick();
        document.querySelectorAll('.mp-gender-btn').forEach((candidate) => candidate.classList.remove('selected'));
        button.classList.add('selected');
        setSelectedGender(button.dataset.mpGender);
      });
    });

    document.querySelectorAll('.mp-shift-btn').forEach((button) => {
      button.addEventListener('click', () => {
        playClick();
        document.querySelectorAll('.mp-shift-btn').forEach((candidate) => candidate.classList.remove('selected'));
        button.classList.add('selected');
        setMPHostShift(parseInt(button.dataset.shift, 10));
      });
    });

    $('mp-create-room-btn')?.addEventListener('click', createRoom);
    $('mp-quickmatch-btn')?.addEventListener('click', startQuickMatch);
    $('mp-auto-match-toggle')?.addEventListener('change', async (event) => {
      mpState.autoMatch = event.target.checked;
      if (mpState.autoMatch && mpState.isSearching) {
        $('waiting-status').textContent = 'Auto-matching with next available player...';
        try {
          const result = await convex.mutation(api.matchmaking.joinQueue, {
            deviceId: getDeviceId(),
            playerName: getPlayerName(),
            cosmetics: getCosmeticsPayload(getCosmeticState()),
            autoMatch: true,
          });
          if (result.status === 'matched') foundQuickMatch(result.roomCode);
        } catch (error) {
          console.log('Auto-match re-join failed:', error);
        }
      } else {
        $('waiting-status').textContent = 'Choose an opponent or enable auto-match';
      }
    });

    $('waiting-cancel')?.addEventListener('click', () => {
      playClick();
      cancelQuickMatch();
      showScreen('title-screen');
    });
    $('mp-challenge-accept')?.addEventListener('click', () => {
      playClick();
      acceptIncomingChallenge();
    });
    $('mp-challenge-decline')?.addEventListener('click', () => {
      playClick();
      declineIncomingChallenge();
    });

    $('mp-join-btn')?.addEventListener('click', openJoinRoomModal);
    $('close-mp-join')?.addEventListener('click', closeJoinRoomModal);
    $('mp-join-modal')?.addEventListener('click', (event) => {
      if (event.target === $('mp-join-modal')) closeJoinRoomModal();
    });
    $('mp-join-back')?.addEventListener('click', backToMultiplayerModal);
    $('mp-join-submit')?.addEventListener('click', submitJoinCode);
    $('mp-code-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') $('mp-join-submit')?.click();
    });

    $('mp-copy-code')?.addEventListener('click', () => {
      playClick();
      const code = $('mp-lobby-code').textContent;
      navigator.clipboard?.writeText(code).then(() => {
        $('mp-copy-code').textContent = 'Copied!';
        setTimeout(() => { $('mp-copy-code').textContent = 'Copy Code'; }, 2000);
      }).catch(() => {
        $('mp-copy-code').textContent = code + ' (copied)';
        setTimeout(() => { $('mp-copy-code').textContent = 'Copy Code'; }, 2000);
      });
    });

    $('mp-leave-btn')?.addEventListener('click', leaveRoom);
    $('mp-start-btn')?.addEventListener('click', hostStartGame);
  }

  return {
    bindEvents,
    stopLobbyPolling,
    cancelQuickMatch,
  };
}
