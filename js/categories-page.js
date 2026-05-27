/**
 * Category listing page — many games in one category (same window).
 */
(function () {
  const GRID_STEP = 48;
  const INITIAL_REMOTE_PAGES = 8;
  const REMOTE_PAGES_PER_LOAD = 4;

  const CATEGORY_FALLBACKS = {
    girls: ["dress-up", "beauty", "princess", "casual"],
    boys: ["battle", "shooting", "racing", "arcade"],
    puzzle: ["match-3", "puzzle"],
    brain: ["match-3", "puzzle"],
  };

  const state = {
    slug: "",
    title: "",
    desc: "",
    allItems: [],
    shown: 0,
    remotePage: 1,
    remoteDone: false,
    loadingRemote: false,
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.body.classList.contains("page-category")) return;

    if (window.history && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    const params = new URLSearchParams(window.location.search);
    const slug = (params.get("cat") || "").trim().toLowerCase();
    const titleParam = (params.get("title") || "").trim();

    if (!slug) {
      window.location.replace("index.html");
      return;
    }

    const meta = resolveCategoryMeta(slug, titleParam);
    state.slug = slug;
    state.title = meta.title;
    state.desc = meta.desc;

    applyPageMeta();
    bindLoadMore();
    loadCategoryGames();
  });

  function resolveCategoryMeta(slug, titleParam) {
    const list = window.VIXO_CATEGORIES || [];
    const match = list.find(function (cat) {
      return cat.slug === slug;
    });

    if (match) {
      return {
        title: titleParam || match.title,
        desc: match.desc || "",
      };
    }

    const api = window.vixoGamePix;
    const formatted = api ? api.formatCategory(slug) : slug;
    return {
      title: titleParam || formatted,
      desc: "",
    };
  }

  function applyPageMeta() {
    document.title = state.title + " Games – VixoGames";

    const h1 = document.getElementById("category-page-title");
    const desc = document.getElementById("category-page-desc");
    const crumb = document.getElementById("category-breadcrumb-current");

    if (h1) h1.textContent = state.title;
    if (crumb) crumb.textContent = state.title;
    if (desc) {
      desc.textContent = state.desc || "Free browser games — play instantly, no download.";
    }
  }

  function bindLoadMore() {
    const btn = document.getElementById("category-load-more");
    if (!btn) return;
    btn.addEventListener("click", function () {
      revealMoreGames();
    });
  }

  async function loadCategoryGames() {
    const grid = document.getElementById("category-games-grid");
    const api = window.vixoGamePix;
    if (!grid || !api) {
      showStatus("Could not load games. Please refresh.");
      return;
    }

    showStatus("Loading games…");

    try {
      const items = await fetchCategoryCatalog(state.slug, INITIAL_REMOTE_PAGES);
      state.allItems = items;
      state.remotePage = INITIAL_REMOTE_PAGES + 1;
      state.remoteDone = items.length < INITIAL_REMOTE_PAGES * api.PAGE_SIZE * 0.5;

      if (!items.length) {
        showEmpty();
        return;
      }

      grid.innerHTML = "";
      grid.classList.remove("is-loading", "has-error");
      state.shown = 0;
      revealMoreGames(true);
    } catch (err) {
      console.warn("Category page load failed:", err);
      showStatus("Could not load games. Check your connection and try again.");
    }
  }

  async function fetchCategoryCatalog(slug, maxPages) {
    const api = window.vixoGamePix;
    if (!api) return [];

    if (slug === "all") {
      return api.fetchPageRange(1, maxPages, null);
    }

    let items = await api.fetchPageRange(1, maxPages, slug);
    if (items.length >= 8) return items;

    const fallbacks = CATEGORY_FALLBACKS[slug] || [];
    for (let i = 0; i < fallbacks.length && items.length < 8; i++) {
      const extra = await api.fetchPageRange(1, Math.min(4, maxPages), fallbacks[i]);
      items = api.dedupeGames(items.concat(extra));
    }

    return items;
  }

  async function fetchMoreRemotePages() {
    if (state.loadingRemote || state.remoteDone) return;
    const api = window.vixoGamePix;
    if (!api) return;

    state.loadingRemote = true;
    setLoadMoreBusy(true);

    try {
      const category = state.slug === "all" ? null : state.slug;
      const start = state.remotePage;
      const extra = await api.fetchPageRange(
        start,
        REMOTE_PAGES_PER_LOAD,
        category
      );

      state.remotePage += REMOTE_PAGES_PER_LOAD;

      if (!extra.length) {
        state.remoteDone = true;
      } else {
        state.allItems = api.dedupeGames(state.allItems.concat(extra));
        if (extra.length < REMOTE_PAGES_PER_LOAD * api.PAGE_SIZE * 0.4) {
          state.remoteDone = true;
        }
      }
    } catch (err) {
      console.warn("Category load more failed:", err);
    } finally {
      state.loadingRemote = false;
      setLoadMoreBusy(false);
    }
  }

  function revealMoreGames(isFirst) {
    const grid = document.getElementById("category-games-grid");
    const api = window.vixoGamePix;
    if (!grid || !api) return;

    const nextBatch = state.allItems.slice(state.shown, state.shown + GRID_STEP);
    if (nextBatch.length) {
      api.appendGameCards(grid, nextBatch, api.categoryCardOptions, state.shown);
      state.shown += nextBatch.length;
      updateCount();
      updateLoadMoreUi();
      return;
    }

    if (state.remoteDone) {
      updateLoadMoreUi();
      if (isFirst) showEmpty();
      return;
    }

    fetchMoreRemotePages().then(function () {
      revealMoreGames(isFirst);
    });
  }

  function updateCount() {
    const el = document.getElementById("category-page-count");
    if (!el) return;
    el.hidden = false;
    el.textContent =
      "Showing " +
      state.shown +
      (state.allItems.length > state.shown
        ? " of " + state.allItems.length + "+ games"
        : " games");
  }

  function updateLoadMoreUi() {
    const wrap = document.getElementById("category-load-wrap");
    const btn = document.getElementById("category-load-more");
    if (!wrap || !btn) return;

    const hasBuffered = state.shown < state.allItems.length;
    const canFetch = !state.remoteDone;
    const visible = hasBuffered || canFetch;

    wrap.hidden = !visible;
    btn.disabled = state.loadingRemote;

    if (!hasBuffered && !canFetch) {
      wrap.hidden = true;
    } else if (!hasBuffered && canFetch) {
      btn.textContent = state.loadingRemote ? "Loading…" : "Load more games";
    } else {
      btn.textContent = state.loadingRemote ? "Loading…" : "Show more games";
    }
  }

  function setLoadMoreBusy(busy) {
    const btn = document.getElementById("category-load-more");
    if (btn) {
      btn.disabled = busy;
      btn.textContent = busy ? "Loading…" : "Load more games";
    }
  }

  function showStatus(message) {
    const grid = document.getElementById("category-games-grid");
    if (grid) {
      grid.innerHTML = '<p class="category-page-status">' + message + "</p>";
    }
    const wrap = document.getElementById("category-load-wrap");
    if (wrap) wrap.hidden = true;
  }

  function showEmpty() {
    showStatus(
      'No games found in this category right now. <a href="index.html">Browse all games</a>.'
    );
    const count = document.getElementById("category-page-count");
    if (count) count.hidden = true;
  }
})();
