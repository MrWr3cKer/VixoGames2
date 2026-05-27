/**
 * categories.html — browse all categories (tiles) or single-category game list
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
    const viewAll =
      !slug ||
      slug === "browse" ||
      slug === "all-categories" ||
      params.get("view") === "all";

    if (viewAll) {
      initCategoryBrowse();
      return;
    }

    initSingleCategoryPage(slug, (params.get("title") || "").trim());
  });

  function initCategoryBrowse() {
    document.title = "All categories – VixoGames";
    const browse = document.getElementById("category-browse-view");
    const games = document.getElementById("category-games-view");
    if (browse) browse.hidden = false;
    if (games) {
      games.hidden = true;
      games.classList.add("is-hidden");
    }

    const grid = document.getElementById("category-tiles-grid");
    const list = window.VIXO_CATEGORIES || [];
    if (!grid || !list.length) {
      if (grid) {
        grid.innerHTML =
          '<p class="category-page-status">No categories found. <a href="index.html">Back to home</a>.</p>';
      }
      return;
    }

    const catalog = window.vixoCategoryCatalog;
    if (!catalog || !catalog.filterCategoriesWithGames) {
      renderCategoryTiles(grid, list);
      bindCategoryBrowseSearch(grid, list);
      loadCategoryTileThumbs(grid, list);
      return;
    }

    grid.innerHTML =
      '<p class="category-page-status">Finding categories with games…</p>';

    catalog
      .filterCategoriesWithGames(list, function (done, total) {
        grid.innerHTML =
          '<p class="category-page-status">Checking categories (' +
          done +
          "/" +
          total +
          ")…</p>";
      })
      .then(function (valid) {
        document.dispatchEvent(
          new CustomEvent("vixo:valid-categories-ready", {
            detail: { slugs: valid.map(function (c) { return c.slug; }) },
          })
        );
        if (!valid.length) {
          grid.innerHTML =
            '<p class="category-page-status">No categories with games right now. <a href="index.html">Back to home</a>.</p>';
          return;
        }
        renderCategoryTiles(grid, valid);
        bindCategoryBrowseSearch(grid, valid);
        loadCategoryTileThumbs(grid, valid);
      })
      .catch(function () {
        renderCategoryTiles(grid, list);
        bindCategoryBrowseSearch(grid, list);
        loadCategoryTileThumbs(grid, list);
      });
  }

  function renderCategoryTiles(grid, list) {
    grid.innerHTML = "";
    const api = window.vixoGamePix;

    list.forEach(function (cat) {
      const href = api
        ? api.getCategoryPageUrl(cat)
        : "categories.html?cat=" + encodeURIComponent(cat.slug);

      const tile = document.createElement("a");
      tile.className = "category-tile";
      tile.href = href;
      tile.dataset.categorySlug = cat.slug;

      const cover = document.createElement("span");
      cover.className = "category-tile__cover";

      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "category-tile__img";
      img.hidden = true;

      const fallback = document.createElement("span");
      fallback.className = "category-tile__fallback";
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = (cat.title || cat.slug).charAt(0).toUpperCase();

      cover.appendChild(img);
      cover.appendChild(fallback);

      const label = document.createElement("span");
      label.className = "category-tile__label";
      label.textContent = cat.title || cat.slug;

      tile.appendChild(cover);
      tile.appendChild(label);
      grid.appendChild(tile);
    });
  }

  function bindCategoryBrowseSearch(grid, list) {
    const input = document.getElementById("category-browse-search");
    if (!input) return;

    input.addEventListener("input", function () {
      const q = input.value.trim().toLowerCase();
      grid.querySelectorAll(".category-tile").forEach(function (tile) {
        const slug = tile.dataset.categorySlug || "";
        const label = (tile.textContent || "").toLowerCase();
        const match = !q || slug.indexOf(q) !== -1 || label.indexOf(q) !== -1;
        tile.classList.toggle("is-hidden", !match);
      });
    });
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

  async function buildThumbMap() {
    const map = {};

    function addGame(game) {
      if (!game || !game.category) return;
      const key = String(game.category).toLowerCase();
      if (!map[key]) map[key] = game;
    }

    (window.vixoGames || []).forEach(addGame);

    const api = window.vixoGamePix;
    if (api && Object.keys(map).length < 30) {
      try {
        const pages = await api.fetchPageRange(1, 5, null);
        pages.forEach(addGame);
      } catch (err) {
        console.warn("Category thumb prefetch:", err);
      }
    }

    return map;
  }

  async function loadCategoryTileThumbs(grid, list) {
    const thumbMap = await buildThumbMap();
    const api = window.vixoGamePix;
    const tiles = grid.querySelectorAll(".category-tile");

    tiles.forEach(function (tile) {
      const slug = tile.dataset.categorySlug;
      const img = tile.querySelector(".category-tile__img");
      if (!slug || !img) return;

      const game = thumbMap[slug];
      if (game) {
        applyThumbToTile(tile, img, game);
        return;
      }

      if (!api || !("IntersectionObserver" in window)) {
        fetchThumbForSlug(slug, tile, img);
        return;
      }

      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            io.unobserve(entry.target);
            fetchThumbForSlug(slug, tile, img);
          });
        },
        { rootMargin: "120px" }
      );
      io.observe(tile);
    });
  }

  function applyThumbToTile(tile, img, game) {
    const src = gamePixImageUrl(game.banner_image || game.image, 360);
    if (!src) return;
    img.src = src;
    img.onload = function () {
      img.hidden = false;
      tile.classList.add("has-thumb");
    };
  }

  async function fetchThumbForSlug(slug, tile, img) {
    const api = window.vixoGamePix;
    if (!api) return;
    try {
      const items = await api.fetchCategoryGames(slug, 1);
      if (items[0]) applyThumbToTile(tile, img, items[0]);
    } catch (err) {
      console.warn("Category tile thumb:", slug, err);
    }
  }

  function initSingleCategoryPage(slug, titleParam) {
    const browse = document.getElementById("category-browse-view");
    const games = document.getElementById("category-games-view");
    if (browse) {
      browse.hidden = true;
    }
    if (games) {
      games.hidden = false;
      games.classList.remove("is-hidden");
    }

    const meta = resolveCategoryMeta(slug, titleParam);
    state.slug = slug;
    state.title = meta.title;
    state.desc = meta.desc;

    applyPageMeta();
    bindLoadMore();
    loadCategoryGames();
  }

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
