// HTML builders for sacred text. Every word stays INLINE in one text flow (no inline-block,
// no flex items), so all words of a line share one baseline — lit pills, echo underlines and
// the gold dot are absolutely-positioned pseudo-elements / children that never touch layout.
import { tokenize, quranGroups, sacredDisplay, ayahMarker, NBSP, esc, isMarkOnly } from './arabic.js';

/** One display group (word + attached marks) — the ۩ sajda sign tinted gold. */
function groupInner(g) {
  return g.parts.map((p) => {
    const t = esc(p.text);
    return p.joiner + (p.letterless && !isMarkOnly(p.text) ? `<span class="sj">${t}</span>` : t);
  }).join('');
}

/**
 * A Quran text (Result / Daily ayah row, one mushaf ayah, a passage ayah) in KFGQPC Hafs display
 * form. opts.hl: Map token → {theme_id}; opts.echo: Set tokens; opts.anchor: token with the gold
 * dot; opts.breaks + opts.first: multi-ayah rows (digits-only marker glued with NBSP to the previous
 * word); opts.lit: Map word index → link (mushaf).
 */
export function quranHTML(stored, opts = {}) {
  const groups = quranGroups(stored);
  const breaks = new Set(opts.breaks || []);
  let ordinal = 0;
  let out = '';
  groups.forEach((g, gi) => {
    if (gi > 0) {
      if (breaks.has(g.index)) {
        const n = (opts.first || 0) + ordinal++;
        out += NBSP + `<span class="am">${ayahMarker(n)}</span>`;
      }
      out += ' ';
    }
    const inner = groupInner(g);
    const h = opts.hl?.get(g.index);
    const link = opts.lit?.get(g.index);
    const echo = opts.echo?.has(g.index);
    const dot = opts.anchor != null && opts.anchor === g.index;
    if (h || link || echo || dot) {
      const cls = ['w'];
      let data = '';
      if (h) { cls.push('lit'); data += ` data-theme="${esc(h.theme_id)}" role="link" tabindex="0"`; }
      if (link) { cls.push('lit'); data += ` data-link="${link.idx}" role="link" tabindex="0"`; }
      if (echo) cls.push('echo');
      out += `<span class="${cls.join(' ')}"${data}>${inner}${dot ? `<button class="tdot" data-dot="1" aria-label="${esc(opts.dotLabel || '')}"></button>` : ''}</span>`;
    } else {
      out += inner;
    }
  });
  return out;
}

/**
 * A non-Quran sacred text (munajat, wisdom) in its display form (ArabicText.sacredDisplay):
 * lit concept words (opts.hl) and IQTIBAS echo underlines (opts.echo). opts.limit = first N words.
 */
export function sacredHTML(text, opts = {}) {
  let tokens = tokenize(text);
  let ellipsis = '';
  if (opts.limit && tokens.length > opts.limit) { tokens = tokens.slice(0, opts.limit); ellipsis = '…'; }
  return tokens.map((tok, i) => {
    const d = esc(sacredDisplay(tok));
    const h = opts.hl?.get(i);
    const echo = opts.echo?.has(i);
    if (!h && !echo) return d;
    const cls = ['w']; let data = '';
    if (h) { cls.push('lit'); data = ` data-theme="${esc(h.theme_id)}" role="link" tabindex="0"`; }
    if (echo) cls.push('echo');
    return `<span class="${cls.join(' ')}"${data}>${d}</span>`;
  }).join(' ') + ellipsis;
}

/** Plain sacred paragraph (library blocks, titles). */
export function sacredPlain(text) { return esc(sacredDisplay(text)); }
