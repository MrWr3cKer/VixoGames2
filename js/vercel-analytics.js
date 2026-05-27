/**
 * Vercel Web Analytics for static HTML sites.
 * Enable Web Analytics in the Vercel project dashboard, then deploy.
 * @see https://vercel.com/docs/analytics/quickstart
 */
(function () {
  if (window.__vixoVercelAnalytics) return;
  window.__vixoVercelAnalytics = true;

  window.va =
    window.va ||
    function () {
      (window.vaq = window.vaq || []).push(arguments);
    };

  var script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  document.head.appendChild(script);
})();
