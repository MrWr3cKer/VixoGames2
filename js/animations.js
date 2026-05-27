/**
 * Scroll reveals + stable game card hover (no opacity pop-in)
 */
document.addEventListener("DOMContentLoaded", function () {
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobilePerf = window.matchMedia("(max-width: 768px)").matches;

  var sections = document.querySelectorAll(
    ".game-section, .user-section, .home-stats, .hero--home"
  );

  if (prefersReduced || mobilePerf) {
    sections.forEach(function (el) {
      el.classList.add("is-visible");
    });
    prepareAllGameCards();
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

        prepareGameCardsInSection(section);
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
      if (el.classList.contains("is-visible")) {
        prepareGameCardsInSection(el);
      }
    });
  }

  if ("IntersectionObserver" in window) {
    wireSections();
  } else {
    sections.forEach(function (el) {
      el.classList.add("is-visible");
      prepareGameCardsInSection(el);
    });
  }

  var hero = document.querySelector(".hero--home");
  if (hero) hero.classList.add("is-visible");

  document.addEventListener("vixo:games-loaded", wireSections);
  document.addEventListener("vixo:category-mounted", wireSections);
  document.addEventListener("vixo:games-loaded", prepareAllGameCards);
  document.addEventListener("vixo:category-mounted", prepareAllGameCards);

  document.body.addEventListener("click", function (e) {
    var btn = e.target.closest(".game-fav-btn");
    if (!btn) return;
    burstFavorite(btn);
  });
});

function prepareGameCard(card) {
  card.classList.remove("card-pop-in");
  card.classList.add("card-pop-done");
  card.style.removeProperty("--pop-delay");
}

function prepareGameCardsInSection(section) {
  if (!section) return;
  section.querySelectorAll(".game-card").forEach(prepareGameCard);
}

function prepareAllGameCards() {
  document.querySelectorAll(".game-card").forEach(prepareGameCard);
}

window.vixoPrepareGameCards = prepareGameCardsInSection;

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
