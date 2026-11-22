// الرحلة — «رحلة القرآن»: eras → stories → passages of full ayat, read from quran-mushaf.json
// (Features/Journey/*, docs/JOURNEY-SPEC.md). Progress lives in localStorage.
import { S, esc, icon, fmt, num, plural, openSheet } from '../ui.js';
import { app, getTimeline, getMushaf, getLinks, getGraph, go } from '../app.js';
import { store } from '../store.js';
import { ayatHTML, basmalaHTML, wireAyat } from './mushaf.js';

function progress(story) {
  const done = store.journey.completed.includes(story.id);
  const reached = store.journey.reached[story.id];
  const frac = done ? 1 : reached == null ? 0 : Math.min(1, (reached + 1) / story.passages.length);
  return { done, frac };
}

/** 14pt node ring: goldMid ring · gold arc for the share reached · solid when read to the end · glow on the current story. */
function ring(story, size = 14, current = false) {
  const { done, frac } = progress(story);
  const r = size / 2 - 1; const c = 2 * Math.PI * r;
  const arc = frac > 0 && !done ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--gold)" stroke-width="1.6" stroke-dasharray="${(c * frac).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="round"/>` : '';
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="${current ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${done ? 'var(--gold)' : 'var(--bg)'}" stroke="${done ? 'var(--gold)' : 'var(--goldmid)'}" stroke-width="1.4"/>${arc}
    ${current && !done ? `<circle cx="${size / 2}" cy="${size / 2}" r="${Math.max(1.5, size * 0.15)}" fill="var(--gold)"/>` : ''}</svg>`;
}

function counts(story, m) {
  const surahs = new Set(story.passages.map((p) => p.s)).size;
  const ayat = story.passages.reduce((n, p) => n + (p.b - p.a + 1), 0);
  return `${fmt(S.journeyFromFmt, plural('journeySurahs', surahs))} · ${plural('journeyAyat', ayat)}`;
}

export async function renderHome(screen) {
  const [t, m] = await Promise.all([getTimeline(), getMushaf()]);
  const curID = store.journey.storyID && t.byID.has(store.journey.storyID) ? store.journey.storyID : null;
  const cur = curID ? t.byID.get(curID) : t.stories[0];
  screen.className = 'screen';
  screen.innerHTML = `
    <header class="j-head"><h1>${S.journeyTitle}</h1><div class="sub">${S.journeySubtitle}</div><p class="intro">${S.journeyIntro}</p></header>
    <button class="card lg j-resume" data-story="${esc(cur.id)}">
      <div style="flex:1;min-width:0"><div class="k">${curID ? S.journeyResume : S.journeyBegin}</div><div class="t">${esc(cur.title)}</div><div class="s">${esc(cur.subtitle)}</div></div>
      ${ring(cur, 40, false)}
    </button>
    <div class="timeline">
      ${t.sections.map((sec) => `<div class="era"><i></i><span>${esc(sec.title)}</span></div>
        ${sec.stories.map((st) => `<div class="st"><div class="rail">${ring(st, 14, st.id === curID)}</div>
          <button class="card st-card${st.id === curID ? ' cur' : ''}" data-story="${esc(st.id)}"><div class="t">${esc(st.title)}</div><div class="s">${esc(st.subtitle)}</div><div class="c">${counts(st, m)}</div></button></div>`).join('')}`).join('')}
    </div>`;
  screen.addEventListener('click', (e) => { const b = e.target.closest('[data-story]'); if (b) go(`#/story/${b.dataset.story}`); });
  screen.addEventListener('mounted', () => { if (curID) screen.querySelector('.st-card.cur')?.scrollIntoView({ block: 'center' }); }, { once: true });
}

function storiesSheet(t, curID) {
  const sheet = openSheet(`<h2>${S.journeyStories}</h2><p class="muted" style="font-size:13px;margin:0 0 8px">${S.journeyScrubberHint}</p>
    ${t.sections.map((sec) => `<div class="kicker" style="margin:14px 0 4px">${esc(sec.title)}</div>
      ${sec.stories.map((st) => `<button class="row${st.id === curID ? ' cur' : ''}" data-story="${esc(st.id)}"><span class="num" style="background:none">${ring(st, 16, st.id === curID)}</span><span class="main"><span class="t">${esc(st.title)}</span></span>${progress(st).done ? `<span class="end" style="color:var(--gold)">${icon('check', 'sm')}</span>` : ''}</button>`).join('')}`).join('')}`, { label: S.journeyStories });
  sheet.addEventListener('click', (e) => { const b = e.target.closest('[data-story]'); if (b) go(`#/story/${b.dataset.story}`, { replace: true }); });
  setTimeout(() => sheet.querySelector('.row.cur')?.scrollIntoView({ block: 'center' }), 340);
}

export async function renderStory(screen, parts) {
  const [t, m] = await Promise.all([getTimeline(), getMushaf()]);
  await getGraph().catch(() => null);
  const links = await getLinks().catch(() => null);
  const story = t.byID.get(parts[0]);
  if (!story) { go('#/journey', { replace: true }); return; }
  let start = parts[1] != null ? Number(parts[1]) : (store.journey.storyID === story.id ? store.journey.passage : 0);
  if (!(start >= 0 && start < story.passages.length)) start = 0;
  const prev = t.stories[story.index - 1]; const next = t.stories[story.index + 1];
  const reflections = app.graph ? new Set(app.graph.nodesByAyahKey.keys()) : null;
  store.set('journey', { storyID: story.id });
  screen.className = 'screen story-screen';
  screen.dataset.keepScroll = '1';
  screen.innerHTML = `
    <div class="mbar">
      <div class="mbar-r1">
        <button class="nav-btn" data-nav="${prev ? prev.id : ''}" aria-label="${S.journeyPrevStory}" ${prev ? '' : 'disabled'}>${icon('back')}</button>
        <button class="mbar-title" data-sheet="1">${esc(story.title)}</button>
        <button class="nav-btn" data-nav="${next ? next.id : ''}" aria-label="${S.journeyNextStory}" ${next ? '' : 'disabled'}>${icon('fwd')}</button>
      </div>
      <div class="mbar-r2">
        <button data-up="1" style="color:var(--gold);display:inline-flex;align-items:center;gap:3px;padding:6px 4px">${icon('back', 'xs')}<span>${S.journeyTitle}</span></button>
        <span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(story.section.title)}</span>
        <button data-sheet="1" style="padding:6px 4px;color:var(--muted)">${fmt(S.journeyStoryPositionFmt, num(story.index + 1), num(t.stories.length))}</button>
      </div>
    </div>
    <header class="story-head"><div class="sub">${esc(story.subtitle)}</div><div class="c">${counts(story, m)}</div><div class="ornament" aria-hidden="true"><i></i></div></header>
    ${story.passages.map((p, i) => {
      const su = m.surah(p.s);
      return `<section class="psg" data-p="${i}" aria-label="${esc(fmt(S.journeyPassageA11yFmt, su.name, num(p.a), num(p.b)))}">
        <div class="psg-h"><span class="t">${esc(fmt(S.mushafSurahFmt, su.name))} · ${num(p.a)}${p.b !== p.a ? '–' + num(p.b) : ''}</span><span class="hl"></span>
          <button data-open="${p.s}/${p.a}">${icon('book', 'sm')}<span>${S.journeyOpenInMushaf}</span></button></div>
        ${p.a === 1 && su.basmala ? basmalaHTML(m) : ''}
        <div class="sacred mushaf-text" lang="ar">${ayatHTML(m, p.s, p.a, p.b, { marks: false, links, reflections })}</div></section>`;
    }).join('')}
    <div class="end-l">${next ? S.journeyEndOfStory : S.journeyEndOfJourney}</div>
    ${next ? `<button class="next-card" data-nav="${next.id}" id="endcard"><div class="k">${S.journeyNextStory}</div><div class="t">${esc(next.title)}</div><div class="s">${esc(next.subtitle)}</div></button>`
      : `<p class="muted center" id="endcard" style="font-size:14px">${S.journeyEndOfJourneyHint}</p>`}`;

  screen.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav],[data-sheet],[data-up],[data-open]'); if (!b) return;
    if (b.dataset.nav) return go(`#/story/${b.dataset.nav}/0`, { replace: true });
    if (b.dataset.sheet) return storiesSheet(t, story.id);
    if (b.dataset.up) return go('#/journey');
    if (b.dataset.open) return go(`#/mushaf/${b.dataset.open}`);
  });
  const passageOf = (s, a) => story.passages.findIndex((p) => p.s === s && a >= p.a && a <= p.b);
  screen.querySelectorAll('.mushaf-text').forEach((el) => wireAyat(el, m, { journey: (s, a) => ({ storyID: story.id, passage: Math.max(0, passageOf(s, a)) }) }));

  // progress: the passage on top is the reading place; the end card completes the story
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.target.id === 'endcard') {
        if (en.isIntersecting && !store.journey.completed.includes(story.id)) { store.journey.completed.push(story.id); store.save('journey'); }
        continue;
      }
      const i = Number(en.target.dataset.p);
      if (en.isIntersecting) visible.add(i); else visible.delete(i);
    }
    if (visible.size) {
      const top = Math.min(...visible);
      const reached = Math.max(store.journey.reached[story.id] ?? -1, top);
      store.journey.passage = top; store.journey.reached[story.id] = reached; store.save('journey');
      app.tabMemory.journey = `#/story/${story.id}/${top}`;
    }
  }, { rootMargin: '-110px 0px -40% 0px' });
  screen.addEventListener('mounted', async () => {
    await document.fonts.ready;
    if (start > 0) {
      const el = screen.querySelector(`.psg[data-p="${start}"]`);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - screen.querySelector('.mbar').offsetHeight - 8);
    }
    screen.querySelectorAll('.psg').forEach((el) => io.observe(el));
    const end = screen.querySelector('#endcard'); if (end) io.observe(end);
  }, { once: true });
  return () => io.disconnect();
}
