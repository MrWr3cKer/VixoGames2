/**
 * GamePix JSON feed → VixoGames homepage
 */

const GAMEPIX_SID = "1VXSV";
const GAMEPIX_PAGE_SIZE = 48;
const GAMEPIX_PAGE_SIZE_FALLBACK = 24;
const GAMEPIX_FEED_BASE = "https://feeds.gamepix.com/v2/json";
const FETCH_CHUNK_SIZE = 4;
const FETCH_TIMEOUT_MS = 15000;

/** Main catalog pages — quick first, rest in background */
const INITIAL_MAIN_PAGES = 3;
const QUICK_LOAD_PAGES = 2;
/** Per category row on homepage — page 2 only when page 1 is full */
const CATEGORY_PAGES_EACH = 1;
/** Max parallel category fetches (all queued at once, drained in batches) */
const MAX_CATEGORY_FETCHES = 4;

let activePageSize = GAMEPIX_PAGE_SIZE;
const TRENDING_SHOW = 16;
const NEW_SHOW = 14;
const CATEGORY_INITIAL_SHOW = 14;
const CATEGORY_LOAD_STEP = 12;
const INITIAL_ALL_SHOW = 32;

const categorySectionState = new Map();

/** Homepage category rows (same list as sidebar) */
const HOME_CATEGORIES =
  (typeof window !== "undefined" && window.VIXO_CATEGORIES) || [
    { slug: "multiplayer", title: "Multiplayer", desc: "Play online with friends" },
    { slug: "battle", title: "Action", desc: "Combat, adventure and battles" },
    { slug: "arcade", title: "Arcade", desc: "Quick classics and high scores" },
  ];

let allGamesPage = INITIAL_MAIN_PAGES + 1;
let allGamesLoading = false;
let allGamesHasMore = true;
window.vixoAllGridItems = [];

function getGamePixFeedUrl(page = 1, category = null, pageSize) {
  const params = new URLSearchParams({
    sid: GAMEPIX_SID,
    pagination: String(pageSize || activePageSize),
    page: String(page),
  });
  if (category) params.set("category", category);
  return `${GAMEPIX_FEED_BASE}?${params.toString()}`;
}

async function fetchGamePixGames(page = 1, category = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(getGamePixFeedUrl(page, category), {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GamePix feed failed (${response.status})`);
    }
    const feed = await response.json();
    return {
      items: Array.isArray(feed.items) ? feed.items : [],
      nextUrl: feed.next_url || null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGamePixGamesSafe(page, category, silent) {
  try {
    return await fetchGamePixGames(page, category);
  } catch (err) {
    if (!silent) {
      console.warn("GamePix page skipped:", page, category || "all", err.message || err);
    }
    return { items: [], nextUrl: null };
  }
}

/** Fetch category feed; avoid page 2+ when GamePix returns 400 for thin categories */
async function fetchCategoryGames(catSlug, maxPages) {
  const limit = maxPages || 1;
  const first = await fetchGamePixGamesSafe(1, catSlug, true);
  let merged = first.items.slice();

  if (
    limit > 1 &&
    first.items.length >= Math.max(12, activePageSize * 0.75)
  ) {
    const second = await fetchGamePixGamesSafe(2, catSlug, true);
    merged = merged.concat(second.items);
  }

  return dedupeGames(merged);
}

async function ensureFeedConnection() {
  let result = await fetchGamePixGamesSafe(1, null);
  if (result.items.length) return true;

  activePageSize = GAMEPIX_PAGE_SIZE_FALLBACK;
  result = await fetchGamePixGamesSafe(1, null);
  return result.items.length > 0;
}

/**
 * Fetch multiple feed pages in small batches; failed pages are skipped.
 */
async function fetchGamePixPageRange(startPage, pageCount, category = null) {
  const merged = [];
  const silent = !!category;

  for (let offset = 0; offset < pageCount; offset += FETCH_CHUNK_SIZE) {
    const chunkCount = Math.min(FETCH_CHUNK_SIZE, pageCount - offset);
    let stopEarly = false;

    for (let i = 0; i < chunkCount; i++) {
      const page = startPage + offset + i;
      const res = await fetchGamePixGamesSafe(page, category, silent);
      merged.push.apply(merged, res.items);

      if (category && (!res.items.length || res.items.length < activePageSize * 0.6)) {
        stopEarly = true;
        break;
      }
    }

    if (stopEarly) break;
  }

  return dedupeGames(merged);
}

let categoryFetchActive = 0;
const categoryFetchQueue = [];
const categoryLoadedSlugs = new Set();

function registerMountedCategory(config) {
  if (!window.vixoMountedCategories) window.vixoMountedCategories = [];
  if (
    window.vixoMountedCategories.some(function (c) {
      return c.slug === config.slug;
    })
  ) {
    return;
  }
  window.vixoMountedCategories.push({ slug: config.slug, title: config.title });
  document.dispatchEvent(
    new CustomEvent("vixo:categories-ready", {
      detail: window.vixoMountedCategories.slice(),
    })
  );
}

function findCategoryConfig(slug) {
  return HOME_CATEGORIES.find(function (c) {
    return c.slug === slug;
  });
}

async function fetchAndMountCategory(placeholder, slug) {
  const config = findCategoryConfig(slug);
  if (!config || categoryLoadedSlugs.has(slug)) return;
  categoryLoadedSlugs.add(slug);

  const items = await fetchCategoryGames(slug, CATEGORY_PAGES_EACH);
  if (!placeholder.isConnected) return;

  if (items.length < 4) {
    placeholder.remove();
    return;
  }

  mergeIntoVixoGames(items);
  registerMountedCategory(config);
  placeholder.dataset.lazyLoaded = "1";
  const section = createCategorySection(config, items);
  placeholder.replaceWith(section);
  document.dispatchEvent(new CustomEvent("vixo:category-mounted"));
}

function drainCategoryQueue() {
  while (categoryFetchActive < MAX_CATEGORY_FETCHES && categoryFetchQueue.length) {
    const job = categoryFetchQueue.shift();
    categoryFetchActive++;
    fetchAndMountCategory(job.placeholder, job.slug)
      .catch(function () {})
      .finally(function () {
        categoryFetchActive--;
        drainCategoryQueue();
      });
  }
}

function queueCategoryFetch(placeholder, slug) {
  if (
    placeholder.dataset.lazyLoaded === "1" ||
    placeholder.dataset.lazyQueued === "1"
  ) {
    return;
  }
  placeholder.dataset.lazyQueued = "1";
  categoryFetchQueue.push({ placeholder: placeholder, slug: slug });
  drainCategoryQueue();
}

function initCategoryRows() {
  const categoryRoot = document.getElementById("category-sections");
  if (!categoryRoot || categoryRoot.dataset.categoriesInit === "1") return;
  categoryRoot.dataset.categoriesInit = "1";
  categoryRoot.innerHTML = "";

  HOME_CATEGORIES.forEach(function (cat) {
    const placeholder = createCategoryPlaceholder(cat);
    categoryRoot.appendChild(placeholder);
    queueCategoryFetch(placeholder, cat.slug);
  });
}

function isLocalFilePage() {
  return window.location.protocol === "file:";
}

function showLoadError(container, message) {
  if (!container) return;
  setGridMessage(container, message, "error");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary grid-retry-btn";
  btn.textContent = "Try again";
  btn.addEventListener("click", function () {
    loadGamePixHomepage();
  });
  container.appendChild(btn);
}

function dedupeGames(items) {
  const seen = new Set();
  return items.filter(function (item) {
    if (!item.namespace || seen.has(item.namespace)) return false;
    seen.add(item.namespace);
    return true;
  });
}

function formatCategory(slug) {
  if (!slug) return "Game";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatRating(score) {
  if (typeof score !== "number") return "";
  return `${(score * 5).toFixed(1)} ★`;
}

function gamePixImageUrl(imageUrl, width = 320) {
  if (!imageUrl) return "";
  try {
    const u = new URL(imageUrl);
    u.searchParams.set("w", String(width));
    return u.toString();
  } catch {
    return imageUrl;
  }
}

function getCategoryPageUrl(cat) {
  const slug = typeof cat === "string" ? cat : cat.slug;
  const title =
    typeof cat === "string"
      ? formatCategory(slug)
      : cat.title || formatCategory(slug);
  return (
    "categories.html?cat=" +
    encodeURIComponent(slug) +
    "&title=" +
    encodeURIComponent(title)
  );
}

function getPlayPageUrl(item) {
  if (item.namespace && typeof window !== "undefined" && window.vixoRoutes) {
    return window.vixoRoutes.getGamePlayPath(item);
  }
  if (item.namespace) {
    return "games/" + encodeURIComponent(item.namespace);
  }
  const params = new URLSearchParams();
  if (item.url) params.set("url", item.url);
  if (item.title) params.set("title", item.title);
  return `play.html?${params.toString()}`;
}

function isMultiplayerItem(item) {
  const cat = (item.category || "").toLowerCase();
  const title = (item.title || "").toLowerCase();
  return cat === "multiplayer" || title.includes("multiplayer") || title.includes("2 player");
}

function getItemLayout(item) {
  const o = (item.orientation || "").toLowerCase();
  if (o === "portrait") return "portrait";
  if (o === "landscape") return "landscape";
  const w = Number(item.width);
  const h = Number(item.height);
  if (w > 0 && h > 0) return h > w ? "portrait" : "landscape";
  return "landscape";
}

function createGameCard(item, options = {}) {
  const {
    large = false,
    tag = null,
    showFavorite = true,
    featured = false,
    eager = false,
  } = options;
  const playUrl = getPlayPageUrl(item);
  const imageSrc = gamePixImageUrl(item.banner_image || item.image, large ? 400 : 280);
  const category = formatCategory(item.category);
  const rating = formatRating(item.quality_score);

  const article = document.createElement("article");
  article.className = "game-card card-pop-done";
  article.dataset.category = item.category || "";
  article.dataset.title = (item.title || "").toLowerCase();
  if (item.namespace) article.dataset.namespace = item.namespace;
  article.dataset.orientation = (item.orientation || "").toLowerCase();
  article.dataset.layout = getItemLayout(item);
  article.dataset.multiplayer = isMultiplayerItem(item) ? "1" : "0";
  if (typeof item.quality_score === "number") {
    article.dataset.quality = String(item.quality_score);
  }
  if (large) article.classList.add("game-card--large");
  if (featured) article.classList.add("game-card--featured");

  const cardLink = document.createElement("a");
  cardLink.href = playUrl;
  cardLink.className = "game-card-link";
  cardLink.setAttribute("aria-label", `Play ${item.title}`);
  if (item.namespace) {
    cardLink.dataset.namespace = item.namespace;
  }

  const img = document.createElement("img");
  img.className = "game-thumb-img";
  img.src = imageSrc;
  img.alt = item.title || "Game";
  img.loading = eager ? "eager" : "lazy";
  img.decoding = "async";
  if (eager && "fetchPriority" in img) {
    img.fetchPriority = "high";
  }

  const overlay = document.createElement("div");
  overlay.className = "game-overlay";
  const playBtn = document.createElement("span");
  playBtn.className = "play-btn";
  playBtn.textContent = "Play";
  overlay.appendChild(playBtn);

  cardLink.appendChild(img);
  cardLink.appendChild(overlay);

  if (showFavorite && item.namespace) {
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "game-fav-btn";
    const isFav =
      window.vixoStorage && window.vixoStorage.isFavorite(item.namespace);
    if (isFav) favBtn.classList.add("is-active");
    favBtn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
    favBtn.setAttribute("aria-pressed", isFav ? "true" : "false");
    favBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    cardLink.appendChild(favBtn);
  }

  if (tag) {
    const tagLabels = { hot: "Hot", new: "New", top: "Top" };
    const tagEl = document.createElement("span");
    tagEl.className = "game-tag game-tag--" + tag;
    tagEl.textContent = tagLabels[tag] || tag;
    cardLink.appendChild(tagEl);
  }

  article.appendChild(cardLink);

  const heading = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = playUrl;
  titleLink.textContent = item.title || "Untitled";
  heading.appendChild(titleLink);
  article.appendChild(heading);

  const meta = document.createElement("p");
  meta.className = "game-meta";
  meta.textContent = rating ? `${category} · ${rating}` : category;
  article.appendChild(meta);

  return article;
}

function renderGameCards(container, items, cardOptions = {}) {
  if (!container) return;
  container.innerHTML = "";
  container.classList.remove("is-loading", "has-error");
  appendGameCards(container, items, cardOptions, 0);
}

function appendGameCards(container, items, cardOptions, startIndex) {
  if (!container || !items.length) return;
  container.classList.remove("is-loading", "has-error");

  const getOptions =
    typeof cardOptions === "function" ? cardOptions : () => cardOptions;
  const base = startIndex || 0;

  items.forEach(function (item, index) {
    container.appendChild(createGameCard(item, getOptions(item, base + index)));
  });

  if (typeof window.vixoPrepareGameCards === "function") {
    var section = container.closest(".game-section, .user-section");
    if (section) window.vixoPrepareGameCards(section);
  }
}

function categoryCardOptions(item, index) {
  return { tag: index === 0 ? "hot" : null, showFavorite: true };
}

function updateCategorySectionUi(slug) {
  const state = categorySectionState.get(slug);
  const section = document.getElementById("cat-" + slug);
  if (!state || !section) return;

  const btn = section.querySelector(".btn-load-more--category");
  const countLink = section.querySelector(".see-all");

  if (countLink) {
    const total = state.items.length;
    countLink.textContent =
      state.shown >= total && !state.hasMoreRemote
        ? `${total} games`
        : `Showing ${state.shown}${total > state.shown ? " of " + total + "+" : ""} games`;
  }

  if (!btn) return;

  const hasLocal = state.shown < state.items.length;
  const hasRemote = state.hasMoreRemote;

  btn.hidden = !hasLocal && !hasRemote;
  btn.disabled = false;
  btn.textContent =
    hasLocal || hasRemote ? "Load more games" : "All games loaded";
}

async function loadMoreCategoryGames(slug) {
  const state = categorySectionState.get(slug);
  if (!state || state.loading) return;

  const section = document.getElementById("cat-" + slug);
  const grid = section?.querySelector("[data-grid]");
  const btn = section?.querySelector(".btn-load-more--category");
  if (!grid || !btn) return;

  const revealLocal = function () {
    const batch = state.items.slice(
      state.shown,
      state.shown + CATEGORY_LOAD_STEP
    );
    if (!batch.length) return false;
    appendGameCards(grid, batch, categoryCardOptions, state.shown);
    state.shown += batch.length;
    mergeIntoVixoGames(batch);
    updateCategorySectionUi(slug);
    document.dispatchEvent(new CustomEvent("vixo:category-mounted"));
    return true;
  };

  if (state.shown < state.items.length) {
    revealLocal();
    return;
  }

  if (!state.hasMoreRemote) {
    btn.hidden = true;
    return;
  }

  state.loading = true;
  btn.disabled = true;
  btn.textContent = "Loading…";

  try {
    const res = await fetchGamePixGamesSafe(state.nextPage, slug, true);
    const incoming = res.items || [];
    const existing = new Set(
      state.items.map(function (g) {
        return g.namespace;
      })
    );
    const fresh = dedupeGames(incoming).filter(function (g) {
      return g.namespace && !existing.has(g.namespace);
    });

    if (fresh.length) {
      state.items.push.apply(state.items, fresh);
      state.nextPage += 1;
      mergeIntoVixoGames(fresh);
      revealLocal();
    }

    if (!incoming.length || incoming.length < activePageSize) {
      state.hasMoreRemote = false;
    }
  } catch (err) {
    console.warn("Category load more:", slug, err);
    state.hasMoreRemote = false;
  }

  state.loading = false;
  updateCategorySectionUi(slug);
}

function setGridMessage(container, message, type) {
  if (!container) return;
  container.innerHTML = "";
  container.classList.remove("is-loading", "has-error");
  container.classList.add(type === "loading" ? "is-loading" : "has-error");
  const p = document.createElement("p");
  p.className = "grid-message";
  p.textContent = message;
  container.appendChild(p);
}

function setSectionCount(id, count) {
  const el = document.getElementById(id);
  if (el) el.textContent = count ? `${count} games` : "";
}

function createCategoryPlaceholder(config) {
  const section = document.createElement("section");
  section.id = `cat-${config.slug}`;
  section.className =
    "game-section game-section--category is-category-lazy";
  section.dataset.section = "";
  section.dataset.categoryBlock = config.slug;
  section.dataset.lazyCategory = config.slug;
  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${config.title}</h2>
        <p class="section-desc">${config.desc}</p>
      </div>
      <span class="section-count">Loading…</span>
    </div>
    <div class="game-grid game-grid--dense game-grid--row category-skeleton" aria-hidden="true">
      <div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>
    </div>
  `;
  return section;
}

function createCategorySection(config, items) {
  const section = document.createElement("section");
  section.id = `cat-${config.slug}`;
  section.className = "game-section game-section--category";
  section.dataset.section = "";
  section.dataset.categoryBlock = config.slug;

  const initialCount = Math.min(CATEGORY_INITIAL_SHOW, items.length);

  categorySectionState.set(config.slug, {
    config: config,
    items: items.slice(),
    shown: 0,
    nextPage: CATEGORY_PAGES_EACH + 1,
    hasMoreRemote: true,
    loading: false,
  });

  const isHub = document.body.classList.contains("home-crazy");

  section.innerHTML = isHub
    ? `
    <div class="section-head section-head--hub">
      <h2>${config.title}</h2>
      <a href="${getCategoryPageUrl(config)}" class="section-view-all">View more</a>
      <span class="see-all section-count-inline" hidden>Showing ${initialCount} games</span>
    </div>
    <div class="game-row-wrap">
      <button type="button" class="game-row-scroll game-row-scroll--prev" aria-label="Scroll left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="game-grid game-grid--row game-grid--hub" data-grid></div>
      <button type="button" class="game-row-scroll game-row-scroll--next" aria-label="Scroll right">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  `
    : `
    <div class="section-head">
      <div>
        <h2>${config.title}</h2>
        <p class="section-desc">${config.desc}</p>
      </div>
      <span class="see-all section-count-inline">Showing ${initialCount} games</span>
    </div>
    <div class="game-grid game-grid--dense game-grid--row" data-grid></div>
  `;

  const grid = section.querySelector("[data-grid]");
  const initial = items.slice(0, initialCount);
  appendGameCards(grid, initial, categoryCardOptions, 0);

  const state = categorySectionState.get(config.slug);
  state.shown = initial.length;

  updateCategorySectionUi(config.slug);

  if (isHub && typeof window.vixoInitGameRowScrollers === "function") {
    window.vixoInitGameRowScrollers();
  }

  return section;
}

let heroRotationItems = [];
let heroRotationIndex = 0;
let heroRotationTimer = null;

function updateHeroFromGame(item) {
  const titleEl = document.getElementById("hero-title");
  const descEl = document.getElementById("hero-desc");
  const playEl = document.getElementById("hero-play");
  const heroLink = document.getElementById("hero-card-link");
  const thumbEl = document.getElementById("hero-thumb");
  const badge = document.getElementById("hero-badge");
  const card = document.querySelector(".hub-welcome__card");

  if (!item) return;

  if (titleEl) titleEl.textContent = item.title || "Featured game";
  if (descEl) {
    descEl.textContent =
      item.description?.slice(0, 140) + (item.description?.length > 140 ? "…" : "") ||
      "Play free in your browser — no download required.";
  }
  const playUrl = getPlayPageUrl(item);
  if (heroLink) heroLink.href = playUrl;
  if (playEl) playEl.href = playUrl;

  if (thumbEl) {
    thumbEl.innerHTML = "";
    const img = document.createElement("img");
    img.className = "hero-thumb-img";
    img.src = gamePixImageUrl(item.banner_image || item.image, 520);
    img.alt = item.title || "";
    img.loading = "eager";
    img.decoding = "async";
    if ("fetchPriority" in img) img.fetchPriority = "high";
    thumbEl.appendChild(img);
  }

  if (badge) badge.textContent = `Featured · ${formatCategory(item.category)}`;
  if (card) {
    card.classList.add("is-hero-active");
    setTimeout(function () {
      card.classList.remove("is-hero-active");
    }, 700);
  }
}

function startHeroRotation(items) {
  heroRotationItems = items.filter(function (g) {
    return g && g.namespace;
  });
  heroRotationIndex = 0;
  if (heroRotationTimer) {
    clearInterval(heroRotationTimer);
    heroRotationTimer = null;
  }
  if (!heroRotationItems.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  heroRotationTimer = setInterval(function () {
    if (!heroRotationItems.length) return;
    heroRotationIndex = (heroRotationIndex + 1) % heroRotationItems.length;
    updateHeroFromGame(heroRotationItems[heroRotationIndex]);
  }, 9000);
}

function appendAllGames(items, replace) {
  const grid = document.getElementById("gamepix-all");
  const btn = document.getElementById("load-more");
  if (!grid) return;

  if (replace) {
    grid.innerHTML = "";
    grid.classList.remove("is-loading", "has-error");
    window.vixoAllGridItems = [];
  }

  window.vixoAllGridItems = window.vixoAllGridItems.concat(items);

  items.forEach(function (item) {
    grid.appendChild(createGameCard(item, { showFavorite: true }));
  });

  if (typeof window.vixoPrepareGameCards === "function") {
    var allSection = document.getElementById("library");
    if (allSection) window.vixoPrepareGameCards(allSection);
  }

  if (typeof applyAllGamesLibraryView === "function") {
    const sortEl = document.getElementById("sort-all");
    if (sortEl && sortEl.value !== "popular") {
      applyAllGamesLibraryView();
      return;
    }
  }

  setSectionCount("count-all", grid.querySelectorAll(".game-card").length);
  if (btn) btn.hidden = !allGamesHasMore;
}

async function loadMoreGames() {
  if (allGamesLoading || !allGamesHasMore) return;
  const btn = document.getElementById("load-more");
  allGamesLoading = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Loading…";
  }

  try {
    const { items, nextUrl } = await fetchGamePixGames(allGamesPage, null);
    appendAllGames(items, false);
    allGamesPage += 1;
    allGamesHasMore = items.length >= activePageSize && !!nextUrl;
    mergeIntoVixoGames(items);
  } catch (err) {
    console.warn("Load more failed:", err);
    allGamesHasMore = false;
  }

  allGamesLoading = false;
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Load more games";
    btn.hidden = !allGamesHasMore;
  }
}

function mergeIntoVixoGames(items) {
  const existing = new Set(
    (window.vixoGames || []).map(function (g) {
      return g.namespace;
    })
  );
  items.forEach(function (item) {
    if (item.namespace && !existing.has(item.namespace)) {
      window.vixoGames.push(item);
      existing.add(item.namespace);
    }
  });
  document.dispatchEvent(
    new CustomEvent("vixo:games-loaded", { detail: window.vixoGames })
  );
}

function applyHomepageEssentials(allPages) {
  const trendingGrid = document.getElementById("gamepix-trending");
  const newGrid = document.getElementById("gamepix-new");

  if (!allPages.length || !trendingGrid) return false;

  const featured = allPages[0];
  if (featured) updateHeroFromGame(featured);

  const trending = allPages.slice(0, TRENDING_SHOW);
  renderGameCards(trendingGrid, trending, function (item, index) {
    return {
      tag: index === 0 ? "top" : index < 4 ? "hot" : null,
      featured: index === 0,
      showFavorite: true,
      eager: index < 3,
    };
  });
  setSectionCount("count-trending", trending.length);
  startHeroRotation(trending.slice(0, 6));

  const newGames = allPages.slice(TRENDING_SHOW, TRENDING_SHOW + NEW_SHOW);
  if (newGrid) {
    const newList =
      newGames.length >= 8
        ? newGames
        : allPages.slice(
            Math.floor(TRENDING_SHOW / 2),
            Math.floor(TRENDING_SHOW / 2) + NEW_SHOW
          );
    renderGameCards(newGrid, newList, function (item, index) {
      return { tag: index < 2 ? "new" : null, large: false, showFavorite: true };
    });
    setSectionCount("count-new", newGrid.querySelectorAll(".game-card").length);
  }

  const usedInMain = new Set(
    trending.concat(newGames).map(function (g) {
      return g.namespace;
    })
  );
  const forAll = allPages.filter(function (g) {
    return !usedInMain.has(g.namespace);
  });
  appendAllGames(forAll.slice(0, INITIAL_ALL_SHOW), true);
  allGamesPage = INITIAL_MAIN_PAGES + 1;
  allGamesHasMore =
    forAll.length > INITIAL_ALL_SHOW ||
    allPages.length >= activePageSize;

  window.vixoGames = dedupeGames(allPages.slice());

  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.textContent = `${window.vixoGames.length}+`;

  document.dispatchEvent(
    new CustomEvent("vixo:games-loaded", { detail: window.vixoGames })
  );

  initCategoryRows();

  return true;
}

function applyHomepageExtras(seedPages, extraPages) {
  const allPages = dedupeGames(seedPages.concat(extraPages));
  window.vixoGames = allPages;

  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.textContent = `${allPages.length}+`;

  const existing = new Set(
    (window.vixoAllGridItems || []).map(function (g) {
      return g.namespace;
    })
  );
  const fresh = extraPages.filter(function (g) {
    return g.namespace && !existing.has(g.namespace);
  });
  if (fresh.length) appendAllGames(fresh, false);

  document.dispatchEvent(
    new CustomEvent("vixo:games-loaded", { detail: window.vixoGames })
  );
}

async function loadHomepageExtrasInBackground(seedPages) {
  try {
    const extraPageCount = Math.max(0, INITIAL_MAIN_PAGES - QUICK_LOAD_PAGES);
    if (!extraPageCount) return;

    const extraPages = await fetchGamePixPageRange(
      QUICK_LOAD_PAGES + 1,
      extraPageCount,
      null
    );
    if (!extraPages.length) return;

    applyHomepageExtras(seedPages, extraPages);
  } catch (err) {
    console.warn("Background homepage load:", err);
  }
}

async function loadGamePixHomepage() {
  const trendingGrid = document.getElementById("gamepix-trending");
  const newGrid = document.getElementById("gamepix-new");
  const allGrid = document.getElementById("gamepix-all");
  const categoryRoot = document.getElementById("category-sections");

  if (!trendingGrid) return;

  activePageSize = GAMEPIX_PAGE_SIZE;

  if (isLocalFilePage()) {
    showLoadError(
      trendingGrid,
      "You opened the HTML file directly. Close this tab and run start.bat — the site must open at http://localhost:5500"
    );
    if (newGrid) newGrid.innerHTML = "";
    if (allGrid) allGrid.innerHTML = "";
    return;
  }

  setGridMessage(trendingGrid, "Loading games…", "loading");
  if (newGrid) setGridMessage(newGrid, "Loading new games…", "loading");
  if (allGrid) setGridMessage(allGrid, "Loading library…", "loading");

  try {
    const feedOk = await ensureFeedConnection();
    if (!feedOk) {
      throw new Error(
        "Could not reach GamePix. Check your internet connection, firewall, or ad blocker."
      );
    }

    let allPages = await fetchGamePixPageRange(1, QUICK_LOAD_PAGES, null);
    if (!allPages.length) {
      throw new Error("No games returned from the feed.");
    }

    applyHomepageEssentials(allPages);
    loadHomepageExtrasInBackground(allPages);
  } catch (err) {
    console.error("GamePix load error:", err);
    showLoadError(
      trendingGrid,
      err.message ||
        "Could not load games. Run start.bat and open http://localhost:5500 — then click Try again."
    );
    if (newGrid) newGrid.innerHTML = "";
    if (allGrid) allGrid.innerHTML = "";
    if (categoryRoot) categoryRoot.innerHTML = "";
  }
}

window.vixoSearchHelpers = {
  playUrl: getPlayPageUrl,
  getGamePlayPath: function (item) {
    return getPlayPageUrl(item);
  },
  thumbUrl: function (item, width) {
    return gamePixImageUrl(item.banner_image || item.image, width || 96);
  },
  categoryLabel: formatCategory,
};

window.createGameCard = createGameCard;
window.renderGameCards = renderGameCards;
window.setSectionCount = setSectionCount;

function updateGameCardLinksToPretty() {
  if (!window.vixoRoutes || window.vixoUsePrettyPaths !== true) return;
  const cards = document.querySelectorAll(".game-card[data-namespace]");
  cards.forEach(function (card) {
    const slug = card.dataset.namespace;
    if (!slug) return;
    const href = window.vixoRoutes.getGamePlayPath({ namespace: slug });
    // Update both the image overlay link and the title link.
    card.querySelectorAll("a.game-card-link, h3 a").forEach(function (a) {
      a.href = href;
    });
  });
}

document.addEventListener("vixo:routes-ready", function (ev) {
  // With pretty URLs as the default, no need to patch hrefs.
});

// Personal sections (favorites/recent/play again) may render after our initial probe.
// Re-run on those events too.
document.addEventListener("vixo:games-loaded", function () {
  // With pretty URLs as the default, no need to patch hrefs.
});
document.addEventListener("vixo:recent-updated", function () {
  // With pretty URLs as the default, no need to patch hrefs.
});
document.addEventListener("vixo:favorites-updated", function () {
  // With pretty URLs as the default, no need to patch hrefs.
});
document.addEventListener("vixo:category-mounted", function () {
  // With pretty URLs as the default, no need to patch hrefs.
});

window.vixoGamePix = {
  fetchPage: fetchGamePixGamesSafe,
  fetchCategoryGames: fetchCategoryGames,
  fetchPageRange: fetchGamePixPageRange,
  appendGameCards: appendGameCards,
  renderGameCards: renderGameCards,
  categoryCardOptions: categoryCardOptions,
  dedupeGames: dedupeGames,
  formatCategory: formatCategory,
  getCategoryPageUrl: getCategoryPageUrl,
  PAGE_SIZE: GAMEPIX_PAGE_SIZE,
};

document.addEventListener("DOMContentLoaded", function () {
  loadGamePixHomepage();

  const loadMoreBtn = document.getElementById("load-more");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", loadMoreGames);
  }

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  var host = window.location.hostname;
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1";
    if (isLocal) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          reg.unregister();
        });
      });
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          keys.forEach(function (key) {
            caches.delete(key);
          });
        });
      }
    } else {
      navigator.serviceWorker.register("sw.js?v=24").then(function (reg) {
        reg.update();
      }).catch(function () {});
    }
  }
});
