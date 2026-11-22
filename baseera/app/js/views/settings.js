// الإعدادات (Features/Settings/SettingsView.swift) + «عن المصادر» (Sheets/AboutSheet.swift) + المحفوظات.
import { S, esc, icon, fmt, num, openSheet, closeSheet } from '../ui.js';
import { app, getGraph, getLibrary, getMushaf, go, push, enterLibrary } from '../app.js';
import { store, applySettings } from '../store.js';
import { quranHTML } from '../render.js';
import { APP_STORE_URL, VERSION } from '../config.js';

function seg(key, options, cls = '') {
  return `<div class="seg ${cls}" role="group">${options.map(([v, label, aria]) =>
    `<button data-set="${key}" data-v="${v}" aria-pressed="${store.settings[key] === v}" ${aria ? `aria-label="${esc(aria)}"` : ''}>${label}</button>`).join('')}</div>`;
}

export async function render(screen) {
  screen.className = 'screen';
  screen.style.paddingTop = 'calc(56px + var(--safe-t))';
  const bm = store.mushaf.bookmark;
  let bmDetail = '';
  if (bm) { const m = app.mushaf; bmDetail = m ? `${m.surah(bm.s).name} · ${num(bm.a)}` : `${fmt(S.mushafSurahFmt, num(bm.s))} · ${num(bm.a)}`; }
  const g = (size) => `<span class="g" style="font-size:${size}px">ق</span>`;
  screen.innerHTML = `
    <h1 class="title" style="margin-bottom:22px">${S.tabSettings}</h1>
    <div class="card set-card">
      <div class="set-row"><span class="l">${S.theme}</span>${seg('theme', [['day', S.day], ['night', S.night], ['auto', S.themeAuto]])}</div>
      <div class="set-row"><span class="l">${S.fontSize}</span>${seg('ayahSize', [['S', g(15 * 1.1), S.fontSmall], ['M', g(20 * 1.1), S.fontMedium], ['L', g(26 * 1.1), S.fontLarge]], 'glyph')}</div>
      <div class="set-row"><span class="l">${S.munajatSize}</span>${seg('munajatSize', [['M', `<span class="g s" style="font-size:16px">ص</span>`, S.fontMedium], ['L', `<span class="g s" style="font-size:22px">ص</span>`, S.fontLarge], ['XL', `<span class="g s" style="font-size:28px">ص</span>`, S.fontXLarge]], 'glyph')}</div>
      <div class="set-row"><span class="l">${S.mushafSize}</span>${seg('mushafSize', [['XS', g(13 * 1.1)], ['S', g(16 * 1.1)], ['M', g(19 * 1.1)], ['L', g(22 * 1.1)], ['XL', g(26 * 1.1)]], 'glyph five')}</div>
    </div>
    <div class="card set-card">
      <button class="nav-row" data-go="#/saved"><span class="l">${S.saved}</span><span class="d">${store.saved.length ? num(store.saved.length) : ''}</span>${icon('fwd', 'sm chev')}</button>
      <button class="nav-row" data-go="${bm ? `#/mushaf/${bm.s}/${bm.a}` : '#/mushaf'}"><span class="l">${S.settingsMushafBookmark}</span><span class="d">${esc(bmDetail)}</span>${icon('fwd', 'sm chev')}</button>
      <button class="nav-row" data-lib="1">${icon('bookOpen')}<span class="l">${S.libraryTitle}</span>${icon('fwd', 'sm chev')}</button>
      <button class="nav-row" data-about="1"><span class="l">${S.about}</span>${icon('fwd', 'sm chev')}</button>
    </div>
    <div class="card set-card">
      <a class="nav-row" href="../">${icon('home')}<span class="l">${S.webHome}</span>${icon('fwd', 'sm chev')}</a>
      <a class="nav-row" href="${APP_STORE_URL}" rel="noopener">${icon('apple')}<span class="l">${S.downloadOnAppStore}</span>${icon('fwd', 'sm chev')}</a>
      ${app.installPrompt ? `<button class="nav-row" data-install="1">${icon('install')}<span class="l">${S.webInstall}</span>${icon('fwd', 'sm chev')}</button>` : ''}
    </div>
    <p class="footer-note">${S.appName} ${VERSION} · ${S.webVersionNote}<br>${S.webPrivacyNote}</p>`;

  screen.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-set],[data-go],[data-about],[data-lib],[data-install]'); if (!b) return;
    if (b.dataset.set) {
      store.settings[b.dataset.set] = b.dataset.v; store.save('settings'); applySettings();
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      return;
    }
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.about) return openAbout();
    if (b.dataset.lib) return librarySheet();
    if (b.dataset.install) { app.installPrompt.prompt(); app.installPrompt = null; b.remove(); }
  });
  if (bm && !app.mushaf) getMushaf().then(() => { if (app.route.name === 'settings') { const d = screen.querySelectorAll('.nav-row .d')[1]; if (d) d.textContent = `${app.mushaf.surah(bm.s).name} · ${num(bm.a)}`; } }).catch(() => {});
}

async function librarySheet() {
  const lib = await getLibrary();
  const { libraryCountLabel } = await import('./search.js');
  const sheet = openSheet(`<h2>${S.libraryTitle}</h2><p class="muted" style="font-size:13px;margin:0 0 6px">${S.librarySubtitle}</p>
    ${lib.works.map((w) => `<button class="row" data-work="${esc(w.id)}"><span class="main"><span class="t">${esc(w.title)}</span><br><span class="s">${esc(w.subtitle)}</span></span><span class="end" style="color:var(--gold)">${esc(libraryCountLabel(w))}</span></button>`).join('')}`, { label: S.libraryTitle });
  sheet.addEventListener('click', (e) => { const b = e.target.closest('[data-work]'); if (b) { enterLibrary(); go(`#/library/${b.dataset.work}`); } });
}

const FALLBACK_ABOUT = { quran: 'srcDescQuran', sahifa_sajjadiyya: 'srcDescSahifa', whispered_prayers: 'srcDescWhispered', kumayl: 'srcDescKumayl', abu_hamza: 'srcDescAbuHamza', arafah: 'srcDescArafah', jawshan_kabir: 'srcDescJawshan', nahj_al_balagha: 'srcDescNahj' };

export async function openAbout() {
  const g = await getGraph();
  const lib = await getLibrary().catch(() => null);
  const sources = [...g.sources.filter((s) => s.kind === 'quran'), ...g.sources.filter((s) => s.kind !== 'quran')];
  const rows = sources.map((s) => {
    const works = lib ? lib.worksForSource(s.id) : [];
    const about = s.about_ar || S[FALLBACK_ABOUT[s.id]] || '';
    return `<div class="src"><div class="h"><b>${esc(s.name_ar)}</b><span>${esc(s.kind_label_ar)}</span></div>${about ? `<p>${esc(about)}</p>` : ''}
      ${works.length ? `<div class="pills">${works.map((w) => `<button class="pill" data-work="${esc(w.id)}" style="font-size:12.5px">${icon('bookOpen', 'sm')}&nbsp;${works.length === 1 ? S.libraryOpenFull : esc(w.title)}</button>`).join('')}</div>` : ''}</div>`;
  }).join('');
  const sheet = openSheet(`<div class="about"><h2>${S.about}</h2><p>${esc(S.aboutIntro)}</p>${rows}
    <h3>${S.aboutReviewTitle}</h3><p>${esc(S.aboutReviewBody)}</p>
    <hr class="hairline" style="margin-top:22px"><h3>${S.aboutCreditsTitle}</h3>
    ${g.meta.quran_attribution_ar ? `<p class="credit">${esc(g.meta.quran_attribution_ar)}</p>` : ''}
    <p class="credit ltr" style="text-align:right">${esc(g.meta.quran_attribution)}</p>
    <p class="credit">${esc(S.aboutQuranTextCredit)}</p>
    <p class="credit">${esc(S.aboutQuranFontCredit)}</p>
    <p class="credit">${esc(S.aboutFontsCredit)}</p>
    <p class="credit">${esc(S.aboutLibraryCredit)}</p></div>`, { label: S.about });
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('[data-work]'); if (!b) return;
    enterLibrary(); app.libraryOrigin.about = true; go(`#/library/${b.dataset.work}`);
  });
}

export async function renderSaved(screen) {
  const g = await getGraph();
  screen.className = 'screen';
  screen.style.paddingTop = 'calc(56px + var(--safe-t))';
  const items = store.saved.filter((s) => g.resolve(s.nodeID));
  screen.innerHTML = `<div class="topbar" style="background:none"><div class="topbar-row"><button class="glass-chip" data-back="1">${icon('back', 'xs')}<span>${S.tabSettings}</span></button></div></div>
    <h1 class="title" style="margin-top:12px">${S.saved}</h1>
    ${items.length ? items.map((s) => { const r = g.resolve(s.nodeID); return `<button class="card saved-row" data-node="${esc(s.nodeID)}" data-theme="${esc(s.themeID)}"><div class="t">${esc(g.themeName(s.themeID))} · ${esc(r.ayah.ref_ar)}</div><div class="sacred quran saved-q" data-sacred="quran" data-stored="${esc(r.ayah.text)}">${quranHTML(r.ayah.text, { breaks: r.ayah.ayah_breaks, first: r.ayah.ayah_start })}</div></button>`; }).join('')
      : `<p class="muted center" style="margin-top:30px">${S.savedEmpty}</p>`}`;
  screen.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) return go('#/settings');
    const b = e.target.closest('[data-node]'); if (b) { app.mushafReturn = null; app.journeyReturn = null; push(b.dataset.theme, b.dataset.node); }
  });
}

export { closeSheet };
