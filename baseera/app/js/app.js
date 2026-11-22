// App state + routing (a port of App/AppState.swift's navigation, on top of hash routes so the
// browser / Android back button works). Routes:
//   #/daily  #/search  #/result  #/saved  #/settings
//   #/mushaf[/s/a]  #/journey  #/story/<id>[/<passage>]  #/library/<work>[/<unit>]
import { loadJSON, Graph, Engine, Mushaf, buildLinkIndex, parseTimeline, parseLibrary } from './data.js';
import { store } from './store.js';
import { closeSheet, sheetOpen } from './ui.js';

export const app = {
  graph: null, engine: null, mushaf: null, links: null, timeline: null, library: null,
  route: { name: 'daily', parts: [] },
  /** «العودة إلى المصحف» / «العودة إلى الرحلة» (Result chip). */
  mushafReturn: null, journeyReturn: null,
  /** Where «مكتبة الأدعية» was entered from (route hash + tab). */
  libraryOrigin: null,
  /** Pending highlight for the library reader: {heritageID}. */
  libraryLink: null,
  suggestion: null,
  query: '',
  tabMemory: { journey: '#/journey' },
};

// ------------------------------------------------------------------ data
let graphP = null, mushafP = null, timelineP = null, libraryP = null;
export function getGraph() {
  graphP ??= loadJSON('data/baseera-pack.json').then((p) => { app.graph = new Graph(p); app.engine = new Engine(app.graph); return app.graph; });
  return graphP.catch((e) => { graphP = null; throw e; });
}
export function getMushaf() {
  mushafP ??= loadJSON('data/quran-mushaf.json').then((d) => (app.mushaf = new Mushaf(d)));
  return mushafP.catch((e) => { mushafP = null; throw e; });
}
export async function getLinks() {
  if (app.links) return app.links;
  const [g, m] = await Promise.all([getGraph(), getMushaf()]);
  app.links ??= buildLinkIndex(g, m);
  return app.links;
}
export function getTimeline() {
  timelineP ??= Promise.all([loadJSON('data/quran-timeline.json'), getMushaf()]).then(([d, m]) => (app.timeline = parseTimeline(d, m)));
  return timelineP.catch((e) => { timelineP = null; throw e; });
}
export function getLibrary() {
  libraryP ??= loadJSON('data/duas-library.json').then((d) => (app.library = parseLibrary(d)));
  return libraryP.catch((e) => { libraryP = null; throw e; });
}

// ------------------------------------------------------------------ routing
export function parseHash(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const name = parts.shift() || 'daily';
  return { name, parts };
}

export function tabOf(route) {
  switch (route.name) {
    case 'daily': return 'daily';
    case 'search': case 'result': return 'search';
    case 'mushaf': return 'mushaf';
    case 'journey': case 'story': return 'journey';
    case 'settings': case 'saved': return 'settings';
    case 'library': return app.libraryOrigin?.tab || 'search';
    default: return 'daily';
  }
}

/** Navigate. A sheet that is open is closed and its history entry reused. */
export function go(hash, { replace = false } = {}) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  if (sheetOpen()) { closeSheet(true); replace = true; }
  if (location.hash === hash) { window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
  if (replace) location.replace(hash); else location.hash = hash;
}

export function selectTab(tab) {
  const cur = tabOf(app.route);
  app.mushafReturn = null; app.journeyReturn = null; app.suggestion = null;
  switch (tab) {
    case 'daily': return go('#/daily');
    case 'search': return go('#/search');
    case 'mushaf': return go('#/mushaf');
    case 'journey': {
      // Tab memory: back to the story the reader left; tapping the tab while on a story goes up.
      if (cur === 'journey') return go('#/journey');
      return go(app.tabMemory.journey || '#/journey');
    }
    case 'settings': return go('#/settings');
  }
}

// ------------------------------------------------------------------ session trail (Result)
export function currentStep() {
  const { stack, index } = store.session;
  return index >= 0 && index < stack.length ? stack[index] : null;
}

let swapHook = null;
/** Result registers a transition hook (fade out 180 ms → swap → fade in). */
export function onNodeSwap(fn) { swapHook = fn; }

export function push(themeID, nodeID) {
  const apply = () => {
    const { stack, index } = store.session;
    const keep = index >= 0 ? stack.slice(0, index + 1) : [];
    store.session = { stack: [...keep, { themeID, nodeID }].slice(-60), index: 0 };
    store.session.index = store.session.stack.length - 1;
    store.save('session');
    app.query = ''; app.suggestion = null;
  };
  if (app.route.name === 'result' && swapHook) swapHook(apply);
  else { apply(); go('#/result'); }
}

export function jump(i) {
  if (i < 0 || i >= store.session.stack.length) return;
  const apply = () => { store.session.index = i; store.save('session'); };
  if (app.route.name === 'result' && swapHook) swapHook(apply); else { apply(); go('#/result'); }
}

export function search(text) {
  const step = currentStep();
  const r = app.engine.search(text, step?.nodeID);
  if (r.kind === 'node') { app.mushafReturn = null; app.journeyReturn = null; push(r.themeID, r.nodeID); return r; }
  app.suggestion = r.kind === 'suggestion' ? r.themeID : null;
  return r;
}

export function openTheme(themeID) {
  app.suggestion = null;
  const id = app.engine.pickNode(themeID, currentStep() ? [currentStep().nodeID] : []);
  if (id) push(themeID, id);
}

export function pivot(themeID) {
  const id = app.engine.pickNode(themeID, currentStep() ? [currentStep().nodeID] : []);
  if (id) push(themeID, id);
}

export function nextReflection() {
  const step = currentStep(); if (!step) return;
  const { stack, index } = store.session;
  const recent = stack.slice(0, index + 1).slice(-4).map((s) => s.nodeID);
  const id = app.engine.next(step.nodeID, step.themeID, recent);
  if (id) push(step.themeID, id);
}

// ------------------------------------------------------------------ saved
export function isSaved(nodeID) { return store.saved.some((s) => s.nodeID === nodeID); }
export function toggleSaved(step) {
  if (isSaved(step.nodeID)) store.saved = store.saved.filter((s) => s.nodeID !== step.nodeID);
  else store.saved = [{ nodeID: step.nodeID, themeID: step.themeID, at: Date.now() }, ...store.saved];
  store.save('saved');
  return isSaved(step.nodeID);
}

// ------------------------------------------------------------------ mushaf ↔ result
/** AppState.linkedNodeID: the node a lit mushaf word opens. */
export function linkedNode(word) {
  const g = app.graph; const t = word.themeID;
  const containing = g.nodesContaining(word.s, word.a).filter((n) => n.primary_theme === t || g.weight(n, t) > 0);
  const owner = g.nodesByID.get(word.nodeID); const ownerOK = owner && owner.enabled ? owner : null;
  const node = containing.find((n) => n.primary_theme === t && n.id === word.nodeID)
    || containing.find((n) => n.primary_theme === t) || ownerOK || containing[0];
  return node ? node.id : app.engine.pickNode(t, []);
}

export function openFromMushaf(word, back) {
  const id = linkedNode(word); if (!id) return;
  app.journeyReturn = null; app.mushafReturn = back;
  push(word.themeID, id);
}

export function openReflections(s, a, back, journey) {
  const node = app.graph.nodesContaining(s, a)[0]; if (!node) return;
  if (journey) { app.mushafReturn = null; app.journeyReturn = journey; } else { app.journeyReturn = null; app.mushafReturn = back; }
  push(node.primary_theme, node.id);
}

// ------------------------------------------------------------------ library
export function enterLibrary() {
  if (app.route.name !== 'library') app.libraryOrigin = { hash: location.hash || '#/search', tab: tabOf(app.route), name: app.route.name, about: false };
}
export function returnFromLibrary() {
  const o = app.libraryOrigin; app.libraryOrigin = null;
  go(o?.hash || '#/search');
  if (o?.about) setTimeout(() => import('./views/settings.js').then((m) => m.openAbout()), 60);
}
