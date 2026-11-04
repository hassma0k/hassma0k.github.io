/* Service worker: the core shell is cached at install; every page and asset the reader opens is cached as it
   is fetched (network first for pages so updates arrive, cache first for assets). Offline navigations that
   were never visited fall back to the language's offline page. Tokens are filled by build.mjs. */
var VERSION = 'sirat-2026-11-04T06:31';
var BASE = '/sirat';
var SHELL = ["/sirat/assets/css/site.css","/sirat/assets/js/app.js","/sirat/assets/img/icon-day.svg","/sirat/en/","/sirat/en/offline/","/sirat/en/journey/","/sirat/en/topics/","/sirat/en/reflections/","/sirat/en/settings/","/sirat/en/proofs/","/sirat/assets/data/questions-en.json","/sirat/assets/data/reflections-en.json","/sirat/manifest-en.webmanifest","/sirat/ar/","/sirat/ar/offline/","/sirat/ar/journey/","/sirat/ar/topics/","/sirat/ar/reflections/","/sirat/ar/settings/","/sirat/ar/proofs/","/sirat/assets/data/questions-ar.json","/sirat/assets/data/reflections-ar.json","/sirat/manifest-ar.webmanifest","/sirat/id/","/sirat/id/offline/","/sirat/id/journey/","/sirat/id/topics/","/sirat/id/reflections/","/sirat/id/settings/","/sirat/id/proofs/","/sirat/assets/data/questions-id.json","/sirat/assets/data/reflections-id.json","/sirat/manifest-id.webmanifest","/sirat/hi/","/sirat/hi/offline/","/sirat/hi/journey/","/sirat/hi/topics/","/sirat/hi/reflections/","/sirat/hi/settings/","/sirat/hi/proofs/","/sirat/assets/data/questions-hi.json","/sirat/assets/data/reflections-hi.json","/sirat/manifest-hi.webmanifest","/sirat/es/","/sirat/es/offline/","/sirat/es/journey/","/sirat/es/topics/","/sirat/es/reflections/","/sirat/es/settings/","/sirat/es/proofs/","/sirat/assets/data/questions-es.json","/sirat/assets/data/reflections-es.json","/sirat/manifest-es.webmanifest","/sirat/fr/","/sirat/fr/offline/","/sirat/fr/journey/","/sirat/fr/topics/","/sirat/fr/reflections/","/sirat/fr/settings/","/sirat/fr/proofs/","/sirat/assets/data/questions-fr.json","/sirat/assets/data/reflections-fr.json","/sirat/manifest-fr.webmanifest","/sirat/tr/","/sirat/tr/offline/","/sirat/tr/journey/","/sirat/tr/topics/","/sirat/tr/reflections/","/sirat/tr/settings/","/sirat/tr/proofs/","/sirat/assets/data/questions-tr.json","/sirat/assets/data/reflections-tr.json","/sirat/manifest-tr.webmanifest","/sirat/ru/","/sirat/ru/offline/","/sirat/ru/journey/","/sirat/ru/topics/","/sirat/ru/reflections/","/sirat/ru/settings/","/sirat/ru/proofs/","/sirat/assets/data/questions-ru.json","/sirat/assets/data/reflections-ru.json","/sirat/manifest-ru.webmanifest","/sirat/assets/fonts/Amiri-Bold.woff2","/sirat/assets/fonts/Amiri-Regular.woff2","/sirat/assets/fonts/AmiriQuran.ttf","/sirat/assets/fonts/CrimsonPro-Italic-VF.woff2","/sirat/assets/fonts/CrimsonPro-VF.woff2","/sirat/assets/fonts/EBGaramond-Italic-VF.woff2","/sirat/assets/fonts/EBGaramond-VF.woff2","/sirat/assets/fonts/NotoNaskhArabic-VF.woff2","/sirat/assets/fonts/NotoSerifCyrillic-VF.woff2","/sirat/assets/fonts/NotoSerifDevanagari-VF.woff2","/sirat/assets/fonts/NotoSerifHebrew-VF.woff2"];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSION).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
function offlinePage(req) {
  var m = new URL(req.url).pathname.replace(BASE, '').match(/^\/([a-z]{2})\//);
  var lang = m ? m[1] : 'en';
  return caches.match(BASE + '/' + lang + '/offline/').then(function (r) { return r || caches.match(BASE + '/en/offline/'); });
}
self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).then(function (res) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); return res; })
      .catch(function () { return caches.match(req).then(function (r) { return r || offlinePage(req); }); }));
    return;
  }
  ev.respondWith(caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) { if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); } return res; });
  }));
});
