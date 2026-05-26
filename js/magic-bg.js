/**
 * Fantasy background: click ripple rings on empty areas (no mouse follower)
 */
(function () {
  var ripplesRoot = document.getElementById("magic-ripples");
  if (!ripplesRoot) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var skipClick =
    "a,button,input,select,textarea,label,iframe," +
    ".game-card-link,.game-card,.search-wrap,.search-dropdown," +
    ".menu-toggle,.site-header,.play-header,.play-toolbar," +
    ".game-stage,.similar-card,.nav-link,.cat-chip,.game-fav-btn,.library-control,.ad-rail";

  document.addEventListener("click", function (e) {
    if (e.target.closest(skipClick)) return;
    spawnRipple(e.clientX, e.clientY);
  });

  function spawnRipple(x, y) {
    var el = document.createElement("span");
    el.className = "magic-ripple";
    var size = 100 + Math.random() * 70;
    var peak = 1.15 + Math.random() * 0.55;
    var duration = 0.7 + Math.random() * 0.45;

    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.setProperty("--ripple-peak", String(peak));
    el.style.setProperty("--ripple-dur", duration + "s");

    ripplesRoot.appendChild(el);
    el.addEventListener("animationend", function () {
      el.remove();
    });
  }
})();
