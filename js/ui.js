document.addEventListener("DOMContentLoaded", function () {
  initMainNav();

  const menuToggle = document.querySelector(".menu-toggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      const open = document.body.classList.toggle("nav-open");
      this.setAttribute("aria-expanded", open);
      if (open) {
        window.requestAnimationFrame(function () {
          const nav = document.querySelector(".main-nav");
          const active = nav?.querySelector(".nav-link.active");
          if (nav && active) moveNavIndicator(nav, active, true);
        });
      }
    });
  }

  document.querySelectorAll(".cat-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.querySelectorAll(".cat-chip").forEach(function (c) {
        c.classList.remove("active");
      });
      chip.classList.add("active");
      filterGamesByChip(chip.dataset.filter || "all");

      const slug = chip.dataset.filter;
      if (slug && slug !== "all" && slug !== "trending") {
        const target = document.getElementById("cat-" + slug);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  initSearchDropdown();

  document.addEventListener("vixo:games-loaded", function () {
    const active = document.querySelector(".cat-chip.active");
    if (active) filterGamesByChip(active.dataset.filter || "all");
    initNavScrollSpy();
    refreshSearchIndex();
  });

// If pretty paths become available after our initial link rendering,
// rebuild the search index so the dropdown opens clean `/games/<slug>` URLs.
document.addEventListener("vixo:routes-ready", function (ev) {
  if (!ev || !ev.detail || ev.detail.pretty !== true) return;
  // Wait a tick so gamepix/home can update hrefs to pretty URLs.
  window.requestAnimationFrame(function () {
    if (typeof refreshSearchIndex === "function") refreshSearchIndex();
  });
});

// Personal sections (favorites/recent/play again) can change after load.
["vixo:recent-updated", "vixo:favorites-updated", "vixo:category-mounted"].forEach(function (evt) {
  document.addEventListener(evt, function () {
    window.requestAnimationFrame(function () {
      if (typeof refreshSearchIndex === "function") refreshSearchIndex();
    });
  });
});
});

const SEARCH_DROPDOWN_LIMIT = 8;
let searchGamesIndex = [];
let searchHighlightIndex = -1;

function refreshSearchIndex() {
  const helpers = window.vixoSearchHelpers;
  const games = window.vixoGames || [];

  if (games.length && helpers) {
    searchGamesIndex = games.map(function (item) {
      return {
        title: item.title || "Untitled",
        titleLower: (item.title || "").toLowerCase(),
        category: (item.category || "").toLowerCase(),
        categoryLabel: helpers.categoryLabel(item.category),
        playUrl: helpers.playUrl(item),
        thumb: helpers.thumbUrl(item, 104),
      };
    });
    return;
  }

  searchGamesIndex = [];
  const seen = new Set();
  getAllHomeCards().forEach(function (card) {
    const link = card.querySelector(".game-card-link, h3 a");
    const img = card.querySelector(".game-thumb-img");
    if (!link) return;
    const playUrl = link.getAttribute("href") || "";
    if (!playUrl || seen.has(playUrl)) return;
    seen.add(playUrl);
    const title = (link.textContent || card.dataset.title || "").trim();
    searchGamesIndex.push({
      title: title,
      titleLower: title.toLowerCase(),
      category: (card.dataset.category || "").toLowerCase(),
      categoryLabel: formatSearchCategoryLabel(card.dataset.category),
      playUrl: playUrl,
      thumb: img ? img.getAttribute("src") : "",
    });
  });
}

function formatSearchCategoryLabel(slug) {
  if (!slug) return "Game";
  return slug
    .split("-")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function matchSearchGames(query) {
  if (!query) return [];

  return searchGamesIndex
    .filter(function (game) {
      return (
        game.titleLower.includes(query) ||
        game.category.includes(query)
      );
    })
    .sort(function (a, b) {
      const aStarts = a.titleLower.startsWith(query);
      const bStarts = b.titleLower.startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.titleLower.localeCompare(b.titleLower);
    });
}

function initSearchDropdown() {
  const input = document.getElementById("search-input");
  const dropdown = document.getElementById("search-dropdown");
  const list = document.getElementById("search-dropdown-list");
  const emptyEl = document.getElementById("search-dropdown-empty");
  const foot = document.getElementById("search-dropdown-foot");
  const moreBtn = document.getElementById("search-dropdown-more");

  if (!input || !dropdown || !list) return;

  const form = input.closest(".search");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      runSearch();
    });
  }

  function setDropdownOpen(open) {
    dropdown.hidden = !open;
    dropdown.classList.toggle("is-open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) searchHighlightIndex = -1;
  }

  function renderDropdown(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      setDropdownOpen(false);
      list.innerHTML = "";
      return;
    }

    const matches = matchSearchGames(q);
    const shown = matches.slice(0, SEARCH_DROPDOWN_LIMIT);
    searchHighlightIndex = shown.length ? 0 : -1;

    list.innerHTML = "";
    shown.forEach(function (game, index) {
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "search-dropdown-item" + (index === 0 ? " is-highlighted" : "");
      btn.setAttribute("role", "option");
      btn.id = "search-option-" + index;
      btn.dataset.playUrl = game.playUrl;

      const img = document.createElement("img");
      img.className = "search-dropdown-thumb";
      img.src = game.thumb || "";
      img.alt = "";
      img.width = 52;
      img.height = 52;
      img.loading = "lazy";
      img.decoding = "async";

      const body = document.createElement("span");
      body.className = "search-dropdown-body";

      const title = document.createElement("span");
      title.className = "search-dropdown-title";
      title.textContent = game.title;

      const meta = document.createElement("span");
      meta.className = "search-dropdown-meta";
      meta.textContent = game.categoryLabel;

      body.appendChild(title);
      body.appendChild(meta);
      btn.appendChild(img);
      btn.appendChild(body);

      btn.addEventListener("click", function () {
        window.location.href = game.playUrl;
      });

      btn.addEventListener("mouseenter", function () {
        highlightSearchOption(index);
      });

      li.appendChild(btn);
      list.appendChild(li);
    });

    if (emptyEl) {
      emptyEl.classList.toggle("is-hidden", matches.length > 0);
    }
    if (foot) {
      foot.classList.toggle("is-hidden", matches.length <= SEARCH_DROPDOWN_LIMIT);
    }
    if (moreBtn && matches.length > SEARCH_DROPDOWN_LIMIT) {
      moreBtn.textContent =
        "View all " + matches.length + " matches on page";
    }

    setDropdownOpen(true);
    if (searchHighlightIndex >= 0) {
      input.setAttribute(
        "aria-activedescendant",
        "search-option-" + searchHighlightIndex
      );
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function highlightSearchOption(index) {
    const items = list.querySelectorAll(".search-dropdown-item");
    if (!items.length) return;
    searchHighlightIndex = Math.max(0, Math.min(index, items.length - 1));
    items.forEach(function (el, i) {
      el.classList.toggle("is-highlighted", i === searchHighlightIndex);
    });
    input.setAttribute(
      "aria-activedescendant",
      "search-option-" + searchHighlightIndex
    );
  }

  function runSearch() {
    const query = input.value.trim().toLowerCase();
    filterBySearch(query);
    renderDropdown(input.value);
  }

  input.addEventListener("input", runSearch);

  input.addEventListener("focus", function () {
    if (input.value.trim()) runSearch();
  });

  input.addEventListener("keydown", function (e) {
    const items = list.querySelectorAll(".search-dropdown-item");
    if (!dropdown.classList.contains("is-open") || !items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightSearchOption(searchHighlightIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightSearchOption(searchHighlightIndex - 1);
    } else if (e.key === "Enter" && searchHighlightIndex >= 0) {
      e.preventDefault();
      const active = items[searchHighlightIndex];
      const url = active && active.dataset.playUrl;
      if (url) window.location.href = url;
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      input.blur();
    }
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search-wrap")) {
      setDropdownOpen(false);
    }
  });

  if (moreBtn) {
    moreBtn.addEventListener("click", function () {
      setDropdownOpen(false);
      const all = document.getElementById("all-games");
      if (all) {
        all.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  refreshSearchIndex();
}

let navScrollSpyObserver = null;
let navClickLockUntil = 0;
let navIndicatorPositioned = false;

function initMainNav() {
  const nav = document.querySelector(".main-nav");
  if (!nav) return;

  const indicator = nav.querySelector(".nav-indicator");
  const links = Array.from(nav.querySelectorAll(".nav-link"));
  if (!indicator || !links.length) return;

  function setActiveNav(link, instant) {
    links.forEach(function (l) {
      l.classList.toggle("active", l === link);
    });
    moveNavIndicator(nav, link, instant);
  }

  links.forEach(function (link) {
    link.addEventListener("click", function () {
      navClickLockUntil = Date.now() + 900;
      setActiveNav(link, false);
    });
  });

  const initial =
    links.find(function (l) {
      return l.getAttribute("href") === window.location.hash;
    }) || links[0];

  links.forEach(function (l) {
    l.classList.toggle("active", l === initial);
  });

  function placeInitialIndicator() {
    moveNavIndicator(nav, initial, true);
    navIndicatorPositioned = true;
  }

  placeInitialIndicator();
  requestAnimationFrame(function () {
    requestAnimationFrame(placeInitialIndicator);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(placeInitialIndicator);
  }

  window.addEventListener("resize", function () {
    const active = nav.querySelector(".nav-link.active");
    if (active) moveNavIndicator(nav, active, true);
  });

  initNavScrollSpy();
}

function moveNavIndicator(nav, activeLink, instant) {
  const indicator = nav.querySelector(".nav-indicator");
  if (!indicator || !activeLink) return;

  const useInstant = instant || !navIndicatorPositioned;
  if (useInstant) {
    indicator.classList.add("is-instant");
  } else {
    indicator.classList.remove("is-instant");
  }

  const navRect = nav.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();

  indicator.style.left = linkRect.left - navRect.left + "px";
  indicator.style.top = linkRect.top - navRect.top + "px";
  indicator.style.width = linkRect.width + "px";
  indicator.style.height = linkRect.height + "px";
  indicator.classList.add("is-ready");

  if (useInstant) {
    void indicator.offsetHeight;
    indicator.classList.remove("is-instant");
  }
}

function initNavScrollSpy() {
  const nav = document.querySelector(".main-nav");
  if (!nav) return;

  const links = Array.from(nav.querySelectorAll(".nav-link"));
  const sections = links
    .map(function (link) {
      const id = (link.getAttribute("href") || "").replace("#", "");
      const el = id ? document.getElementById(id) : null;
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  if (navScrollSpyObserver) {
    navScrollSpyObserver.disconnect();
  }

  let scrollSpySnapFirst = true;

  navScrollSpyObserver = new IntersectionObserver(
    function (entries) {
      if (Date.now() < navClickLockUntil) return;

      const visible = entries
        .filter(function (e) {
          return e.isIntersecting;
        })
        .sort(function (a, b) {
          return b.intersectionRatio - a.intersectionRatio;
        });

      if (!visible.length) return;

      const id = visible[0].target.id;
      const match = sections.find(function (s) {
        return s.el.id === id;
      });
      if (!match) return;

      const snap = scrollSpySnapFirst;
      scrollSpySnapFirst = false;

      sections.forEach(function (s) {
        s.link.classList.toggle("active", s.link === match.link);
      });
      moveNavIndicator(nav, match.link, snap);
    },
    {
      root: null,
      rootMargin: "-15% 0px -55% 0px",
      threshold: [0.1, 0.25, 0.4],
    }
  );

  sections.forEach(function (s) {
    navScrollSpyObserver.observe(s.el);
  });
}

function getAllHomeCards() {
  return document.querySelectorAll(
    ".home-main .game-card, #category-sections .game-card"
  );
}

function filterBySearch(query) {
  const emptyWrap = document.getElementById("search-empty-wrap");
  const cards = getAllHomeCards();
  let visible = 0;

  if (!query) {
    cards.forEach(function (card) {
      card.classList.remove("is-search-hidden");
    });
    document.querySelectorAll("[data-section], .game-section--category").forEach(function (sec) {
      sec.classList.remove("is-section-hidden");
    });
    if (emptyWrap) emptyWrap.classList.add("is-hidden");
    document.querySelectorAll(".user-section").forEach(function (sec) {
      sec.classList.remove("is-section-hidden");
    });
    if (typeof initPersonalSections === "function") initPersonalSections();
    const active = document.querySelector(".cat-chip.active");
    if (active) filterGamesByChip(active.dataset.filter || "all");
    const dropdown = document.getElementById("search-dropdown");
    if (dropdown) {
      dropdown.hidden = true;
      dropdown.classList.remove("is-open");
    }
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.setAttribute("aria-expanded", "false");
    return;
  }

  document.querySelectorAll(".user-section").forEach(function (sec) {
    sec.classList.add("is-section-hidden");
  });

  cards.forEach(function (card) {
    const title = card.dataset.title || "";
    const cat = card.dataset.category || "";
    const match = title.includes(query) || cat.includes(query);
    card.classList.toggle("is-search-hidden", !match);
    if (match) visible += 1;
  });

  document.querySelectorAll("[data-section], .game-section--category").forEach(function (sec) {
    const anyVisible = sec.querySelector(".game-card:not(.is-search-hidden)");
    sec.classList.toggle("is-section-hidden", !anyVisible);
  });

  if (emptyWrap) emptyWrap.classList.toggle("is-hidden", visible > 0);
  if (typeof showSearchEmptySuggestions === "function") {
    showSearchEmptySuggestions(visible > 0 ? "" : query);
  }
}

/**
 * @param {string} filter
 */
function filterGamesByChip(filter) {
  const cards = getAllHomeCards();
  const sections = document.querySelectorAll(
    "[data-section], .game-section--category"
  );

  if (filter === "all") {
    cards.forEach(function (card) {
      card.style.display = "";
    });
    sections.forEach(function (sec) {
      sec.classList.remove("is-section-hidden");
    });
    return;
  }

  if (filter === "trending") {
    sections.forEach(function (sec) {
      const id = sec.id;
      const show = id === "trending" || id === "new";
      sec.classList.toggle("is-section-hidden", !show);
    });
    cards.forEach(function (card) {
      const inVisibleSection =
        card.closest("#trending, #new") &&
        !card.closest(".is-section-hidden");
      card.style.display = inVisibleSection ? "" : "none";
    });
    document.getElementById("trending")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  sections.forEach(function (sec) {
    const block = sec.dataset.categoryBlock;
    if (block) {
      sec.classList.toggle("is-section-hidden", block !== filter);
    } else {
      sec.classList.add("is-section-hidden");
    }
  });

  const catSection = document.getElementById("cat-" + filter);
  if (catSection) {
    catSection.classList.remove("is-section-hidden");
    catSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  cards.forEach(function (card) {
    const cat = (card.dataset.category || "").toLowerCase();
    let show = false;

    if (card.closest("#cat-" + filter)) {
      show = true;
    } else if (filter === "battle") {
      show = ["battle", "stickman", "arcade"].includes(cat);
    } else if (filter === "match-3") {
      show = ["match-3", "2048", "memory"].includes(cat);
    } else if (filter === "memory") {
      show = cat === "memory";
    } else {
      show = cat === filter || cat.includes(filter);
    }

    const section = card.closest("[data-section], .game-section--category");
    if (section && section.classList.contains("is-section-hidden")) {
      show = false;
    }

    card.style.display = show ? "" : "none";
  });

  const allSection = document.getElementById("all-games");
  if (allSection && filter !== "trending") {
    allSection.classList.remove("is-section-hidden");
    cards.forEach(function (card) {
      if (!card.closest("#all-games")) return;
      const cat = (card.dataset.category || "").toLowerCase();
      const show =
        cat === filter ||
        (filter === "battle" && ["battle", "stickman"].includes(cat)) ||
        (filter === "match-3" && ["match-3", "2048", "memory"].includes(cat));
      if (show) card.style.display = "";
    });
  }
}
