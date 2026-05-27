/**
 * CrazyGames-style hub: sidebar drawer + horizontal row scrollers
 */
document.addEventListener("DOMContentLoaded", function () {
  if (!document.body.classList.contains("home-crazy")) return;

  populateHubCategories();
  initHubSidebar();
  initGameRowScrollers();
});

function populateHubCategories() {
  var nav = document.getElementById("hub-cat-nav");
  var list = window.VIXO_CATEGORIES;
  if (!nav || !list || !list.length) return;

  nav.innerHTML = "";
  list.forEach(function (cat) {
    var a = document.createElement("a");
    a.href = "#cat-" + cat.slug;
    a.textContent = cat.title;
    nav.appendChild(a);
  });
}

document.addEventListener("vixo:games-loaded", function () {
  if (document.body.classList.contains("home-crazy")) {
    initGameRowScrollers();
  }
});

function initHubSidebar() {
  var toggle = document.querySelector(".menu-toggle");
  var backdrop = document.getElementById("hub-sidebar-backdrop");
  var sidebar = document.getElementById("hub-sidebar");

  function closeNav() {
    document.body.classList.remove("hub-nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  function openNav() {
    document.body.classList.add("hub-nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
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

  if (sidebar) {
    sidebar.querySelectorAll("a[href^='#']").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 1023px)").matches) {
          closeNav();
        }
      });
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
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
  }
});
