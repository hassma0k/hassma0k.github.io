// Entry point: tab bar, router, service worker.
import { app, parseHash, tabOf, selectTab } from './app.js';
import { applySettings, store } from './store.js';
import { S, icon, closeSheet, sheetOpen, consumeIgnorePop } from './ui.js';
import * as daily from './views/daily.js';
import * as searchV from './views/search.js';
import * as result from './views/result.js';
import * as mushaf from './views/mushaf.js';
import * as journey from './views/journey.js';
import * as library from './views/library.js';
import * as settings from './views/settings.js';

applySettings();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (store.settings.theme === 'auto') applySettings(); });

const VIEWS = {
  daily: daily.render, search: searchV.render, result: result.render, mushaf: mushaf.render,
  journey: journey.renderHome, story: journey.renderStory, library: library.render,
  settings: settings.render, saved: settings.renderSaved,
};

const TABS = [
  ['daily', S.tabDaily, 'mihrab'], ['search', S.tabSearch, 'sun'], ['mushaf', S.tabMushaf, 'book'],
  ['journey', S.tabJourney, 'path'], ['settings', S.tabSettings, 'gear'],
];
const tabs = document.getElementById('tabs');
tabs.innerHTML = TABS.map(([id, label, ic]) => `<button class="tab" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`).join('');
tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) selectTab(b.dataset.tab); });

const root = document.getElementById('app');
let renderToken = 0;
let cleanup = null;

async function route() {
  const r = parseHash();
  if (!VIEWS[r.name]) { location.replace('#/daily'); return; }
  const prevName = app.route.name;
  app.route = r;
  const tab = tabOf(r);
  for (const b of tabs.children) b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
  if (r.name === 'story') app.tabMemory.journey = location.hash;
  if (r.name === 'journey') app.tabMemory.journey = '#/journey';
  const token = ++renderToken;
  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
  const screen = document.createElement('div');
  try {
    const out = await VIEWS[r.name](screen, r.parts, { isCurrent: () => token === renderToken });
    if (token !== renderToken) return;
    cleanup = typeof out === 'function' ? out : null;
  } catch (err) {
    console.warn(err);
    if (token !== renderToken) return;
    screen.className = 'screen';
    screen.innerHTML = `<div class="loading">${S.errContentLoad}</div>`;
  }
  root.replaceChildren(screen);
  if (prevName !== r.name || r.name !== 'result') screen.classList.add('fade-in');
  if (!screen.dataset.keepScroll) window.scrollTo(0, 0);
  screen.dispatchEvent(new Event('mounted'));
}

window.addEventListener('hashchange', route);
window.addEventListener('popstate', () => {
  if (consumeIgnorePop()) return;
  if (sheetOpen()) closeSheet(false, true);
});

route();

// Offline: the service worker caches the app shell, fonts and (after first use) the data files.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => {
      // After the first screen is up and the device is idle, keep the remaining content for
      // offline reading (all four data files — only our own static files are requested).
      const warm = () => navigator.serviceWorker.controller?.postMessage({ type: 'warm' });
      if (navigator.serviceWorker.controller) setTimeout(warm, 6000);
      else navigator.serviceWorker.addEventListener('controllerchange', () => setTimeout(warm, 6000), { once: true });
    }).catch(() => {});
  });
}


// «أضف إلى الشاشة الرئيسية» (Android Chrome) — kept for the Settings row.
window.addEventListener('beforeinstallprompt', (e) => { app.installPrompt = e; });
