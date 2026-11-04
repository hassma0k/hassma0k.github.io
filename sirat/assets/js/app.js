/* The anonymous question form (Baseera's pattern): the body of the one POST the app can make, built from exactly two fields,
   the kind the reader chose and the words they typed. No id, version, language, door, answer or path is ever added.
   Pure, so scripts/test-feedback.mjs can prove it. Bundled in front of app.js by build.mjs; exposed as window.SiratFeedback. */
(function (root) {
  'use strict';
  /** The exact single-choice labels the owner's Google Form uses (site.config.mjs). */
  var KIND_LABELS = { topic: 'New topic', god: 'About God', prophets: 'About the prophets', book: 'About a holy book', correction: 'A correction' };
  /** RFC 3986: only unreserved characters stay; everything else, spaces and Arabic included, is percent-encoded. */
  function encode(v) { return encodeURIComponent(String(v)).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); }
  /** `entryKind=<label>&entryText=<words>`: two fields, nothing else. Returns null when there is nothing to send. */
  function body(entries, kind, text) {
    var label = KIND_LABELS[kind];
    var words = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!label && !words) return null;
    var fields = [];
    if (label) fields.push([entries.kind, label]);
    fields.push([entries.text, words]);
    return fields.map(function (f) { return encode(f[0]) + '=' + encode(f[1]); }).join('&');
  }
  root.SiratFeedback = { body: body, encode: encode, KIND_LABELS: KIND_LABELS, KINDS: ['topic', 'god', 'prophets', 'book', 'correction'] };
})(typeof window !== 'undefined' ? window : globalThis);

/* Progressive enhancement for the generated pages. Without this file every page is fully readable.
   With it: today's reflection and the endless Reflections feed, the share sheet (picture, PDF, link; the picture and the
   PDF are drawn on the device), the first-run tutorial with its language choice, Settings, and the offline worker on the
   website. Only the reader's settings are stored, in localStorage, wrapped in try/catch: no reading record is kept, and
   nothing leaves the device. No HTML sinks: all DOM is built with createElement. */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.add('has-js');
  var body = document.body;
  var BASE = body.getAttribute('data-base') || '';
  var APP = body.getAttribute('data-app') === '1'; // bundled inside the native app: no service worker, links end in index.html
  var INDEX_FILE = APP ? 'index.html' : '';
  var LANG = body.getAttribute('data-lang') || html.lang || 'en';
  var RTL = html.getAttribute('dir') === 'rtl';
  var KEY = 'sirat.v1';
  var UI = {};
  try { var el = document.getElementById('ui'); if (el) UI = JSON.parse(el.textContent); } catch (e) { UI = {}; }
  var t = function (k, vars) { var s = UI[k] || k; if (vars) Object.keys(vars).forEach(function (v) { s = s.replace('{' + v + '}', vars[v]); }); return s; };

  // ---------- every page opens at its top; a hash names a beat and lands with that beat's top under the header ----------
  if ('scrollRestoration' in history) { try { history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ } }
  if (!location.hash) window.scrollTo(0, 0);
  window.addEventListener('pageshow', function (ev) { if (ev.persisted && !location.hash) window.scrollTo(0, 0); });

  // ---------- back: a page with a parent gets a back control at the start of the header ----------
  var parent = document.querySelector('.crumbs a:last-of-type'), row0 = document.querySelector('.header-row');
  if (parent && row0) { var back = document.createElement('a'); back.className = 'back'; back.href = parent.getAttribute('href'); back.setAttribute('aria-label', parent.textContent); row0.insertBefore(back, row0.firstChild); }

  // ---------- state ----------
  // size and qsize: 0 comfortable, 1 larger, 2 large, 3 very large. Anything an earlier version stored is dropped on the next save.
  var S = { theme: 'auto', size: 0, qsize: 0, tutorialDone: false };
  function load() { try { var raw = localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); Object.keys(S).forEach(function (k) { if (k in o) S[k] = o[k]; }); } } catch (e) { /* storage unavailable: run in memory */ } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  load();
  function applyTheme() { if (S.theme === 'light' || S.theme === 'dark') html.setAttribute('data-theme', S.theme); else html.removeAttribute('data-theme'); }
  /** Every reading preference is one attribute on <html>; the stylesheet does the rest, so a change applies at once, everywhere. */
  function applyPrefs() {
    applyTheme();
    html.setAttribute('data-size', String(S.size || 0));
    html.setAttribute('data-qsize', String(S.qsize || 0));
  }
  applyPrefs();

  // ---------- helpers ----------
  function h(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(paths, size, cls) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', cls || 'chev'); s.setAttribute('width', String(size || 16)); s.setAttribute('height', String(size || 16)); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.6'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); paths.forEach(function (d) { var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.appendChild(p); }); return s; }
  function chev() { return svg(['M9 6l6 6-6 6']); }
  function check() { return svg(['M5 12l5 5 9-10']); }
  function shareIcon() { return svg(['M12 3.5v11', 'M8.5 7 12 3.5 15.5 7', 'M5.5 11.5v7a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-7'], 20, 'share-icon'); }
  function row(label, opts) { opts = opts || {}; var b = h(opts.href ? 'a' : 'button', { class: 'row' + (opts.quiet ? ' quiet' : '') }); if (opts.href) b.setAttribute('href', opts.href); else b.setAttribute('type', 'button'); var span = h('span', { text: label }); if (opts.sub) span.appendChild(h('span', { class: 'sub', text: opts.sub })); b.appendChild(span); b.appendChild(opts.done ? check() : chev()); if (opts.on) b.addEventListener('click', opts.on); return b; }
  var toastTimer;
  function toast(msg) { var old = document.querySelector('.toast'); if (old) old.remove(); var el = h('div', { class: 'toast', role: 'status', text: msg }); body.appendChild(el); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.remove(); }, 2400); }
  // numerals: Western unless the page says otherwise (data-digits="arab" for Arabic)
  var DIGITS = { 'arab': '٠١٢٣٤٥٦٧٨٩', 'arab-ext': '۰۱۲۳۴۵۶۷۸۹' }[body.getAttribute('data-digits')] || null;
  function num(n) { return DIGITS ? String(n).replace(/\d/g, function (d) { return DIGITS[d]; }) : String(n); }
  /** The same order for everyone on the same date: a small seeded shuffle. */
  function dayNumber() { return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000); }
  function rng(seed) { var a = seed >>> 0; return function () { a += 0x6D2B79F5; var x = Math.imul(a ^ (a >>> 15), 1 | a); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(list, seed) { var r = rng(seed); var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  var DATA = {};
  function loadData(name, cb) {
    if (DATA[name]) return cb(DATA[name]);
    fetch(BASE + '/assets/data/' + name + '-' + LANG + '.json').then(function (r) { return r.json(); }).then(function (d) { DATA[name] = d; cb(d); }).catch(function () { cb([]); });
  }

  // ---------- sheet: one calm surface that rises from below, closed by the reader ----------
  var sheetState = null;
  function closeSheet() { if (!sheetState) return; var s = sheetState; sheetState = null; s.root.remove(); body.classList.remove('sheet-open'); if (s.returnTo && s.returnTo.focus) s.returnTo.focus(); if (s.onClose) s.onClose(); }
  function openSheet(opts) {
    closeSheet();
    var root = h('div', { class: 'sheet-root' + (opts.full ? ' full' : '') });
    var dim = h('div', { class: 'sheet-dim' }); dim.addEventListener('click', closeSheet);
    var panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    if (opts.title) panel.setAttribute('aria-labelledby', 'sheet-title');
    var top = h('div', { class: 'sheet-top' });
    if (opts.title) top.appendChild(h('p', { class: 'sheet-title', id: 'sheet-title', text: opts.title }));
    var close = h('button', { type: 'button', class: 'sheet-close', 'aria-label': t('sheet.close') }, [svg(['M6 6l12 12M18 6L6 18'], 20, 'x')]);
    close.addEventListener('click', closeSheet); top.appendChild(close);
    panel.appendChild(top);
    var bodyEl = h('div', { class: 'sheet-body' }); (opts.children || []).forEach(function (c) { bodyEl.appendChild(c); }); panel.appendChild(bodyEl);
    root.appendChild(dim); root.appendChild(panel); body.appendChild(root); body.classList.add('sheet-open');
    sheetState = { root: root, body: bodyEl, returnTo: document.activeElement, onClose: opts.onClose };
    root.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(); } });
    setTimeout(function () { var f = panel.querySelector('[data-autofocus]') || close; f.focus(); }, 30);
    return sheetState;
  }

  function bindSeg(root, attr, get, set) {
    var btns = root.querySelectorAll('[' + attr + ']');
    function paint() { btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === get())); }); }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute(attr)); save(); applyPrefs(); paint(); }); });
    paint();
  }

  // ---------- share: a picture, a PDF or a link; only content travels ----------
  function shareMessage(text, url) { return t('gift.msgOne') + '\n' + text + '\n' + t('gift.noNeed') + '\n' + url; }
  function sendLink(text, url, plainText) {
    var msg = plainText ? text + '\n' + url : shareMessage(text, url);
    if (navigator.share) { navigator.share({ title: text, text: plainText ? text : t('gift.msgOne') + '\n' + text + '\n' + t('gift.noNeed'), url: url }).catch(function () { /* cancelled */ }); return; }
    copyText(msg);
  }
  function copyText(msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(function () { toast(t('nav.shared')); }, function () { toast(t('nav.shared')); });
    else { var ta = h('textarea', { class: 'visually-hidden' }); ta.value = msg; body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); toast(t('nav.shared')); }
  }
  /** Hands a file to the system share sheet (Web Share with files, or the Capacitor Share and Filesystem plugins when the
   *  owner has installed them); otherwise saves the file through the browser. Nothing is uploaded anywhere. */
  function deliverFile(blob, name, title) {
    var file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) { file = null; }
    function saveInstead() {
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: name, class: 'visually-hidden', text: name });
      body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 20000);
      toast(t('share.failed'));
    }
    // the share sheet is the aim; a reader who closes it (AbortError) gets no file, any other failure saves the file instead
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { navigator.share({ files: [file], title: title }).then(function () { toast(t('share.saved')); }, function (err) { if (!err || err.name !== 'AbortError') saveInstead(); }); return; }
    var cap = window.Capacitor && window.Capacitor.Plugins;
    if (cap && cap.Filesystem && cap.Share) {
      var fr = new FileReader();
      fr.onload = function () {
        var b64 = String(fr.result).split(',')[1];
        cap.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' }).then(function (r) { return cap.Share.share({ title: title, files: [r.uri] }); }).catch(function (err) { if (!err || !/cancel/i.test(String(err.message || err))) saveInstead(); });
      };
      fr.readAsDataURL(blob);
      return;
    }
    saveInstead();
  }
  /** Draws the card on a canvas in the app's own type and colours: the title, the verse, its translation and reference, the
   *  matching passage with its translation, its original words, its book and verse, the thought, and the app name. Story (1080 x 1920) or square (1080 x 1080). */
  function drawCard(card, shape, cb) {
    var W = 1080, H = shape === 'square' ? 1080 : 1920;
    var bodyFont = getComputedStyle(body).fontFamily;
    var quranFont = '"Amiri Quran", "Amiri", serif';
    var loads = [];
    var hebrew = '"Noto Serif Hebrew", serif';
    var origFont = card.olang === 'he' ? hebrew : bodyFont;
    if (document.fonts && document.fonts.load) { if (card.olang === 'he') loads.push(document.fonts.load('32px ' + hebrew)); loads.push(document.fonts.load('56px ' + quranFont)); loads.push(document.fonts.load('34px ' + bodyFont)); loads.push(document.fonts.load('600 40px ' + bodyFont)); loads.push(document.fonts.load('italic 32px ' + bodyFont)); }
    Promise.all(loads).catch(function () { /* draw with what is there */ }).then(function () {
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      var INK = '#1E2A31', MUTED = '#5E6A73', ACCENT = '#8E4A1F', GLOW = '#C98A4B', BG = '#F4EEE3', SURF = '#FCF8F1';
      var margin = 84, maxW = W - margin * 2;
      function wrap(text, font, dir) {
        ctx.font = font; ctx.direction = dir;
        var words = String(text || '').split(/\s+/).filter(Boolean), lines = [], line = '';
        words.forEach(function (w) { var test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; });
        if (line) lines.push(line);
        return lines;
      }
      // the blocks, measured first so the whole card can be scaled to fit, then centred
      function blocks(k) {
        var out = [];
        var add = function (text, font, size, color, lh, dir, gap) { if (!text) return; var f = font.replace('SIZE', Math.round(size * k)); var lines = wrap(text, f, dir || 'ltr'); out.push({ lines: lines, font: f, color: color, lh: size * k * lh, dir: dir || 'ltr', gap: (gap || 18) * k }); };
        add(card.title, '600 SIZEpx ' + bodyFont, 42, INK, 1.3, RTL ? 'rtl' : 'ltr', 36);
        add('﴿' + card.ayah + '﴾', 'SIZEpx ' + quranFont, 54, INK, 1.9, 'rtl', 14);
        add(card.trans, 'SIZEpx ' + bodyFont, 33, INK, 1.5, RTL ? 'rtl' : 'ltr', 10);
        add(t('step.quran') + ' · ' + card.ref, 'SIZEpx ' + bodyFont, 25, ACCENT, 1.4, RTL ? 'rtl' : 'ltr', 34);
        if (card.ptext) {
          add(card.ptext, 'SIZEpx ' + bodyFont, 31, INK, 1.5, card.pdir || (RTL ? 'rtl' : 'ltr'), 8);
          if (card.porig) add(card.porig, 'SIZEpx ' + origFont, 32, INK, 1.6, card.odir || 'ltr', 8);
          add(card.pbook, 'SIZEpx ' + bodyFont, 25, ACCENT, 1.4, RTL ? 'rtl' : 'ltr', 4);
          add(card.psrc, 'SIZEpx ' + bodyFont, 20, MUTED, 1.4, 'ltr', 30);
        }
        add(card.thought, 'italic SIZEpx ' + bodyFont, 31, INK, 1.45, RTL ? 'rtl' : 'ltr', 10);
        return out;
      }
      var k = 1, bs, total, top = 150, bottom = 130;
      for (var tries = 0; tries < 8; tries++) {
        bs = blocks(k); total = 0;
        bs.forEach(function (b) { total += b.lines.length * b.lh + b.gap; });
        if (total <= H - top - bottom) break;
        k *= 0.9;
      }
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = SURF; ctx.beginPath(); ctx.roundRect(40, 40, W - 80, H - 80, 36); ctx.fill();
      ctx.strokeStyle = 'rgba(30,42,49,.10)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = ACCENT; ctx.font = '600 24px ' + bodyFont; ctx.direction = RTL ? 'rtl' : 'ltr';
      ctx.fillText(String(UI._name || 'Sirat'), W / 2, 104);
      ctx.strokeStyle = 'rgba(30,42,49,.12)'; ctx.beginPath(); ctx.moveTo(W / 2 - 160, 124); ctx.lineTo(W / 2 - 14, 124); ctx.moveTo(W / 2 + 14, 124); ctx.lineTo(W / 2 + 160, 124); ctx.stroke();
      ctx.save(); ctx.translate(W / 2, 124); ctx.rotate(Math.PI / 4); ctx.fillStyle = GLOW; ctx.fillRect(-4, -4, 8, 8); ctx.restore();
      var y = top + Math.max(0, (H - top - bottom - total) / 2);
      bs.forEach(function (b) {
        ctx.font = b.font; ctx.fillStyle = b.color; ctx.direction = b.dir;
        b.lines.forEach(function (ln) { y += b.lh; ctx.fillText(ln, W / 2, y - b.lh * 0.28); });
        y += b.gap;
      });
      ctx.fillStyle = MUTED; ctx.font = '22px ' + bodyFont; ctx.direction = 'ltr';
      ctx.fillText(String(UI._name || 'Sirat'), W / 2, H - 72);
      cb(c);
    });
  }
  /** A dependency-free PDF: one page with the card as a JPEG image placed on an A4 portrait page. */
  function makePdf(jpeg, w, hgt) {
    var pw = 595.28, ph = 841.89, m = 36;
    var s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / hgt); var iw = w * s, ih = hgt * s; var x = (pw - iw) / 2, y = (ph - ih) / 2;
    var enc = new TextEncoder();
    var parts = []; var offsets = []; var len = 0;
    function push(bytes) { parts.push(bytes); len += bytes.length; }
    function str(sv) { push(enc.encode(sv)); }
    function obj(n, bodyText, stream) { offsets[n] = len; str(n + ' 0 obj\n' + bodyText + '\n'); if (stream) { str('stream\n'); push(stream); str('\nendstream\n'); } str('endobj\n'); }
    str('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw.toFixed(2) + ' ' + ph.toFixed(2) + '] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>');
    var content = enc.encode('q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im1 Do Q');
    obj(4, '<< /Length ' + content.length + ' >>', content);
    obj(5, '<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + hgt + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>', jpeg);
    obj(6, '<< /Producer (Sirat) >>');
    var xref = len;
    var table = 'xref\n0 7\n0000000000 65535 f \n';
    for (var i = 1; i <= 6; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    str(table + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var out = new Uint8Array(len); var p = 0; parts.forEach(function (b) { out.set(b, p); p += b.length; });
    return new Blob([out], { type: 'application/pdf' });
  }
  function fileStem(card) { return (card.ref || 'sirat').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'sirat'; }
  function sharePicture(card, shape) {
    toast(t('share.making'));
    drawCard(card, shape, function (c) { c.toBlob(function (blob) { if (blob) deliverFile(blob, 'sirat-' + fileStem(card) + '-' + shape + '.png', card.title || card.ref); }, 'image/png'); });
  }
  function sharePdf(card) {
    toast(t('share.making'));
    drawCard(card, 'page', function (c) {
      c.toBlob(function (blob) {
        if (!blob) return;
        blob.arrayBuffer().then(function (buf) { deliverFile(makePdf(new Uint8Array(buf), c.width, c.height), 'sirat-' + fileStem(card) + '.pdf', card.title || card.ref); });
      }, 'image/jpeg', 0.92);
    });
  }
  /** The share sheet: Picture (story or square), PDF, Link. `card` carries only content and the public page. */
  function openShareSheet(card) {
    var list = h('div', { class: 'rows' });
    var shapes = h('div', { class: 'b2 share-shapes' }, [
      h('button', { type: 'button', class: 'btn', text: t('share.story') }),
      h('button', { type: 'button', class: 'btn secondary', text: t('share.square') }),
    ]);
    shapes.hidden = true;
    shapes.children[0].addEventListener('click', function () { closeSheet(); sharePicture(card, 'story'); });
    shapes.children[1].addEventListener('click', function () { closeSheet(); sharePicture(card, 'square'); });
    var pic = row(t('share.picture'), { sub: t('share.pictureSub'), on: function () { shapes.hidden = !shapes.hidden; } });
    pic.setAttribute('data-autofocus', '1');
    list.appendChild(pic); list.appendChild(shapes);
    list.appendChild(row(t('share.pdf'), { sub: t('share.pdfSub'), on: function () { closeSheet(); sharePdf(card); } }));
    if (card.url) list.appendChild(row(t('share.link'), { sub: t('share.linkSub'), on: function () { closeSheet(); sendLink(card.title || card.ref, card.url, !card.title); } }));
    openSheet({ title: t('share.title'), children: [list] });
  }
  function cardFromReflection(item) {
    return { title: '', ayah: item.a, ref: item.rl, trans: item.t || '', pbook: item.bn + (item.pr ? ' · ' + item.pr : ''), ptext: item.pt, porig: item.po, olang: item.ol, odir: item.od, psrc: item.ps, pdir: item.pd, thought: item.q, url: item.s ? absUrl(item.s) : '' };
  }
  function absUrl(slug) { if (!slug) return ''; if (/^https?:/.test(slug)) return slug; return APP ? '' : location.origin + slug; }

  // ---------- "Didn't find your question?": the one place a reader may type. An anonymous POST to the owner's form, only
  // when site.config.mjs names it (the build writes the address on <body>); the body carries the kind and the words, nothing
  // else (src/feedback.js, proven by scripts/test-feedback.mjs). The text is never stored. ----------
  var FB = body.getAttribute('data-feedback-url') ? { url: body.getAttribute('data-feedback-url'), kind: body.getAttribute('data-feedback-kind'), text: body.getAttribute('data-feedback-text') } : null;
  function feedbackRowEl() { if (!FB) return null; var r = row(t('fb.btn'), { quiet: true, sub: t('fb.btnSub'), on: openFeedback }); r.setAttribute('data-feedback-open', ''); return r; }
  function openFeedback() {
    if (!FB || !window.SiratFeedback) return;
    var kind = null;
    var list = h('div', { class: 'rows' });
    var rows = window.SiratFeedback.KINDS.map(function (k) { var r = row(t('fb.kind.' + k), { on: function () { kind = kind === k ? null : k; paint(); } }); r.setAttribute('data-kind', k); return r; });
    function paint() { rows.forEach(function (r) { var on = r.getAttribute('data-kind') === kind; r.setAttribute('aria-pressed', String(on)); var old = r.querySelector('svg'); if (old) r.replaceChild(on ? check() : chev(), old); }); }
    rows.forEach(function (r) { list.appendChild(r); });
    rows[0].setAttribute('data-autofocus', '1');
    var ta = h('textarea', { class: 'line-field fb-field', rows: '3', maxlength: '1000', placeholder: t('fb.placeholder'), 'aria-label': t('fb.placeholder') });
    var anon = h('p', { class: 'hint fb-anon', text: t('fb.anon') });
    var send = h('button', { type: 'button', class: 'btn', text: t('fb.send') });
    send.addEventListener('click', function () {
      var data = window.SiratFeedback.body({ kind: FB.kind, text: FB.text }, kind, ta.value);
      if (!data) { toast(t('fb.choose')); return; }
      send.disabled = true;
      // Google Forms answers without CORS headers: an opaque response means the request left the device
      fetch(FB.url, { method: 'POST', mode: 'no-cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }, body: data })
        .then(function () { closeSheet(); toast(t('fb.sent')); }, function () { send.disabled = false; toast(t('fb.offline')); });
    });
    openSheet({ title: t('fb.title'), children: [h('p', { class: 'muted sheet-lead', text: t('fb.lead') }), list, ta, anon, h('div', { class: 'b2' }, [send])] });
    paint();
  }
  document.querySelectorAll('[data-feedback-open]').forEach(function (b) { b.addEventListener('click', openFeedback); });

  // ---------- reflection cards (today's and the feed): built from the per-language data ----------
  function rcardEl(item) {
    var card = h('article', { class: 'rcard', 'data-rid': item.i });
    var ayah = h('p', { class: 'ayah small-ayah', lang: 'ar', dir: 'rtl' }, [h('span', { class: 'b', 'aria-hidden': 'true', text: '﴿' }), document.createTextNode(item.a), h('span', { class: 'b', 'aria-hidden': 'true', text: '﴾' })]);
    card.appendChild(ayah);
    if (item.t) { card.appendChild(h('p', { class: 'psg-label', text: t('tag.meaning') })); card.appendChild(h('p', { class: 'trans' + (RTL ? ' rtl' : ''), lang: LANG, text: item.t })); }
    var src = h('p', { class: 'src' }, [h('b', { text: t('step.quran') }), document.createTextNode(' · '), h('span', { dir: RTL ? 'rtl' : 'ltr', text: item.rl })]);
    card.appendChild(src);
    // each passage is treated like the verse: the text, then "Book · place" in the same short style
    function psg(x) {
      var beside = h('div', { class: 'beside' });
      if (x.po) beside.appendChild(h('p', { class: 'psg-label', text: t('tag.translation') }));
      beside.appendChild(h('p', { class: 'psg-trans', lang: x.pl, dir: x.pd, text: x.pt }));
      if (x.po) { beside.appendChild(h('p', { class: 'psg-label', text: t('tag.original') + (x.on ? ' · ' + x.on : '') })); beside.appendChild(h('p', { class: 'psg-orig', lang: x.ol, dir: x.od, text: x.po })); }
      beside.appendChild(h('p', { class: 'src psg-ref' }, [h('b', { text: x.bn }), document.createTextNode(' · '), h('bdi', { text: x.pr })]));
      beside.appendChild(h('p', { class: 'psg-src' }, [h('bdi', { lang: 'en', dir: 'ltr', text: x.ps })]));
      return beside;
    }
    card.appendChild(psg(item));
    if (item.p2) card.appendChild(psg(item.p2));
    card.appendChild(h('p', { class: 'rq', text: item.q }));
    var actions = h('div', { class: 'rcard-actions' });
    var shareBtn = h('button', { type: 'button', class: 'btn secondary small-btn' }, [shareIcon(), h('span', { text: t('share.btn') })]);
    shareBtn.addEventListener('click', function () { openShareSheet(cardFromReflection(item)); });
    actions.appendChild(shareBtn);
    if (item.s) actions.appendChild(h('a', { class: 'btn secondary small-btn', href: item.s }, [h('span', { text: t('refl.open') })]));
    card.appendChild(actions);
    return card;
  }

  // ---------- first-run tutorial: five short screens with the language choice first, replayed from Settings ----------
  function tutorialArt(n) {
    var wrap = h('div', { class: 'tut-art', 'aria-hidden': 'true' });
    if (n === 1) { wrap.appendChild(h('img', { src: BASE + '/assets/img/icon-day.svg', alt: '', width: '96', height: '96' })); return wrap; }
    var paths = {
      2: ['M4.5 5.5h6v6h-6zM13.5 5.5h6v6h-6zM4.5 14.5h6v6h-6zM13.5 14.5h6v6h-6z'],
      3: ['M4 6.5h16', 'M4 12h11', 'M4 17.5h13', 'M18.5 16.5l1.2 1.2 2.3-2.6'],
      4: ['M12 5v14', 'M12 6.5c-1.6-1.3-3.9-1.8-7-1.5v13c3.1-.3 5.4.2 7 1.5', 'M12 6.5c1.6-1.3 3.9-1.8 7-1.5v13c-3.1-.3-5.4.2-7 1.5', 'M2.5 9.5v8', 'M21.5 9.5v8'],
      5: ['M8 3.5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z', 'M12 17.2h.01', 'M12 9v3', 'M10.5 12.5h3'],
    };
    wrap.appendChild(svg(paths[n] || [], 96, 'tut-svg'));
    return wrap;
  }
  function langList() {
    var list = h('div', { class: 'tut-langs chips' });
    (body.getAttribute('data-langs') || '').split(',').forEach(function (pair) {
      var code = pair.split('|')[0], name = pair.split('|')[1] || code;
      if (!code) return;
      var a = h('a', { class: 'chip', href: BASE + '/' + code + '/' + INDEX_FILE, hreflang: code, lang: code, text: name });
      if (code === LANG) a.setAttribute('aria-pressed', 'true');
      a.addEventListener('click', function () { S.tutorialDone = false; save(); });
      list.appendChild(a);
    });
    return list;
  }
  function openTutorial(onDone) {
    var i = 0; var total = 5;
    var art = h('div'); var title = h('p', { class: 'tut-title' }); var text = h('p', { class: 'tut-body' }); var extra = h('div', { class: 'tut-extra' }); var dots = h('div', { class: 'tut-dots', 'aria-hidden': 'true' }); var step = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
    var back = h('button', { type: 'button', class: 'btn secondary tut-back', text: t('tut.back') });
    var next = h('button', { type: 'button', class: 'btn tut-next', text: t('tut.next') });
    var skip = h('button', { type: 'button', class: 'linklike tut-skip', text: t('tut.skip') });
    function finish() { S.tutorialDone = true; save(); closeSheet(); if (onDone) onDone(); }
    function paint() {
      while (art.firstChild) art.removeChild(art.firstChild); art.appendChild(tutorialArt(i + 1));
      title.textContent = t('tut.' + (i + 1) + '.title'); text.textContent = t('tut.' + (i + 1) + '.body');
      while (extra.firstChild) extra.removeChild(extra.firstChild);
      if (i === 0) { extra.appendChild(h('p', { class: 'label', text: t('tut.lang') })); extra.appendChild(langList()); }
      step.textContent = t('tut.step', { n: num(i + 1), total: num(total) });
      while (dots.firstChild) dots.removeChild(dots.firstChild);
      for (var k = 0; k < total; k++) dots.appendChild(h('i', { class: k === i ? 'on' : '' }));
      back.hidden = i === 0; skip.hidden = i === total - 1;
      next.textContent = i === total - 1 ? t('tut.done') : t('tut.next');
    }
    back.addEventListener('click', function () { if (i > 0) { i--; paint(); } });
    next.addEventListener('click', function () { if (i < total - 1) { i++; paint(); } else finish(); });
    skip.addEventListener('click', finish);
    var card = h('div', { class: 'tut' }, [h('div', { class: 'tut-head' }, [step, skip]), art, title, text, extra, dots, h('div', { class: 'tut-actions' }, [back, next])]);
    next.setAttribute('data-autofocus', '1');
    paint();
    openSheet({ full: true, children: [card], onClose: function () { if (!S.tutorialDone) { S.tutorialDone = true; save(); } } });
  }

  // ---------- root language chooser: the phone's language, else the default ----------
  if (body.classList.contains('root')) {
    var langs = (body.getAttribute('data-langs') || 'en').split(',');
    var want = (navigator.language || '').slice(0, 2).toLowerCase();
    var target = langs.indexOf(want) >= 0 ? want : body.getAttribute('data-default') || langs[0];
    if (location.hash !== '#choose') location.replace(BASE + '/' + target + '/' + INDEX_FILE);
  }

  // ---------- home: today's reflection, people also ask ----------
  if (body.classList.contains('home')) {
    var todayBox = document.querySelector('[data-today-reflection]');
    if (todayBox) loadData('reflections', function (list) {
      if (!list.length) return;
      var short = list.filter(function (r) { return r.a.length < 200; }); // a verse that leaves room on the first screen
      var item = shuffled(short.length ? short : list, dayNumber())[0];
      while (todayBox.firstChild) todayBox.removeChild(todayBox.firstChild);
      todayBox.appendChild(rcardEl(item));
    });
    var also = document.querySelector('[data-also-ask]');
    if (also) loadData('questions', function (list) {
      var easy = list.filter(function (q) { return q.slug && q.depth <= 1; });
      if (easy.length < 5) easy = list.filter(function (q) { return q.slug; });
      var pick = shuffled(easy, dayNumber() * 7 + 3).slice(0, 5);
      if (!pick.length) return;
      while (also.firstChild) also.removeChild(also.firstChild);
      pick.forEach(function (q) { also.appendChild(row(q.q, { href: q.slug })); });
    });
    // first launch: the tutorial, once, on the home screen only (never on a shared Step)
    if (!S.tutorialDone) setTimeout(function () { openTutorial(); }, 250);
  }

  // ---------- the Reflections feed: shuffled by day, filtered by book and theme, loading more without end ----------
  var feed = document.querySelector('[data-feed]');
  if (feed) {
    var bookBar = document.querySelector('[data-refl-books]'); var themeBar = document.querySelector('[data-refl-themes]'); var more = document.querySelector('[data-feed-more]');
    // ?book=psalms opens the feed on one book (the "By book" page links here); the marker leaves the address bar
    var wantBook = new URLSearchParams(location.search).get('book');
    var book = wantBook && bookBar && bookBar.querySelector('[data-book="' + wantBook + '"]') ? wantBook : 'all', theme = null, order = [], pos = 0, round = 0, served = 0, ALL = [];
    if (wantBook) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } }
    if (bookBar) bookBar.querySelectorAll('[data-book]').forEach(function (x) { var on = x.getAttribute('data-book') === book; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    function filtered() { return ALL.filter(function (r) { return (book === 'all' || r.b === book) && (!theme || r.th === theme); }); }
    function restart() {
      while (feed.firstChild) feed.removeChild(feed.firstChild);
      round = 0; pos = 0; order = shuffled(filtered(), dayNumber() + round);
      fill();
    }
    function fill() {
      if (!order.length) { if (more) more.hidden = true; return; }
      var n = 0;
      while (n < 8) {
        if (pos >= order.length) { round++; pos = 0; order = shuffled(filtered(), dayNumber() + round); }
        feed.appendChild(rcardEl(order[pos++])); n++;
        served++;
        if (served % 24 === 0) { var fr = feedbackRowEl(); if (fr) feed.appendChild(fr); } // the quiet question row, from time to time
      }
      if (more) more.hidden = false;
    }
    loadData('reflections', function (list) {
      ALL = list; restart();
      if (more && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) fill(); }, { rootMargin: '900px' }).observe(more);
      else window.addEventListener('scroll', function () { if (window.innerHeight + window.scrollY > body.offsetHeight - 1200) fill(); });
    });
    if (bookBar) bookBar.querySelectorAll('[data-book]').forEach(function (c) { c.addEventListener('click', function () { book = c.getAttribute('data-book'); bookBar.querySelectorAll('[data-book]').forEach(function (x) { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); }); restart(); window.scrollTo({ top: feed.getBoundingClientRect().top + window.scrollY - 120, behavior: 'auto' }); }); });
    if (themeBar) themeBar.querySelectorAll('[data-theme]').forEach(function (c) { c.addEventListener('click', function () { var v = c.getAttribute('data-theme'); theme = theme === v ? null : v; themeBar.querySelectorAll('[data-theme]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-theme') === theme)); }); restart(); }); });
  }

  // ---------- Step page: every word is already open, so the script only adds the arrival line and the share sheet ----------
  var article = document.querySelector('article.step, article.station');
  if (article) {
    // arrival from a shared link: one quiet line, shown once, and the marker leaves the address bar so a re-copied link is clean
    var marker = new URLSearchParams(location.search).get('s');
    if (marker) { var arrived = article.querySelector('[data-arrived]'); if (arrived) arrived.hidden = false; try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ } }
    // the share sheet: the card data is a JSON block written by the build (share wording, first verse, first passage, public page)
    var cardData = null;
    try { var ce = document.getElementById('card'); if (ce) cardData = JSON.parse(ce.textContent); } catch (err) { cardData = null; }
    if (cardData) { cardData.thought = ''; document.querySelectorAll('[data-share-open]').forEach(function (b) { b.addEventListener('click', function () { openShareSheet(cardData); }); }); }
  }

  // ---------- Settings page ----------
  if (body.classList.contains('settings')) {
    bindSeg(document, 'data-theme', function () { return S.theme || 'auto'; }, function (v) { S.theme = v; });
    bindSeg(document, 'data-size', function () { return String(S.size || 0); }, function (v) { S.size = +v; });
    bindSeg(document, 'data-qsize', function () { return String(S.qsize || 0); }, function (v) { S.qsize = +v; });
    var tut = document.querySelector('[data-tutorial]'); if (tut) tut.addEventListener('click', function () { openTutorial(); });
    var shareApp = document.querySelector('[data-share-app]'); if (shareApp) shareApp.addEventListener('click', function () { sendLink(shareApp.getAttribute('data-share-text'), shareApp.getAttribute('data-share-url'), true); });
  }

  // ---------- Today's card (website): the same question for everyone on the same date, chosen on the device ----------
  var today = document.querySelector('[data-today]');
  if (today) {
    loadData('daily', function (list) {
      if (!list.length) return;
      var d = list[dayNumber() % list.length];
      var img = today.querySelector('[data-today-img]'); if (img && d.img) { img.addEventListener('error', function () { var fig = img.closest('figure'); if (fig) fig.hidden = true; }); img.src = d.img; img.alt = d.q; }
      var sv = today.querySelector('[data-today-save]'); if (sv && d.img) sv.href = d.img;
      var q = today.querySelector('[data-today-q]'); if (q) q.textContent = d.q;
      var open = today.querySelector('[data-today-open]'); if (open) open.href = d.slug;
      var send = today.querySelector('[data-today-send]'); if (send) send.addEventListener('click', function () { sendLink(d.q, d.url); });
    });
  }

  // ---------- offline ----------
  if (!APP && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' }).catch(function () { /* offline support is optional */ }); });
  }
})();
