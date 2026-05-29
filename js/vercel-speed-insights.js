/**
 * Vercel Speed Insights for static HTML sites.
 * Enable Speed Insights in the Vercel project dashboard, then deploy.
 * @see https://vercel.com/docs/speed-insights/quickstart
 */
(function () {
  if (window.__vixoVercelSpeedInsights) return;
  window.__vixoVercelSpeedInsights = true;

  window.si =
    window.si ||
    function () {
      (window.siq = window.siq || []).push(arguments);
    };

  var script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/speed-insights/script.js";
  document.head.appendChild(script);
})();
