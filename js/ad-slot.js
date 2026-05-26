/**
 * Hides ad placeholder when the network injects content into the slot.
 */
(function () {
  function markLoaded(slot) {
    if (!slot) return;
    if (slot.querySelector("iframe, img, a")) {
      slot.classList.add("is-ad-loaded");
    }
  }

  function watchSlot(slot) {
    markLoaded(slot);
    var observer = new MutationObserver(function () {
      markLoaded(slot);
    });
    observer.observe(slot, { childList: true, subtree: true });
    window.addEventListener("load", function () {
      markLoaded(slot);
    });
    [500, 1500, 4000].forEach(function (ms) {
      setTimeout(function () {
        markLoaded(slot);
      }, ms);
    });
  }

  document.querySelectorAll(".ad-rail__slot").forEach(watchSlot);
})();
