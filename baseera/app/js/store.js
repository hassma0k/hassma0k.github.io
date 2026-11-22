// User data — kept ONLY in this browser's localStorage (nothing is ever sent anywhere).
// Every read is lenient: a missing / malformed value falls back to its default.
const PREFIX = 'baseera.';

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(PREFIX + key)); return v == null ? fallback : v; } catch { return fallback; }
}
function write(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode: in-memory only */ } }

const AYAH = { S: 26, M: 30, L: 36 };
const MUNAJAT = { M: 0, L: 1.5, XL: 3 };
const MUSHAF = { XS: 20, S: 23, M: 26, L: 30, XL: 34 };
export const SIZES = { AYAH, MUNAJAT, MUSHAF };

const defaults = { theme: 'day', ayahSize: 'M', munajatSize: 'M', mushafSize: 'S' };

export const store = {
  settings: { ...defaults, ...read('settings', {}) },
  session: read('session', { stack: [], index: -1 }),
  saved: read('saved', []),
  mushaf: read('mushaf', { last: null, bookmark: null }),
  journey: read('journey', { storyID: null, passage: 0, reached: {}, completed: [] }),
  library: read('library', { lastWork: null, positions: {} }),

  save(key) { write(key, this[key]); },
  set(key, patch) { Object.assign(this[key], patch); this.save(key); },
};

// sanity
if (!AYAH[store.settings.ayahSize]) store.settings.ayahSize = 'M';
if (MUNAJAT[store.settings.munajatSize] == null) store.settings.munajatSize = 'M';
if (!MUSHAF[store.settings.mushafSize]) store.settings.mushafSize = 'S';
if (!['day', 'night', 'auto'].includes(store.settings.theme)) store.settings.theme = 'day';
if (!Array.isArray(store.session.stack)) store.session = { stack: [], index: -1 };
if (!Array.isArray(store.saved)) store.saved = [];
if (!store.journey.reached || typeof store.journey.reached !== 'object') store.journey.reached = {};
if (!Array.isArray(store.journey.completed)) store.journey.completed = [];
if (!store.library.positions || typeof store.library.positions !== 'object') store.library.positions = {};

/** Applies theme + text sizes to the document. */
export function applySettings() {
  const s = store.settings;
  let theme = s.theme;
  if (theme === 'auto') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.setProperty('--ayah', AYAH[s.ayahSize]);
  root.style.setProperty('--munajat', 20 + MUNAJAT[s.munajatSize]);
  root.style.setProperty('--mushaf', MUSHAF[s.mushafSize]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#10161D' : '#F3EDE2');
}
