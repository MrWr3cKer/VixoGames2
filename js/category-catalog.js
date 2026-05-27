/**
 * Filter VIXO_CATEGORIES to slugs that return games from GamePix.
 * Cached in sessionStorage to avoid re-checking every navigation.
 */
(function () {
  const MIN_GAMES = 4;
  const CACHE_KEY = "vixo-valid-category-slugs-v1";
  const CACHE_TS_KEY = "vixo-valid-category-slugs-ts-v1";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const BATCH_SIZE = 3;

  function readCache() {
    try {
      const ts = parseInt(sessionStorage.getItem(CACHE_TS_KEY) || "0", 10);
      if (!ts || Date.now() - ts > CACHE_TTL_MS) return null;
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return null;
      return new Set(list);
    } catch {
      return null;
    }
  }

  function writeCache(slugSet) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(slugSet)));
      sessionStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
  }

  async function slugHasGames(slug) {
    const api = window.vixoGamePix;
    if (!api || !slug) return false;
    try {
      const items = await api.fetchCategoryGames(slug, 1);
      return items.length >= MIN_GAMES;
    } catch {
      return false;
    }
  }

  async function filterCategoriesWithGames(categories, onProgress) {
    const list = (categories || []).slice();
    if (!list.length) return [];

    const cached = readCache();
    if (cached) {
      return list.filter(function (cat) {
        return cached.has(cat.slug);
      });
    }

    const valid = new Set();
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async function (cat) {
          const ok = await slugHasGames(cat.slug);
          return { slug: cat.slug, ok: ok };
        })
      );
      results.forEach(function (r) {
        if (r.ok) valid.add(r.slug);
      });
      if (typeof onProgress === "function") {
        onProgress(Math.min(list.length, i + BATCH_SIZE), list.length);
      }
    }

    writeCache(valid);
    window.vixoValidCategorySlugs = valid;

    return list.filter(function (cat) {
      return valid.has(cat.slug);
    });
  }

  function getCachedValidSlugs() {
    return readCache();
  }

  window.vixoCategoryCatalog = {
    filterCategoriesWithGames: filterCategoriesWithGames,
    getCachedValidSlugs: getCachedValidSlugs,
    MIN_GAMES: MIN_GAMES,
  };
})();
