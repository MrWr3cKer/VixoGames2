/**
 * Lightweight on-device personalization:
 * - First-visit genre picker (dismissable)
 * - Play session tracking
 * - Genre/game affinity scoring for recommendations
 */
(function () {
  const KEY_PROFILE = "vixo-profile-v1";
  const KEY_STATS = "vixo-play-stats-v1";
  const MAX_PICKED_GENRES = 5;

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function readProfile() {
    const base = {
      selectedGenres: [],
      onboardingSeen: false,
      dismissedAt: 0,
      updatedAt: 0,
    };
    return Object.assign(base, safeParse(localStorage.getItem(KEY_PROFILE), {}));
  }

  function writeProfile(profile) {
    try {
      localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
    } catch {
      /* ignore quota/private mode */
    }
  }

  function readStats() {
    const base = {
      totalSessions: 0,
      totalSeconds: 0,
      genres: {},
      games: {},
      updatedAt: 0,
    };
    return Object.assign(base, safeParse(localStorage.getItem(KEY_STATS), {}));
  }

  function writeStats(stats) {
    try {
      localStorage.setItem(KEY_STATS, JSON.stringify(stats));
    } catch {
      /* ignore quota/private mode */
    }
  }

  function normalizeGenres(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .map(function (s) {
        return String(s || "").trim().toLowerCase();
      })
      .filter(function (s) {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      })
      .slice(0, MAX_PICKED_GENRES);
  }

  function getPreferredGenres() {
    return normalizeGenres(readProfile().selectedGenres);
  }

  function savePreferredGenres(genres) {
    const profile = readProfile();
    profile.selectedGenres = normalizeGenres(genres);
    profile.onboardingSeen = true;
    profile.updatedAt = Date.now();
    writeProfile(profile);
    document.dispatchEvent(new CustomEvent("vixo:preferences-updated"));
  }

  function dismissOnboarding() {
    const profile = readProfile();
    profile.onboardingSeen = true;
    profile.dismissedAt = Date.now();
    profile.updatedAt = Date.now();
    writeProfile(profile);
  }

  function shouldShowOnboarding() {
    const profile = readProfile();
    if (profile.onboardingSeen) return false;
    return true;
  }

  function recordPlaySession(payload) {
    const namespace = String(payload?.namespace || "").trim();
    if (!namespace) return;
    const durationSec = Math.max(0, Math.round(Number(payload?.durationSec || 0)));
    if (durationSec < 5) return;

    const title = String(payload?.title || "Game");
    const category = String(payload?.category || "").toLowerCase();
    const now = Date.now();
    const stats = readStats();

    stats.totalSessions = Number(stats.totalSessions || 0) + 1;
    stats.totalSeconds = Number(stats.totalSeconds || 0) + durationSec;
    stats.updatedAt = now;

    if (!stats.games || typeof stats.games !== "object") stats.games = {};
    if (!stats.genres || typeof stats.genres !== "object") stats.genres = {};

    const game = stats.games[namespace] || {
      namespace: namespace,
      title: title,
      category: category,
      plays: 0,
      seconds: 0,
      lastPlayed: 0,
    };
    game.title = title || game.title;
    game.category = category || game.category;
    game.plays += 1;
    game.seconds += durationSec;
    game.lastPlayed = now;
    stats.games[namespace] = game;

    if (category) {
      const g = stats.genres[category] || { plays: 0, seconds: 0 };
      g.plays += 1;
      g.seconds += durationSec;
      stats.genres[category] = g;
    }

    writeStats(stats);
    document.dispatchEvent(new CustomEvent("vixo:play-stats-updated"));
  }

  function getTopGenres(limit) {
    const max = limit || 5;
    const profileGenres = getPreferredGenres();
    const stats = readStats();
    const entries = Object.entries(stats.genres || {});
    entries.sort(function (a, b) {
      const aa = Number(a[1]?.seconds || 0) + Number(a[1]?.plays || 0) * 45;
      const bb = Number(b[1]?.seconds || 0) + Number(b[1]?.plays || 0) * 45;
      return bb - aa;
    });
    const rankedByPlay = entries.map(function (entry) {
      return entry[0];
    });
    return normalizeGenres(profileGenres.concat(rankedByPlay)).slice(0, max);
  }

  function scoreGame(item) {
    if (!item) return 0;
    const ns = String(item.namespace || "");
    const cat = String(item.category || "").toLowerCase();
    const quality = Number(item.quality_score || 0);
    const preferred = new Set(getPreferredGenres());
    const stats = readStats();
    const genreStats = (stats.genres && stats.genres[cat]) || null;
    const gameStats = (stats.games && stats.games[ns]) || null;

    let score = 0;
    if (preferred.has(cat)) score += 140;
    if (genreStats) {
      score += Math.min(120, Number(genreStats.seconds || 0) / 10);
      score += Math.min(70, Number(genreStats.plays || 0) * 8);
    }
    if (gameStats) {
      score += Math.min(80, Number(gameStats.seconds || 0) / 18);
      score += Math.min(50, Number(gameStats.plays || 0) * 10);
    }
    score += Math.max(0, quality) * 2;
    return score;
  }

  function rankGames(items) {
    return (Array.isArray(items) ? items : [])
      .slice()
      .sort(function (a, b) {
        const sa = scoreGame(a);
        const sb = scoreGame(b);
        if (sb !== sa) return sb - sa;
        return Number(b?.quality_score || 0) - Number(a?.quality_score || 0);
      });
  }

  function getTopGames(limit) {
    const max = limit || 12;
    const stats = readStats();
    const list = Object.values(stats.games || {}).sort(function (a, b) {
      const sa = Number(a.seconds || 0) + Number(a.plays || 0) * 60;
      const sb = Number(b.seconds || 0) + Number(b.plays || 0) * 60;
      return sb - sa;
    });
    return list.slice(0, max);
  }

  window.vixoPersonalization = {
    MAX_PICKED_GENRES: MAX_PICKED_GENRES,
    getProfile: readProfile,
    getStats: readStats,
    getPreferredGenres: getPreferredGenres,
    savePreferredGenres: savePreferredGenres,
    dismissOnboarding: dismissOnboarding,
    shouldShowOnboarding: shouldShowOnboarding,
    recordPlaySession: recordPlaySession,
    getTopGenres: getTopGenres,
    scoreGame: scoreGame,
    rankGames: rankGames,
    getTopGames: getTopGames,
  };
})();
