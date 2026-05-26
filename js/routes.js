/**
 * Game play URLs — always use games/index.html?game=slug locally (works everywhere).
 * Pretty /games/slug when server supports it (server.py, Netlify, Vercel).
 */
(function () {
  let prettyDetectPromise = null;

  function getGameSlug(item) {
    return (item && item.namespace) || "";
  }

  function getSiteBase() {
    const path = window.location.pathname.replace(/\\/g, "/");
    const gamesAt = path.indexOf("/games");
    if (gamesAt >= 0) {
      return path.slice(0, gamesAt + 1);
    }
    const last = path.lastIndexOf("/");
    return last >= 0 ? path.slice(0, last + 1) : "/";
  }

  /** Works on Live Server, file://, and VixoGames server */
  function getGamePlayPathQuery(slug) {
    return (
      getSiteBase() +
      "games/index.html?game=" +
      encodeURIComponent(slug)
    );
  }

  function getGamePlayPath(item) {
    const slug = getGameSlug(item);
    if (!slug) {
      return getSiteBase() + "index.html";
    }
    // When the server supports rewrites (/games/<slug>), use the pretty URL.
    // Otherwise fall back to query-string URLs (works everywhere).
    if (window.vixoUsePrettyPaths === true) {
      return getSiteBase() + "games/" + encodeURIComponent(slug);
    }
    return getGamePlayPathQuery(slug);
  }

  function detectPrettyPaths() {
    if (prettyDetectPromise) return prettyDetectPromise;

    prettyDetectPromise = fetch(
      getSiteBase() + "games/__vixo_route_probe__?t=" + Date.now(),
      { method: "GET", cache: "no-store" }
    )
      .then(function (res) {
        window.vixoUsePrettyPaths = res.ok;
        document.dispatchEvent(
          new CustomEvent("vixo:routes-ready", {
            detail: { pretty: window.vixoUsePrettyPaths },
          })
        );
        return window.vixoUsePrettyPaths;
      })
      .catch(function () {
        window.vixoUsePrettyPaths = false;
        document.dispatchEvent(
          new CustomEvent("vixo:routes-ready", {
            detail: { pretty: false },
          })
        );
        return false;
      });

    return prettyDetectPromise;
  }

  function parseGameSlugFromLocation() {
    const q = new URLSearchParams(window.location.search);
    if (q.get("game")) return q.get("game");

    const path = window.location.pathname.replace(/\\/g, "/");
    const marker = "/games/";
    const idx = path.indexOf(marker);

    if (idx >= 0) {
      const rest = path.slice(idx + marker.length);
      const slug = rest.split("/").filter(Boolean)[0];
      if (
        slug &&
        slug !== "index.html" &&
        slug !== "__vixo_route_probe__"
      ) {
        try {
          return decodeURIComponent(slug);
        } catch {
          return slug;
        }
      }
    }

    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash.indexOf("games/") === 0) {
      const fromHash = hash.slice(6).split("/")[0];
      if (fromHash) {
        try {
          return decodeURIComponent(fromHash);
        } catch {
          return fromHash;
        }
      }
    }

    return null;
  }

  function getCanonicalGameUrl(slug) {
    if (!slug) return null;
    try {
      return new URL(
        "games/" + encodeURIComponent(slug),
        window.location.origin + getSiteBase()
      ).href;
    } catch {
      return null;
    }
  }

  function replaceUrlWithGamePath(slug) {
    if (!slug || !window.history.replaceState) return;
    if (window.vixoUsePrettyPaths !== true) return;

    const base = getSiteBase();
    const next = base + "games/" + encodeURIComponent(slug);
    const current = window.location.pathname;
    if (current === next || current.endsWith("/" + encodeURIComponent(slug))) {
      return;
    }
    window.history.replaceState(null, "", next);
  }

  function gameToSearchParams(game) {
    const p = new URLSearchParams();
    if (!game) return p;
    if (game.namespace) p.set("game", game.namespace);
    if (game.title) p.set("title", game.title);
    if (game.category) p.set("category", game.category);
    if (game.width) p.set("w", String(game.width));
    if (game.height) p.set("h", String(game.height));
    if (game.orientation) p.set("orientation", game.orientation);
    return p;
  }

  window.vixoUsePrettyPaths = false;
  window.vixoRoutes = {
    getGameSlug: getGameSlug,
    getGamePlayPath: getGamePlayPath,
    getGamePlayPathQuery: getGamePlayPathQuery,
    getSiteBase: getSiteBase,
    parseGameSlugFromLocation: parseGameSlugFromLocation,
    getCanonicalGameUrl: getCanonicalGameUrl,
    replaceUrlWithGamePath: replaceUrlWithGamePath,
    gameToSearchParams: gameToSearchParams,
    detectPrettyPaths: detectPrettyPaths,
  };

  detectPrettyPaths();
})();
