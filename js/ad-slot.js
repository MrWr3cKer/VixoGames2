/**
 * Load ad script on desktop; affilistStart handles every <ins> on the page.
 */
(function () {
  var DESKTOP_LEFT = window.matchMedia("(min-width: 1024px)");
  var DESKTOP_DUAL = window.matchMedia("(min-width: 1500px)");
  var SCRIPT_SRC = "//data527.click/js/responsive.js";

  function hasIns() {
    return !!document.querySelector(".ad-rail__slot ins[data-affquery]");
  }

  function shouldLoadAds() {
    if (!hasIns()) return false;
    if (DESKTOP_DUAL.matches) return true;
    if (DESKTOP_LEFT.matches) return true;
    return false;
  }

  function startAffilist() {
    if (typeof window.affilistStart !== "function") return false;
    window.affilistStart();
    return true;
  }

  function loadResponsive(done) {
    if (typeof window.affilistStart === "function") {
      done();
      return;
    }

    var existing = document.querySelector("script[data-vixo-ad-script]");
    if (existing) {
      if (existing.dataset.loaded === "1") {
        done();
      } else {
        existing.addEventListener("load", done, { once: true });
      }
      return;
    }

    var script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-vixo-ad-script", "1");
    script.onload = function () {
      script.dataset.loaded = "1";
      done();
    };
    document.head.appendChild(script);
  }

  function boot() {
    if (!shouldLoadAds()) return;

    loadResponsive(function () {
      var tries = 0;
      (function tryStart() {
        if (startAffilist() || ++tries > 40) return;
        setTimeout(tryStart, 100);
      })();
    });
  }

  if (document.readyState === "complete") {
    boot();
  } else {
    window.addEventListener("load", boot);
  }

  DESKTOP_LEFT.addEventListener("change", boot);
  DESKTOP_DUAL.addEventListener("change", boot);
})();
