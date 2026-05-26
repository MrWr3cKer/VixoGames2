/**
 * Fixed left Adsterra skyscraper (160×600) — isolated iframe, desktop only
 */
(function () {
  var AD_KEY = "c7f791b56299129e9f1ed08bf70c3a5e";
  var AD_SRC =
    "https://www.highperformanceformat.com/" + AD_KEY + "/invoke.js";

  if (!window.matchMedia("(min-width: 1280px)").matches) {
    return;
  }

  document.body.classList.add("has-ad-rail");

  var rail = document.createElement("aside");
  rail.className = "ad-rail";
  rail.setAttribute("aria-label", "Advertisement");

  var frame = document.createElement("iframe");
  frame.className = "ad-rail__frame";
  frame.title = "Advertisement";
  frame.width = "160";
  frame.height = "600";
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("frameborder", "0");
  frame.setAttribute("loading", "lazy");
  frame.referrerPolicy = "no-referrer-when-downgrade";

  var adDoc =
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=160,initial-scale=1\">" +
    "<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;width:160px;height:600px;}</style>" +
    "</head><body>" +
    "<script>atOptions={key:'" +
    AD_KEY +
    "',format:'iframe',height:600,width:160,params:{}};<\/script>" +
    "<script src=\"" +
    AD_SRC +
    "\"><\/script>" +
    "</body></html>";

  frame.srcdoc = adDoc;

  rail.appendChild(frame);

  var anchor = document.querySelector(".site-header, .play-header");
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(rail, anchor);
  } else {
    document.body.insertBefore(rail, document.body.firstChild);
  }
})();
