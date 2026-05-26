/**
 * Load left banner ad only on desktop; keep it inside .ad-rail__slot (no full-page overlay).
 */
(function () {
  var AD_SCRIPT = "https://data527.click/js/responsive.js";
  var MIN_WIDTH = 1280;

  function isDesktopAd() {
    return window.matchMedia("(min-width: " + MIN_WIDTH + "px)").matches;
  }

  function getSlot() {
    return document.getElementById("ad-slot");
  }

  function markLoaded(slot) {
    if (!slot) return;
    if (slot.querySelector("iframe, img, a[href]")) {
      slot.classList.add("is-ad-loaded");
    }
  }

  function moveBleedingAdsIntoSlot(slot) {
    if (!slot) return;
    document.querySelectorAll("body > iframe").forEach(function (iframe) {
      if (iframe.closest(".ad-rail__slot")) return;
      var w = iframe.offsetWidth || parseInt(iframe.getAttribute("width"), 10) || 0;
      if (w > 0 && w <= 200) {
        slot.appendChild(iframe);
      }
    });
  }

  function watchSlot(slot) {
    markLoaded(slot);
    moveBleedingAdsIntoSlot(slot);
    var observer = new MutationObserver(function () {
      markLoaded(slot);
      moveBleedingAdsIntoSlot(slot);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("load", function () {
      markLoaded(slot);
      moveBleedingAdsIntoSlot(slot);
    });
    [800, 2000, 5000].forEach(function (ms) {
      setTimeout(function () {
        markLoaded(slot);
        moveBleedingAdsIntoSlot(slot);
      }, ms);
    });
  }

  function injectAd(slot) {
    if (!slot || slot.dataset.adInjected === "1") return;
    slot.dataset.adInjected = "1";

    var ins = document.createElement("ins");
    ins.style.width = "120px";
    ins.style.height = "600px";
    ins.setAttribute("data-width", "120");
    ins.setAttribute("data-height", "600");
    ins.className = "u27eb8fe8d3";
    ins.setAttribute("data-domain", "//data527.click");
    ins.setAttribute(
      "data-affquery",
      "/ed3ecbae9a77159e4e93/27eb8fe8d3/?placementName=Banner1"
    );

    slot.appendChild(ins);

    var script = document.createElement("script");
    script.src = AD_SCRIPT;
    script.async = true;
    slot.appendChild(script);

    watchSlot(slot);
  }

  function init() {
    var slot = getSlot();
    if (!slot) return;

    if (!isDesktopAd()) {
      slot.dataset.adInjected = "skip";
      return;
    }

    injectAd(slot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("resize", function () {
    var slot = getSlot();
    if (!slot) return;
    if (isDesktopAd() && slot.dataset.adInjected !== "1") {
      init();
    }
  });
})();
