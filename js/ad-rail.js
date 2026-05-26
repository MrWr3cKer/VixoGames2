/**
 * Fixed left Adsterra banner (160×600) — desktop only
 */
(function () {
  var AD_KEY = "c7f791b56299129e9f1ed08bf70c3a5e";
  var AD_SRC =
    "https://www.highperformanceformat.com/" + AD_KEY + "/invoke.js";

  document.body.classList.add("has-ad-rail");

  var rail = document.createElement("aside");
  rail.className = "ad-rail";
  rail.setAttribute("aria-label", "Advertisement");

  var slot = document.createElement("div");
  slot.className = "ad-rail__slot";
  slot.id = "adsterra-left-rail";
  rail.appendChild(slot);

  var anchor =
    document.querySelector(".site-header, .play-header") || document.body.firstChild;
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(rail, anchor);
  } else {
    document.body.appendChild(rail);
  }

  function loadAd() {
    if (slot.dataset.loaded === "1") return;
    slot.dataset.loaded = "1";

    window.atOptions = {
      key: AD_KEY,
      format: "iframe",
      height: 600,
      width: 160,
      params: {},
    };

    var invoke = document.createElement("script");
    invoke.src = AD_SRC;
    invoke.async = true;
    slot.appendChild(invoke);
  }

  var desktop = window.matchMedia("(min-width: 1280px)");

  if (desktop.matches) {
    loadAd();
  } else {
    desktop.addEventListener("change", function (e) {
      if (e.matches) loadAd();
    });
  }
})();
