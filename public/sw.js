/* Service worker: precaches the app shell so the app opens instantly from
   the home screen and works offline. Data still comes from Firestore /
   localStorage — only static files are cached here.

   Strategy:
   - page navigations  → network first, cached page as offline fallback
   - same-origin files → stale-while-revalidate (serve cache, refresh behind)
   - Firebase SDK (gstatic, versioned URLs) → cache first
   - TMDb posters     → cache first, in a cache that survives version bumps
   - everything else (Firestore, auth, TMDb API) → untouched, network only */

importScripts("./js/version.js");

const CACHE_NAME = `service-log-v${APP_VERSION}`;

/* Posters are immutable per URL and expensive to refetch, so they live in
   their own cache that release bumps don't clear (see `activate`). Bounded so
   a long watchlist can't grow storage without limit. */
// v2: v1 could store 404s as opaque responses and serve them forever, so the
// name is bumped to drop any poisoned entries (activate deletes unknown caches).
const POSTER_CACHE = "tmdb-posters-v2";
const POSTER_CACHE_MAX = 300;

const SHELL = [
  "./",
  "./index.html",
  "./vehicles.html",
  "./vehicle.html",
  "./vehicle-form.html",
  "./record-form.html",
  "./login.html",
  "./movies.html",
  "./movie-search.html",
  "./settings.html",
  "./reminders.html",
  "./categories.html",
  "./changelog.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/version.js",
  "./js/shell.js",
  "./js/firebase-config.js",
  "./js/core.js",
  "./js/garage.store.js",
  "./js/watchlist.store.js",
  "./js/tmdb.js",
  "./js/movies.js",
  "./js/movie-search.js",
  "./js/auth.js",
  "./js/garage.js",
  "./js/agenda.js",
  "./js/vehicle.js",
  "./js/vehicle-form.js",
  "./js/record-form.js",
  "./js/settings.js",
  "./js/reminders.js",
  "./js/categories.js",
  "./js/changelog.js",
  "./js/pull-refresh.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache each file individually so one miss doesn't fail the whole install.
    await Promise.allSettled(SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      // Keep the poster cache across releases — its entries are still valid.
      if (key !== CACHE_NAME && key !== POSTER_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await refresh) || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// Oldest-first eviction — Cache Storage returns keys in insertion order.
async function trimPosterCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= POSTER_CACHE_MAX) return;
  for (const key of keys.slice(0, keys.length - POSTER_CACHE_MAX)) {
    await cache.delete(key);
  }
}

async function posterCacheFirst(request) {
  const cache = await caches.open(POSTER_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  // An <img> request is no-cors, so its response is opaque: status 0 and
  // `ok` false whether TMDb served the poster or a 404 HTML page. Caching on
  // opaqueness alone therefore stores failures, and because this is
  // cache-first that poster stays broken forever.
  //
  // image.tmdb.org sends `access-control-allow-origin: *`, so refetch with
  // CORS to get a real status and store only genuine hits. A miss still
  // returns the error response, which fires the <img> error handler and
  // leaves the placeholder tile in place.
  //
  // `cache: "no-store"` is load-bearing, not tidiness: posters are served with
  // max-age ~1 year, so an earlier no-cors <img> load leaves an *opaque* entry
  // in the HTTP cache, and a CORS request that reuses it fails with a
  // TypeError. Bypassing the HTTP cache keeps this fetch honest — we store the
  // result in Cache Storage ourselves anyway.
  let response;
  try {
    response = await fetch(request.url, { mode: "cors", credentials: "omit", cache: "no-store" });
  } catch {
    return fetch(request); // CORS attempt failed — serve the plain request
  }

  if (response.ok) {
    await cache.put(request, response.clone());
    trimPosterCache(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === "https://www.gstatic.com") {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin === "https://image.tmdb.org") {
    event.respondWith(posterCacheFirst(request));
    return;
  }
  if (url.origin !== location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
