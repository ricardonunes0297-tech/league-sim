/* League Sim offline worker.
   The game page is fetched fresh when online, so uploading a new index.html is all an update needs.
   When offline (or the network is slow) the last cached copy is used. Save files are never touched here. */
const CACHE = "leaguesim-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(rej, ms)); }

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Game page: network first, cache as fallback
  if (req.mode === "navigate") {
    e.respondWith(
      (() => {
        // Store the fresh page whenever it arrives, even if the slow-network fallback was used this time
        const net = fetch(req, { cache: "no-cache" }).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); } return res; });
        return Promise.race([net, timeout(4000)]).catch(() => caches.match("./index.html").then(hit => hit || net));
      })()
    );
    return;
  }

  // Google Fonts and our own files: serve from cache, refresh in the background
  if (url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
