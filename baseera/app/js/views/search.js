// النور — search by feeling / word, «مكتبة الأدعية» row, topic explorer, resume card
// (Features/Search/SearchView.swift, TopicsSection.swift, Library/LibrarySection.swift).
import { S, esc, icon, h, plural, fmt } from '../ui.js';
import { app, getGraph, getLibrary, search, openTheme, go, currentStep, enterLibrary } from '../app.js';
import { store } from '../store.js';

export function searchFieldHTML(value = '') {
  return `<form class="search-field" role="search" autocomplete="off">
    ${icon('search')}
    <input type="search" name="q" enterkeyhint="search" placeholder="${esc(S.searchPh)}" aria-label="${esc(S.searchPh)}" value="${esc(value)}" lang="ar" dir="rtl">
    <button type="button" class="clear-btn" aria-label="${esc(S.searchClear)}" hidden>${icon('close', 'sm')}</button>
    <button type="submit" class="go" aria-label="${esc(S.searchGo)}">${icon('arrow')}</button>
  </form>`;
}

/** goldSoft card «لم أجد نورًا لهذه الكلمة. هل تقصد «X»؟» + the gentle note. */
export function suggestionHTML(themeID) {
  const name = app.graph.themeName(themeID);
  const [pre, post] = S.noMatchFmt.split('«%@»');
  return `<button class="suggest" data-suggest="${esc(themeID)}"><div class="s1">${esc(pre)}<b>«${esc(name)}»</b>${esc(post ?? '')}</div><div class="s2">${esc(S.moreTopicsSoon)}</div></button>`;
}

export function wireSearchField(form, onSubmit) {
  const input = form.querySelector('input');
  const clear = form.querySelector('.clear-btn');
  const sync = () => { clear.hidden = !input.value; };
  input.addEventListener('input', () => { sync(); app.query = input.value; });
  clear.addEventListener('click', () => { input.value = ''; app.query = ''; sync(); input.focus(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); input.blur(); onSubmit(input.value); });
  sync();
}

export function libraryCountLabel(work) {
  const n = work.units.length;
  if (n <= 1) return S.libraryFullText;
  switch (work.id) {
    case 'sahifa': return plural('libraryDuas', n);
    case 'munajat15': return plural('libraryMunajat', n);
    case 'jawshan': return plural('librarySections', n);
    default: return plural('libraryTexts', n);
  }
}

async function librarySection(container) {
  try {
    const lib = await getLibrary();
    const last = store.library.lastWork;
    container.innerHTML = `<div class="kicker">${S.libraryTitle}</div><p class="lib-sub">${S.librarySubtitle}</p>
      <div class="lib-row">${lib.works.map((w) => `<button class="lib-card${w.id === last ? ' last' : ''}" data-work="${esc(w.id)}">
        <span class="n">${esc(libraryCountLabel(w))}</span><span class="t">${esc(w.title)}</span><span class="s">${esc(w.subtitle)}</span></button>`).join('')}</div>`;
  } catch { container.hidden = true; }
}

export async function render(screen) {
  const g = await getGraph();
  screen.className = 'screen search-screen';
  const step = currentStep();
  const crumbs = store.session.stack.slice(0, store.session.index + 1).slice(-3).map((s) => g.themeName(s.themeID));
  const hasTrail = !!step;
  screen.innerHTML = `
    <h1 class="title">${S.tabSearch}</h1>
    ${searchFieldHTML(app.query)}
    <p class="example">${esc(S.example)}</p>
    <div id="sg">${app.suggestion ? suggestionHTML(app.suggestion) : ''}</div>
    <section class="section" id="lib" style="min-height:190px"></section>
    <section class="section">
      <div class="kicker">${S.exploreTopics}</div>
      ${g.catalog().map((grp) => `<div class="cat">${grp.category ? `<h3>${esc(grp.category.name_ar)}</h3>` : ''}
        <div class="pills">${grp.themes.map((t) => `<button class="pill" data-theme="${esc(t.id)}">${esc(t.name_ar)}</button>`).join('')}</div></div>`).join('')}
    </section>
    ${hasTrail ? `<div class="resume"><div class="resume-l">${S.lastTrail}</div>
      <button class="card resume-b" data-resume="1" aria-label="${esc(S.resumeA11y)}"><span class="crumbs">${crumbs.map(esc).join(' <span style="opacity:.4">‹</span> ')}</span><span class="go-t">${S.resume}</span></button></div>` : ''}`;
  if (hasTrail) screen.style.paddingBottom = 'calc(var(--tabbar) + var(--safe-b) + 150px)';

  const form = screen.querySelector('form');
  const sg = screen.querySelector('#sg');
  wireSearchField(form, (q) => {
    const r = search(q);
    sg.innerHTML = r.kind === 'suggestion' ? suggestionHTML(r.themeID) : '';
  });
  form.querySelector('input').addEventListener('input', () => { if (app.suggestion) { app.suggestion = null; sg.innerHTML = ''; } });
  librarySection(screen.querySelector('#lib'));

  screen.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme],[data-suggest],[data-resume],[data-work]');
    if (!t) return;
    if (t.dataset.theme) openTheme(t.dataset.theme);
    else if (t.dataset.suggest) openTheme(t.dataset.suggest);
    else if (t.dataset.resume) go('#/result');
    else if (t.dataset.work) { enterLibrary(); go(`#/library/${t.dataset.work}`); }
  });
}

export { fmt, h };
