// المصحف — the whole Quran, one surah per continuous scroll (Features/Mushaf/*, docs/MUSHAF-SPEC.md):
// surah band + basmala, justified RTL Hafs text, digits-only ayah markers, hizb ۞, inline page marks,
// lit (glowing) words → شجرة النور, long-press / marker tap → ayah menu, last-read + bookmark, index.
import { S, esc, icon, fmt, num, openSheet, closeSheet, toast, copyText, h } from '../ui.js';
import { quranHTML } from '../render.js';
import { ayahMarker, ayahCopyText, NBSP, sacredDisplay, normalize, quranDisplay } from '../arabic.js';
import { app, getMushaf, getLinks, getGraph, go, openFromMushaf, openReflections, linkedNode, push } from '../app.js';
import { store, applySettings } from '../store.js';
import { Mushaf } from '../data.js';

const linkRegistry = [];

/** HTML of ayat a…b of surah s (mushaf and journey). opts.marks: page / hizb / juz marks. */
export function ayatHTML(m, s, from, to, { marks = true, links = null, reflections = null } = {}) {
  let out = '';
  const bm = store.mushaf.bookmark;
  for (let a = from; a <= to; a++) {
    const key = s * 1000 + a;
    if (marks) {
      const page = m.pageStarts.get(key);
      const juz = m.juzStarts.get(key);
      if (page && !(a === from)) out += `<span class="pm" data-page="${page}">${juz ? fmt(S.mushafJuzFmt, num(juz)) + ' · ' : ''}${num(page)}</span> `;
      const q = m.quarterStarts.get(key);
      if (q && key !== 1001 && !(a === 1)) out += `<span class="hz" aria-hidden="true">۞</span> `;
    }
    let lit = null;
    const words = links?.get(key);
    if (words?.length) {
      lit = new Map();
      for (const w of words) { linkRegistry.push(w); lit.set(w.word, { idx: linkRegistry.length - 1 }); }
    }
    const stored = m.text(s, a);
    const cls = ['am', 'mk'];
    if (reflections?.has(key)) cls.push('rf');
    if (bm && bm.s === s && bm.a === a) cls.push('bm');
    out += `<span class="ay" data-s="${s}" data-a="${a}" data-sacred="quran" data-stored="${esc(stored)}">${quranHTML(stored, { lit })}${NBSP}<span class="${cls.join(' ')}" role="button" tabindex="0" aria-label="${esc(fmt(S.mushafA11yAyahFmt, m.surah(s).name, num(a)))}">${ayahMarker(a)}</span></span> `;
  }
  return out;
}

export function linkFor(idx) { return linkRegistry[Number(idx)]; }

export function basmalaHTML(m) {
  return `<div class="basmala sacred" data-sacred="quran" data-stored="${esc(m.basmala)}">${quranHTML(m.basmala)}</div>`;
}

function bandHTML(m, s) {
  const su = m.surah(s);
  return `<div class="band" role="heading" aria-level="2" aria-label="${esc(fmt(S.mushafSurahFmt, su.name))}">
    <span class="band-m r">${su.type === 'meccan' ? S.mushafMeccan : S.mushafMedinan}</span>
    <span class="band-t">${esc(sacredDisplay(fmt(S.mushafSurahFmt, su.name)))}</span>
    <span class="band-m l">${fmt(S.mushafAyatCountFmt, num(su.ayas))}</span></div>`;
}

/** Ayah menu (long-press): bookmark · copy · «تأملات هذه الآية». */
export function ayahMenu(m, s, a, { journey = null, back = null, onClose } = {}) {
  const su = m.surah(s);
  const stored = m.text(s, a);
  const has = app.graph && app.graph.nodesContaining(s, a).length > 0;
  const sheet = openSheet(`
    <div class="am-ref">${esc(su.name)} · ${num(a)}</div>
    <div class="sacred quran am-preview" data-sacred="quran" data-stored="${esc(stored)}">${quranHTML(stored)}</div>
    <button class="sheet-btn primary" data-a="bm">${icon('bookmark')}<span>${S.mushafSaveBookmark}</span></button>
    ${has ? `<button class="sheet-btn gold" data-a="rf">${icon('sun')}<span>${S.mushafReflections}</span></button>` : ''}
    ${journey ? `<button class="sheet-btn" data-a="open">${icon('book')}<span>${S.journeyOpenInMushaf}</span></button>` : ''}
    <button class="sheet-btn quiet" data-a="copy">${icon('copy', 'sm')}<span>${S.mushafCopyAyah}</span></button>`, { label: fmt(S.mushafA11yAyahFmt, su.name, num(a)), onClose });
  sheet.addEventListener('click', (e) => {
    const act = e.target.closest('[data-a]')?.dataset.a; if (!act) return;
    if (act === 'bm') {
      store.mushaf.bookmark = { s, a, page: m.page(s, a), at: Date.now() }; store.save('mushaf');
      document.querySelectorAll('.am.bm').forEach((x) => x.classList.remove('bm'));
      document.querySelector(`.ay[data-s="${s}"][data-a="${a}"] .am`)?.classList.add('bm');
      closeSheet(); toast(S.mushafBookmarkSaved);
    }
    if (act === 'copy') { closeSheet(); copyText(ayahCopyText(stored, su.name, a), S.mushafCopied); }
    if (act === 'rf') openReflections(s, a, back || { s, a, page: m.page(s, a) }, journey);
    if (act === 'open') go(`#/mushaf/${s}/${a}`);
  });
}

/** Long-press (contextmenu on Android) / marker tap → menu; lit word tap → the tree. */
export function wireAyat(root, m, { journey = null, backFor } = {}) {
  let timer = 0; let start = null; let lastOpen = 0;
  const open = (ay) => {
    if (Date.now() - lastOpen < 900) return;
    lastOpen = Date.now();
    const s = Number(ay.dataset.s), a = Number(ay.dataset.a);
    ay.classList.add('sel');
    ayahMenu(m, s, a, { journey: journey?.(s, a), back: backFor?.(s, a), onClose: () => ay.classList.remove('sel') });
  };
  root.addEventListener('contextmenu', (e) => { const ay = e.target.closest('.ay'); if (ay) { e.preventDefault(); clearTimeout(timer); open(ay); } });
  root.addEventListener('pointerdown', (e) => {
    const ay = e.target.closest('.ay'); if (!ay) return;
    start = [e.clientX, e.clientY];
    timer = setTimeout(() => { start = null; open(ay); }, 600);
  });
  const cancel = (e) => { if (start && e.type === 'pointermove' && Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 8) return; clearTimeout(timer); };
  root.addEventListener('pointermove', cancel); root.addEventListener('pointerup', cancel); root.addEventListener('pointercancel', cancel);
  root.addEventListener('click', (e) => {
    if (Date.now() - lastOpen < 900) return;
    const lit = e.target.closest('[data-link]');
    if (lit) {
      const w = linkFor(lit.dataset.link); if (!w) return;
      if (journey) { const id = linkedNode(w); if (id) { app.mushafReturn = null; app.journeyReturn = journey(w.s, w.a); push(w.themeID, id); } }
      else openFromMushaf(w, backFor ? backFor(w.s, w.a) : null);
      return;
    }
    const mk = e.target.closest('.am.mk'); if (mk) open(mk.closest('.ay'));
  });
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lit,.am.mk')) { e.preventDefault(); e.target.click(); } });
}

// ------------------------------------------------------------------ index sheet
function indexSheet(m, cur) {
  let tab = 'surahs';
  const box = h('<div></div>');
  const draw = () => {
    box.innerHTML = `<div class="idx-tabs" role="tablist">
      <button data-tab="surahs" aria-pressed="${tab === 'surahs'}">${S.mushafSurahs}</button>
      <button data-tab="juz" aria-pressed="${tab === 'juz'}">${S.mushafJuzs}</button></div>
      ${tab === 'surahs' ? `<label class="field">${icon('search', 'sm')}<input id="flt" type="search" placeholder="${esc(S.mushafFilterPh)}" aria-label="${esc(S.mushafFilterPh)}"></label><div class="rows" id="rows"></div>`
      : `<div class="rows">${m.juz.map((j) => `<button class="row${j.n === cur.juz ? ' cur' : ''}" data-go="${j.s}/${j.a}"><span class="num">${num(j.n)}</span><span class="main"><span class="t">${fmt(S.mushafJuzFmt, num(j.n))}</span><br><span class="s">${fmt(S.mushafJuzStartsFmt, `${esc(m.surah(j.s).name)} ${num(j.a)}`)}</span></span><span class="end">${fmt(S.mushafPageFmt, num(j.page))}</span></button>`).join('')}</div>`}
      <form class="go-page"><label class="field"><input name="p" type="number" inputmode="numeric" min="1" max="604" placeholder="${esc(S.mushafGoToPage)}" aria-label="${esc(S.mushafGoToPage)}"></label><button>${S.mushafGo}</button></form>`;
    if (tab === 'surahs') {
      const rows = box.querySelector('#rows'); const flt = box.querySelector('#flt');
      const list = () => {
        const q = normalize(flt.value).replace(/\s+/g, '');
        const items = m.surahs.filter((su) => {
          if (!q) return true;
          const n = normalize(su.name).replace(/\s+/g, '');
          const qd = q.replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660);
          return n.includes(q) || n.replace(/^ال/, '').includes(q.replace(/^ال/, '')) || String(su.n) === qd || su.tname.toLowerCase().replace(/[^a-z]/g, '').includes(q.replace(/[^a-z]/g, '') || '#');
        });
        rows.innerHTML = items.length ? items.map((su) => `<button class="row${su.n === cur.s ? ' cur' : ''}" data-go="${su.n}/1"><span class="num">${num(su.n)}</span><span class="main"><span class="t">${esc(su.name)}</span><br><span class="s">${su.type === 'meccan' ? S.mushafMeccan : S.mushafMedinan} · ${fmt(S.mushafAyatCountFmt, num(su.ayas))}</span></span><span class="end">${fmt(S.mushafPageFmt, num(su.page))}</span></button>`).join('')
          : `<p class="muted center">${S.mushafNoSurah}</p>`;
      };
      flt.addEventListener('input', list); list();
    }
    box.querySelector('.go-page').addEventListener('submit', (e) => {
      e.preventDefault(); const p = Number(e.target.p.value);
      if (p >= 1 && p <= 604) { const pg = m.pages[p - 1]; go(`#/mushaf/${pg.s}/${pg.a}`, { replace: true }); }
    });
  };
  box.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); return; }
    const g = e.target.closest('[data-go]'); if (g) go(`#/mushaf/${g.dataset.go}`, { replace: true });
  });
  draw();
  openSheet(box, { label: S.mushafOpenIndex });
  setTimeout(() => box.querySelector('.row.cur')?.scrollIntoView({ block: 'center' }), 340);
}

// ------------------------------------------------------------------ screen
export async function render(screen, parts) {
  const [m] = await Promise.all([getMushaf(), getGraph().catch(() => null)]);
  const links = await getLinks().catch(() => null);
  let s = Number(parts[0]); let a = Number(parts[1]);
  if (!m.contains(s, a || 1)) {
    const last = store.mushaf.last;
    if (last && m.contains(last.s, last.a)) { s = last.s; a = last.a; } else { s = 1; a = 1; }
  }
  a = a || 1;
  const su = m.surah(s);
  const reflections = app.graph ? new Set(app.graph.nodesByAyahKey.keys()) : null;
  linkRegistry.length = 0;
  screen.className = 'screen mushaf-screen';
  screen.dataset.keepScroll = '1';
  screen.innerHTML = `
    <div class="mbar" id="mbar">
      <div class="mbar-r1">
        <button class="nav-btn" data-nav="prevSurah" aria-label="${S.mushafPrevSurah}" ${s === 1 ? 'disabled' : ''}>${icon('back')}</button>
        <button class="mbar-title" data-nav="index" aria-label="${S.mushafOpenIndex}">${esc(fmt(S.mushafSurahFmt, su.name))}</button>
        <button class="nav-btn" data-nav="nextSurah" aria-label="${S.mushafNextSurah}" ${s === 114 ? 'disabled' : ''}>${icon('fwd')}</button>
      </div>
      <div class="mbar-r2">
        <div class="mbar-sub">
          <button class="nav-btn" data-nav="prevJuz" aria-label="${S.mushafPrevJuz}">${icon('back')}</button>
          <button data-nav="index" id="juzL"></button>
          <button class="nav-btn" data-nav="nextJuz" aria-label="${S.mushafNextJuz}">${icon('fwd')}</button>
        </div>
        <button data-nav="index" id="pageL" style="color:var(--muted);font-size:12.5px;padding:6px 2px"></button>
        <div class="mbar-sub">
          ${store.mushaf.bookmark ? `<button class="nav-btn" data-nav="bookmark" aria-label="${S.mushafGoToBookmark}">${icon('bookmark', 'fill')}</button>` : ''}
          <button class="nav-btn" data-nav="size" aria-label="${S.mushafSize}">${icon('textsize')}</button>
          <button class="nav-btn" data-nav="index" aria-label="${S.mushafOpenIndex}">${icon('list')}</button>
        </div>
      </div>
    </div>
    ${bandHTML(m, s)}
    ${su.basmala ? basmalaHTML(m) : ''}
    <div class="sacred mushaf-text" lang="ar">${ayatHTML(m, s, 1, su.ayas, { links, reflections })}</div>
    <div class="mushaf-end">
      ${s < 114 ? `<button class="next-card" data-go="${s + 1}/1"><div class="k">${S.mushafNextSurah}</div><div class="t">${esc(fmt(S.mushafSurahFmt, m.surah(s + 1).name))}</div><div class="s">${fmt(S.mushafPageFmt, num(m.surah(s + 1).page))}</div></button>` : ''}
    </div>`;

  const text = screen.querySelector('.mushaf-text');
  const ays = Array.from(text.querySelectorAll('.ay'));
  const bar = screen.querySelector('#mbar');
  const juzL = screen.querySelector('#juzL'); const pageL = screen.querySelector('#pageL');
  let curA = a;
  const describe = (ay) => {
    const juz = m.juzOf(s, ay); const q = m.quarterOf(s, ay);
    juzL.textContent = fmt(S.mushafJuzFmt, num(juz));
    pageL.textContent = `${fmt(S.mushafHizbFmt, num(Math.floor((q + 3) / 4)))} · ${fmt(S.mushafPageFmt, num(m.page(s, ay)))}`;
  };
  describe(a);
  const firstVisible = () => {
    const top = bar.getBoundingClientRect().bottom + 6;
    let lo = 0, hi = ays.length - 1, ans = ays.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (ays[mid].getBoundingClientRect().bottom > top) { ans = mid; hi = mid - 1; } else lo = mid + 1; }
    return Number(ays[ans].dataset.a);
  };
  let raf = 0; let saveT = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const v = firstVisible();
      if (v !== curA) { curA = v; describe(v); }
      clearTimeout(saveT);
      saveT = setTimeout(() => { store.mushaf.last = { s, a: curA }; store.save('mushaf'); }, 400);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const scrollToAyah = (n) => {
    if (n <= 1) { window.scrollTo(0, 0); return; }
    const el = text.querySelector(`.ay[data-a="${n}"]`); if (!el) return;
    const top = el.getClientRects()[0]?.top ?? el.getBoundingClientRect().top;
    window.scrollTo(0, Math.max(0, top + scrollY - bar.getBoundingClientRect().height - 14));
  };
  screen.addEventListener('mounted', async () => {
    await document.fonts.ready;
    scrollToAyah(a);
    requestAnimationFrame(() => { curA = a > 1 ? firstVisible() : 1; describe(curA); });
    store.mushaf.last = { s, a }; store.save('mushaf');
  }, { once: true });

  const backFor = (ss, aa) => ({ s: ss, a: aa, page: m.page(ss, aa) });
  wireAyat(text, m, { backFor });
  screen.querySelector('.mbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]'); if (!b) return;
    const nav = b.dataset.nav;
    if (nav === 'index') return indexSheet(m, { s, juz: m.juzOf(s, curA) });
    if (nav === 'prevSurah' && s > 1) return go(`#/mushaf/${s - 1}/1`, { replace: true });
    if (nav === 'nextSurah' && s < 114) return go(`#/mushaf/${s + 1}/1`, { replace: true });
    if (nav === 'prevJuz' || nav === 'nextJuz') {
      const k = s * 1000 + curA;
      const starts = m.juz.map((j) => j.s * 1000 + j.a);
      let target;
      if (nav === 'nextJuz') target = m.juz.find((j) => j.s * 1000 + j.a > k);
      else { const cur = m.juzOf(s, curA); const startK = starts[cur - 1]; target = k > startK ? m.juz[cur - 1] : m.juz[cur - 2]; }
      if (target) go(`#/mushaf/${target.s}/${target.a}`, { replace: true });
      return;
    }
    if (nav === 'bookmark') { const bm = store.mushaf.bookmark; if (bm) go(`#/mushaf/${bm.s}/${bm.a}`, { replace: true }); return; }
    if (nav === 'size') {
      const order = ['XS', 'S', 'M', 'L', 'XL'];
      const i = order.indexOf(store.settings.mushafSize);
      store.settings.mushafSize = order[(i + 1) % order.length]; store.save('settings'); applySettings();
      const keep = curA; requestAnimationFrame(() => { scrollToAyah(keep); curA = keep; describe(keep); });
    }
  });
  screen.querySelector('.mushaf-end').addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) go(`#/mushaf/${g.dataset.go}`, { replace: true }); });
  return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
}

export { Mushaf, quranDisplay };
