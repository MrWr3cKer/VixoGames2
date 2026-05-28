/**
 * Game Finder chat: heuristic query parser + recommendation bubbles.
 */
(function () {
  const CATEGORY_HINTS = {
    action: ["battle", "shooting", "adventure", "war", "stickman", "ninja"],
    fun: ["casual", "arcade", "funny", "kids", "match-3"],
    puzzle: ["match-3", "puzzle", "mahjong", "word", "escape", "hidden-object"],
    race: ["racing", "driving", "car", "motocross", "truck"],
    sports: ["sports", "football", "basketball", "tennis", "golf", "baseball"],
    strategy: ["strategy", "tower-defense", "simulation"],
    multiplayer: ["multiplayer", "io", "two-player"],
    relaxing: ["casual", "idle", "farm", "fishing"],
  };

  const INTRO_TEMPLATES = [
    "Here are my top {{n}} {{label}} picks right now:",
    "I looked through your library - these {{n}} are strong {{label}} matches:",
    "Nice request. Try these {{n}} {{label}} games:",
    "These {{n}} should fit what you asked for:",
    "Based on your request, here are {{n}} great options:",
  ];
  let lastIntroIndex = -1;

  function pickIntro(n, label) {
    let idx = Math.floor(Math.random() * INTRO_TEMPLATES.length);
    if (idx === lastIntroIndex) idx = (idx + 1) % INTRO_TEMPLATES.length;
    lastIntroIndex = idx;
    return INTRO_TEMPLATES[idx]
      .replace("{{n}}", String(n))
      .replace("{{label}}", label || "game");
  }

  function getGamesPool() {
    const list = (window.vixoGames || []).slice();
    if (list.length) return list;
    return (window.vixoAllGridItems || []).slice();
  }

  function parseWantedCount(text) {
    const m = text.match(/\b(?:top|best|find|show|give|need)\s+(\d{1,2})\b/i);
    const any = text.match(/\b(\d{1,2})\b/);
    const raw = m ? Number(m[1]) : any ? Number(any[1]) : 5;
    return Math.min(20, Math.max(1, raw || 5));
  }

  function getCategoryByHint(query) {
    const q = query.toLowerCase();
    const chosen = new Set();
    Object.keys(CATEGORY_HINTS).forEach(function (key) {
      if (q.includes(key)) {
        CATEGORY_HINTS[key].forEach(function (slug) {
          chosen.add(slug);
        });
      }
    });
    (window.VIXO_CATEGORIES || []).forEach(function (cat) {
      const slug = String(cat.slug || "").toLowerCase();
      const title = String(cat.title || "").toLowerCase();
      if (!slug) return;
      if (q.includes(slug) || (title && q.includes(title))) {
        chosen.add(slug);
      }
    });
    return Array.from(chosen);
  }

  function inferIntent(query) {
    const q = query.toLowerCase();
    const topN = parseWantedCount(q);
    const slugs = getCategoryByHint(q);
    const wantsTop = /\b(top|best|popular|liked|rating|highest)\b/.test(q);
    const wantsRandom = /\b(random|surprise|anything)\b/.test(q);
    const label =
      slugs.length > 0
        ? slugs[0].replace(/-/g, " ")
        : wantsTop
          ? "top rated"
          : "recommended";
    return { topN: topN, slugs: slugs, wantsTop: wantsTop, wantsRandom: wantsRandom, label: label };
  }

  function scoreItem(item, intent, query) {
    const cat = String(item.category || "").toLowerCase();
    const title = String(item.title || "").toLowerCase();
    const quality = Number(item.quality_score || 0);
    let score = quality * 2;

    const prefs = window.vixoPersonalization;
    if (prefs && prefs.scoreGame) score += prefs.scoreGame(item) * 0.75;

    if (intent.slugs.length) {
      if (intent.slugs.includes(cat)) score += 180;
      intent.slugs.forEach(function (slug) {
        if (title.includes(slug.replace(/-/g, " "))) score += 24;
      });
    }
    if (query.includes("fun")) {
      if (["casual", "arcade", "funny", "kids", "match-3"].includes(cat)) score += 70;
    }
    if (query.includes("action")) {
      if (["battle", "shooting", "war", "adventure", "stickman"].includes(cat)) score += 72;
    }
    return score;
  }

  function recommendGames(query) {
    const intent = inferIntent(query);
    let pool = getGamesPool();
    if (!pool.length) return { intent: intent, list: [] };

    if (intent.wantsRandom) {
      pool = pool.slice().sort(function () {
        return Math.random() - 0.5;
      });
    } else {
      pool = pool
        .slice()
        .sort(function (a, b) {
          return scoreItem(b, intent, query.toLowerCase()) - scoreItem(a, intent, query.toLowerCase());
        });
    }

    const seen = new Set();
    const list = pool.filter(function (item) {
      if (!item.namespace || seen.has(item.namespace)) return false;
      seen.add(item.namespace);
      return true;
    });
    return { intent: intent, list: list.slice(0, intent.topN) };
  }

  function createBubble(text, who) {
    const el = document.createElement("article");
    el.className = "finder-msg finder-msg--" + (who === "user" ? "user" : "bot");
    el.textContent = text;
    return el;
  }

  function createGameButtons(items) {
    const wrap = document.createElement("div");
    wrap.className = "finder-msg__games";
    const helpers = window.vixoSearchHelpers;
    items.forEach(function (item) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "finder-game-btn";
      btn.dataset.namespace = item.namespace || "";

      const img = document.createElement("img");
      img.className = "finder-game-btn__thumb";
      img.alt = item.title || "Game";
      if (helpers && helpers.thumbUrl) {
        img.src = helpers.thumbUrl(item, 280);
      } else {
        img.src = item.banner_image || item.image || "";
      }
      img.loading = "lazy";
      img.decoding = "async";

      const body = document.createElement("span");
      body.className = "finder-game-btn__body";

      const title = document.createElement("span");
      title.className = "finder-game-btn__title";
      title.textContent = item.title || "Game";

      const meta = document.createElement("span");
      meta.className = "finder-game-btn__meta";
      const catLabel = (item.category || "game").replace(/-/g, " ");
      const scoreLabel = Number(item.quality_score || 0) > 0
        ? ` · ${Math.round(Number(item.quality_score || 0))}%`
        : "";
      meta.textContent = catLabel + scoreLabel;

      body.appendChild(title);
      body.appendChild(meta);
      btn.appendChild(img);
      btn.appendChild(body);
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function openFinder() {
    const modal = document.getElementById("finder-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("finder-modal-open");
    const chat = document.getElementById("finder-chat");
    if (chat) chat.scrollTop = 0;
    const input = document.getElementById("finder-input");
    if (input) window.setTimeout(function () { input.focus(); }, 50);
  }

  function closeFinder() {
    const modal = document.getElementById("finder-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("finder-modal-open");
    const btn = document.getElementById("finder-open");
    if (btn) btn.focus();
  }

  function ensureGamesReady() {
    return new Promise(function (resolve) {
      if (getGamesPool().length) return resolve(true);
      let done = false;
      const t = window.setTimeout(function () {
        if (done) return;
        done = true;
        resolve(getGamesPool().length > 0);
      }, 2200);
      document.addEventListener(
        "vixo:games-loaded",
        function () {
          if (done) return;
          done = true;
          clearTimeout(t);
          resolve(getGamesPool().length > 0);
        },
        { once: true }
      );
    });
  }

  function navigateToGame(item) {
    const helpers = window.vixoSearchHelpers;
    let href = "";
    if (helpers && helpers.playUrl) href = helpers.playUrl(item);
    if (!href && window.vixoRoutes && window.vixoRoutes.getGamePlayPath) {
      href = window.vixoRoutes.getGamePlayPath(item);
    }
    if (href) {
      closeFinder();
      window.location.href = href;
    }
  }

  function init() {
    const openBtn = document.getElementById("finder-open");
    const modal = document.getElementById("finder-modal");
    const chat = document.getElementById("finder-chat");
    const form = document.getElementById("finder-form");
    const input = document.getElementById("finder-input");
    if (!openBtn || !modal || !chat || !form || !input) return;

    function keepUserBubbleInView(userBubble) {
      if (!userBubble) return;
      const chatRect = chat.getBoundingClientRect();
      const bubbleRect = userBubble.getBoundingClientRect();
      const topPad = 16;
      const targetTop =
        chat.scrollTop + (bubbleRect.top - chatRect.top) - topPad;
      chat.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    }

    function addBotReply(text, games) {
      const bubble = createBubble(text, "bot");
      if (games && games.length) bubble.appendChild(createGameButtons(games));
      chat.appendChild(bubble);
    }

    openBtn.addEventListener("click", openFinder);
    modal.querySelectorAll("[data-finder-close]").forEach(function (el) {
      el.addEventListener("click", closeFinder);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeFinder();
    });

    chat.addEventListener("click", function (e) {
      const btn = e.target.closest(".finder-game-btn");
      if (!btn) return;
      const ns = btn.dataset.namespace;
      const item = getGamesPool().find(function (g) {
        return g.namespace === ns;
      });
      if (item) navigateToGame(item);
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const userBubble = createBubble(q, "user");
      chat.appendChild(userBubble);
      keepUserBubbleInView(userBubble);
      input.value = "";

      const wait = createBubble("Let me find the best matches for that…", "bot");
      chat.appendChild(wait);
      keepUserBubbleInView(userBubble);

      await ensureGamesReady();
      const result = recommendGames(q);
      wait.remove();
      if (!result.list.length) {
        addBotReply("I could not find strong matches yet. Try asking for a genre like action, racing, puzzle, multiplayer, or top rated.");
        keepUserBubbleInView(userBubble);
        return;
      }
      const intro = pickIntro(result.list.length, result.intent.label);
      addBotReply(intro, result.list);
      keepUserBubbleInView(userBubble);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
