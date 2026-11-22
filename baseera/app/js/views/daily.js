// المحراب — «رسالة المحراب» (Features/Daily/DailyView.swift). Today's node follows the engine's
// 05:00-local index; the whole card is fitted on ONE screen by stepping through denser styles.
import { S, esc } from '../ui.js';
import { quranHTML, sacredHTML } from '../render.js';
import { dailyIndex, loadJSON } from '../data.js';
import { app, getGraph } from '../app.js';
import { DAILY } from '../config.js';

const STYLES = [
  { ayah: 1.0, words: 26, m: 21, habit: 16, pad: 14, gap: 26 },
  { ayah: 0.86, words: 20, m: 19.5, habit: 15.5, pad: 12, gap: 20 },
  { ayah: 0.74, words: 15, m: 18.5, habit: 15, pad: 11, gap: 15 },
  { ayah: 0.64, words: 10, m: 17.5, habit: 14.5, pad: 10, gap: 12 },
];

/** Today's card: a tiny pre-built shard (fast first paint), or the content graph when loaded. */
async function todaysCard(index) {
  if (app.graph) {
    const g = app.graph; const seq = g.daily.sequence;
    let id = seq[index]; const n = g.nodesByID.get(id); if (!n || !n.enabled) id = g.enabledNodes()[0]?.id;
    const r = g.resolve(id);
    const ref = (r.munajat.source_ref_ar || '').trim();
    return { id, ayah: r.ayah, munajat: { text: r.munajat.text, source: ref || g.sourceName(r.munajat) }, action: r.action.text_ar,
      echoAyah: r.echoAyah, echoMunajat: r.echoMunajat };
  }
  try {
    const d = await loadJSON(`data/daily/${index}.json`);
    return { ...d, echoAyah: new Set(d.echo.map((p) => p[0])), echoMunajat: new Set(d.echo.map((p) => p[1])) };
  } catch {
    await getGraph(); return todaysCard(index);
  }
}

export async function render(screen) {
  const now = new Date();
  const index = dailyIndex(DAILY.count, DAILY.resetHour, now);
  const card = await todaysCard(index);
  const date = new Intl.DateTimeFormat('ar-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  screen.className = 'screen daily';
  const paint = (st) => {
    const m = st.m + (Number(getComputedStyle(document.documentElement).getPropertyValue('--munajat')) - 20 || 0);
    screen.style.setProperty('--gap', st.gap + 'px');
    screen.style.setProperty('--cardpad', st.pad + 'px');
    screen.style.setProperty('--habit', st.habit + 'px');
    screen.innerHTML = `
      <header class="daily-head"><div class="daily-date">${esc(date)}</div><h1 class="daily-title">${S.dailyTitle}</h1></header>
      <div class="daily-body">
        <div class="sacred quran center" style="font-size:calc(var(--ayah) * ${st.ayah} * 1.1px)" lang="ar" data-sacred="quran" data-stored="${esc(card.ayah.text)}">${quranHTML(card.ayah.text, { echo: card.echoAyah, breaks: card.ayah.ayah_breaks, first: card.ayah.ayah_start })}</div>
        <div class="ref">${esc(card.ayah.ref_ar)}</div>
        <div class="ornament" aria-hidden="true"><i></i></div>
        <div>
          <div class="daily-mlabel">${S.fromMunajat}</div>
          <div class="sacred munajat" style="font-size:${(m * 1.1).toFixed(2)}px;line-height:1.8" lang="ar" data-sacred="heritage" data-stored="${esc(card.munajat.text)}" data-limit="${st.words}">${sacredHTML(card.munajat.text, { limit: st.words, echo: new Set([...card.echoMunajat].filter((t) => t < st.words)) })}</div>
          <div class="daily-src">${esc(card.munajat.source)}</div>
        </div>
        <div class="card habit"><div class="habit-l">${S.habit}</div><div class="habit-t">${esc(card.action)}</div></div>
      </div>
      <div class="renew">${S.renew}</div>`;
  };
  let step = 0;
  paint(STYLES[0]);
  const fit = async () => {
    await document.fonts.ready;
    while (step < STYLES.length - 1 && screen.offsetHeight > window.innerHeight + 1) {
      step += 1; paint(STYLES[step]);
    }
  };
  screen.addEventListener('mounted', fit, { once: true });
  // Turn the card over at the 05:00 boundary while the screen stays open.
  const timer = setInterval(() => {
    if (dailyIndex(DAILY.count, DAILY.resetHour) !== index) window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, 60000);
  return () => clearInterval(timer);
}
