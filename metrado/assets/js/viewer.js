/* Metrado proposal viewer (/p/#1.<payload>).
   Payload v1: "1." + base64url(deflateRaw(UTF-8 JSON)). Decoded in the browser with the bundled MIT inflate
   (fflate, see assets/js/fflate-inflate.js). Nothing is sent anywhere. Every value is untrusted: it is only ever
   written with textContent or encodeURIComponent, never as HTML. No cookies, no storage.
   ES5 on purpose, so it runs in older in-app browsers. */
(function (root) {
  'use strict';

  var MAX_INPUT = 6000;   // characters of payload we will even try to read
  var MAX_STR = 400;
  var LANGS = { en: 'ltr', es: 'ltr', ar: 'rtl' };

  // ---------- pure functions (also exercised by scripts/payload-test.mjs) ----------
  function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function str(x, max) {
    if (typeof x === 'number' && isFinite(x)) x = String(x);
    if (typeof x !== 'string') return '';
    return x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max || MAX_STR);
  }

  function normalize(o, fallbackLang) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    var biz = o.biz && typeof o.biz === 'object' ? o.biz : {};
    var doc = o.doc && typeof o.doc === 'object' ? o.doc : {};
    var client = o.client && typeof o.client === 'object' ? o.client : {};
    if (!Array.isArray(o.options) || !o.options.length) return null;
    var lang = LANGS.hasOwnProperty(o.lang) ? o.lang : (fallbackLang || 'en');
    var dir = o.dir === 'rtl' || o.dir === 'ltr' ? o.dir : LANGS[lang];
    var options = [];
    for (var i = 0; i < o.options.length && i < 6; i++) {
      var op = o.options[i];
      if (!op || typeof op !== 'object' || !Array.isArray(op.lines)) return null;
      var lines = [];
      for (var j = 0; j < op.lines.length && j < 80; j++) {
        var l = op.lines[j] || {};
        lines.push({ label: str(l.label), qty: str(l.qty), amount: str(l.amount, 60) });
      }
      var t = op.tax;
      if (t && typeof t === 'object') t = { label: str(t.label, 60), amount: str(t.amount, 60) };
      else t = str(t, 60) ? { label: '', amount: str(t, 60) } : null;
      options.push({ name: str(op.name, 120), lines: lines, subtotal: str(op.subtotal, 60), tax: t, total: str(op.total, 60) });
    }
    var dep = o.deposit;
    if (dep && typeof dep === 'object') dep = str(dep.label, 60) ? str(dep.label, 60) + ': ' + str(dep.amount, 60) : str(dep.amount, 60);
    return {
      v: 1, lang: lang, dir: dir,
      biz: { name: str(biz.name, 120), phone: str(biz.phone, 40), whatsapp: str(biz.whatsapp, 40), email: str(biz.email, 120), tierLine: str(biz.tierLine, 200).replace(/^\s+|\s+$/g, '') },
      doc: { number: str(doc.number, 60), date: str(doc.date, 60), validUntil: str(doc.validUntil, 60), verifyId: str(doc.verifyId, 64) },
      client: { name: str(client.name, 120) },
      title: str(o.title, 160),
      options: options,
      deposit: str(dep, 160),
      termsSummary: str(o.termsSummary, 1200)
    };
  }

  // Returns { ok: true, data } or { ok: false, reason: 'empty' | 'bad' | 'new' }.
  function decodePayload(hash, fallbackLang) {
    var h = String(hash || '').replace(/^#/, '');
    if (!h) return { ok: false, reason: 'empty' };
    var m = /^(\d{1,3})\.([A-Za-z0-9_-]+)$/.exec(h);
    if (!m || m[2].length > MAX_INPUT) return { ok: false, reason: 'bad' };
    if (m[1] !== '1') return { ok: false, reason: 'new' };
    try {
      var inf = root.MetradoInflate;
      var json = inf.str(inf.inflate(b64urlToBytes(m[2])));
      var data = normalize(JSON.parse(json), fallbackLang);
      if (!data || !data.biz.name) return { ok: false, reason: 'bad' };
      return { ok: true, data: data };
    } catch (e) {
      return { ok: false, reason: 'bad' };
    }
  }

  function phoneDigits(p) {
    var d = String(p || '').replace(/[^0-9]/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    return d.length >= 7 && d.length <= 15 ? d : '';
  }
  function phoneDial(p) {
    var d = phoneDigits(p);
    return d ? '+' + d : '';
  }
  function emailOk(e) { return /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/.test(e || ''); }

  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars.hasOwnProperty(k) ? vars[k] : ''; });
  }

  // msgs = { en: { t, dep, name }, es: {...}, ar: {...} }. The message is written in the proposal's language.
  function acceptMessage(data, optionIndex, clientName, msgs) {
    var m = msgs[data.lang] || msgs.en;
    var op = data.options[optionIndex] || data.options[0];
    return fill(m.t, {
      biz: data.biz.name,
      number: data.doc.number,
      title: data.title ? ' (' + data.title + ')' : '',
      option: op.name,
      total: op.total,
      deposit: data.deposit ? ' ' + fill(m.dep, { v: data.deposit }) : '',
      name: clientName ? ' ' + fill(m.name, { v: clientName }) : '',
      code: data.doc.verifyId
    }).replace(/ {2,}/g, ' ');
  }

  function acceptLinks(data, optionIndex, clientName, msgs, subject) {
    var text = acceptMessage(data, optionIndex, clientName, msgs);
    var enc = encodeURIComponent;
    var out = { wa: '', sms: '', mail: '', text: text };
    var wa = phoneDigits(data.biz.whatsapp);
    if (wa) out.wa = 'https://wa.me/' + wa + '?text=' + enc(text);
    var sms = phoneDial(data.biz.phone || data.biz.whatsapp);
    if (sms) out.sms = 'sms:' + sms + '?&body=' + enc(text);
    if (emailOk(data.biz.email)) out.mail = 'mailto:' + data.biz.email + '?subject=' + enc(fill(subject, { number: data.doc.number })) + '&body=' + enc(text);
    return out;
  }

  // The lines under the business name, in order. A line that is empty or missing is left out entirely: no row, no separator.
  function brandLines(biz) {
    var contact = [biz.phone || biz.whatsapp, biz.email].filter(Boolean).join(' · ');
    var out = [];
    if (biz.tierLine) out.push({ cls: 'doc-contact', text: biz.tierLine });
    if (contact) out.push({ cls: 'doc-contact num', text: contact });
    return out;
  }

  root.MetradoViewer = { brandLines: brandLines, decodePayload: decodePayload, normalize: normalize, acceptMessage: acceptMessage, acceptLinks: acceptLinks, phoneDigits: phoneDigits };

  // ---------- DOM (browser only) ----------
  if (typeof document === 'undefined') return;

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k) && attrs[k] !== null && attrs[k] !== undefined) {
      if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    }
    if (kids) for (var i = 0; i < kids.length; i++) if (kids[i]) n.appendChild(kids[i]);
    return n;
  }
  function tx(tag, cls, text) { return el(tag, { 'class': cls, text: text }); }

  function keepHash() {
    var links = document.querySelectorAll('a[data-keep-hash]');
    for (var i = 0; i < links.length; i++) links[i].href = links[i].getAttribute('href').split('#')[0] + location.hash;
  }

  function init() {
    var rootEl = document.getElementById('viewer-root');
    if (!rootEl) return;
    keepHash();
    var I = JSON.parse(document.getElementById('i18n').textContent);
    var pageLang = document.documentElement.getAttribute('lang') || 'en';

    function show() {
      var r = decodePayload(location.hash, pageLang);
      if (r.reason === 'empty') return; // keep the static empty state
      while (rootEl.firstChild) rootEl.removeChild(rootEl.firstChild);
      document.title = (r.ok && r.data.title ? r.data.title + ' · ' : '') + I.title + ' · Metrado';
      if (!r.ok) {
        rootEl.appendChild(el('div', { 'class': 'wrap-doc msg-box' }, [
          tx('h1', '', I.errorTitle),
          tx('p', '', r.reason === 'new' ? I.errorTooNew : I.errorBody),
          el('p', null, [el('a', { href: I.verifyUrl, text: I.howToCheck })])
        ]));
        return;
      }
      render(r.data);
    }

    function render(d) {
      var sel = 0;
      var isSample = d.doc.verifyId === 'SAMPLE';
      var note = el('div', { 'class': 'demo-note' }, [el('div', { 'class': 'wrap-doc' }, [
        tx('p', '', (isSample ? I.sampleBanner + ' ' : '') + I.unverified),
        el('a', { href: I.verifyUrl + (d.doc.verifyId ? '#' + encodeURIComponent(d.doc.verifyId) : ''), text: I.howToCheck })
      ])]);

      var doc = el('div', { 'class': 'doc', lang: d.lang, dir: d.dir });
      var initials = d.biz.name.replace(/^\s+|\s+$/g, '').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || 'M';
      var meta = el('dl', { 'class': 'doc-meta' });
      function metaRow(label, value, cls) {
        if (!value) return;
        meta.appendChild(el('div', null, [tx('dt', '', label), tx('dd', cls || '', value)]));
      }
      metaRow(I.number, d.doc.number, 'num');
      metaRow(I.date, d.doc.date, 'num');
      metaRow(I.validUntil, d.doc.validUntil, 'num');
      metaRow(I.preparedFor, d.client.name);
      metaRow(I.checkCode, d.doc.verifyId, 'num');
      var head = el('header', { 'class': 'doc-head' }, [
        el('div', { 'class': 'doc-brand' }, [
          tx('span', 'doc-logo', initials),
          el('div', null, [tx('p', 'doc-co', d.biz.name)].concat(brandLines(d.biz).map(function (l) { return tx('p', l.cls, l.text); })))
        ]),
        tx('h1', 'doc-title', d.title || I.title),
        meta
      ]);
      doc.appendChild(head);

      // options
      var detail = el('section', { 'class': 'doc-sec', 'aria-live': 'polite' });
      var optsSec = null;
      if (d.options.length > 1) {
        optsSec = el('section', { 'class': 'doc-sec' });
        optsSec.appendChild(tx('h2', '', I.options));
        var fs = el('fieldset', { 'class': 'options' });
        fs.appendChild(tx('legend', 'visually-hidden', I.options));
        d.options.forEach(function (op, i) {
          var id = 'opt-' + i;
          var inp = el('input', { type: 'radio', name: 'option', id: id, value: String(i) });
          if (i === 0) inp.checked = true;
          inp.addEventListener('change', function () { sel = i; paint(); });
          fs.appendChild(el('div', { 'class': 'option' }, [inp, el('label', { 'for': id }, [tx('span', 'opt-name', op.name || (I.option + ' ' + (i + 1))), tx('span', 'opt-total num', op.total)])]));
        });
        optsSec.appendChild(fs);
        doc.appendChild(optsSec);
      }
      doc.appendChild(detail);

      var terms = d.termsSummary ? el('section', { 'class': 'doc-sec' }, [tx('h2', '', I.terms), tx('p', 'doc-small-text', d.termsSummary)]) : null;
      if (terms) doc.appendChild(terms);

      // accept
      var acc = el('section', { 'class': 'doc-sec accept' });
      acc.appendChild(tx('h2', '', I.acceptTitle));
      var chosen = tx('p', 'doc-intro', '');
      acc.appendChild(chosen);
      var nameField = el('div', { 'class': 'field' });
      var nameInp = el('input', { type: 'text', id: 'client-name', autocomplete: 'name', maxlength: '80' });
      nameInp.value = d.client.name;
      nameField.appendChild(el('label', { 'for': 'client-name', text: I.yourName }));
      nameField.appendChild(nameInp);
      acc.appendChild(nameField);
      var btns = el('div', { 'class': 'accept-btns' });
      var bWa = el('a', { 'class': 'btn btn-brand btn-block', rel: 'noopener', text: I.viaWhatsapp });
      var bSms = el('a', { 'class': 'btn btn-brand btn-block', text: I.viaSms });
      var bMail = el('a', { 'class': 'btn btn-brand btn-block', text: I.viaEmail });
      [bWa, bSms, bMail].forEach(function (b) { btns.appendChild(b); });
      acc.appendChild(btns);
      var none = tx('p', 'help', I.noContact);
      acc.appendChild(none);
      acc.appendChild(tx('p', 'help', I.acceptHelp));
      doc.appendChild(acc);

      function paint() {
        var op = d.options[sel];
        while (detail.firstChild) detail.removeChild(detail.firstChild);
        detail.appendChild(tx('h2', '', op.name || I.option));
        var tbody = el('tbody');
        op.lines.forEach(function (l) {
          tbody.appendChild(el('tr', null, [
            el('td', null, [tx('span', '', l.label), l.qty ? tx('small', 'line-qty num', l.qty) : null]),
            tx('td', 'amt num', l.amount)
          ]));
        });
        var tfoot = el('tfoot');
        function foot(label, value, cls) { if (value) tfoot.appendChild(el('tr', { 'class': cls || null }, [tx('th', '', label), tx('td', 'amt num', value)])); }
        if (op.tax) foot(op.tax.label || I.tax, op.tax.amount);
        if (op.subtotal && op.subtotal !== op.total) tfoot.insertBefore(el('tr', null, [tx('th', '', I.subtotal), tx('td', 'amt num', op.subtotal)]), tfoot.firstChild);
        foot(I.total, op.total, 'tot');
        foot(I.deposit, d.deposit);
        var table = el('table', { 'class': 'doc-table lines' }, [
          el('thead', null, [el('tr', null, [tx('th', '', I.item), tx('th', 'amt', I.amount)])]), tbody, tfoot
        ]);
        table.querySelector('thead th').setAttribute('scope', 'col');
        detail.appendChild(el('div', { 'class': 'table-wrap' }, [table]));
        chosen.textContent = I.acceptedOption + ': ' + (op.name || I.option) + ' · ' + op.total;
        links();
      }

      function links() {
        var L = acceptLinks(d, sel, nameInp.value.replace(/^\s+|\s+$/g, ''), I.msgs, I.emailSubject);
        function set(b, href) { if (href) { b.setAttribute('href', href); b.style.display = ''; } else { b.removeAttribute('href'); b.style.display = 'none'; } }
        set(bWa, L.wa); set(bSms, L.sms); set(bMail, L.mail);
        none.style.display = L.wa || L.sms || L.mail ? 'none' : '';
      }
      nameInp.addEventListener('input', links);

      rootEl.appendChild(note);
      rootEl.appendChild(doc);
      paint();
    }

    show();
    window.addEventListener('hashchange', function () { location.reload(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
