/**
 * Favorites & recently played (localStorage)
 */
(function () {
  const KEY_FAV = "vixo-favorites";
  const KEY_RECENT = "vixo-recent";
  const LEGACY_FAV = "zonix-favorites";
  const LEGACY_RECENT = "zonix-recent";
  const MAX_FAV = 48;
  const MAX_RECENT = 16;

  function migrateLegacyKeys() {
    try {
      if (!localStorage.getItem(KEY_FAV) && localStorage.getItem(LEGACY_FAV)) {
        localStorage.setItem(KEY_FAV, localStorage.getItem(LEGACY_FAV));
        localStorage.removeItem(LEGACY_FAV);
      }
      if (!localStorage.getItem(KEY_RECENT) && localStorage.getItem(LEGACY_RECENT)) {
        localStorage.setItem(KEY_RECENT, localStorage.getItem(LEGACY_RECENT));
        localStorage.removeItem(LEGACY_RECENT);
      }
    } catch {
      /* private mode / blocked */
    }
  }

  migrateLegacyKeys();

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function write(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* quota */
    }
  }

  function gameRefFromItem(item) {
    const helpers = window.vixoSearchHelpers;
    return {
      namespace: item.namespace || "",
      title: item.title || "Game",
      category: item.category || "",
      playUrl: helpers ? helpers.playUrl(item) : "",
      thumb: helpers
        ? helpers.thumbUrl(item, 280)
        : item.banner_image || item.image || "",
      width: item.width,
      height: item.height,
      orientation: item.orientation || "",
      quality: item.quality_score,
    };
  }

  function findGameInLibrary(namespace) {
    if (!namespace) return null;
    return (window.vixoGames || []).find(function (g) {
      return g.namespace === namespace;
    });
  }

  function gameRefFromParams(params, extras) {
    const helpers = window.vixoSearchHelpers;
    const namespace = params.get("game") || "";
    const fromLib = findGameInLibrary(namespace);
    if (fromLib && helpers) {
      return gameRefFromItem(fromLib);
    }

    const item = {
      namespace: namespace,
      title: params.get("title") || "Game",
      category: params.get("category") || "",
      width: extras?.width,
      height: extras?.height,
      orientation: params.get("orientation") || extras?.orientation || "",
      quality_score: extras?.quality,
      banner_image: extras?.thumb,
      image: extras?.thumb,
    };
    if (helpers && item.namespace && (item.banner_image || item.image)) {
      return gameRefFromItem(item);
    }
    const q = new URLSearchParams();
    if (item.namespace) q.set("game", item.namespace);
    if (item.title) q.set("title", item.title);
    if (item.category) q.set("category", item.category);
    return {
      namespace: item.namespace,
      title: item.title,
      category: item.category,
      playUrl: "play.html?" + q.toString(),
      thumb: extras?.thumb || "",
      width: item.width,
      height: item.height,
      orientation: item.orientation,
      quality: extras?.quality,
    };
  }

  function addRecent(ref) {
    if (!ref || !ref.namespace) return;
    let list = read(KEY_RECENT).filter(function (g) {
      return g.namespace !== ref.namespace;
    });
    list.unshift(ref);
    write(KEY_RECENT, list.slice(0, MAX_RECENT));
    document.dispatchEvent(new CustomEvent("vixo:recent-updated"));
  }

  function getRecent() {
    return read(KEY_RECENT);
  }

  function getFavorites() {
    return read(KEY_FAV);
  }

  function isFavorite(namespace) {
    return read(KEY_FAV).some(function (g) {
      return g.namespace === namespace;
    });
  }

  function toggleFavorite(ref) {
    if (!ref || !ref.namespace) return false;
    let list = read(KEY_FAV);
    const idx = list.findIndex(function (g) {
      return g.namespace === ref.namespace;
    });
    if (idx >= 0) {
      list.splice(idx, 1);
      write(KEY_FAV, list);
      document.dispatchEvent(new CustomEvent("vixo:favorites-updated"));
      return false;
    }
    list.unshift(ref);
    write(KEY_FAV, list.slice(0, MAX_FAV));
    document.dispatchEvent(new CustomEvent("vixo:favorites-updated"));
    return true;
  }

  function upgradeStoredRefs() {
    const helpers = window.vixoSearchHelpers;
    const lib = window.vixoGames || [];
    if (!helpers || !lib.length) return false;

    let anyChanged = false;

    [KEY_RECENT, KEY_FAV].forEach(function (key) {
      const list = read(key);
      let changed = false;
      const next = list.map(function (ref) {
        if (!ref.namespace) return ref;
        const needsThumb = !ref.thumb;
        const fromLib = findGameInLibrary(ref.namespace);
        if (!fromLib) return ref;
        if (!needsThumb && ref.title === (fromLib.title || ref.title)) {
          return ref;
        }
        changed = true;
        const updated = gameRefFromItem(fromLib);
        updated.playUrl = ref.playUrl || updated.playUrl;
        return updated;
      });
      if (changed) {
        write(key, next);
        anyChanged = true;
      }
    });

    return anyChanged;
  }

  window.vixoStorage = {
    gameRefFromItem: gameRefFromItem,
    gameRefFromParams: gameRefFromParams,
    findGameInLibrary: findGameInLibrary,
    upgradeStoredRefs: upgradeStoredRefs,
    addRecent: addRecent,
    getRecent: getRecent,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
  };
})();
