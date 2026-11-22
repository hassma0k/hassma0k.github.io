// مكتبة الأدعية — works → units → full-text reader (Features/Library/*, docs/LIBRARY-SPEC.md).
// A munajat source chip opens the reader at the quoted span, softly lit.
import { S, esc, icon, fmt, num, openSheet, closeSheet, copyText } from '../ui.js';
import { app, getLibrary, go, returnFromLibrary } from '../app.js';
import { store, applySettings } from '../store.js';
import { libraryBlocks, libKey } from '../data.js';
import { sacredPlain } from '../render.js';
import { arabicIndic } from '../arabic.js';
import { libraryCountLabel } from './search.js';

let pendingHighlight = null; // { work, unit, span }

function unitTitle(unit, work) {
  let t = unit.title;
  for (const sep of [' — ', ' - ', ' – ']) { const p = work.title + sep; if (t.startsWith(p) && t.length > p.length) { t = t.slice(p.length); break; } }
  return arabicIndic(t);
}
const readerTitle = (u, w) => (w.single ? w.title : unitTitle(u, w));
const reference = (u, w) => (w.single ? w.title : w.title + ' · ' + unitTitle(u, w));

function returnLabel() {
  const o = app.libraryOrigin;
  if (o?.about) return S.libraryReturnAbout;
  switch (o?.name) {
    case 'search': return S.libraryReturnSearch;
    case 'result': return S.libraryReturnResult;
    case 'journey': case 'story': return S.journeyReturn;
    case 'mushaf': return S.mushafReturn;
    case 'settings': return S.back;
    default: return S.back;
  }
}
const returnChip = () => `<button class="glass-chip" data-ret="1">${icon('back', 'xs')}<span>${esc(returnLabel())}</span></button>`;

function savePos(work, unit, para, offset) {
  store.library.lastWork = work.id;
  store.library.positions[work.id] = { unit: unit.id, para, offset };
  store.save('library');
}

export async function render(screen, parts) {
  const lib = await getLibrary();
  if (parts[0] === '@link') {
    const l = app.libraryLink; app.libraryLink = null;
    if (l) {
      const link = lib.link(l.heritageID);
      if (link) {
        const w = lib.byID.get(link.work); const u = w.units[w.unitIndex.get(link.unit)];
        const n = u.paras[link.para] ? Array.from(u.paras[link.para]).length : 0;
        const a = Math.min(Math.max(0, link.start), n), b = Math.min(Math.max(a, link.end), n);
        if (link.para < u.paras.length && b > a) pendingHighlight = { work: w.id, unit: u.id, span: { para: link.para, start: a, end: b } };
        else pendingHighlight = { work: w.id, unit: u.id, span: null, para: Math.min(link.para, u.paras.length - 1) };
        return go(`#/library/${w.id}/${u.id}`, { replace: true });
      }
      const w = lib.worksForSource(l.source)[0];
      if (w) return go(`#/library/${w.id}`, { replace: true });
    }
    return returnFromLibrary();
  }
  const work = lib.byID.get(parts[0]);
  if (!work) return go('#/search', { replace: true });
  if (!app.libraryOrigin) app.libraryOrigin = { hash: '#/search', tab: 'search', name: 'search' };
  if (parts[1] != null || work.single) return renderReader(screen, lib, work, parts[1] ?? work.units[0].id);
  return renderWork(screen, lib, work);
}

function renderWork(screen, lib, work) {
  const pos = store.library.positions[work.id];
  const posUnit = pos && work.unitIndex.has(pos.unit) ? work.units[work.unitIndex.get(pos.unit)] : null;
  screen.className = 'screen';
  screen.style.paddingTop = 'calc(70px + var(--safe-t))';
  screen.innerHTML = `
    <div class="topbar"><div class="topbar-row">${returnChip()}</div></div>
    <header class="lib-head"><h1>${esc(work.title)}</h1><div class="sub">${esc(work.subtitle)}</div><div class="c">${esc(libraryCountLabel(work))}</div><div class="ornament" aria-hidden="true"><i></i></div></header>
    ${posUnit ? `<button class="card lib-resume" data-unit="${esc(posUnit.id)}" data-resume="1"><div class="k">${S.libraryResume}</div><div class="t">${esc(unitTitle(posUnit, work))}</div><div class="s">${fmt(S.libraryUnitPositionFmt, num(work.unitIndex.get(posUnit.id) + 1), num(work.units.length))}</div></button>` : ''}
    <label class="field">${icon('search', 'sm')}<input type="search" id="flt" placeholder="${esc(S.libraryFilterPh)}" aria-label="${esc(S.libraryFilterPh)}"></label>
    <div class="rows" id="rows"></div>
    <div class="lib-note"><h4>${S.libraryNoteTitle}</h4>${work.note ? `<p>${esc(work.note)}</p>` : ''}<p>${esc(lib.note)}</p>${work.source ? `<p>${esc(fmt(S.libraryDigitalSourceFmt, work.source))}</p>` : ''}</div>`;
  const rows = screen.querySelector('#rows'); const flt = screen.querySelector('#flt');
  const list = () => {
    const q = libKey(flt.value);
    const num_ = /^[0-9]+$/.test(q) ? Number(q) : null;
    const out = [];
    work.units.forEach((u, i) => {
      if (!q) out.push([i, u, false]);
      else if (num_ != null && (num_ === i + 1 || u.id === q)) out.push([i, u, false]);
      else if (u.titleKey.includes(q)) out.push([i, u, false]);
      else if (u.textKey.includes(q)) out.push([i, u, true]);
    });
    rows.innerHTML = out.length ? out.slice(0, 400).map(([i, u, inText]) => {
      const t = unitTitle(u, work);
      const short = Array.from(t).length < 14;
      return `<button class="row lib-unit-row${posUnit && posUnit.id === u.id ? ' cur' : ''}" data-unit="${esc(u.id)}"><span class="num">${num(i + 1)}</span>
        <span class="main"><span class="t">${esc(t)}</span>${short ? `<span class="lead" style="display:block">${sacredPlain(u.lead)}</span>` : ''}${inText ? `<span class="intext">${S.libraryInText}</span>` : ''}</span></button>`;
    }).join('') : `<p class="muted center">${S.libraryNoMatch}</p>`;
  };
  flt.addEventListener('input', list); list();
  screen.addEventListener('click', (e) => {
    if (e.target.closest('[data-ret]')) return returnFromLibrary();
    const b = e.target.closest('[data-unit]'); if (b) go(`#/library/${work.id}/${b.dataset.unit}`);
  });
}

function blockMenu(text, ref) {
  const sheet = openSheet(`<div class="am-ref">${esc(ref)}</div>
    <button class="sheet-btn primary" data-a="copy">${icon('copy')}<span>${S.libraryCopy}</span></button>
    <button class="sheet-btn quiet" data-a="x">${S.cancel}</button>`, { label: S.libraryCopy });
  sheet.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    closeSheet();
    if (a === 'copy') copyText(text + '\n— ' + ref, S.libraryCopied);
  });
}

function renderReader(screen, lib, work, unitID) {
  if (!work.unitIndex.has(unitID)) return go(`#/library/${work.id}`, { replace: true });
  const idx = work.unitIndex.get(unitID); const unit = work.units[idx];
  const prev = work.units[idx - 1]; const next = work.units[idx + 1];
  let hl = null; let startPara = 0; let startOffset = 0;
  if (pendingHighlight && pendingHighlight.work === work.id && pendingHighlight.unit === unit.id) {
    hl = pendingHighlight.span; if (hl) { startPara = hl.para; startOffset = hl.start; } else startPara = pendingHighlight.para || 0;
  } else {
    const pos = store.library.positions[work.id];
    if (pos && pos.unit === unit.id) { startPara = pos.para || 0; startOffset = pos.offset || 0; }
  }
  pendingHighlight = null;
  savePos(work, unit, startPara, startOffset);
  const blocks = libraryBlocks(unit, hl);
  const ref = reference(unit, work);
  screen.className = 'screen reader-screen';
  screen.dataset.keepScroll = '1';
  let body = ''; let inQuote = false;
  for (const b of blocks) {
    if (b.hl && !inQuote) { body += `<div class="quoted" id="quoted"><div class="quoted-l">✦ ${S.libraryQuoted}</div>`; inQuote = true; }
    if (!b.hl && inQuote) { body += '</div>'; inQuote = false; }
    body += `<p class="blk${b.ps ? ' ps' : ''}" data-b="${b.id}" data-para="${b.para}" data-start="${b.start}" data-sacred="heritage" data-stored="${esc(b.text)}">${sacredPlain(b.text)}</p>`;
  }
  if (inQuote) body += '</div>';
  screen.innerHTML = `
    <div class="mbar">
      <div class="mbar-r1">
        <button class="nav-btn" data-u="${prev ? esc(prev.id) : ''}" aria-label="${S.libraryPrevUnit}" ${prev ? '' : 'disabled'}>${icon('back')}</button>
        <div class="mbar-title" role="heading" aria-level="1">${esc(readerTitle(unit, work))}</div>
        <button class="nav-btn" data-u="${next ? esc(next.id) : ''}" aria-label="${S.libraryNextUnit}" ${next ? '' : 'disabled'}>${icon('fwd')}</button>
      </div>
      <div class="mbar-r2">
        ${work.single ? '<span></span>' : `<button data-contents="1" style="color:var(--gold);display:inline-flex;align-items:center;gap:3px;padding:6px 4px;max-width:40%;overflow:hidden;white-space:nowrap">${icon('back', 'xs')}<span>${esc(work.title)}</span></button>`}
        <button class="nav-btn" data-size="1" aria-label="${S.libraryTextSize}">${icon('textsize')}</button>
        ${returnChip()}
      </div>
    </div>
    <header class="reader-head"><div class="w">${esc(work.title)}${work.single ? '' : ' · ' + fmt(S.libraryUnitPositionFmt, num(idx + 1), num(work.units.length))}</div>
      <h1>${esc(readerTitle(unit, work))}</h1><div class="ornament" aria-hidden="true"><i></i></div><div class="hint">${S.libraryLongPressHint}</div></header>
    <div class="sacred lib-text" lang="ar">${body}</div>
    <div class="end-l">${S.libraryEndOfUnit}</div>
    ${next ? `<button class="next-card" data-u="${esc(next.id)}"><div class="k">${S.libraryNextUnit}</div><div class="t">${esc(unitTitle(next, work))}</div><div class="s">${fmt(S.libraryUnitPositionFmt, num(idx + 2), num(work.units.length))}</div></button>`
      : `<div class="center" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${work.single ? '' : `<button class="chip" data-contents="1">${S.libraryContents}</button>`}<button class="chip" data-ret="1">${esc(returnLabel())}</button></div>`}`;

  screen.addEventListener('click', (e) => {
    const b = e.target.closest('[data-u],[data-contents],[data-ret],[data-size]'); if (!b) return;
    if (b.dataset.u) return go(`#/library/${work.id}/${b.dataset.u}`, { replace: true });
    if (b.dataset.contents) return go(`#/library/${work.id}`, { replace: true });
    if (b.dataset.ret) return returnFromLibrary();
    if (b.dataset.size) {
      const order = ['M', 'L', 'XL']; const i = order.indexOf(store.settings.munajatSize);
      store.settings.munajatSize = order[(i + 1) % 3]; store.save('settings'); applySettings();
    }
  });
  const text = screen.querySelector('.lib-text');
  let timer = 0; let lastOpen = 0;
  const openMenu = (p) => { if (Date.now() - lastOpen < 900) return; lastOpen = Date.now(); blockMenu(p.dataset.stored, ref); };
  text.addEventListener('contextmenu', (e) => { const p = e.target.closest('.blk'); if (p) { e.preventDefault(); clearTimeout(timer); openMenu(p); } });
  text.addEventListener('pointerdown', (e) => { const p = e.target.closest('.blk'); if (p) timer = setTimeout(() => openMenu(p), 600); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => text.addEventListener(ev, () => clearTimeout(timer)));
  text.addEventListener('pointermove', () => clearTimeout(timer));

  const els = Array.from(text.querySelectorAll('.blk'));
  let raf = 0; let saveT = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const top = screen.querySelector('.mbar').getBoundingClientRect().bottom + 4;
      const el = els.find((x) => x.getBoundingClientRect().bottom > top); if (!el) return;
      clearTimeout(saveT);
      saveT = setTimeout(() => savePos(work, unit, Number(el.dataset.para), Number(el.dataset.start)), 400);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  screen.addEventListener('mounted', async () => {
    await document.fonts.ready;
    let target = null;
    if (hl) target = screen.querySelector('#quoted');
    else if (startPara || startOffset) {
      let best = null; for (const b of blocks) { if (b.para === startPara) { if (!best || b.start <= startOffset) best = b; if (b.start > startOffset) break; } else if (b.para > startPara) break; }
      if (best) target = text.querySelector(`.blk[data-b="${best.id}"]`);
    }
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + scrollY - screen.querySelector('.mbar').offsetHeight - 12);
  }, { once: true });
  return () => window.removeEventListener('scroll', onScroll);
}
