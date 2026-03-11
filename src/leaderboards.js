export function createLeaderboardsController({
  $,
  convex,
  api,
  getPlayerName,
  getCurrentUserId,
  getTodayString,
}) {
  let leaderboardData = [];

  function createLeaderboardRow(scoreEntry, rankIndex) {
    const row = document.createElement('div');
    row.className = 'lb-row';
    if (scoreEntry.playerName === getPlayerName()) row.classList.add('lb-you');

    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = String(rankIndex + 1);

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = scoreEntry.playerName || 'Anonymous';

    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = Number(scoreEntry.score || 0).toLocaleString();

    const grade = document.createElement('span');
    grade.className = 'lb-grade';
    grade.textContent = scoreEntry.grade || '-';

    row.append(rank, name, score, grade);
    return row;
  }

  function renderLeaderboardList(container, scores, emptyText) {
    if (!container) return;
    container.innerHTML = '';

    if (!scores || scores.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    scores.forEach((scoreEntry, rankIndex) => {
      container.appendChild(createLeaderboardRow(scoreEntry, rankIndex));
    });
  }

  function updateLeaderboardUI() {
    renderLeaderboardList($('leaderboard-list'), leaderboardData, 'No scores yet. Be the first!');
    renderLeaderboardList($('go-leaderboard-list'), leaderboardData, 'No scores yet. Be the first!');
  }

  async function fetchLeaderboard() {
    try {
      leaderboardData = await convex.query(api.scores.getTopScores, { limit: 10 });
      updateLeaderboardUI();
    } catch (error) {
      console.log('Leaderboard offline:', error);
    }
  }

  async function submitScore(score, shift, grade) {
    const playerName = getPlayerName();
    if (!playerName) return null;

    try {
      const scoreId = await convex.mutation(api.scores.submitScore, {
        playerName,
        score,
        shift,
        grade,
        userId: getCurrentUserId(),
      });
      await fetchLeaderboard();
      return scoreId;
    } catch (error) {
      console.log('Score submit failed:', error);
      return null;
    }
  }

  async function submitDailyScore(score, grade) {
    const playerName = getPlayerName();
    if (!playerName) return null;

    try {
      const scoreId = await convex.mutation(api.scores.submitDailyScore, {
        playerName,
        score,
        grade,
        date: getTodayString(),
        userId: getCurrentUserId(),
      });
      await fetchDailyLeaderboard();
      return scoreId;
    } catch (error) {
      console.log('Daily score submit failed:', error);
      return null;
    }
  }

  async function fetchDailyLeaderboard() {
    try {
      const scores = await convex.query(api.scores.getDailyScores, {
        date: getTodayString(),
        limit: 10,
      });
      renderLeaderboardList($('daily-leaderboard-list'), scores, 'No daily scores yet!');
    } catch (error) {
      console.log('Daily leaderboard offline:', error);
    }
  }

  return {
    fetchLeaderboard,
    submitScore,
    submitDailyScore,
    fetchDailyLeaderboard,
    updateLeaderboardUI,
  };
}
