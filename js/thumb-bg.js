/**

 * Diagonal brick-grid — infinite drift down-left, full viewport coverage.

 * Boots after idle using on-page games first (no upfront 8-page feed hammering).

 */

(function () {

  var root = null;

  var plane = null;

  var track = null;

  var built = false;

  var bootStarted = false;

  var bootScheduled = false;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;



  function isMobilePerf() {

    return window.matchMedia("(max-width: 768px)").matches;

  }



  var TILE_W = 88;

  var GAP = 7;

  var ROWS = 14;

  var COLS = 20;

  var BLOCKS = 3;

  var MIN_IMAGES = 8;

  var MIN_POOL_SIZE = 40;

  var PLANE_ANGLE = 35;



  var imagePool = [];

  var poolCursor = 0;

  var scrollOffset = 0;

  var blockHeight = 0;

  var rafId = 0;

  var lastTime = 0;

  var speedPxPerSec = 24;



  function tileUnit() {

    return TILE_W + GAP;

  }



  function updateViewportCoverage() {

    var vw = Math.max(

      window.innerWidth || 0,

      document.documentElement.clientWidth || 0,

      320

    );

    var vh = Math.max(

      window.innerHeight || 0,

      document.documentElement.clientHeight || 0,

      480

    );

    var rad = (PLANE_ANGLE * Math.PI) / 180;

    var sin = Math.abs(Math.sin(rad));

    var cos = Math.abs(Math.cos(rad));

    var coverW = vw * cos + vh * sin + 240;

    var coverH = vw * sin + vh * cos + 240;

    var unit = tileUnit();



    COLS = Math.min(32, Math.max(14, Math.ceil(coverW / unit) + 4));

    ROWS = Math.min(22, Math.max(10, Math.ceil(coverH / unit / BLOCKS) + 2));



    if (root) {

      root.style.setProperty("--plane-w", Math.ceil(coverW) + "px");

      root.style.setProperty("--plane-h", Math.ceil(coverH) + "px");

    }

  }



  function configureSizes() {

    if (window.matchMedia("(max-width: 768px)").matches) {

      TILE_W = 64;

      GAP = 5;

      speedPxPerSec = 16;

      BLOCKS = 2;

    } else if (window.matchMedia("(max-width: 1024px)").matches) {

      TILE_W = 76;

      GAP = 6;

      speedPxPerSec = 20;

      BLOCKS = 2;

    } else {

      TILE_W = 88;

      GAP = 7;

      speedPxPerSec = 24;

      BLOCKS = 3;

    }



    updateViewportCoverage();



    if (!root) return;

    root.style.setProperty("--thumb-size", TILE_W + "px");

    root.style.setProperty("--thumb-gap", GAP + "px");

    root.style.setProperty("--plane-angle", PLANE_ANGLE + "deg");

  }



  function calcBlockHeight() {

    return ROWS * TILE_W + (ROWS - 1) * GAP + GAP;

  }



  function imageUrl(raw, width) {

    if (!raw) return "";

    try {

      var u = new URL(raw);

      u.searchParams.set("w", String(width));

      return u.toString();

    } catch (e) {

      return raw;

    }

  }



  function dedupeItems(items) {

    var seen = {};

    var out = [];

    items.forEach(function (item) {

      if (!item || !item.namespace || seen[item.namespace]) return;

      seen[item.namespace] = true;

      out.push(item);

    });

    return out;

  }



  function toSrc(item) {

    if (typeof item === "string") return item;

    return imageUrl(item.banner_image || item.image, TILE_W * 2);

  }



  function shuffle(arr) {

    var copy = arr.slice();

    for (var i = copy.length - 1; i > 0; i--) {

      var j = Math.floor(Math.random() * (i + 1));

      var tmp = copy[i];

      copy[i] = copy[j];

      copy[j] = tmp;

    }

    return copy;

  }



  function nextSrc() {

    if (!imagePool.length) return "";

    var src = imagePool[poolCursor % imagePool.length];

    poolCursor++;

    return src;

  }



  function scrapeDomImages() {

    var urls = [];

    document.querySelectorAll(".game-thumb-img, .game-card-link img, .similar-card-cover img").forEach(function (img) {

      if (img.src && img.src.indexOf("gamepix") !== -1) urls.push(img.src);

    });

    return urls;

  }



  function buildSourcesFromItems(items) {

    var seen = {};

    var out = [];

    shuffle(items).forEach(function (item) {

      if (!item) return;

      var key =

        typeof item === "string"

          ? item

          : item.namespace || item.banner_image || item.image;

      if (!key || seen[key]) return;

      var src = toSrc(item);

      if (!src) return;

      seen[key] = true;

      out.push(src);

    });

    return out;

  }



  async function fetchFeedPage(page) {

    try {

      var url =

        "https://feeds.gamepix.com/v2/json?sid=1VXSV&pagination=96&page=" + page;

      var res = await fetch(url);

      if (!res.ok) return [];

      var feed = await res.json();

      return Array.isArray(feed.items) ? feed.items : [];

    } catch (e) {

      return [];

    }

  }



  async function gatherLightPool() {

    var merged = [];

    var batch = await Promise.all([fetchFeedPage(1), fetchFeedPage(2)]);

    merged = batch[0].concat(batch[1]);



    if (window.vixoGames && window.vixoGames.length) {

      merged = merged.concat(window.vixoGames);

    }



    return dedupeItems(merged);

  }



  function mergeMoreIntoPool(items) {

    if (!items || !items.length) return;

    var seen = {};

    imagePool.forEach(function (src) {

      seen[src] = true;

    });

    items.forEach(function (item) {

      var src = toSrc(item);

      if (!src || seen[src]) return;

      seen[src] = true;

      imagePool.push(src);

    });

  }



  function fillBlock(block) {

    block.querySelectorAll(".game-thumb-bg__tile img").forEach(function (img) {

      var src = nextSrc();

      if (src) img.src = src;

    });

  }



  function createBlock() {

    var block = document.createElement("div");

    block.className = "game-thumb-bg__block";



    for (var r = 0; r < ROWS; r++) {

      var row = document.createElement("div");

      row.className = "game-thumb-bg__row";

      if (r % 2 === 1) row.classList.add("is-offset");



      for (var c = 0; c < COLS; c++) {

        var tile = document.createElement("div");

        tile.className = "game-thumb-bg__tile";



        var img = document.createElement("img");

        img.alt = "";

        img.width = TILE_W;

        img.height = TILE_W;

        img.decoding = "async";

        img.loading = "lazy";

        img.src = nextSrc();



        tile.appendChild(img);

        row.appendChild(tile);

      }



      block.appendChild(row);

    }



    return block;

  }



  function measureBlockHeight() {

    blockHeight = calcBlockHeight();

    if (!track) return;

    var block = track.querySelector(".game-thumb-bg__block");

    if (block && block.offsetHeight > 0) {

      blockHeight = block.offsetHeight;

    }

  }



  function applyTransform() {

    if (!track) return;

    track.style.transform = "translate3d(0, " + scrollOffset + "px, 0)";

  }



  function recycleTopBlock() {

    if (!track || !track.firstElementChild) return;

    var block = track.firstElementChild;

    fillBlock(block);

    track.appendChild(block);

  }



  function tick(now) {

    if (!track || reducedMotion) return;



    if (!lastTime) lastTime = now;

    var dt = Math.min(0.05, (now - lastTime) / 1000);

    lastTime = now;



    scrollOffset += speedPxPerSec * dt;



    if (blockHeight > 0 && scrollOffset >= blockHeight) {

      scrollOffset -= blockHeight;

      recycleTopBlock();

    }



    applyTransform();

    rafId = window.requestAnimationFrame(tick);

  }



  function startLoop() {

    if (reducedMotion || !track) return;

    stopLoop();

    measureBlockHeight();

    lastTime = 0;

    scrollOffset = 0;

    applyTransform();

    root.classList.add("is-running");

    rafId = window.requestAnimationFrame(tick);

  }



  function stopLoop() {

    if (rafId) {

      window.cancelAnimationFrame(rafId);

      rafId = 0;

    }

    lastTime = 0;

    if (root) root.classList.remove("is-running");

  }



  function buildGrid(pool) {

    if (built || !root) return false;



    configureSizes();



    var sources = buildSourcesFromItems(pool);

    if (sources.length < MIN_IMAGES) {

      sources = sources.concat(

        buildSourcesFromItems(

          scrapeDomImages().map(function (url) {

            return { namespace: url, banner_image: url };

          })

        )

      );

    }



    if (sources.length < MIN_IMAGES) return false;



    imagePool = sources;

    poolCursor = Math.floor(Math.random() * imagePool.length);

    built = true;

    stopLoop();

    root.innerHTML = "";



    plane = document.createElement("div");

    plane.className = "game-thumb-bg__plane";



    track = document.createElement("div");

    track.className = "game-thumb-bg__track";



    for (var b = 0; b < BLOCKS; b++) {

      track.appendChild(createBlock());

    }



    plane.appendChild(track);

    root.appendChild(plane);

    root.classList.add("is-ready");



    window.requestAnimationFrame(function () {

      measureBlockHeight();

      startLoop();

    });



    return true;

  }



  function tryBuildFromSite() {

    if (built || !ensureRoot()) return false;

    var games = window.vixoGames;

    if (!games || games.length < MIN_IMAGES) return false;

    return buildGrid(games);

  }



  async function boot() {

    if (built || isMobilePerf()) return;

    if (!bootStarted) bootStarted = true;

    if (!ensureRoot()) return;



    if (tryBuildFromSite()) return;



    var pool = [];

    if (window.vixoGames && window.vixoGames.length >= MIN_POOL_SIZE) {

      pool = window.vixoGames;

    } else {

      pool = await gatherLightPool();

    }



    if (built) return;

    if (pool.length >= MIN_IMAGES && buildGrid(pool)) return;

    tryBuildFromSite();

  }



  function scheduleBoot() {

    if (built || bootScheduled || isMobilePerf()) return;

    bootScheduled = true;



    var run = function () {

      bootScheduled = false;

      boot();

    };



    if ("requestIdleCallback" in window) {

      window.requestIdleCallback(run, { timeout: 2800 });

    } else {

      window.setTimeout(run, 1500);

    }

  }



  function ensureRoot() {

    if (!root) {

      root = document.getElementById("game-thumb-bg");

      if (root) configureSizes();

    }

    return root;

  }



  function init() {

    if (!ensureRoot()) return;

    if (isMobilePerf()) {

      root.classList.add("is-mobile-static");

      root.classList.add("is-ready");

      return;

    }

    scheduleBoot();

  }



  document.addEventListener("vixo:games-loaded", function () {

    if (isMobilePerf()) return;

    if (built) {

      mergeMoreIntoPool(window.vixoGames || []);

      return;

    }

    if (tryBuildFromSite()) return;

    if (!bootStarted) scheduleBoot();

  });



  var resizeTimer = 0;

  window.addEventListener("resize", function () {

    if (!built) {

      configureSizes();

      return;

    }

    window.clearTimeout(resizeTimer);

    resizeTimer = window.setTimeout(function () {

      configureSizes();

      measureBlockHeight();

      if (blockHeight > 0 && scrollOffset >= blockHeight) {

        scrollOffset = scrollOffset % blockHeight;

        applyTransform();

      }

    }, 200);

  });



  document.addEventListener("visibilitychange", function () {

    if (document.hidden) {

      stopLoop();

    } else if (built && track) {

      startLoop();

    }

  });



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", init);

  } else {

    init();

  }

})();


