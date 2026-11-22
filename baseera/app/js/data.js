// Content layer: lazy JSON loaders + ports of ContentGraph / Engine (Core/Content, Core/Engine),
// the mushaf model (Core/Quran/QuranModels), MushafLinks, the journey timeline and the duas library.
// Only the app's own static files are ever fetched.
import { normalize, tokenize, isLetterless, firstWords } from './arabic.js';

const cache = new Map();
/** Fetch one of our own JSON files once (the service worker keeps it for offline use). */
export function loadJSON(path) {
  if (!cache.has(path)) {
    const p = fetch(path).then((r) => { if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

// ================================================================== content graph

export class Graph {
  constructor(pack) {
    this.meta = pack.pack;
    this.themes = pack.themes || [];
    this.sources = pack.sources || [];
    this.daily = pack.daily;
    const by = (rows) => { const m = new Map(); for (const r of rows || []) if (!m.has(r.id)) m.set(r.id, r); return m; };
    this.themesByID = by(this.themes);
    this.sourcesByID = by(this.sources);
    this.ayat = by(pack.ayat);
    this.heritage = by(pack.heritage);
    this.actions = by(pack.actions);
    this.tadabbur = by(pack.tadabbur);
    this.nodes = (pack.nodes || []).map((n) => ({ ...n, enabled: n.enabled !== false }));
    this.nodesByID = by(this.nodes);
    this.highlights = pack.highlights || {};
    this.anchors = pack.anchors || {};
    this.categories = [...(pack.categories || [])].map((c, i) => ({ ...c, _i: i }))
      .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a._i - b._i);
    this.nodesByTheme = new Map();
    this.nodesByAyahKey = new Map();
    for (const n of this.nodes) {
      if (!n.enabled) continue;
      for (const tw of n.themes || []) if (tw.weight > 0) {
        if (!this.nodesByTheme.has(tw.theme_id)) this.nodesByTheme.set(tw.theme_id, []);
        this.nodesByTheme.get(tw.theme_id).push(n);
      }
      const a = this.ayat.get(n.ayah_id);
      if (a && a.surah > 0 && a.ayah_start > 0) {
        for (let k = a.ayah_start; k <= Math.max(a.ayah_start, a.ayah_end || 0); k++) {
          const key = a.surah * 1000 + k;
          if (!this.nodesByAyahKey.has(key)) this.nodesByAyahKey.set(key, []);
          this.nodesByAyahKey.get(key).push(n.id);
        }
      }
    }
    // echoes: validated, ≤ 3 per node
    this.echoes = new Map();
    for (const [nodeID, raw] of Object.entries(pack.echoes || {})) {
      const n = this.nodesByID.get(nodeID); if (!n) continue;
      const a = this.ayat.get(n.ayah_id); const m = this.heritage.get(n.munajat_id); if (!a || !m) continue;
      const ac = tokenize(a.text).length, mc = tokenize(m.text).length;
      const pairs = [];
      for (const p of raw || []) {
        if (!Array.isArray(p) || p.length !== 2) continue;
        if (p[0] < 0 || p[0] >= ac || p[1] < 0 || p[1] >= mc) continue;
        if (pairs.some((q) => q[0] === p[0] && q[1] === p[1])) continue;
        pairs.push(p); if (pairs.length === 3) break;
      }
      if (pairs.length) this.echoes.set(nodeID, pairs);
    }
  }
  theme(id) { return this.themesByID.get(id); }
  themeName(id) { return this.theme(id)?.name_ar || ''; }
  nodesInTheme(id) { return this.nodesByTheme.get(id) || []; }
  enabledNodes() { return this.nodes.filter((n) => n.enabled); }
  sourceName(h) { return this.sourcesByID.get(h.source)?.name_ar || h.source; }
  weight(node, themeID) { return (node.themes || []).find((t) => t.theme_id === themeID)?.weight || 0; }
  relatedScore(from, to) { return this.nodesByID.get(from)?.related?.find((r) => r.node_id === to)?.score || 0; }
  nodesContaining(s, a) { return (this.nodesByAyahKey.get(s * 1000 + a) || []).map((id) => this.nodesByID.get(id)); }

  /** Everything a screen needs for one node (ResolvedNode). */
  resolve(id) {
    const node = this.nodesByID.get(id); if (!node) return null;
    const ayah = this.ayat.get(node.ayah_id), munajat = this.heritage.get(node.munajat_id), wisdom = this.heritage.get(node.wisdom_id);
    const action = this.actions.get(node.action_id), tadabbur = this.tadabbur.get(node.tadabbur_id);
    if (!ayah || !munajat || !wisdom || !action || !tadabbur) return null;
    const map = (list) => { const m = new Map(); for (const h of list || []) if (!m.has(h.token)) m.set(h.token, h); return m; };
    const echoes = this.echoes.get(id) || [];
    return {
      id, node, ayah, munajat, wisdom, action, tadabbur,
      ayahHL: map(this.highlights[ayah.id]), munajatHL: map(this.highlights[munajat.id]), wisdomHL: map(this.highlights[wisdom.id]),
      anchor: this.anchors[id] ?? null,
      echoAyah: new Set(echoes.map((p) => p[0])), echoMunajat: new Set(echoes.map((p) => p[1])),
    };
  }

  /** TopicCatalog.build — categories in order, then uncategorised themes. */
  catalog() {
    const known = new Set(this.categories.map((c) => c.id));
    const groups = this.categories.map((c) => ({ category: c, themes: this.themes.filter((t) => t.category_id === c.id) })).filter((g) => g.themes.length);
    const rest = this.themes.filter((t) => !t.category_id || !known.has(t.category_id));
    if (rest.length) groups.push({ category: null, themes: rest });
    return groups;
  }
}

// ================================================================== engine

function weightedPick(items) {
  if (!items.length) return null;
  const total = items.reduce((s, it) => s + Math.max(0, it.w), 0);
  if (total <= 0) return items[Math.min(items.length - 1, Math.floor(Math.random() * items.length))].id;
  let r = Math.random() * total;
  for (const it of items) { r -= Math.max(0, it.w); if (r <= 0) return it.id; }
  return items[items.length - 1].id;
}

function commonPrefixLength(a, b) {
  const x = Array.from(a), y = Array.from(b); let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
}

export class Engine {
  constructor(graph) { this.g = graph; }
  /** Normalize → longest alias substring → weighted node; else a suggestion (never empty). */
  search(query, excluding) {
    const q = normalize(query).trim();
    if (!q) return { kind: 'nothing' };
    const themeID = this.matchTheme(q);
    if (themeID) {
      const nodeID = this.pickNode(themeID, excluding ? [excluding] : []);
      if (nodeID) return { kind: 'node', themeID, nodeID };
    }
    const s = this.suggestTheme(q);
    return s ? { kind: 'suggestion', themeID: s } : { kind: 'nothing' };
  }
  matchTheme(q) {
    let best = null;
    for (const t of this.g.themes) for (const alias of t.aliases || []) {
      if (!alias) continue;
      const pos = q.indexOf(alias); if (pos < 0) continue;
      const len = Array.from(alias).length;
      if (!best || len > best.len || (len === best.len && pos < best.pos)) best = { id: t.id, len, pos };
    }
    return best?.id || null;
  }
  suggestTheme(q) {
    const themes = this.g.themes; if (!themes.length || !q) return null;
    const words = [...q.split(' ').filter(Boolean), q];
    let best = null;
    for (const t of themes) for (const alias of t.aliases || []) {
      if (!alias) continue;
      for (const w of words) { const l = commonPrefixLength(w, alias); if (l > 0 && (!best || l > best.l)) best = { id: t.id, l }; }
    }
    if (best) return best.id;
    return themes[(Array.from(q).length * 7) % themes.length].id;
  }
  pickNode(themeID, excluding = []) {
    const all = this.g.nodesInTheme(themeID);
    let cands = all.filter((n) => !excluding.includes(n.id));
    if (!cands.length) cands = all;
    return weightedPick(cands.map((n) => ({ id: n.id, w: this.g.weight(n, themeID) })));
  }
  /** «تأمل آخر»: same theme, not the current one nor the last 3 visited, related-weighted. */
  next(currentID, themeID, recent = []) {
    const all = this.g.nodesInTheme(themeID).filter((n) => n.id !== currentID);
    if (!all.length) return null;
    const recentSet = new Set(recent.slice(-3));
    let cands = all.filter((n) => !recentSet.has(n.id)); if (!cands.length) cands = all;
    return weightedPick(cands.map((n) => ({ id: n.id, w: this.g.weight(n, themeID) * (0.5 + 0.5 * this.g.relatedScore(currentID, n.id)) })));
  }
}

/** Engine.dailyIndex: day counter since 2000-01-01 of the LOCAL date of (now − reset hour). */
export function dailyIndex(count, resetHour, now = new Date()) {
  if (!count) return 0;
  const shifted = new Date(now.getTime() - resetHour * 3600 * 1000);
  const days = Math.round((Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()) - Date.UTC(2000, 0, 1)) / 86400000);
  return ((days % count) + count) % count;
}

// ================================================================== mushaf

export class Mushaf {
  constructor(doc) {
    this.doc = doc;
    this.surahs = doc.surahs;
    this.ayat = doc.ayat;
    this.basmala = doc.basmala;
    this.juz = doc.juz; this.quarters = doc.quarters; this.pages = doc.pages;
    this.sajdas = new Set((doc.sajdas || []).map((x) => x.s * 1000 + x.a));
    this.pageStarts = new Map(doc.pages.map((p) => [p.s * 1000 + p.a, p.n]));
    this.juzStarts = new Map(doc.juz.map((j) => [j.s * 1000 + j.a, j.n]));
    this.quarterStarts = new Map(doc.quarters.map((q) => [q.s * 1000 + q.a, q.n]));
  }
  surah(n) { return this.surahs[n - 1]; }
  text(s, a) { return this.ayat[s - 1]?.[a - 1]; }
  contains(s, a) { return s >= 1 && s <= 114 && a >= 1 && a <= this.surahs[s - 1].ayas; }
  static key(s, a) { return s * 1000 + a; }
  /** Last start ≤ (s,a) in a table of {n,s,a}. */
  static locate(table, s, a) {
    const k = s * 1000 + a; let lo = 0, hi = table.length - 1, ans = table[0];
    while (lo <= hi) { const mid = (lo + hi) >> 1; const mk = table[mid].s * 1000 + table[mid].a; if (mk <= k) { ans = table[mid]; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  page(s, a) { return Mushaf.locate(this.pages, s, a).n; }
  juzOf(s, a) { return Mushaf.locate(this.juz, s, a).n; }
  quarterOf(s, a) { return Mushaf.locate(this.quarters, s, a).n; }
}

/** MushafLinkIndex: the pack's lit words mapped onto (ayah, word) of the stored mushaf text. */
export function buildLinkIndex(graph, mushaf) {
  const byKey = new Map(); const seen = new Set();
  for (const node of graph.enabledNodes()) {
    const row = graph.ayat.get(node.ayah_id); if (!row) continue;
    const hl = graph.highlights[row.id]; if (!hl || !hl.length) continue;
    if (!(row.surah > 0 && row.ayah_start > 0)) continue;
    const end = Math.max(row.ayah_start, row.ayah_end || 0);
    const slots = []; let ok = true;
    for (let a = row.ayah_start; a <= end; a++) {
      if (!mushaf.contains(row.surah, a)) { ok = false; break; }
      tokenize(mushaf.text(row.surah, a)).forEach((t, i) => slots.push({ s: row.surah, a, word: i, text: t }));
    }
    if (!ok) continue;
    const pt = tokenize(row.text); if (!pt.length || pt.length > slots.length) continue;
    let offset = -1;
    for (let st = 0; st <= slots.length - pt.length && offset < 0; st++) {
      let m = true; for (let j = 0; j < pt.length; j++) if (slots[st + j].text !== pt[j]) { m = false; break; }
      if (m) offset = st;
    }
    if (offset < 0) continue;
    for (const h of hl) {
      if (h.token < 0 || h.token >= pt.length) continue;
      const sl = slots[offset + h.token];
      if (isLetterless(sl.text)) continue;
      const slot = (sl.s * 1000 + sl.a) * 1000 + sl.word; if (seen.has(slot)) continue; seen.add(slot);
      const k = sl.s * 1000 + sl.a;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push({ s: sl.s, a: sl.a, word: sl.word, themeID: h.theme_id, nodeID: node.id });
    }
  }
  return byKey;
}

// ================================================================== journey

export function parseTimeline(doc, mushaf) {
  if (!doc || doc.schema !== 1) throw new Error('timeline schema');
  const sections = []; const stories = []; const ids = new Set();
  for (const sec of doc.sections || []) {
    const out = { id: sec.id, title: sec.title_ar || sec.title_en || '', stories: [] };
    for (const st of sec.stories || []) {
      if (!st || !st.id || ids.has(st.id)) { if (st && ids.has(st.id)) throw new Error('dup story'); continue; }
      const passages = [];
      for (const p of st.passages || []) {
        let a = p.a, b = p.b ?? p.a; if (!(p.s >= 1 && p.s <= 114) || !(a >= 1)) continue; if (b < a) [a, b] = [b, a];
        const max = mushaf.surah(p.s).ayas; if (a > max) continue; b = Math.min(b, max);
        passages.push({ s: p.s, a, b });
      }
      if (!passages.length) continue;
      ids.add(st.id);
      const story = { id: st.id, title: st.title_ar || st.title_en, short: st.short_ar || st.title_ar, subtitle: st.subtitle_ar || '', passages, section: out };
      out.stories.push(story); stories.push(story);
    }
    if (out.stories.length) sections.push(out);
  }
  if (!stories.length) throw new Error('no stories');
  stories.forEach((s, i) => { s.index = i; });
  return { sections, stories, byID: new Map(stories.map((s) => [s.id, s])) };
}

// ================================================================== duas library

export const WORKS_BY_SOURCE = {
  sahifa_sajjadiyya: ['sahifa'], whispered_prayers: ['munajat15'], kumayl: ['kumayl'],
  abu_hamza: ['abu_hamza'], arafah: ['arafah'], jawshan_kabir: ['jawshan'],
};

/** LibrarySearch.key: normalize + no whitespace + Arabic-Indic digits → ASCII. */
export function libKey(text) {
  return normalize(text).replace(/\s+/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

export function parseLibrary(doc) {
  if (!doc || (doc.schema ?? 1) !== 1) throw new Error('library schema');
  const works = []; const ids = new Set();
  for (const w of doc.works || []) {
    if (!w || !w.id || !w.title_ar) continue;
    if (ids.has(w.id)) throw new Error('dup work');
    const units = []; const uids = new Set();
    for (const u of w.units || []) {
      if (!u || u.id == null) continue; const id = String(u.id); if (uids.has(id)) continue;
      const paras = (u.paras || []).filter((p) => typeof p === 'string' && p.trim());
      if (!paras.length) continue;
      uids.add(id);
      units.push({ id, title: u.title_ar || id, paras, _tk: null, _xk: null,
        get titleKey() { return this._tk ??= libKey(this.title); },
        get textKey() { return this._xk ??= libKey(this.paras.join(' ')); },
        get lead() { return firstWords(Array.from(this.paras[0]).slice(0, 240).join(''), 11); } });
    }
    if (!units.length) continue;
    ids.add(w.id);
    works.push({ id: w.id, title: w.title_ar, subtitle: w.subtitle_ar || '', source: w.source_ar || '', note: w.note_ar || '', packSource: w.pack_source || '', units,
      unitIndex: new Map(units.map((u, i) => [u.id, i])), get single() { return this.units.length === 1; } });
  }
  if (!works.length) throw new Error('empty library');
  const byID = new Map(works.map((w) => [w.id, w]));
  return {
    note: doc.note_ar || '', works, byID,
    links: doc.links || {},
    link(heritageID) { const l = this.links[heritageID]; if (!l) return null; const w = byID.get(l.work); if (!w || !w.unitIndex.has(String(l.unit))) return null; return { ...l, unit: String(l.unit) }; },
    worksForSource(src) { const ids = [...(WORKS_BY_SOURCE[src] || [])]; for (const w of works) if (w.packSource === src && !ids.includes(w.id)) ids.push(w.id); return ids.map((i) => byID.get(i)).filter(Boolean); },
  };
}

/** LibraryLayout.blocks — paragraphs cut into ~520-scalar display blocks; the quoted span isolated. */
export function libraryBlocks(unit, span) {
  const TARGET = 520, HARD = 1100;
  const isSpace = (c) => c === ' ' || c === ' ' || c === '\n' || c === '\t';
  const strong = (c) => c === '.' || c === '؟' || c === '!' || c === '؛' || c === ':' || c === '۔';
  const weak = (c) => c === '،' || c === ',';
  const cut = (s, from, to, test) => { if (from >= to) return null; for (let i = Math.max(from, 2); i <= to; i++) if (isSpace(s[i - 1]) && test(s[i - 2])) { let j = i; while (j < to && isSpace(s[j])) j++; return j; } return null; };
  const spaceCut = (s, from, to) => { if (from >= to) return null; for (let i = Math.max(from, 1); i <= to; i++) if (isSpace(s[i - 1])) { let j = i; while (j < to && isSpace(s[j])) j++; return j; } return null; };
  const split = (s, a, b) => { const out = []; let st = a; while (b - st > HARD) { const ws = st + TARGET, we = Math.min(b, st + HARD); const c = cut(s, ws, we, strong) ?? cut(s, ws, we, weak) ?? spaceCut(s, ws, we) ?? we; out.push([st, c]); st = c; } if (st < b) out.push([st, b]); return out; };
  const blocks = [];
  unit.paras.forEach((text, p) => {
    const s = Array.from(text); const n = s.length; if (!n) return;
    let segs = [[0, n, false]];
    if (span && span.para === p && span.start < n) {
      let a = Math.min(Math.max(0, span.start), n), b = Math.min(Math.max(a, span.end), n);
      while (a > 0 && !isSpace(s[a - 1])) a--; while (b < n && !isSpace(s[b])) b++; while (b < n && isSpace(s[b])) b++;
      if (b <= a) b = Math.min(n, a + 1);
      segs = []; if (a > 0) segs.push([0, a, false]); segs.push([a, b, true]); if (b < n) segs.push([b, n, false]);
    }
    let first = true, firstHL = true;
    for (const [a, b, hl] of segs) for (const [x, y] of split(s, a, b)) {
      const t = s.slice(x, y).join('').trim(); if (!t) continue;
      blocks.push({ id: blocks.length, para: p, start: x, end: y, text: t, hl, hlStart: hl && firstHL, ps: first });
      first = false; if (hl) firstHL = false;
    }
  });
  return blocks;
}
