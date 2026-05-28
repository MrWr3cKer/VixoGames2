/**
 * Homepage extras: favorites, recent, play again, library sort/filter, search hints
 */
document.addEventListener("DOMContentLoaded", function () {
  initPreferenceOnboarding();
  initFavoriteDelegation();
  initLibraryControls();
  initPersonalSections();
  initForYouSection();
  initRandomHeroButton();
  document.addEventListener("vixo:games-loaded", function () {
    if (window.vixoStorage?.upgradeStoredRefs()) {
      document.dispatchEvent(new CustomEvent("vixo:recent-updated"));
      document.dispatchEvent(new CustomEvent("vixo:favorites-updated"));
    }
    initPersonalSections();
    renderForYouGames();
    reorderCategorySectionsByPreference();
    syncAllFavoriteButtons();
  });
  document.addEventListener("vixo:favorites-updated", function () {
    initPersonalSections();
    renderForYouGames();
    syncAllFavoriteButtons();
  });
  document.addEventListener("vixo:recent-updated", function () {
    initPersonalSections();
    renderForYouGames();
  });
  document.addEventListener("vixo:category-mounted", syncAllFavoriteButtons);
  document.addEventListener("vixo:category-mounted", reorderCategorySectionsByPreference);
  document.addEventListener("vixo:preferences-updated", function () {
    renderForYouGames();
    reorderCategorySectionsByPreference();
  });
  document.addEventListener("vixo:play-stats-updated", renderForYouGames);
});

function initRandomHeroButton() {
  const btn = document.getElementById("hero-random");
  if (!btn) return;
  btn.addEventListener("click", function () {
    const helpers = window.vixoSearchHelpers;
    const list =
      (window.vixoGames || []).length > 0
        ? window.vixoGames
        : window.vixoAllGridItems || [];
    if (!helpers || !helpers.playUrl || !list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    const url = helpers.playUrl(pick);
    if (url) window.location.href = url;
  });
}

function initPreferenceOnboarding() {
  const prefs = window.vixoPersonalization;
  if (!prefs || !prefs.shouldShowOnboarding || !prefs.shouldShowOnboarding()) return;
  if (!document.body.classList.contains("home-crazy")) return;

  const modal = document.createElement("div");
  modal.id = "pref-modal";
  modal.className = "pref-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");

  const categories = (window.VIXO_CATEGORIES || []).slice(0, 16);
  modal.innerHTML = `
    <div class="pref-modal__backdrop" data-pref-close tabindex="-1" aria-hidden="true"></div>
    <div class="pref-modal__panel" role="dialog" aria-modal="true" aria-labelledby="pref-modal-title">
      <button type="button" class="pref-modal__close" data-pref-close aria-label="Close">✕</button>
      <h2 id="pref-modal-title" class="pref-modal__title">Choose your favorite genres</h2>
      <p class="pref-modal__lead">Pick up to 5. We will use this to show better recommendations.</p>
      <p class="pref-modal__counter" id="pref-counter">0 / 5 selected</p>
      <div class="pref-modal__grid" id="pref-grid"></div>
      <div class="pref-modal__actions">
        <button type="button" class="btn btn-ghost" data-pref-close>Skip</button>
        <button type="button" class="btn btn-primary" id="pref-save">Save choices</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const grid = modal.querySelector("#pref-grid");
  const counter = modal.querySelector("#pref-counter");
  const saveBtn = modal.querySelector("#pref-save");
  const selected = new Set();

  function syncSelectionUi() {
    const count = selected.size;
    counter.textContent = `${count} / 5 selected`;
    saveBtn.disabled = count === 0;
    grid.querySelectorAll(".pref-chip").forEach(function (btn) {
      btn.classList.toggle("is-selected", selected.has(btn.dataset.slug));
    });
  }

  categories.forEach(function (cat) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pref-chip";
    btn.dataset.slug = cat.slug;
    btn.textContent = cat.title;
    btn.addEventListener("click", function () {
      const slug = btn.dataset.slug;
      if (selected.has(slug)) {
        selected.delete(slug);
      } else if (selected.size < 5) {
        selected.add(slug);
      }
      syncSelectionUi();
    });
    grid.appendChild(btn);
  });

  function close(save) {
    if (save) {
      prefs.savePreferredGenres(Array.from(selected));
    } else {
      prefs.dismissOnboarding();
    }
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pref-modal-open");
  }

  modal.querySelectorAll("[data-pref-close]").forEach(function (el) {
    el.addEventListener("click", function () {
      close(false);
    });
  });
  saveBtn.addEventListener("click", function () {
    close(true);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) close(false);
  });

  syncSelectionUi();
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("pref-modal-open");
}

function ensureForYouElements() {
  let section = document.getElementById("for-you");
  if (section) {
    return {
      section: section,
      grid: document.getElementById("for-you-grid"),
    };
  }
  const anchor = document.getElementById("trending");
  if (!anchor) return { section: null, grid: null };

  section = document.createElement("section");
  section.id = "for-you";
  section.className = "game-section game-section--alt is-hidden";
  section.dataset.section = "";
  section.innerHTML = `
    <div class="section-head section-head--hub">
      <h2>Picked for you</h2>
      <span class="section-desc">Based on your favorite genres and play history.</span>
    </div>
    <div class="game-grid game-grid--dense game-grid--row game-grid--hub" id="for-you-grid" aria-live="polite"></div>
  `;
  anchor.parentNode.insertBefore(section, anchor);
  return {
    section: section,
    grid: section.querySelector("#for-you-grid"),
  };
}

function initForYouSection() {
  renderForYouGames();
}

function renderForYouGames() {
  const prefs = window.vixoPersonalization;
  if (!prefs || typeof createGameCard !== "function") return;

  const els = ensureForYouElements();
  const section = els.section;
  const grid = els.grid;
  if (!section || !grid) return;

  const all = (window.vixoGames || []).slice();
  if (!all.length) {
    section.classList.add("is-hidden");
    return;
  }

  const recentSet = new Set(
    (window.vixoStorage?.getRecent?.() || []).map(function (r) {
      return r.namespace;
    })
  );
  const ranked = prefs
    .rankGames(all)
    .filter(function (g) {
      return !recentSet.has(g.namespace);
    })
    .slice(0, 14);

  if (!ranked.length) {
    section.classList.add("is-hidden");
    return;
  }

  section.classList.remove("is-hidden");
  renderGameCards(grid, ranked, function (item, index) {
    return {
      showFavorite: true,
      tag: index < 3 ? "hot" : null,
      eager: index < 2,
    };
  });
  syncAllFavoriteButtons();
}

function reorderCategorySectionsByPreference() {
  const prefs = window.vixoPersonalization;
  const top = prefs && prefs.getTopGenres ? prefs.getTopGenres(5) : [];
  if (!top.length) return;
  const root = document.getElementById("category-sections");
  if (!root) return;
  const bySlug = {};
  Array.from(root.children).forEach(function (el) {
    const slug = el.dataset.lazyCategory || el.dataset.categoryBlock;
    if (slug) bySlug[slug] = el;
  });
  top.forEach(function (slug) {
    const el = bySlug[slug];
    if (el) root.prepend(el);
  });
}

function initFavoriteDelegation() {
  document.body.addEventListener("click", function (e) {
    const btn = e.target.closest(".game-fav-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const card = btn.closest(".game-card");
    if (!card || !window.vixoStorage) return;
    const ns = card.dataset.namespace;
    if (!ns) return;
    const helpers = window.vixoSearchHelpers;
    const game = (window.vixoGames || []).find(function (g) {
      return g.namespace === ns;
    });
    const ref = game
      ? window.vixoStorage.gameRefFromItem(game)
      : {
          namespace: ns,
          title: card.querySelector("h3 a")?.textContent || "Game",
          category: card.dataset.category || "",
          playUrl: card.querySelector(".game-card-link")?.getAttribute("href") || "",
          thumb: card.querySelector(".game-thumb-img")?.getAttribute("src") || "",
        };
    window.vixoStorage.toggleFavorite(ref);
    syncFavoriteButton(btn, ns);
  });
}

function syncFavoriteButton(btn, namespace) {
  const on = window.vixoStorage && window.vixoStorage.isFavorite(namespace);
  btn.classList.toggle("is-active", on);
  btn.setAttribute("aria-label", on ? "Remove from favorites" : "Add to favorites");
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function syncAllFavoriteButtons() {
  document.querySelectorAll(".game-fav-btn").forEach(function (btn) {
    const card = btn.closest(".game-card");
    if (card?.dataset.namespace) syncFavoriteButton(btn, card.dataset.namespace);
  });
}

function resolveRefToGameItem(ref) {
  if (!ref) return null;

  const fromLib =
    window.vixoStorage && window.vixoStorage.findGameInLibrary(ref.namespace);
  if (fromLib) {
    return {
      namespace: fromLib.namespace,
      title: fromLib.title || ref.title,
      category: fromLib.category || ref.category,
      banner_image: fromLib.banner_image || fromLib.image,
      image: fromLib.image || fromLib.banner_image,
      quality_score:
        typeof fromLib.quality_score === "number"
          ? fromLib.quality_score
          : ref.quality,
      width: fromLib.width ?? ref.width,
      height: fromLib.height ?? ref.height,
      orientation: fromLib.orientation || ref.orientation,
    };
  }

  const thumb = ref.thumb || "";
  return {
    namespace: ref.namespace,
    title: ref.title,
    category: ref.category,
    banner_image: thumb,
    image: thumb,
    quality_score: ref.quality,
    width: ref.width,
    height: ref.height,
    orientation: ref.orientation,
  };
}

function renderRefCards(container, refs, emptyMsg) {
  if (!container) return;
  container.innerHTML = "";
  if (!refs.length) {
    container.innerHTML = '<p class="section-empty-msg">' + emptyMsg + "</p>";
    return;
  }
  refs.forEach(function (ref) {
    const item = resolveRefToGameItem(ref);
    if (!item || typeof createGameCard !== "function") return;
    container.appendChild(createGameCard(item, { showFavorite: true }));
  });
  syncAllFavoriteButtons();
}

function initPersonalSections() {
  if (!window.vixoStorage) return;

  const recent = window.vixoStorage.getRecent();
  const favs = window.vixoStorage.getFavorites();

  const recentSec = document.getElementById("recent-games");
  const recentGrid = document.getElementById("recent-grid");
  if (recentSec && recentGrid) {
    if (recent.length) {
      recentSec.classList.remove("is-hidden");
      renderRefCards(
        recentGrid,
        recent.slice(0, 12),
        "Games you play will show up here."
      );
    } else {
      recentSec.classList.add("is-hidden");
    }
  }

  const favSec = document.getElementById("favorites");
  const favGrid = document.getElementById("favorites-grid");
  if (favSec && favGrid) {
    if (favs.length) {
      favSec.classList.remove("is-hidden");
      renderRefCards(
        favGrid,
        favs,
        "Tap the heart on any game to save it here."
      );
    } else {
      favSec.classList.add("is-hidden");
    }
  }
}

function initLibraryControls() {
  const sortEl = document.getElementById("sort-all");
  const playersEl = document.getElementById("filter-players");
  const layoutEl = document.getElementById("filter-layout");

  function onChange() {
    applyAllGamesLibraryView();
  }

  if (sortEl) sortEl.addEventListener("change", onChange);
  if (playersEl) playersEl.addEventListener("change", onChange);
  if (layoutEl) layoutEl.addEventListener("change", onChange);
}

function applyAllGamesLibraryView() {
  const grid = document.getElementById("gamepix-all");
  if (!grid || typeof renderGameCards !== "function") return;

  let items = (window.vixoAllGridItems || []).slice();
  const sort = document.getElementById("sort-all")?.value || "popular";
  const players = document.getElementById("filter-players")?.value || "all";
  const layout = document.getElementById("filter-layout")?.value || "all";

  if (players === "multiplayer") {
    items = items.filter(isMultiplayerGame);
  } else if (players === "single") {
    items = items.filter(function (g) {
      return !isMultiplayerGame(g);
    });
  }

  if (layout === "portrait") {
    items = items.filter(function (g) {
      return getGameLayout(g) === "portrait";
    });
  } else if (layout === "landscape") {
    items = items.filter(function (g) {
      return getGameLayout(g) === "landscape";
    });
  }

  if (sort === "az") {
    items.sort(function (a, b) {
      return (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
    });
  } else if (sort === "category") {
    items.sort(function (a, b) {
      const ca = (a.category || "").localeCompare(b.category || "");
      if (ca !== 0) return ca;
      return (a.title || "").localeCompare(b.title || "");
    });
  } else {
    items.sort(function (a, b) {
      return (b.quality_score || 0) - (a.quality_score || 0);
    });
  }

  renderGameCards(grid, items, { showFavorite: true });
  setSectionCount("count-all", items.length);
  syncAllFavoriteButtons();
}

function isMultiplayerGame(item) {
  const cat = (item.category || "").toLowerCase();
  const title = (item.title || "").toLowerCase();
  return cat === "multiplayer" || title.includes("multiplayer") || title.includes("2 player");
}

function getGameLayout(item) {
  const o = (item.orientation || "").toLowerCase();
  if (o === "portrait") return "portrait";
  if (o === "landscape") return "landscape";
  const w = Number(item.width);
  const h = Number(item.height);
  if (w > 0 && h > 0) return h > w ? "portrait" : "landscape";
  return "landscape";
}

function showSearchEmptySuggestions(query) {
  const box = document.getElementById("search-suggestions");
  if (!box) return;

  if (!query) {
    box.classList.add("is-hidden");
    box.innerHTML = "";
    return;
  }

  const chips = [
    { label: "Puzzle", filter: "match-3", href: "#cat-match-3" },
    { label: "Action", filter: "battle", href: "#cat-battle" },
    { label: "Multiplayer", filter: "multiplayer", href: "#cat-multiplayer" },
    { label: "Arcade", filter: "arcade", href: "#cat-arcade" },
  ];

  box.classList.remove("is-hidden");
  box.innerHTML =
    '<p class="search-suggestions-title">No matches — try browsing:</p><div class="search-suggestions-chips"></div>';
  const wrap = box.querySelector(".search-suggestions-chips");

  chips.forEach(function (c) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-chip";
    btn.textContent = c.label;
    btn.addEventListener("click", function () {
      document.querySelectorAll(".cat-chip").forEach(function (chip) {
        chip.classList.toggle("active", chip.dataset.filter === c.filter);
      });
      if (typeof filterGamesByChip === "function") {
        filterGamesByChip(c.filter);
      }
      const target = document.querySelector(c.href);
      if (target) scrollToSection(target);
      const input = document.getElementById("search-input");
      if (input) {
        input.value = "";
        filterBySearch("");
      }
      box.classList.add("is-hidden");
    });
    wrap.appendChild(btn);
  });
}
