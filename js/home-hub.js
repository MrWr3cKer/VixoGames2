var pendingCategoryScrollId = null;

var HUB_MOBILE_POPULAR_SLUGS = [
  "multiplayer",
  "battle",
  "arcade",
  "match-3",
  "racing",
  "sports",
  "shooting",
  "casual",
  "strategy",
  "io",
  "kids",
];

function getHubPrioritySlugs() {
  var prefs = window.vixoPersonalization;
  var preferred = prefs && prefs.getTopGenres ? prefs.getTopGenres(6) : [];
  var merged = preferred.concat(HUB_MOBILE_POPULAR_SLUGS);
  var seen = {};
  return merged.filter(function (slug) {
    if (!slug || seen[slug]) return false;
    seen[slug] = 1;
    return true;
  });
}

function getScrollOffsetTop() {
  var header = document.querySelector(".site-header");
  var headerH = header ? header.getBoundingClientRect().height : 72;
  return headerH + 20;
}

function scrollToPageSection(target) {
  var el =
    typeof target === "string"
      ? document.getElementById(target.replace(/^#/, ""))
      : target;
  if (!el) return false;

  var top =
    el.getBoundingClientRect().top +
    (window.pageYOffset || window.scrollY || 0) -
    getScrollOffsetTop();

  window.scrollTo({
    top: Math.max(0, top),
    behavior: "smooth",
  });
  return true;
}

function isMobileHub() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function getCategoryList() {
  var list = (window.VIXO_CATEGORIES || []).slice();
  var prefs = window.vixoPersonalization;
  var top = prefs && prefs.getTopGenres ? prefs.getTopGenres(5) : [];
  if (!top.length) return list;
  var topSet = new Set(top);
  var head = list.filter(function (cat) {
    return topSet.has(cat.slug);
  });
  var tail = list.filter(function (cat) {
    return !topSet.has(cat.slug);
  });
  return head.concat(tail);
}

function orderBySlugs(list, slugs) {
  var map = {};
  list.forEach(function (cat) {
    map[cat.slug] = cat;
  });
  return slugs
    .map(function (slug) {
      return map[slug];
    })
    .filter(Boolean);
}

function renderHubCatLink(cat, parent) {
  var a = document.createElement("a");
  a.href = "#cat-" + cat.slug;
  a.textContent = cat.title;
  a.dataset.catTitle = (cat.title || "").toLowerCase();
  parent.appendChild(a);
}

function renderMobileQuickCategories(list) {
  var strip = document.getElementById("hub-mobile-cats");
  if (!strip) return;

  strip.innerHTML = "";
  if (!isMobileHub()) {
    strip.classList.add("is-hidden");
    return;
  }
  strip.classList.remove("is-hidden");

  var quick = orderBySlugs(list, getHubPrioritySlugs()).slice(0, 10);
  if (!quick.length) quick = list.slice(0, 10);

  quick.forEach(function (cat) {
    var a = document.createElement("a");
    a.className = "hub-mobile-cats__chip";
    a.href = "#cat-" + cat.slug;
    a.textContent = cat.title;
    strip.appendChild(a);
  });

  var more = document.createElement("a");
  more.className = "hub-mobile-cats__chip hub-mobile-cats__chip--more";
  more.href = "categories.html?view=all";
  more.textContent = "All";
  strip.appendChild(more);
}

function renderHubCategoryNav(list) {
  var nav = document.getElementById("hub-cat-nav");
  if (!nav || !list.length) return;

  var isSmall = isMobileHub();
  var filterInput = document.getElementById("hub-cat-filter");
  var filterQuery = filterInput ? filterInput.value : "";
  nav.innerHTML = "";

  var drawerList = isSmall ? orderBySlugs(list, getHubPrioritySlugs()) : list;

  if (isSmall && !drawerList.length) {
    drawerList = list.slice(0, 14);
  }

  drawerList.forEach(function (cat) {
    renderHubCatLink(cat, nav);
  });

  var oldMore = document.getElementById("hub-cat-more");
  if (oldMore) oldMore.remove();

  if (isSmall) {
    var more = document.createElement("a");
    more.id = "hub-cat-more";
    more.className = "hub-cat-nav__all";
    more.href = "categories.html?view=all";
    more.textContent = "Browse all categories →";
    nav.parentElement.appendChild(more);
  } else if (list.length > drawerList.length) {
    var moreDesktop = document.createElement("a");
    moreDesktop.id = "hub-cat-more";
    moreDesktop.className = "hub-cat-nav__all";
    moreDesktop.href = "#library";
    moreDesktop.textContent = "See full library";
    nav.parentElement.appendChild(moreDesktop);
  }

  renderMobileQuickCategories(list);
  initHubCategoryFilter();

  if (filterQuery && filterInput) {
    filterInput.value = filterQuery;
    filterInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function populateHubCategories() {
  var nav = document.getElementById("hub-cat-nav");
  var list = getCategoryList();
  if (!nav || !list.length) return;

  var catalog = window.vixoCategoryCatalog;
  if (!catalog || !catalog.filterCategoriesWithGames) {
    renderHubCategoryNav(list);
    return;
  }

  var cached = catalog.getCachedValidSlugs();
  if (cached) {
    renderHubCategoryNav(
      list.filter(function (cat) {
        return cached.has(cat.slug);
      })
    );
    return;
  }

  if (isMobileHub()) {
    /* Mobile first paint: show full list immediately, validate lazily. */
    renderHubCategoryNav(list);
    var runValidation = function () {
      catalog
        .filterCategoriesWithGames(list)
        .then(function (valid) {
          document.dispatchEvent(
            new CustomEvent("vixo:valid-categories-ready", {
              detail: { slugs: valid.map(function (c) { return c.slug; }) },
            })
          );
          if (!valid.length) return;
          renderHubCategoryNav(valid);
        })
        .catch(function () {});
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runValidation, { timeout: 2500 });
    } else {
      window.setTimeout(runValidation, 1200);
    }
    return;
  }

  nav.innerHTML = '<p class="hub-cat-nav-status">Loading categories…</p>';

  catalog
    .filterCategoriesWithGames(list)
    .then(function (valid) {
      document.dispatchEvent(
        new CustomEvent("vixo:valid-categories-ready", {
          detail: { slugs: valid.map(function (c) { return c.slug; }) },
        })
      );
      if (!valid.length) {
        nav.innerHTML =
          '<p class="hub-cat-nav-status">No categories available.</p>';
        return;
      }
      renderHubCategoryNav(valid);
    })
    .catch(function () {
      renderHubCategoryNav(list);
    });
}

function pruneInvalidCategorySections(validSlugs) {
  if (!validSlugs || !validSlugs.length) return;
  var allowed = new Set(validSlugs);
  document
    .querySelectorAll("[data-lazy-category], [data-category-block]")
    .forEach(function (el) {
      var slug = el.dataset.lazyCategory || el.dataset.categoryBlock;
      if (slug && !allowed.has(slug)) {
        el.remove();
      }
    });
}

function initHubCategoryFilter() {
  var input = document.getElementById("hub-cat-filter");
  var nav = document.getElementById("hub-cat-nav");
  if (!input || !nav) return;

  if (!isMobileHub()) {
    input.classList.add("is-hidden");
    input.value = "";
    nav.querySelectorAll("a").forEach(function (link) {
      link.hidden = false;
    });
    return;
  }

  input.classList.remove("is-hidden");

  if (input.dataset.filterWired === "1") return;
  input.dataset.filterWired = "1";

  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase();
    nav.querySelectorAll("a").forEach(function (link) {
      if (!link.dataset.catTitle) return;
      var match =
        !q ||
        link.dataset.catTitle.indexOf(q) !== -1 ||
        link.textContent.toLowerCase().indexOf(q) !== -1;
      link.hidden = !match;
    });
  });
}

/**
 * CrazyGames-style hub: sidebar drawer + horizontal row scrollers
 */
document.addEventListener("DOMContentLoaded", function () {
  if (!document.body.classList.contains("home-crazy")) return;

  if (window.history && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  if (window.location.hash) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }
  window.scrollTo(0, 0);

  window.vixoScrollToSection = scrollToPageSection;
  populateHubCategories();
  initHubSidebar();
  initGameRowScrollers();

  window.addEventListener("resize", function () {
    populateHubCategories();
  });
});

document.addEventListener("vixo:games-loaded", function () {
  if (document.body.classList.contains("home-crazy")) {
    initGameRowScrollers();
  }
});

document.addEventListener("vixo:valid-categories-ready", function (ev) {
  if (!document.body.classList.contains("home-crazy")) return;
  var slugs = (ev && ev.detail && ev.detail.slugs) || [];
  pruneInvalidCategorySections(slugs);
  populateHubCategories();
});

function initHubSidebar() {
  var toggle = document.querySelector(".menu-toggle");
  var backdrop = document.getElementById("hub-sidebar-backdrop");
  var sidebar = document.getElementById("hub-sidebar");
  var lockedScrollY = 0;

  function isDrawer() {
    return window.matchMedia("(max-width: 1023px)").matches;
  }

  function lockPageScroll() {
    if (!isDrawer()) return;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("hub-nav-lock");
    document.body.classList.add("hub-nav-lock");
    document.body.style.top = "-" + lockedScrollY + "px";
  }

  function unlockPageScroll() {
    if (!document.body.classList.contains("hub-nav-lock")) return;
    document.documentElement.classList.remove("hub-nav-lock");
    document.body.classList.remove("hub-nav-lock");
    document.body.style.top = "";
    window.scrollTo(0, lockedScrollY);
  }

  function closeNav() {
    document.body.classList.remove("hub-nav-open");
    unlockPageScroll();
    var filter = document.getElementById("hub-cat-filter");
    if (filter) filter.value = "";
    var nav = document.getElementById("hub-cat-nav");
    if (nav) {
      nav.querySelectorAll("a").forEach(function (link) {
        link.hidden = false;
      });
    }
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }
  }

  function openNav() {
    document.body.classList.add("hub-nav-open");
    lockPageScroll();
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    }
  }

  function scrollToHashTarget(href) {
    if (!href || href.charAt(0) !== "#") return;
    var id = href.slice(1);
    if (!id) return;

    if (id.indexOf("cat-") === 0) {
      var slug = id.slice(4);
      if (slug && typeof window.vixoEnsureCategoryLoaded === "function") {
        window.vixoEnsureCategoryLoaded(slug);
      }
    }

    var target = document.getElementById(id);
    if (!target) {
      pendingCategoryScrollId = id;
      return;
    }
    pendingCategoryScrollId = null;

    window.setTimeout(function () {
      scrollToPageSection(target);
    }, isDrawer() ? 320 : 0);
  }

  if (sidebar) {
    sidebar.addEventListener("click", function (e) {
      var link = e.target.closest("a[href^='#']");
      if (!link) return;

      var href = link.getAttribute("href");
      if (!href || href === "#") return;

      e.preventDefault();
      if (isDrawer()) closeNav();
      scrollToHashTarget(href);
    });
  }

  var mobileCats = document.getElementById("hub-mobile-cats");
  if (mobileCats) {
    mobileCats.addEventListener("click", function (e) {
      var link = e.target.closest("a[href^='#']");
      if (!link) return;
      e.preventDefault();
      scrollToHashTarget(link.getAttribute("href"));
    });
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      if (document.body.classList.contains("hub-nav-open")) {
        closeNav();
      } else {
        openNav();
      }
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeNav);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("hub-nav-open")) {
      closeNav();
    }
  });
}

function initGameRowScrollers() {
  document.querySelectorAll(".game-row-wrap:not([data-scroll-init])").forEach(function (wrap) {
    wrap.setAttribute("data-scroll-init", "1");
    var grid = wrap.querySelector(".game-grid--row");
    var prev = wrap.querySelector(".game-row-scroll--prev");
    var next = wrap.querySelector(".game-row-scroll--next");
    if (!grid) return;

    function step() {
      return Math.max(220, grid.clientWidth * 0.72);
    }

    if (prev) {
      prev.addEventListener("click", function () {
        grid.scrollBy({ left: -step(), behavior: "smooth" });
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        grid.scrollBy({ left: step(), behavior: "smooth" });
      });
    }
  });
}

window.vixoInitGameRowScrollers = initGameRowScrollers;

document.addEventListener("vixo:category-mounted", function () {
  if (document.body.classList.contains("home-crazy")) {
    initGameRowScrollers();
    if (pendingCategoryScrollId) {
      var late = document.getElementById(pendingCategoryScrollId);
      if (late) scrollToPageSection(late);
      pendingCategoryScrollId = null;
    }
  }
});
