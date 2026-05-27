var pendingCategoryScrollId = null;

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

/**
 * CrazyGames-style hub: sidebar drawer + horizontal row scrollers
 */
document.addEventListener("DOMContentLoaded", function () {
  if (!document.body.classList.contains("home-crazy")) return;

  // Always open homepage from the top; avoid anchor/hash auto-jumps.
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
});

function populateHubCategories() {
  var nav = document.getElementById("hub-cat-nav");
  var mounted = window.vixoMountedCategories;
  var list = Array.isArray(mounted) && mounted.length ? mounted : window.VIXO_CATEGORIES;
  if (!nav || !list || !list.length) return;

  var isSmall = window.matchMedia("(max-width: 768px)").matches;
  var visible = isSmall ? list.slice(0, 24) : list;
  nav.innerHTML = "";
  visible.forEach(function (cat) {
    var a = document.createElement("a");
    a.href = "#cat-" + cat.slug;
    a.textContent = cat.title;
    nav.appendChild(a);
  });

  var oldMore = document.getElementById("hub-cat-more");
  if (oldMore) oldMore.remove();
  if (isSmall && list.length > visible.length) {
    var more = document.createElement("a");
    more.id = "hub-cat-more";
    more.href = "#library";
    more.textContent = "See all categories";
    nav.parentElement.appendChild(more);
  }
}

document.addEventListener("vixo:games-loaded", function () {
  if (document.body.classList.contains("home-crazy")) {
    initGameRowScrollers();
  }
});

document.addEventListener("vixo:categories-ready", function () {
  if (document.body.classList.contains("home-crazy")) {
    populateHubCategories();
  }
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
    var target = document.getElementById(id);
    if (!target) {
      pendingCategoryScrollId = id;
      return;
    }
    pendingCategoryScrollId = null;

    window.setTimeout(function () {
      scrollToPageSection(target);
    }, isDrawer() ? 280 : 0);
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
