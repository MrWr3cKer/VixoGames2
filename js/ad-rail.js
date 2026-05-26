/**
 * Moves the real Adsterra iframe into the left holder (scripts stay on <body>).
 */
(function () {
  const SLOT_ID = "adsterra-slot";
  const INVOKE_KEY = "c7f791b56299129e9f1ed08bf70c3a5e";

  function getSlot() {
    return document.getElementById(SLOT_ID);
  }

  function isAdNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.tagName === "IFRAME") return true;
    if (node.tagName === "DIV" && node.querySelector("iframe")) return true;
    return false;
  }

  function markFilled(slot) {
    if (slot && slot.querySelector("iframe")) {
      slot.classList.add("ad-rail__slot--filled");
    }
  }

  function adoptNode(node) {
    const slot = getSlot();
    if (!slot || !node || slot.contains(node)) {
      markFilled(getSlot());
      return;
    }
    if (node.tagName === "IFRAME") {
      slot.insertBefore(node, slot.firstChild);
    } else {
      slot.insertBefore(node, slot.firstChild);
    }
    markFilled(slot);
  }

  function collectAdNodes() {
    const slot = getSlot();
    if (!slot) return;

    document.querySelectorAll(`script[src*="${INVOKE_KEY}"]`).forEach((script) => {
      let el = script.nextElementSibling;
      while (el) {
        if (el.id === SLOT_ID || el.classList.contains("ad-rail")) break;
        if (isAdNode(el)) {
          adoptNode(el);
          return;
        }
        el = el.nextElementSibling;
      }
    });

    document.querySelectorAll("body > iframe, body > div").forEach((el) => {
      if (el.closest(".ad-rail")) return;
      if (el.tagName === "IFRAME") {
        adoptNode(el);
      } else if (
        el.tagName === "DIV" &&
        el.querySelector(`iframe[src*="${INVOKE_KEY}"], iframe[src*="highperformanceformat"]`)
      ) {
        adoptNode(el);
      }
    });

    markFilled(slot);
  }

  document.body.classList.add("has-ad-rail");

  const observer = new MutationObserver(collectAdNodes);
  observer.observe(document.body, { childList: true, subtree: true });

  collectAdNodes();
  window.addEventListener("load", collectAdNodes);
  [300, 800, 2000, 5000, 15000, 30000].forEach((ms) => setTimeout(collectAdNodes, ms));
})();
