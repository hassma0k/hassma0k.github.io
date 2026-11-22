// شجرة النور (Features/Result/ResultView.swift): ayah with lit concept words + the gold dot,
// munajat with lit words and IQTIBAS echo underlines, wisdom, action card, «تأمّل آخر», source chips.
import { S, esc, icon, fmt, num, openSheet, closeSheet, toast, copyText } from '../ui.js';
import { quranHTML, sacredHTML } from '../render.js';
import { app, getGraph, currentStep, onNodeSwap, jump, pivot, nextReflection, isSaved, toggleSaved, go, search,
  enterLibrary, getMushaf } from '../app.js';
import { store } from '../store.js';
import { WORKS_BY_SOURCE } from '../data.js';
import { searchFieldHTML, suggestionHTML, wireSearchField } from './search.js';
import { ayahCopyText } from '../arabic.js';

function sourceChip(h, g) {
  const linked = !!WORKS_BY_SOURCE[h.source];
  const name = esc(g.sourceName(h));
  const inner = `${icon('bookOpen', 'sm')}<span>${name}</span>${linked ? icon('fwd', 'xs') : ''}`;
  return linked ? `<button class="chip" data-lib="${esc(h.id)}" aria-label="${esc(S.source)}: ${name}">${inner}</button>`
    : `<span class="chip">${inner}</span>`;
}

function layersHTML(r, g) {
  return `
    <div class="ayah-wrap"><div class="sacred quran center" lang="ar" data-sacred="quran" data-stored="${esc(r.ayah.text)}">${quranHTML(r.ayah.text, {
      hl: r.ayahHL, echo: r.echoAyah, anchor: r.anchor, breaks: r.ayah.ayah_breaks, first: r.ayah.ayah_start,
      dotLabel: S.tadabbur })}</div></div>
    <div class="ref">${esc(r.ayah.ref_ar)}</div>
    <div class="hint" style="margin-top:6px">${S.tapWord}</div>
    ${r.anchor != null ? `<div class="hint">${icon('bulb')}<span>${S.tapDot}</span></div>` : ''}

    <div class="ldiv glow"><span>${S.manifest}</span></div>
    <div class="sacred munajat" lang="ar" data-sacred="heritage" data-stored="${esc(r.munajat.text)}">${sacredHTML(r.munajat.text, { hl: r.munajatHL, echo: r.echoMunajat })}</div>
    <div class="src-row">${sourceChip(r.munajat, g)}</div>
    ${r.echoMunajat.size ? `<p class="echo-hint">${S.echoesHint}</p>` : ''}

    <div class="ldiv muted"><span>${S.wisdom}</span></div>
    <div class="wisdom-wrap"><div class="sacred wisdom" lang="ar" data-sacred="heritage" data-stored="${esc(r.wisdom.text)}">${sacredHTML(r.wisdom.text, { hl: r.wisdomHL })}</div></div>
    <div class="src-row">${sourceChip(r.wisdom, g)}</div>

    <div class="card lg action"><div class="l">${S.action}</div><div class="t">${esc(r.action.text_ar)}</div></div>`;
}

function topBarHTML(g) {
  const { stack, index } = store.session;
  const step = currentStep();
  const saved = isSaved(step.nodeID);
  let chip = '';
  if (app.mushafReturn) {
    chip = `<button class="glass-chip" data-back="mushaf" style="margin-top:6px">${icon('back', 'xs')}${icon('book', 'sm')}<span>${S.mushafReturn}</span><span>·</span><span style="font-weight:400">${fmt(S.mushafPageFmt, num(app.mushafReturn.page))}</span></button>`;
  } else if (app.journeyReturn) {
    const st = app.timeline?.byID.get(app.journeyReturn.storyID);
    chip = `<button class="glass-chip" data-back="journey" style="margin-top:6px">${icon('back', 'xs')}${icon('path', 'sm')}<span>${S.journeyReturn}</span>${st ? `<span>·</span><span style="font-weight:400">${esc(st.short)}</span>` : ''}</button>`;
  }
  return `<div class="topbar"><div class="topbar-row">
      <div class="crumbs-scroll">${stack.map((s, i) => `${i ? '<span class="crumb-sep" aria-hidden="true">‹</span>' : ''}<button class="crumb${i === index ? ' on' : ''}" data-crumb="${i}" ${i === index ? 'aria-current="step"' : ''}>${esc(g.themeName(s.themeID))}</button>`).join('')}</div>
      <button class="round-btn${saved ? ' on' : ''}" data-save="1" aria-label="${saved ? S.a11yBookmarkRemove : S.a11yBookmarkAdd}">${icon('bookmark', saved ? 'fill' : '')}</button>
      <button class="round-btn" data-more="1" aria-label="${S.a11yMore}">${icon('ellipsis')}</button>
    </div>${chip}</div>`;
}

function tadabburSheet(r) {
  const sheet = openSheet(`<div class="tq-l">${S.tadabbur}</div><div class="tq-q">${esc(r.tadabbur.question_ar)}</div>
    <button class="reveal" data-reveal="1" aria-label="${esc(S.revealA11y)}">${icon('up')}<span>${S.revealA11y}</span></button>`, { label: S.tadabbur });
  sheet.querySelector('[data-reveal]').addEventListener('click', (e) => {
    e.currentTarget.outerHTML = `<div class="answer" aria-label="${esc(S.tadabburAnswer)}">${esc(r.tadabbur.answer_ar)}</div>`;
  });
}

function menuSheet(r, step, rerenderBar) {
  const saved = isSaved(step.nodeID);
  const sheet = openSheet(`
    <button class="sheet-btn primary" data-a="save">${icon('bookmark', saved ? 'fill' : '')}<span>${saved ? S.unsave : S.save}</span></button>
    <button class="sheet-btn" data-a="copy">${icon('copy')}<span>${S.mushafCopyAyah}</span></button>
    <button class="sheet-btn" data-a="mushaf">${icon('book')}<span>${S.journeyOpenInMushaf}</span></button>
    <button class="sheet-btn quiet" data-a="cancel">${S.cancel}</button>`, { label: S.a11yMore });
  sheet.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'save') { const on = toggleSaved(step); toast(on ? S.savedToast : S.unsavedToast); closeSheet(); rerenderBar(); }
    if (a === 'copy') {
      const ay = r.ayah;
      const text = '﴿' + ay.text + '﴾' + ' [' + ay.ref_ar + ']';
      closeSheet(); copyText(text, S.mushafCopied);
    }
    if (a === 'mushaf') { app.mushafReturn = null; go(`#/mushaf/${r.ayah.surah}/${r.ayah.ayah_start}`); }
    if (a === 'cancel') closeSheet();
  });
}

function miniSearch() {
  const sheet = openSheet(`<div style="padding-top:4px">${searchFieldHTML('')}</div><div id="msg"></div>`, { label: S.a11yMiniSearch });
  const form = sheet.querySelector('form');
  form.querySelector('input').placeholder = S.miniPh;
  wireSearchField(form, (q) => {
    const res = search(q);
    if (res.kind === 'suggestion') {
      sheet.querySelector('#msg').innerHTML = suggestionHTML(res.themeID);
      sheet.querySelector('[data-suggest]').addEventListener('click', () => { closeSheet(true); app.suggestion = null; import('../app.js').then((m) => m.openTheme(res.themeID)); });
    } else if (res.kind === 'node') closeSheet(true);
  });
}

export async function render(screen) {
  const g = await getGraph();
  const step = currentStep();
  screen.className = 'screen result';
  if (!step || !g.resolve(step.nodeID)) {
    screen.innerHTML = `<div class="loading"><p>${S.trailEmpty}</p><button class="chip" data-go="1">${S.tabSearch}</button></div>`;
    screen.querySelector('[data-go]').onclick = () => go('#/search');
    return;
  }
  let r = g.resolve(step.nodeID);
  if (app.mushafReturn || app.journeyReturn) screen.classList.add('with-chip');
  screen.innerHTML = `${topBarHTML(g)}<div class="layers">${layersHTML(r, g)}</div>
    <div class="floating"><button class="fpill" data-next="1" aria-label="${esc(S.a11yAnother)}">${S.another}</button>
    <button class="mini-btn" data-mini="1" aria-label="${esc(S.a11yMiniSearch)}">${icon('search')}</button></div>`;

  const scrollCrumb = () => screen.querySelector('.crumb.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  const rerenderBar = () => { screen.querySelector('.topbar').outerHTML = topBarHTML(g); scrollCrumb(); };
  screen.addEventListener('mounted', scrollCrumb, { once: true });

  onNodeSwap((apply) => {
    const layers = screen.querySelector('.layers');
    layers.classList.add('out');
    setTimeout(() => {
      apply();
      const s = currentStep(); r = g.resolve(s.nodeID);
      layers.innerHTML = layersHTML(r, g);
      rerenderBar();
      window.scrollTo(0, 0);
      requestAnimationFrame(() => layers.classList.remove('out'));
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  });

  screen.addEventListener('click', (e) => {
    const t = e.target.closest('[data-dot],[data-theme],[data-crumb],[data-save],[data-more],[data-next],[data-mini],[data-lib],[data-back]');
    if (!t) return;
    const step = currentStep();
    if (t.dataset.dot) { e.stopPropagation(); tadabburSheet(r); return; }
    if (t.dataset.theme) return pivot(t.dataset.theme);
    if (t.dataset.crumb) return jump(Number(t.dataset.crumb));
    if (t.dataset.save) { const on = toggleSaved(step); toast(on ? S.savedToast : S.unsavedToast); rerenderBar(); return; }
    if (t.dataset.more) return menuSheet(r, step, rerenderBar);
    if (t.dataset.next) return nextReflection();
    if (t.dataset.mini) return miniSearch();
    if (t.dataset.lib) {
      const hrt = g.heritage.get(t.dataset.lib);
      enterLibrary(); app.libraryLink = { heritageID: hrt.id, source: hrt.source };
      return go('#/library/@link');
    }
    if (t.dataset.back === 'mushaf') { const b = app.mushafReturn; app.mushafReturn = null; return go(`#/mushaf/${b.s}/${b.a}`); }
    if (t.dataset.back === 'journey') { const b = app.journeyReturn; app.journeyReturn = null; return go(`#/story/${b.storyID}/${b.passage}`); }
  });
  screen.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lit')) { e.preventDefault(); e.target.click(); } });
  return () => onNodeSwap(null);
}

export { getMushaf, ayahCopyText };
