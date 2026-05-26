/**
 * Load the ad script only on desktop (>=1024px).
 * Hidden iframes on narrow windows stay blank — that was the start.bat bug.
 */
(function () {
  var DESKTOP = window.matchMedia("(min-width: 1024px)");
  var SCRIPT_SRC = "//data527.click/js/responsive.js";

  function getSlot() {
    return document.querySelector(".ad-rail__slot");
  }

  function hasIns() {
    var slot = getSlot();
    return !!(slot && slot.querySelector("ins[data-affquery]"));
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
    if (!DESKTOP.matches || !hasIns()) return;

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

  DESKTOP.addEventListener("change", function (event) {
    if (event.matches) boot();
  });
})();
