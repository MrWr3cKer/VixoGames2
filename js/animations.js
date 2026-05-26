/**
 * Scroll reveals, staggered game cards, favorite heart burst
 */
document.addEventListener("DOMContentLoaded", function () {
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var sections = document.querySelectorAll(
    ".game-section, .user-section, .home-stats, .hero--home"
  );

  if (prefersReduced) {
    sections.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  sections.forEach(function (el) {
    el.classList.add("reveal-pending");
  });

  var sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var section = entry.target;
        section.classList.add("is-visible");

        var title = section.querySelector(".section-head h2");
        if (title) title.classList.add("is-visible");

        staggerGameCards(section);
        sectionObserver.unobserve(section);
      });
    },
    { root: null, rootMargin: "0px 0px -5% 0px", threshold: 0.05 }
  );

  function wireSections() {
    document.querySelectorAll(".game-section, .user-section").forEach(function (el) {
      if (el.dataset.animWired === "1") return;
      el.dataset.animWired = "1";
      sectionObserver.observe(el);
    });
  }

  if ("IntersectionObserver" in window) {
    wireSections();
  } else {
    sections.forEach(function (el) {
      el.classList.add("is-visible");
      staggerGameCards(el);
    });
  }

  var hero = document.querySelector(".hero--home");
  if (hero) hero.classList.add("is-visible");

  document.addEventListener("vixo:games-loaded", wireSections);
  document.addEventListener("vixo:category-mounted", wireSections);

  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest(".game-fav-btn");
    if (!btn) return;
    burstFavorite(btn);
  });
});

function staggerGameCards(section) {
  var cards = section.querySelectorAll(".game-card");
  cards.forEach(function (card, i) {
    if (card.classList.contains("card-pop-in")) return;
    card.classList.add("card-pop-in");
    card.style.setProperty("--pop-delay", Math.min(i * 0.04, 1.2) + "s");
  });
}

function burstFavorite(btn) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  btn.classList.add("is-bursting");
  window.setTimeout(function () {
    btn.classList.remove("is-bursting");
  }, 560);

  var rect = btn.getBoundingClientRect();
  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;
  var bits = ["♥", "♥", "✨", "💖", "★"];

  for (var i = 0; i < 5; i++) {
    var p = document.createElement("span");
    p.className = "fav-particle";
    p.textContent = bits[i % bits.length];
    p.style.left = cx + "px";
    p.style.top = cy + "px";
    p.style.setProperty("--fly-x", (Math.random() - 0.5) * 56 + "px");
    p.style.setProperty("--fly-y", (Math.random() - 0.5) * 50 - 24 + "px");
    document.body.appendChild(p);
    window.setTimeout(function (el) {
      el.remove();
    }, 700, p);
  }
}
