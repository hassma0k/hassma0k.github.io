// Arabic text helpers — a faithful port of ios/Baseera/Core/Arabic/ArabicText.swift,
// Core/Quran/MushafDisplayText.swift and the display rules of DesignSystem/Typography.swift.
// Every transform here is DISPLAY-ONLY: stored Quran / heritage text is never altered;
// copy and share always use the stored string.

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** "12" → "١٢" (non-digits pass through). */
export function arabicIndic(value) {
  return String(value).replace(/[0-9]/g, (d) => AR_DIGITS[d.charCodeAt(0) - 48]);
}

/** ArabicText.normalize (docs/ARCHITECTURE.md §4). */
export function normalize(input) {
  const nfc = String(input || '').normalize('NFC');
  let out = '';
  for (const ch of nfc) {
    const v = ch.codePointAt(0);
    if ((v >= 0x064B && v <= 0x065F) || v === 0x0670 || (v >= 0x06D6 && v <= 0x06ED)
        || v === 0x0640 || (v >= 0x200B && v <= 0x200F)) continue;
    switch (v) {
      case 0x0671: case 0x0623: case 0x0625: case 0x0622: case 0x0672: case 0x0673: out += 'ا'; break;
      case 0x0649: out += 'ي'; break;
      case 0x0624: out += 'و'; break;
      case 0x0626: out += 'ي'; break;
      case 0x0629: out += 'ه'; break;
      default: out += ch;
    }
  }
  return out.toLowerCase().replace(/\p{P}/gu, '');
}

/** Tokenization contract: split on U+0020 only, empty strings dropped. */
export function tokenize(text) {
  return String(text || '').split(' ').filter((t) => t.length > 0);
}

/** First `count` tokens joined with spaces (+ ellipsis when truncated). */
export function firstWords(text, count, ellipsis = '…') {
  const tokens = tokenize(text);
  if (tokens.length <= count) return tokens.join(' ');
  return tokens.slice(0, count).join(' ') + ellipsis;
}

// ---------------------------------------------------------------- sacred face

/** Codepoints KFGQPC Hafs v22 maps to its EMPTY dotted-ring placeholder (169). */
export function isRingPlaceholder(v) {
  return (v >= 0x0602 && v <= 0x0620) || (v >= 0x063B && v <= 0x063F) || (v >= 0x0658 && v <= 0x065D)
    || v === 0x065F || (v >= 0x066A && v <= 0x066D) || v === 0x066F || (v >= 0x0672 && v <= 0x06D5)
    || v === 0x06DF || v === 0x06E3 || v === 0x06EB || (v >= 0x06EE && v <= 0x06FF);
}

const isOrnateBracket = (v) => v === 0xFD3E || v === 0xFD3F;
const WORD_SCALAR = /[\p{Lo}\p{Mn}]/u;

/**
 * ArabicText.sacredDisplay — DISPLAY form of a non-Quran sacred text (munajat, wisdom,
 * duas library, surah titles): «آ» U+0622 drawn as U+0627 U+0653 (the face has no
 * precomposed آ), and a no-break space between an ornate bracket ﴿ ﴾ and a letter it touches.
 */
export function sacredDisplay(text) {
  const s = String(text || '');
  if (!/[آ﴾﴿]/.test(s)) return s;
  let out = '';
  let prev = null;
  for (const ch of s) {
    const v = ch.codePointAt(0);
    if (prev !== null) {
      const pv = prev.codePointAt(0);
      if ((isOrnateBracket(v) && WORD_SCALAR.test(prev)) || (isOrnateBracket(pv) && WORD_SCALAR.test(ch))) {
        out += ' ';
      }
    }
    out += v === 0x0622 ? 'آ' : ch;
    prev = ch;
  }
  return out;
}

// ---------------------------------------------------------------- Quran display

export const NBSP = ' ';
const LETTER = /\p{L}/u;
const MARK = /^\p{M}+$/u;

/** Every scalar is a combining mark (a waqf / sakta token). */
export function isMarkOnly(token) { return token.length > 0 && MARK.test(token); }
/** No letter at all: a mark-only token or a bare symbol such as «۩». */
export function isLetterless(token) { return token.length > 0 && !LETTER.test(token); }

/**
 * MushafDisplayText.faceText for KFGQPC Hafs (display-only, per string):
 * (a) U+06DF → U+06E0, (b) U+0640 dropped when directly followed by U+0670.
 */
export function hafsFace(source) {
  return String(source).replace(/ـ(?=ٰ)/g, '').replace(/۟/g, '۠');
}

/**
 * The ayah-end marker for KFGQPC Hafs: the Arabic-Indic DIGITS only (no U+06DD) —
 * the font's required ligatures turn 1–3 digits into one numbered ornament.
 */
export function ayahMarker(number) { return arabicIndic(number); }

/**
 * Groups the STORED tokens of one Quran text for display (MushafDisplayText.layout +
 * faceText): each group is a word plus the letterless tokens attached to it.
 * Returns [{ index, tokens:[i...], display }] where `display` is the face form of the
 * group with the mushaf joins: a combining-mark token is attached with NO separator
 * (two NBSP when it follows another mark token, 36:52), a symbol token (۩) with one NBSP.
 */
export function quranGroups(stored) {
  const tokens = tokenize(stored);
  const groups = [];
  let previousMarkOnly = false;
  tokens.forEach((token, index) => {
    const markOnly = isMarkOnly(token);
    if (index > 0 && isLetterless(token) && groups.length) {
      const g = groups[groups.length - 1];
      let joiner = '';
      if (!markOnly) joiner = NBSP;
      else if (previousMarkOnly) joiner = NBSP + NBSP;
      g.tokens.push(index);
      g.display += joiner + hafsFace(token);
      g.parts.push({ index, joiner, text: hafsFace(token), letterless: true });
    } else {
      groups.push({ index, tokens: [index], display: hafsFace(token), parts: [{ index, joiner: '', text: hafsFace(token), letterless: false }] });
    }
    previousMarkOnly = markOnly;
  });
  return groups;
}

/** The whole display string of one stored ayah (MushafDisplayText.layout(_:face: .hafs).text). */
export function quranDisplay(stored) {
  return quranGroups(stored).map((g) => g.display).join(' ');
}

/** Copy text: «﴿…﴾ [البقرة: ٢٥٥]» built from the STORED text. */
export function ayahCopyText(stored, surahName, ayah) {
  return '﴿' + stored + '﴾' + ' [' + surahName + ': ' + arabicIndic(ayah) + ']';
}

/** HTML escaping. */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
