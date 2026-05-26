/**
 * GamePix JSON feed → VixoGames homepage
 */

const GAMEPIX_SID = "1INOM";
const GAMEPIX_PAGE_SIZE = 48;
const GAMEPIX_PAGE_SIZE_FALLBACK = 24;
const GAMEPIX_FEED_BASE = "https://feeds.gamepix.com/v2/json";
const FETCH_CHUNK_SIZE = 4;
const FETCH_TIMEOUT_MS = 25000;

/** Main catalog pages (loaded in two phases for fast first paint) */
const INITIAL_MAIN_PAGES = 16;
const QUICK_LOAD_PAGES = 5;
/** Per category row on homepage */
const CATEGORY_PAGES_EACH = 3;
const CATEGORY_BATCH_SIZE = 2;

let activePageSize = GAMEPIX_PAGE_SIZE;
const TRENDING_SHOW = 72;
const NEW_SHOW = 56;
const CATEGORY_INITIAL_SHOW = 12;
const CATEGORY_LOAD_STEP = 12;
const INITIAL_ALL_SHOW = 180;

const categorySectionState = new Map();

const HOME_CATEGORIES = [
  { slug: "multiplayer", title: "Multiplayer", icon: "👥", desc: "Play online with others" },
  { slug: "battle", title: "Action & battle", icon: "⚔️", desc: "Fast combat and fights" },
  { slug: "match-3", title: "Puzzle & match", icon: "🧩", desc: "Match, think, solve" },
  { slug: "arcade", title: "Arcade classics", icon: "🕹️", desc: "Quick arcade fun" },
  { slug: "simulation", title: "Simulation", icon: "🎮", desc: "Drive, build, simulate" },
  { slug: "2048", title: "Brain & logic", icon: "🧠", desc: "Numbers and strategy" },
  { slug: "kids", title: "Kids & casual", icon: "🌈", desc: "Easy games for everyone" },
  { slug: "stickman", title: "Stickman", icon: "🏃", desc: "Stick figure action" },
  { slug: "memory", title: "Memory & brain", icon: "💡", desc: "Remember and match" },
  { slug: "sports", title: "Sports", icon: "⚽", desc: "Football, racing and more" },
  { slug: "racing", title: "Racing", icon: "🏎️", desc: "Speed and driving games" },
  { slug: "shooter", title: "Shooter", icon: "🎯", desc: "Aim and fire" },
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

async function fetchGamePixGamesSafe(page, category) {
  try {
    return await fetchGamePixGames(page, category);
  } catch (err) {
    console.warn("GamePix page skipped:", page, category || "all", err.message || err);
    return { items: [], nextUrl: null };
  }
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

  for (let offset = 0; offset < pageCount; offset += FETCH_CHUNK_SIZE) {
    const chunkCount = Math.min(FETCH_CHUNK_SIZE, pageCount - offset);
    const fetches = [];
    for (let i = 0; i < chunkCount; i++) {
      fetches.push(fetchGamePixGamesSafe(startPage + offset + i, category));
    }
    const results = await Promise.all(fetches);
    results.forEach(function (res) {
      merged.push.apply(merged, res.items);
    });
  }

  return dedupeGames(merged);
}

async function fetchAllCategorySections() {
  const results = [];

  for (let i = 0; i < HOME_CATEGORIES.length; i += CATEGORY_BATCH_SIZE) {
    const batch = HOME_CATEGORIES.slice(i, i + CATEGORY_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async function (cat) {
        const items = await fetchGamePixPageRange(1, CATEGORY_PAGES_EACH, cat.slug);
        return { config: cat, items: items };
      })
    );
    results.push.apply(results, batchResults);
  }

  return results;
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
  const { large = false, tag = null, showFavorite = true } = options;
  const playUrl = getPlayPageUrl(item);
  const imageSrc = gamePixImageUrl(item.banner_image || item.image, large ? 400 : 280);
  const category = formatCategory(item.category);
  const rating = formatRating(item.quality_score);

  const article = document.createElement("article");
  article.className = "game-card";
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

  const cardLink = document.createElement("a");
  cardLink.href = playUrl;
  cardLink.className = "game-card-link";
  cardLink.setAttribute("aria-label", `Play ${item.title}`);

  const img = document.createElement("img");
  img.className = "game-thumb-img";
  img.src = imageSrc;
  img.alt = item.title || "Game";
  img.loading = "lazy";
  img.decoding = "async";

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
    const tagEl = document.createElement("span");
    tagEl.className = `game-tag ${tag}`;
    tagEl.textContent = tag === "hot" ? "Hot" : "New";
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
    const res = await fetchGamePixGamesSafe(state.nextPage, slug);
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
        <h2>${config.icon} ${config.title}</h2>
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

function mountLazyCategorySections(categoryResults) {
  const categoryRoot = document.getElementById("category-sections");
  if (!categoryRoot) return;

  categoryRoot.innerHTML = "";
  const pending = categoryResults.filter(function (r) {
    return r.items.length >= 4;
  });

  if (!pending.length) return;

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const placeholder = entry.target;
        if (placeholder.dataset.lazyLoaded === "1") return;
        const slug = placeholder.dataset.lazyCategory;
        const result = pending.find(function (r) {
          return r.config.slug === slug;
        });
        if (!result) return;
        placeholder.dataset.lazyLoaded = "1";
        const section = createCategorySection(result.config, result.items);
        placeholder.replaceWith(section);
        observer.unobserve(placeholder);
        document.dispatchEvent(new CustomEvent("vixo:category-mounted"));
      });
    },
    { rootMargin: "280px 0px", threshold: 0.01 }
  );

  pending.forEach(function (result) {
    const placeholder = createCategoryPlaceholder(result.config);
    categoryRoot.appendChild(placeholder);
    observer.observe(placeholder);
  });
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

  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${config.icon} ${config.title}</h2>
        <p class="section-desc">${config.desc}</p>
      </div>
      <span class="see-all section-count-inline">Showing ${initialCount} games</span>
    </div>
    <div class="game-grid game-grid--dense game-grid--row" data-grid></div>
    <div class="load-more-wrap category-load-more-wrap">
      <button type="button" class="btn btn-primary btn-load-more btn-load-more--category" data-category-slug="${config.slug}">
        Load more games
      </button>
    </div>
  `;

  const grid = section.querySelector("[data-grid]");
  const initial = items.slice(0, initialCount);
  appendGameCards(grid, initial, categoryCardOptions, 0);

  const state = categorySectionState.get(config.slug);
  state.shown = initial.length;

  const btn = section.querySelector(".btn-load-more--category");
  if (btn) {
    btn.addEventListener("click", function () {
      loadMoreCategoryGames(config.slug);
    });
  }

  updateCategorySectionUi(config.slug);

  return section;
}

function updateHeroFromGame(item) {
  const titleEl = document.getElementById("hero-title");
  const descEl = document.getElementById("hero-desc");
  const playEl = document.getElementById("hero-play");
  const heroLink = document.getElementById("hero-card-link");
  const thumbEl = document.getElementById("hero-thumb");
  const badge = document.getElementById("hero-badge");

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
    thumbEl.appendChild(img);
  }

  if (badge) badge.textContent = `Featured · ${formatCategory(item.category)}`;
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

function applyHomepageCatalog(allPages, categoryResults) {
  const trendingGrid = document.getElementById("gamepix-trending");
  const newGrid = document.getElementById("gamepix-new");
  const categoryRoot = document.getElementById("category-sections");

  if (!allPages.length) return false;

  const featured = allPages[0];
  if (featured) updateHeroFromGame(featured);

  const trending = allPages.slice(0, TRENDING_SHOW);
  renderGameCards(trendingGrid, trending, function (item, index) {
    return { tag: index < 3 ? "hot" : null, large: index === 0, showFavorite: true };
  });
  setSectionCount("count-trending", trending.length);

  const newGames = allPages.slice(TRENDING_SHOW, TRENDING_SHOW + NEW_SHOW);
  if (newGrid) {
    const newList =
      newGames.length >= 12
        ? newGames
        : allPages.slice(
            Math.floor(TRENDING_SHOW / 2),
            Math.floor(TRENDING_SHOW / 2) + NEW_SHOW
          );
      renderGameCards(newGrid, newList, function (item, index) {
        return { tag: index < 2 ? "new" : null, large: index === 0, showFavorite: true };
      });
    setSectionCount("count-new", newGrid.querySelectorAll(".game-card").length);
  }

  if (categoryRoot) {
    mountLazyCategorySections(categoryResults);
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

  const library = dedupeGames(
    allPages.concat(
      categoryResults.flatMap(function (r) {
        return r.items;
      })
    )
  );

  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.textContent = `${library.length}+`;

  const statCat = document.getElementById("stat-categories");
  if (statCat) statCat.textContent = String(HOME_CATEGORIES.length);

  window.vixoGames = library;

  document.dispatchEvent(
    new CustomEvent("vixo:games-loaded", { detail: window.vixoGames })
  );

  return true;
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
  if (categoryRoot) {
    categoryRoot.innerHTML =
      '<p class="category-loading-msg">Loading category rows…</p>';
  }

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

    applyHomepageCatalog(allPages, []);

    const extraPageCount = Math.max(0, INITIAL_MAIN_PAGES - QUICK_LOAD_PAGES);
    const [extraPages, categoryResults] = await Promise.all([
      extraPageCount
        ? fetchGamePixPageRange(QUICK_LOAD_PAGES + 1, extraPageCount, null)
        : Promise.resolve([]),
      fetchAllCategorySections(),
    ]);

    if (extraPages.length) {
      allPages = dedupeGames(allPages.concat(extraPages));
    }

    applyHomepageCatalog(allPages, categoryResults);
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

document.addEventListener("DOMContentLoaded", function () {
  loadGamePixHomepage();

  const loadMoreBtn = document.getElementById("load-more");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", loadMoreGames);
  }

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
});
