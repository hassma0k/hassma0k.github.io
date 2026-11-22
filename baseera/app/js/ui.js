// Small UI toolkit: strings, icons, sheets, toast.
import { S } from './strings.js';
import { arabicIndic, esc } from './arabic.js';

export { S, esc };
export const num = (n) => arabicIndic(n);

/** "%@" / "%1$@" templates (iOS style). */
export function fmt(template, ...args) {
  let i = 0;
  return String(template).replace(/%(\d)\$@|%@/g, (m, k) => (k ? args[Number(k) - 1] : args[i++]) ?? '');
}

/** Arabic plural categories (CLDR): zero / one / two / few (3–10) / many (11–99) / other. */
export function plural(key, n) {
  const forms = S[key] || {};
  const m = n % 100;
  const cat = n === 0 ? 'zero' : n === 1 ? 'one' : n === 2 ? 'two' : (m >= 3 && m <= 10) ? 'few' : (m >= 11 && m <= 99) ? 'many' : 'other';
  return fmt(forms[cat] ?? forms.other ?? '', num(n));
}

const P = {
  mihrab: '<path d="M6 21V11a6 6 0 0 1 12 0v10"/><path d="M4 21h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  book: '<path d="M12 7.5C14.5 5.8 17.3 5.2 20 5.5v11c-2.7-.3-5.5.3-8 2V7.5z"/><path d="M12 7.5C9.5 5.8 6.7 5.2 4 5.5v11c2.7-.3 5.5.3 8 2"/><path d="M14.5 10l3-.6M14.5 13l3-.6M9.5 10l-3-.6M9.5 13l-3-.6"/><path d="M6 21.5l6-3 6 3"/>',
  path: '<circle cx="5.5" cy="5" r="2"/><circle cx="18.5" cy="19" r="2"/><path d="M7.5 5H14a4 4 0 0 1 0 8h-4a3 3 0 0 0 0 6h6.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
  ellipsis: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  fwd: '<path d="M15 18l-6-6 6-6"/>', // forward in RTL (points left)
  back: '<path d="M9 18l6-6-6-6"/>',  // backward in RTL (points right)
  down: '<path d="M6 9l6 6 6-6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  bookOpen: '<path d="M3.5 5.5c3-.6 5.8 0 8.5 1.8 2.7-1.8 5.5-2.4 8.5-1.8v12.5c-3-.6-5.8 0-8.5 1.8-2.7-1.8-5.5-2.4-8.5-1.8z"/><path d="M12 7.3v12.5"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.4 10.9c.6.5.9 1.2.9 1.9v.2h5v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  textsize: '<path d="M3.5 18L8 6.5 12.5 18M5.2 14h5.6"/><path d="M14 18l3.2-8 3.3 8M15.2 15.2h4"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8" fill="currentColor"/><circle cx="4" cy="12" r=".8" fill="currentColor"/><circle cx="4" cy="18" r=".8" fill="currentColor"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>',
  apple: '<path d="M16.2 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.9-.9-3.1-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.4-.9-2.4-3.8zM14 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z" fill="currentColor" stroke="none"/>',
  install: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  share: '<path d="M12 15V4M8 7.5L12 3.5l4 4"/><path d="M6 11.5H5v9h14v-9h-1"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
}

/** Parse an HTML string into a single element. */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ------------------------------------------------------------------ toast
let toastEl = null; let toastTimer = 0;
export function toast(message) {
  if (!toastEl) { toastEl = h('<div class="toast" role="status"></div>'); document.body.appendChild(toastEl); }
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1800);
}

// ------------------------------------------------------------------ sheets
// A sheet pushes one history entry so Android's back button closes it.
let current = null;
export function openSheet(html, { onClose, label } = {}) {
  closeSheet(true);
  const dim = h('<div class="dim"></div>');
  const sheet = h(`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || '')}"><div class="grab"></div></div>`);
  if (typeof html === 'string') sheet.insertAdjacentHTML('beforeend', html); else sheet.appendChild(html);
  document.body.append(dim, sheet);
  requestAnimationFrame(() => { dim.classList.add('on'); sheet.classList.add('on'); });
  const close = () => closeSheet();
  dim.addEventListener('click', close);
  current = { dim, sheet, onClose, pushed: true };
  history.pushState({ sheet: true }, '', location.hash || '#/');
  const prevFocus = document.activeElement;
  current.prevFocus = prevFocus;
  setTimeout(() => sheet.querySelector('form[role=search] input')?.focus({ preventScroll: true }), 320);
  return sheet;
}

/** Close the sheet. `silent` = replaced by another one (keeps the history entry). */
export function closeSheet(silent = false, fromPop = false) {
  if (!current) return;
  const { dim, sheet, onClose, pushed } = current;
  current = null;
  dim.classList.remove('on'); sheet.classList.remove('on');
  setTimeout(() => { dim.remove(); sheet.remove(); }, 320);
  onClose?.();
  if (pushed && !fromPop) {
    if (silent) history.replaceState(null, '', location.hash || '#/');
    else { ignoreNextPop = true; history.back(); }
  }
}
export let ignoreNextPop = false;
export function consumeIgnorePop() { const v = ignoreNextPop; ignoreNextPop = false; return v; }
export function sheetOpen() { return !!current; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeSheet(); });

export async function copyText(text, message) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch { /* ignore */ } ta.remove();
  }
  if (message) toast(message);
}
