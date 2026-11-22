// Baseera web — service worker: offline after the first visit.
// The app shell + fonts are cached at install; the content JSON is cached on first use (and warmed
// in the background once the first screen is up). Same-origin requests only — there are no others.
const CACHE = 'baseera-web-v1-9633e97926';
const SHELL = ["./", "index.html", "app.css", "manifest.webmanifest", "js/app.js", "js/arabic.js", "js/config.js", "js/data.js", "js/main.js", "js/render.js", "js/store.js", "js/strings.js", "js/ui.js", "js/views/daily.js", "js/views/journey.js", "js/views/library.js", "js/views/mushaf.js", "js/views/result.js", "js/views/search.js", "js/views/settings.js", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png", "fonts/KFGQPC-UthmanicHafs-v22.ttf", "fonts/NotoNaskhArabic-VF.woff2", "fonts/EBGaramond-VF.woff2"];
const DATA = ['data/baseera-pack.json', 'data/quran-mushaf.json', 'data/quran-timeline.json', 'data/duas-library.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('baseera-web-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // the app is one page: serve it from the cache, refresh it in the background
    event.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match('./index.html');
      const net = fetch(req).then((r) => { if (r.ok && url.pathname.endsWith('/')) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response('offline', { status: 503 });
    }));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && url.pathname.includes('/app/')) c.put(req, res.clone());
    return res;
  }));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'warm') return;
  event.waitUntil(caches.open(CACHE).then(async (c) => {
    for (const path of DATA) {
      const url = new URL(path, self.registration.scope).href;
      if (!(await c.match(url))) { try { const r = await fetch(url); if (r.ok) await c.put(url, r); } catch { /* offline: next time */ } }
    }
  }));
});
