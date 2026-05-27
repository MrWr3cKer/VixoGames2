/**
 * Homepage extras: favorites, recent, play again, library sort/filter, search hints
 */
document.addEventListener("DOMContentLoaded", function () {
  initFavoriteDelegation();
  initLibraryControls();
  initPersonalSections();
  initRandomHeroButton();
  document.addEventListener("vixo:games-loaded", function () {
    if (window.vixoStorage?.upgradeStoredRefs()) {
      document.dispatchEvent(new CustomEvent("vixo:recent-updated"));
      document.dispatchEvent(new CustomEvent("vixo:favorites-updated"));
    }
    initPersonalSections();
    syncAllFavoriteButtons();
  });
  document.addEventListener("vixo:favorites-updated", function () {
    initPersonalSections();
    syncAllFavoriteButtons();
  });
  document.addEventListener("vixo:recent-updated", initPersonalSections);
  document.addEventListener("vixo:category-mounted", syncAllFavoriteButtons);
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

  const playAgainSec = document.getElementById("play-again");
  const playAgainGrid = document.getElementById("play-again-grid");
  if (playAgainSec && playAgainGrid && recent[0]) {
    playAgainSec.classList.remove("is-hidden");
    renderRefCards(playAgainGrid, [recent[0]], "");
  } else if (playAgainSec) {
    playAgainSec.classList.add("is-hidden");
  }

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
