// Reform heatmap tracker — served from /api/heatmap/h.js?site=<key>
// Source is hand-written ES2019 so no build step is needed; the server
// strips comments + collapses whitespace before serving.
//
// Privacy contract:
//   - No form values are read.
//   - No element text beyond tag name + ARIA role.
//   - No cookies, no localStorage, no third-party requests.
//   - Honors navigator.doNotTrack === '1' (loads but emits nothing).
//
// Placeholders replaced by the server:
//   __REFORM_SITE_KEY__      → per-site key
//   __REFORM_COLLECT_URL__   → absolute ingestion URL

(function () {
  var SITE_KEY = "__REFORM_SITE_KEY__";
  var COLLECT_URL = "__REFORM_COLLECT_URL__";
  var FLUSH_INTERVAL_MS = 5000;
  var MOVE_THROTTLE_MS = 100;      // 10 Hz
  var MAX_EVENTS_PER_FLUSH = 100;
  var RAGE_WINDOW_MS = 1000;
  var RAGE_RADIUS_PX = 50;
  var warned = false;

  function warnOnce(err) {
    if (warned) return;
    warned = true;
    try { console.warn("[reform-heatmap]", err); } catch (_) {}
  }

  try {
    if (typeof window === "undefined" || !window.document) return;
    if (window.__reformHeatmap__ && window.__reformHeatmap__.loaded) return;
    window.__reformHeatmap__ = { v: 1, siteKey: SITE_KEY, loaded: true };

    // DNT: load (so verify sees us) but emit nothing.
    var dnt = (navigator.doNotTrack === "1" || window.doNotTrack === "1");
    if (dnt) return;

    // Session ID — UUID in sessionStorage, per-tab lifetime.
    var sessionId;
    try {
      sessionId = sessionStorage.getItem("__reform_sid__");
      if (!sessionId) {
        sessionId = genUuid();
        sessionStorage.setItem("__reform_sid__", sessionId);
      }
    } catch (_) {
      sessionId = genUuid();
    }

    function genUuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return "sid-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
    }

    var queue = [];
    var recentClicks = [];   // {x, y, t} for client-side rage hint
    var maxScrollY = 0;
    var pageLoadAt = Date.now();

    function viewportMetrics() {
      var d = document.documentElement;
      var b = document.body || { scrollHeight: 0 };
      var pageH = Math.max(d.scrollHeight, b.scrollHeight, d.offsetHeight);
      var pageW = Math.max(d.scrollWidth, b.scrollWidth, d.offsetWidth);
      return {
        pageW: pageW,
        pageH: pageH,
        viewW: window.innerWidth || d.clientWidth,
        viewH: window.innerHeight || d.clientHeight,
      };
    }

    function push(evt) {
      if (queue.length >= MAX_EVENTS_PER_FLUSH) return;
      queue.push(evt);
    }

    // ── Click ─────────────────────────────────────────────────────────
    document.addEventListener("click", function (e) {
      try {
        var tgt = e.target;
        if (!tgt || !(tgt instanceof Element)) return;
        // Privacy: never observe typing targets.
        if (tgt.closest && tgt.closest("input, textarea, [contenteditable], [contenteditable='true']")) return;

        var m = viewportMetrics();
        var x = e.clientX;
        var y = e.clientY;
        var pageY = y + (window.scrollY || window.pageYOffset || 0);

        // Client-side rage hint — pruned server-side too.
        var now = Date.now();
        recentClicks = recentClicks.filter(function (c) { return now - c.t < RAGE_WINDOW_MS; });
        var rageHint = false;
        for (var i = 0; i < recentClicks.length; i++) {
          var dx = recentClicks[i].x - x;
          var dy = recentClicks[i].y - y;
          if (dx * dx + dy * dy <= RAGE_RADIUS_PX * RAGE_RADIUS_PX) {
            if (recentClicks.length >= 2) { rageHint = true; break; }
          }
        }
        recentClicks.push({ x: x, y: y, t: now });

        push({
          type: "click",
          x_pct: clamp(100 * x / m.viewW),
          y_pct: clamp(100 * y / m.viewH),
          page_y_pct: clamp(100 * pageY / Math.max(m.pageH, 1)),
          tag: (tgt.tagName || "").toLowerCase(),
          role: tgt.getAttribute && (tgt.getAttribute("role") || "") || "",
          rage: rageHint,
        });
      } catch (err) { warnOnce(err); }
    }, true);

    // ── Pointer move (throttled) ──────────────────────────────────────
    var lastMove = 0;
    document.addEventListener("pointermove", function (e) {
      var now = Date.now();
      if (now - lastMove < MOVE_THROTTLE_MS) return;
      lastMove = now;
      try {
        var m = viewportMetrics();
        var pageY = e.clientY + (window.scrollY || window.pageYOffset || 0);
        push({
          type: "move",
          x_pct: clamp(100 * e.clientX / m.viewW),
          page_y_pct: clamp(100 * pageY / Math.max(m.pageH, 1)),
        });
      } catch (err) { warnOnce(err); }
    }, true);

    // ── Scroll depth ──────────────────────────────────────────────────
    window.addEventListener("scroll", function () {
      try {
        var m = viewportMetrics();
        var bottom = (window.scrollY || window.pageYOffset || 0) + m.viewH;
        if (bottom > maxScrollY) maxScrollY = bottom;
      } catch (err) { warnOnce(err); }
    }, { passive: true });

    function emitScroll() {
      try {
        var m = viewportMetrics();
        push({
          type: "scroll",
          max_y_pct: clamp(100 * Math.min(maxScrollY, m.pageH) / Math.max(m.pageH, 1)),
          duration_ms: Date.now() - pageLoadAt,
        });
      } catch (err) { warnOnce(err); }
    }

    // ── View event ────────────────────────────────────────────────────
    function emitView() {
      push({ type: "view", referrer: (document.referrer || "").slice(0, 512) });
    }

    // ── Flushing ──────────────────────────────────────────────────────
    // fetch+keepalive only — navigator.sendBeacon is intentionally NOT
    // used. sendBeacon has no way to opt out of credentials and fires a
    // CORS request the browser treats as credentialed; paired with our
    // public endpoint's `Allow-Origin: *` + `Allow-Credentials: false`
    // response, every flush would be rejected. `fetch` with `keepalive:
    // true` + `credentials: "omit"` gives us the same unload-safe
    // delivery without the credentials problem.
    function flush() {
      if (queue.length === 0) return;
      try {
        var m = viewportMetrics();
        var payload = {
          site_key: SITE_KEY,
          session_id: sessionId,
          path: location.pathname + location.search,
          page_width_px: m.pageW,
          page_height_px: m.pageH,
          viewport_width: m.viewW,
          viewport_height: m.viewH,
          user_agent: (navigator.userAgent || "").slice(0, 256),
          events: queue.splice(0, MAX_EVENTS_PER_FLUSH),
        };
        fetch(COLLECT_URL, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          credentials: "omit",
          mode: "cors",
        }).catch(function () {});
      } catch (err) { warnOnce(err); }
    }

    function clamp(v) {
      if (v < 0) return 0;
      if (v > 100) return 100;
      return v;
    }

    // Kick off.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", emitView);
    } else {
      emitView();
    }
    var flushTimer = setInterval(function () { emitScroll(); flush(); }, FLUSH_INTERVAL_MS);

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { emitScroll(); flush(); }
    });
    window.addEventListener("pagehide", function () { emitScroll(); flush(); });

    // ── SPA route change detection ────────────────────────────────────
    // Next.js App Router, React Router, and every other client-side
    // router navigate by calling history.pushState/replaceState without
    // reloading the document, so `emitView` on DOMContentLoaded fires
    // only once per hard load. Without this hook, a site that renders
    // 10 routes as an SPA would only ever register a view for the first.
    // We wrap the history methods (preserving the original return value
    // and `this`), and listen for `popstate` (back/forward). On a real
    // route change we reset per-page state, emit a view, and flush so
    // the new path gets its own HeatmapPage row without waiting up to
    // FLUSH_INTERVAL_MS for the next scheduled flush.
    var currentPath = location.pathname + location.search;
    function onRouteChanged() {
      try {
        var next = location.pathname + location.search;
        if (next === currentPath) return;
        currentPath = next;
        maxScrollY = 0;
        pageLoadAt = Date.now();
        emitView();
        flush();
      } catch (err) { warnOnce(err); }
    }
    var _push = history.pushState;
    history.pushState = function () {
      var rv = _push.apply(this, arguments);
      onRouteChanged();
      return rv;
    };
    var _replace = history.replaceState;
    history.replaceState = function () {
      var rv = _replace.apply(this, arguments);
      onRouteChanged();
      return rv;
    };
    window.addEventListener("popstate", onRouteChanged);
  } catch (err) {
    warnOnce(err);
  }
})();
