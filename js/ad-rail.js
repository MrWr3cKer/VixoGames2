/**
 * Keeps Adsterra iframe inside the left rail slot (invoke.js may inject elsewhere).
 */
(function () {
  const SLOT_ID = "adsterra-slot";
  const INVOKE_KEY = "c7f791b56299129e9f1ed08bf70c3a5e";

  function getSlot() {
    return document.getElementById(SLOT_ID);
  }

  function markFilled(slot) {
    if (slot && slot.querySelector("iframe")) {
      slot.classList.add("ad-rail__slot--filled");
    }
  }

  function adoptIframe(iframe) {
    const slot = getSlot();
    if (!slot || !iframe || slot.contains(iframe)) {
      markFilled(getSlot());
      return;
    }
    slot.appendChild(iframe);
    markFilled(slot);
  }

  function collectIframes() {
    const slot = getSlot();
    if (!slot) return;

    document.querySelectorAll(`script[src*="${INVOKE_KEY}"]`).forEach((script) => {
      let el = script.nextElementSibling;
      while (el && el !== slot) {
        if (el.tagName === "IFRAME") {
          adoptIframe(el);
          return;
        }
        el = el.nextElementSibling;
      }
    });

    document.querySelectorAll("body > iframe").forEach(adoptIframe);
    markFilled(slot);
  }

  document.body.classList.add("has-ad-rail");

  const observer = new MutationObserver(collectIframes);
  observer.observe(document.body, { childList: true, subtree: true });

  collectIframes();
  window.addEventListener("load", collectIframes);
  setTimeout(collectIframes, 500);
  setTimeout(collectIframes, 3000);
  setTimeout(collectIframes, 15000);
})();
