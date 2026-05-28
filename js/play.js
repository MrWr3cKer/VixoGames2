const GAMEPIX_SID = "1VXSV";
const GAMEPIX_PAGE_SIZE = 24;
const GAMEPIX_FEED_BASE = "https://feeds.gamepix.com/v2/json";
function formatCategory(slug) {
  if (!slug) return "Game";
  return slug
    .split("-")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function getEmbedUrlForSlug(slug) {
  if (slug && /^[a-z0-9-]+$/i.test(slug)) {
    return `https://play.gamepix.com/${slug}/embed?sid=${GAMEPIX_SID}`;
  }
  return null;
}

async function fetchGameBySlug(slug) {
  if (!slug) return null;

  const lib = window.vixoGames || [];
  let found = lib.find(function (g) {
    return g.namespace === slug;
  });
  if (found) return found;

  for (let page = 1; page <= 10; page++) {
    try {
      const items = await fetchGamePixGames(page, null);
      found = items.find(function (g) {
        return g.namespace === slug;
      });
      if (found) {
        if (!window.vixoGames) window.vixoGames = [];
        const exists = window.vixoGames.some(function (g) {
          return g.namespace === found.namespace;
        });
        if (!exists) window.vixoGames.push(found);
        return found;
      }
      if (items.length < GAMEPIX_PAGE_SIZE) break;
    } catch (err) {
      console.warn("fetchGameBySlug:", err);
      break;
    }
  }

  return null;
}

function gamePixImageUrl(imageUrl, width) {
  if (!imageUrl) return "";
  try {
    const u = new URL(imageUrl);
    u.searchParams.set("w", String(width));
    return u.toString();
  } catch {
    return imageUrl;
  }
}

function getPlayPageUrl(item) {
  if (window.vixoRoutes && item) {
    return window.vixoRoutes.getGamePlayPath(item);
  }
  if (item && item.namespace) {
    return (
      "../games/index.html?game=" + encodeURIComponent(item.namespace)
    );
  }
  return "../index.html";
}

/**
 * Sizes the player to match GamePix width/height or orientation.
 * @param {HTMLElement} stage
 * @param {URLSearchParams} params
 */
function applyGameStageSize(stage, params) {
  if (!stage) return;

  const w = parseInt(params.get("w"), 10);
  const h = parseInt(params.get("h"), 10);
  const orientation = (params.get("orientation") || "").toLowerCase();

  let aspect = "16 / 9";
  const wideDesktop = window.matchMedia("(min-width: 1024px)").matches;
  let maxWidth = wideDesktop ? "100%" : "min(100%, 1040px)";

  if (w > 0 && h > 0) {
    aspect = `${w} / ${h}`;
    if (w >= h) {
      maxWidth = wideDesktop ? "100%" : "min(100%, 1040px)";
      stage.classList.add("game-stage--landscape");
      stage.classList.remove("game-stage--portrait");
    } else {
      maxWidth =
        wideDesktop
          ? "min(100%, 820px)"
          : window.matchMedia("(min-width: 768px)").matches
            ? "min(100%, 680px)"
            : "min(100%, 420px)";
      stage.classList.add("game-stage--portrait");
      stage.classList.remove("game-stage--landscape");
    }
  } else if (orientation === "portrait") {
    aspect = "3 / 4";
    maxWidth =
      wideDesktop
        ? "min(100%, 820px)"
        : window.matchMedia("(min-width: 768px)").matches
          ? "min(100%, 680px)"
          : "min(100%, 420px)";
    stage.classList.add("game-stage--portrait");
    stage.classList.remove("game-stage--landscape");
  } else if (orientation === "landscape") {
    aspect = "4 / 3";
    maxWidth = wideDesktop ? "100%" : "min(100%, 1040px)";
    stage.classList.add("game-stage--landscape");
    stage.classList.remove("game-stage--portrait");
  } else {
    aspect = "16 / 9";
    maxWidth = wideDesktop ? "100%" : "min(100%, 1040px)";
    stage.classList.add("game-stage--landscape");
    stage.classList.remove("game-stage--portrait");
  }

  stage.style.setProperty("--game-aspect", aspect);
  stage.style.setProperty("--game-max-width", maxWidth);

  const shell = stage.closest(".play-stage-shell");
  if (shell) shell.style.maxWidth = maxWidth;
}

async function enrichGameMeta(namespace, params, stageEl) {
  if (params.get("w") && params.get("h")) {
    applyGameStageSize(stageEl, params);
    const fromLib = (window.vixoGames || []).find(function (item) {
      return item.namespace === namespace;
    });
    return fromLib || null;
  }

  try {
    let game = null;
    const category = params.get("category");
    if (category) {
      const catItems = await fetchGamePixGames(1, category);
      game = catItems.find(function (item) {
        return item.namespace === namespace;
      });
    }
    if (!game) {
      const all = await fetchGamePixGames(1, null);
      game = all.find(function (item) {
        return item.namespace === namespace;
      });
    }
    if (!game) return null;

    if (game.width) params.set("w", String(game.width));
    if (game.height) params.set("h", String(game.height));
    if (game.orientation) params.set("orientation", game.orientation);
    if (game.category && !params.get("category")) {
      params.set("category", game.category);
      const categoryEl = document.getElementById("play-category");
      if (categoryEl) {
        categoryEl.textContent = formatCategory(game.category);
        categoryEl.classList.add("is-visible");
      }
    }
    applyGameStageSize(stageEl, params);
    return game;
  } catch {
    /* keep defaults */
    return null;
  }
}

async function fetchGamePixGames(page, category) {
  const params = new URLSearchParams({
    sid: GAMEPIX_SID,
    pagination: String(GAMEPIX_PAGE_SIZE),
    page: String(page),
  });
  if (category) params.set("category", category);

  const response = await fetch(`${GAMEPIX_FEED_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error("Feed failed");
  const feed = await response.json();
  return Array.isArray(feed.items) ? feed.items : [];
}

function dedupeGames(items) {
  const seen = new Set();
  return items.filter(function (item) {
    if (!item.namespace || seen.has(item.namespace)) return false;
    seen.add(item.namespace);
    return true;
  });
}

function publishGamesForThumbBg(items) {
  if (!items || !items.length) return;
  window.vixoGames = dedupeGames((window.vixoGames || []).concat(items));
  document.dispatchEvent(
    new CustomEvent("vixo:games-loaded", { detail: window.vixoGames })
  );
}

function createSimilarCard(item) {
  const link = document.createElement("a");
  link.className = "similar-card";
  link.href = getPlayPageUrl(item);
  if (item.namespace) {
    link.dataset.namespace = item.namespace;
  }
  link.title = item.title || "Game";

  const cover = document.createElement("div");
  cover.className = "similar-card-cover";

  const img = document.createElement("img");
  img.src = gamePixImageUrl(item.banner_image || item.image, 280);
  img.alt = item.title || "";
  img.loading = "lazy";
  cover.appendChild(img);

  const body = document.createElement("div");
  body.className = "similar-card-body";

  const title = document.createElement("span");
  title.className = "similar-card-title";
  title.textContent = item.title || "Game";

  const meta = document.createElement("span");
  meta.className = "similar-card-meta";
  meta.textContent = formatCategory(item.category);

  body.appendChild(title);
  body.appendChild(meta);
  link.appendChild(cover);
  link.appendChild(body);
  return link;
}

function updateSimilarLinksToPretty() {
  if (!window.vixoRoutes || window.vixoUsePrettyPaths !== true) return;
  const links = document.querySelectorAll(".similar-card[data-namespace]");
  links.forEach(function (link) {
    const slug = link.dataset.namespace;
    if (!slug) return;
    link.href = window.vixoRoutes.getGamePlayPath({ namespace: slug });
  });
}

document.addEventListener("vixo:routes-ready", function (ev) {
  if (ev && ev.detail && ev.detail.pretty === true) {
    updateSimilarLinksToPretty();
  }
});

function renderSimilarList(container, items) {
  if (!container) return;
  container.innerHTML = "";
  items.forEach(function (item) {
    container.appendChild(createSimilarCard(item));
  });
  // If pretty paths are already enabled, ensure sidebar links are clean.
  if (window.vixoUsePrettyPaths === true) {
    updateSimilarLinksToPretty();
  }
}

async function buildSimilarPool(category) {
  const fromLibrary = window.vixoGames || [];
  if (fromLibrary.length >= 16) {
    return fromLibrary.slice();
  }

  const results = await Promise.all([
    fetchGamePixGames(1, category || null),
    fetchGamePixGames(2, category || null),
    fetchGamePixGames(1, null),
  ]);
  return dedupeGames(results.flat().concat(fromLibrary));
}

async function loadTrendingSidebar(container, currentNamespace) {
  if (!container) return;

  try {
    let pool = window.vixoGames || [];
    if (pool.length < 12) {
      pool = dedupeGames(pool.concat(await fetchGamePixGames(1, null)));
    }

    const trending = pool
      .filter(function (item) {
        return item.namespace && item.namespace !== currentNamespace;
      })
      .slice(0, 14);

    if (!trending.length) {
      container.innerHTML =
        '<p class="similar-empty">No trending games right now.</p>';
      return;
    }

    renderSimilarList(container, trending);
    publishGamesForThumbBg(pool);
  } catch (err) {
    console.warn("Trending sidebar:", err);
    container.innerHTML =
      '<p class="similar-empty">Could not load trending.</p>';
  }
}

async function loadSimilarGames(currentNamespace, category) {
  const left = document.getElementById("similar-left");
  const right = document.getElementById("similar-right");
  const mobile = document.getElementById("similar-mobile");
  const countEl = document.getElementById("similar-count");

  if (right) {
    loadTrendingSidebar(right, currentNamespace);
  }

  try {
    const pool = await buildSimilarPool(category);

    const similar = pool
      .filter(function (item) {
        return item.namespace && item.namespace !== currentNamespace;
      })
      .slice(0, 24);

    if (countEl) {
      countEl.textContent = similar.length ? `${similar.length} games` : "";
    }

    if (!similar.length) {
      const msg = '<p class="similar-empty">No suggestions right now.</p>';
      if (left) left.innerHTML = msg;
      if (mobile) mobile.innerHTML = msg;
      return;
    }

    renderSimilarList(left, similar);
    renderSimilarList(mobile, similar);
    publishGamesForThumbBg(pool);
  } catch (err) {
    console.warn("Similar games:", err);
    const msg = '<p class="similar-empty">Could not load suggestions.</p>';
    if (left) left.innerHTML = msg;
    if (mobile) mobile.innerHTML = msg;
  }
}

const GAMEPIX_ORIGIN = "https://play.gamepix.com";

/**
 * GamePix player listens for { message: "resume" } (refocus after UI interaction).
 * @param {string} message
 */
function sendGamePixCommand(message) {
  const iframe = document.getElementById("game-frame");
  if (!iframe || !iframe.contentWindow) return;

  try {
    iframe.contentWindow.postMessage({ message: message }, GAMEPIX_ORIGIN);
  } catch {
    /* cross-origin */
  }
}

function focusGameFrame() {
  const iframe = document.getElementById("game-frame");
  if (!iframe) return;
  iframe.focus();
  sendGamePixCommand("resume");
  /* Best effort: some embeds require explicit unmute after user intent. */
  sendGamePixCommand("unmute");
  sendGamePixCommand("audioOn");
  sendGamePixCommand("soundOn");
}

function initGameFocus() {
  const iframe = document.getElementById("game-frame");
  const shell = document.querySelector(".play-stage-shell");
  const toolbar = document.querySelector(".play-toolbar");
  const layout = document.querySelector(".play-layout");

  if (!iframe) return;

  const unlockAudio = function () {
    focusGameFrame();
  };

  if (toolbar) {
    toolbar.addEventListener("mousedown", function (e) {
      /* preventDefault on mousedown blocks the click event on iOS Safari */
      if (e.target.closest("button, a")) return;
      e.preventDefault();
    });
    toolbar.addEventListener("mouseup", function (e) {
      if (e.target.closest("#btn-fullscreen")) return;
      focusGameFrame();
    });
  }

  if (shell) {
    shell.addEventListener("mousedown", function (e) {
      if (e.target === iframe || e.target.closest("#game-frame")) return;
      focusGameFrame();
    });
    shell.addEventListener("touchstart", unlockAudio, {
      passive: true,
      once: true,
    });
  }

  if (layout) {
    layout.addEventListener("mousedown", function (e) {
      if (e.target.closest(".play-sidebar, .play-similar-mobile, .similar-card")) {
        return;
      }
      if (e.target.closest(".play-stage-shell, .play-toolbar")) return;
      focusGameFrame();
    });
  }

  document.addEventListener("mouseup", function (e) {
    if (e.target.closest(".play-sidebar, .similar-card, .play-back, .logo")) return;
    if (e.target.closest(".play-toolbar")) return;
    if (!e.target.closest("#game-frame")) {
      window.setTimeout(focusGameFrame, 0);
    }
  });

  document.addEventListener(
    "keydown",
    function () {
      unlockAudio();
    },
    { once: true }
  );
}

function initFullscreen() {
  const btn = document.getElementById("btn-fullscreen");
  const stage = document.getElementById("game-stage");
  const iframe = document.getElementById("game-frame");
  const shell = stage?.closest(".play-stage-shell");
  const fsTarget = shell || stage;
  const iconEnter = btn?.querySelector(".icon-fs-enter");
  const iconExit = btn?.querySelector(".icon-fs-exit");
  const label = btn?.querySelector(".toolbar-btn-label");

  if (!btn || !stage || !fsTarget) return;

  let fsScrollLockY = 0;
  let fsViewportBound = false;

  function isCoarseMobile() {
    return (
      window.matchMedia("(max-width: 768px)").matches ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    );
  }

  function isNativeFullscreen() {
    const el =
      document.fullscreenElement ||
      document.webkitFullscreenElement;
    return (
      el === stage ||
      el === fsTarget ||
      el === iframe ||
      (el && (el === stage || fsTarget.contains(el)))
    );
  }

  function isMobileFullscreen() {
    return document.body.classList.contains("vixo-mobile-fs");
  }

  function isDesktopFallback() {
    return fsTarget.classList.contains("is-fullscreen-fallback");
  }

  function isFullscreenActive() {
    return (
      isNativeFullscreen() || isMobileFullscreen() || isDesktopFallback()
    );
  }

  function updateFsViewportHeight() {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    const w = vv ? vv.width : window.innerWidth;
    const top = vv ? vv.offsetTop : 0;
    const left = vv ? vv.offsetLeft : 0;
    const root = document.documentElement;
    root.style.setProperty("--vixo-fs-h", Math.round(h) + "px");
    root.style.setProperty("--vixo-fs-w", Math.round(w) + "px");
    root.style.setProperty("--vixo-fs-top", Math.round(top) + "px");
    root.style.setProperty("--vixo-fs-left", Math.round(left) + "px");
  }

  function scheduleFsViewportUpdates() {
    updateFsViewportHeight();
    [50, 150, 350, 600].forEach(function (ms) {
      window.setTimeout(updateFsViewportHeight, ms);
    });
  }

  function onFsViewportChange() {
    if (!isMobileFullscreen()) return;
    updateFsViewportHeight();
  }

  function bindFsViewport() {
    if (fsViewportBound) return;
    fsViewportBound = true;
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onFsViewportChange);
      window.visualViewport.addEventListener("scroll", onFsViewportChange);
    }
    window.addEventListener("resize", onFsViewportChange);
    window.addEventListener("orientationchange", onFsOrientation);
  }

  function onFsOrientation() {
    if (!isMobileFullscreen()) return;
    scheduleFsViewportUpdates();
  }

  function unbindFsViewport() {
    if (!fsViewportBound) return;
    fsViewportBound = false;
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", onFsViewportChange);
      window.visualViewport.removeEventListener("scroll", onFsViewportChange);
    }
    window.removeEventListener("resize", onFsViewportChange);
    window.removeEventListener("orientationchange", onFsOrientation);
    const root = document.documentElement;
    root.style.removeProperty("--vixo-fs-h");
    root.style.removeProperty("--vixo-fs-w");
    root.style.removeProperty("--vixo-fs-top");
    root.style.removeProperty("--vixo-fs-left");
  }

  function lockPageForFs() {
    fsScrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = "-" + fsScrollLockY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockPageForFs() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, fsScrollLockY);
  }

  function setMobileFullscreen(on) {
    document.documentElement.classList.toggle("vixo-mobile-fs", on);
    document.body.classList.toggle("vixo-mobile-fs", on);
    const floater = document.getElementById("vixo-fs-exit");
    if (floater) floater.hidden = !on;
    if (on) {
      /* Avoid body position:fixed — breaks layout on iOS rotation */
      scheduleFsViewportUpdates();
      bindFsViewport();
      window.setTimeout(focusGameFrame, 50);
    } else {
      unbindFsViewport();
    }
  }

  function setDesktopFallback(on) {
    fsTarget.classList.toggle("is-fullscreen-fallback", on);
    stage.classList.toggle("is-fullscreen-fallback", on && fsTarget !== stage);
    document.documentElement.classList.toggle("vixo-fs-active", on);
    document.body.classList.toggle("vixo-fs-active", on);
    if (on) {
      lockPageForFs();
    } else {
      unlockPageForFs();
    }
  }

  function syncFullscreenUi() {
    const active = isFullscreenActive();
    if (iconEnter) iconEnter.classList.toggle("is-hidden", active);
    if (iconExit) iconExit.classList.toggle("is-hidden", !active);
    if (label) {
      label.textContent = active ? "Exit" : "Fullscreen";
    }
    btn.setAttribute("aria-label", active ? "Exit fullscreen" : "Fullscreen");
    stage.classList.toggle("is-fullscreen", isNativeFullscreen());
  }

  function requestNativeFullscreen(el) {
    const target = el || fsTarget;
    const req =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      target.mozRequestFullScreen ||
      target.msRequestFullscreen;
    if (!req) return Promise.reject(new Error("Fullscreen API unavailable"));
    return Promise.resolve(req.call(target));
  }

  function exitNativeFullscreen() {
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;
    if (exit) return Promise.resolve(exit.call(document));
    return Promise.resolve();
  }

  function enterFullscreen() {
    if (isCoarseMobile()) {
      setMobileFullscreen(true);
      syncFullscreenUi();
      return;
    }

    requestNativeFullscreen(fsTarget)
      .then(syncFullscreenUi)
      .catch(function () {
        if (iframe) {
          return requestNativeFullscreen(iframe);
        }
        return Promise.reject();
      })
      .then(syncFullscreenUi)
      .catch(function () {
        setDesktopFallback(true);
        syncFullscreenUi();
        window.setTimeout(focusGameFrame, 80);
      });
  }

  function exitFullscreen() {
    if (isMobileFullscreen()) {
      setMobileFullscreen(false);
      syncFullscreenUi();
      return;
    }
    if (isDesktopFallback()) {
      setDesktopFallback(false);
      syncFullscreenUi();
      return;
    }
    exitNativeFullscreen().then(syncFullscreenUi).catch(syncFullscreenUi);
  }

  function toggleFullscreen() {
    if (isFullscreenActive()) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }

  let floater = document.getElementById("vixo-fs-exit");
  if (!floater && isCoarseMobile()) {
    floater = document.createElement("button");
    floater.type = "button";
    floater.id = "vixo-fs-exit";
    floater.className = "vixo-fs-exit";
    floater.hidden = true;
    floater.setAttribute("aria-label", "Exit fullscreen");
    floater.textContent = "Done";
    document.body.appendChild(floater);
    floater.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      exitFullscreen();
    });
  }

  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleFullscreen();
  });

  document.addEventListener("fullscreenchange", syncFullscreenUi);
  document.addEventListener("webkitfullscreenchange", syncFullscreenUi);

  syncFullscreenUi();
}

function setPlayPageMeta(title, description, slug) {
  document.title = `${title} – VixoGames`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content =
    description ||
    `Play ${title} free in your browser on VixoGames. No download or account needed.`;

  const canonical = document.getElementById("canonical-url");
  if (canonical && slug && window.vixoRoutes) {
    const href = window.vixoRoutes.getCanonicalGameUrl(slug);
    if (href) canonical.href = href;
  }
}

function initPlayLoadingUi(iframe, loadingEl, retryBtn) {
  const bar = document.getElementById("play-loading-bar");
  const fill = document.getElementById("play-loading-fill");
  const textEl = document.getElementById("play-loading-text");
  let progress = 0;
  let tick = null;
  let failTimer = null;

  function setProgress(p) {
    progress = Math.min(100, p);
    if (fill) fill.style.width = progress + "%";
  }

  function showLoading(msg) {
    if (loadingEl) {
      loadingEl.classList.remove("is-hidden");
    }
    if (bar) bar.classList.remove("is-hidden");
    if (textEl && msg) textEl.textContent = msg;
    if (retryBtn) retryBtn.classList.add("is-hidden");
  }

  function hideLoading() {
    if (loadingEl) loadingEl.classList.add("is-hidden");
    if (bar) bar.classList.add("is-hidden");
    setProgress(100);
    if (tick) clearInterval(tick);
    if (failTimer) clearTimeout(failTimer);
  }

  showLoading("Loading game…");
  setProgress(8);
  tick = window.setInterval(function () {
    if (progress < 88) setProgress(progress + 4 + Math.random() * 6);
  }, 350);

  failTimer = window.setTimeout(function () {
    if (loadingEl && !loadingEl.classList.contains("is-hidden")) {
      if (textEl) {
        textEl.textContent = "This is taking longer than usual…";
      }
      if (retryBtn) retryBtn.classList.remove("is-hidden");
    }
  }, 18000);

  iframe.addEventListener("load", function () {
    hideLoading();
    focusGameFrame();
  });

  if (retryBtn) {
    retryBtn.addEventListener("click", function () {
      hideLoading();
      showLoading("Reloading…");
      setProgress(5);
      iframe.src = iframe.src;
    });
  }

  return { showLoading: showLoading, hideLoading: hideLoading };
}

function initShareButton() {
  const btn = document.getElementById("btn-share");
  const label = document.getElementById("share-label");
  if (!btn) return;

  btn.addEventListener("click", async function () {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          url: url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      if (label) {
        label.textContent = "Copied!";
        window.setTimeout(function () {
          label.textContent = "Share";
        }, 2000);
      }
      btn.setAttribute("aria-label", "Link copied");
    } catch {
      window.prompt("Copy this link:", url);
    }
  });
}

function initPlayFavorite(namespace, params, gameMeta) {
  const btn = document.getElementById("btn-favorite-play");
  if (!btn || !window.vixoStorage || !namespace) return;

  function sync() {
    const on = window.vixoStorage.isFavorite(namespace);
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "Remove from favorites" : "Add to favorites");
  }

  btn.addEventListener("click", function () {
    const ref = window.vixoStorage.gameRefFromParams(params, gameMeta);
    window.vixoStorage.toggleFavorite(ref);
    sync();
  });

  sync();
}

function recordRecentPlay(namespace, params, gameMeta) {
  if (!window.vixoStorage || !namespace) return;
  const ref = window.vixoStorage.gameRefFromParams(params, gameMeta);
  window.vixoStorage.addRecent(ref);
}

function initPlaySessionTracking(namespace, title, category) {
  const prefs = window.vixoPersonalization;
  if (!prefs || !prefs.recordPlaySession || !namespace) return;

  let activeSince = 0;
  let activeMs = 0;
  let flushed = false;

  function canBeActive() {
    return !document.hidden && document.visibilityState !== "hidden";
  }

  function startActive() {
    if (!canBeActive() || activeSince) return;
    activeSince = Date.now();
  }

  function stopActive() {
    if (!activeSince) return;
    activeMs += Math.max(0, Date.now() - activeSince);
    activeSince = 0;
  }

  function flush() {
    if (flushed) return;
    stopActive();
    const seconds = Math.round(activeMs / 1000);
    if (seconds < 5) return;
    flushed = true;
    prefs.recordPlaySession({
      namespace: namespace,
      title: title || "Game",
      category: category || "",
      durationSec: seconds,
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (canBeActive()) {
      startActive();
    } else {
      stopActive();
    }
  });
  window.addEventListener("blur", stopActive);
  window.addEventListener("focus", startActive);
  window.addEventListener("pagehide", flush, { once: true });
  window.addEventListener("beforeunload", flush, { once: true });

  startActive();
}

async function initPlayPage() {
  const slug = window.vixoRoutes?.parseGameSlugFromLocation();

  const titleEl = document.getElementById("play-title");
  const categoryEl = document.getElementById("play-category");
  const descEl = document.getElementById("play-desc");
  const iframe = document.getElementById("game-frame");
  const loadingEl = document.getElementById("play-loading");
  const errorEl = document.getElementById("play-error");
  const stageEl = document.getElementById("game-stage");
  const retryBtn = document.getElementById("play-retry");

  if (!slug) {
    const home =
      (window.vixoRoutes && window.vixoRoutes.getSiteBase() + "index.html") ||
      "../index.html";
    window.location.replace(home);
    return;
  }

  if (window.vixoRoutes) {
    const routes = window.vixoRoutes;
    const applyUrl = function () {
      routes.replaceUrlWithGamePath(slug);
    };
    if (window.vixoUsePrettyPaths === true) {
      applyUrl();
    } else if (window.vixoUsePrettyPaths === false) {
      /* keep games/index.html?game= on Live Server */
    } else if (routes.detectPrettyPaths) {
      routes.detectPrettyPaths().then(applyUrl);
    }
  }

  if (titleEl) titleEl.textContent = formatCategory(slug);

  const game = await fetchGameBySlug(slug);
  if (game) publishGamesForThumbBg([game]);
  const params = game
    ? window.vixoRoutes.gameToSearchParams(game)
    : (function () {
        const p = new URLSearchParams();
        p.set("game", slug);
        return p;
      })();

  const title = game?.title || params.get("title") || formatCategory(slug);
  const namespace = slug;
  const category = game?.category || params.get("category") || "";
  const embedUrl = getEmbedUrlForSlug(slug);

  if (titleEl) titleEl.textContent = title;

  const descText =
    game?.description?.trim() ||
    (game
      ? `Play ${title} free in your browser — ${formatCategory(category)} game on VixoGames.`
      : null);
  setPlayPageMeta(title, descText, slug);

  if (descEl) {
    if (game?.description) {
      descEl.textContent =
        game.description.length > 220
          ? game.description.slice(0, 220) + "…"
          : game.description;
      descEl.classList.remove("is-hidden");
    } else {
      descEl.classList.add("is-hidden");
    }
  }

  if (categoryEl && category) {
    categoryEl.textContent = formatCategory(category);
    categoryEl.classList.add("is-visible");
  } else if (categoryEl) {
    categoryEl.classList.remove("is-visible");
  }

  let gameMeta = { thumb: "", quality: null };

  function savePlayToStorage(resolvedGame) {
    if (!namespace || !window.vixoStorage) return;
    if (resolvedGame) {
      gameMeta = {
        thumb: gamePixImageUrl(resolvedGame.banner_image || resolvedGame.image, 280),
        quality: resolvedGame.quality_score,
        width: resolvedGame.width,
        height: resolvedGame.height,
        orientation: resolvedGame.orientation,
      };
    }
    const ref = window.vixoStorage.gameRefFromParams(params, gameMeta);
    window.vixoStorage.addRecent(ref);
  }

  applyGameStageSize(stageEl, params);

  const resolved = game || (await enrichGameMeta(namespace, params, stageEl));
  if (resolved) {
    if (!game?.description && resolved.description && descEl) {
      descEl.textContent =
        resolved.description.length > 220
          ? resolved.description.slice(0, 220) + "…"
          : resolved.description;
      descEl.classList.remove("is-hidden");
    }
    setPlayPageMeta(
      resolved.title || title,
      resolved.description
        ? resolved.description.slice(0, 155) + (resolved.description.length > 155 ? "…" : "")
        : descText,
      slug
    );
    savePlayToStorage(resolved);
    initPlayFavorite(namespace, params, gameMeta);
  } else {
    savePlayToStorage(null);
    initPlayFavorite(namespace, params, gameMeta);
  }

  initGameFocus();
  initFullscreen();
  initShareButton();
  initPlaySessionTracking(namespace, title, category);

  if (!embedUrl || !iframe) {
    if (stageEl) stageEl.classList.add("is-hidden");
    if (errorEl) errorEl.classList.remove("is-hidden");
    if (loadingEl) loadingEl.classList.add("is-hidden");
    return;
  }

  initPlayLoadingUi(iframe, loadingEl, retryBtn);
  iframe.src = embedUrl;
  loadSimilarGames(namespace, category);
}

document.addEventListener("DOMContentLoaded", function () {
  initPlayPage().catch(function (err) {
    console.error("Play page init:", err);
    const errorEl = document.getElementById("play-error");
    if (errorEl) errorEl.classList.remove("is-hidden");
  });
});
