/**
 * Keeps banner ads inside #ad-slot; moves stray iframes from <body> into the slot.
 */
(function () {
  function getSlot() {
    return document.getElementById("ad-slot");
  }

  function markLoaded(slot) {
    if (slot && slot.querySelector("iframe, img, a[href]")) {
      slot.classList.add("is-ad-loaded");
    }
  }

  function moveStrayAdsIntoSlot(slot) {
    if (!slot) return;
    document.querySelectorAll("body > iframe").forEach(function (iframe) {
      if (iframe.closest(".ad-rail__slot")) return;
      slot.appendChild(iframe);
    });
  }

  function watch() {
    var slot = getSlot();
    if (!slot) return;

    markLoaded(slot);
    moveStrayAdsIntoSlot(slot);

    var observer = new MutationObserver(function () {
      markLoaded(slot);
      moveStrayAdsIntoSlot(slot);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("load", function () {
      markLoaded(slot);
      moveStrayAdsIntoSlot(slot);
    });

    [300, 1000, 3000, 8000].forEach(function (ms) {
      setTimeout(function () {
        markLoaded(slot);
        moveStrayAdsIntoSlot(slot);
      }, ms);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch);
  } else {
    watch();
  }
})();
