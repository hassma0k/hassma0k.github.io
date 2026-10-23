/* Metrado small pages: /v/#<id> (check a document) and /r/#<CODE> (invite). Reads the part of the address after
   the # in the browser only. Values are validated and written with textContent. No cookies, no storage. */
(function () {
  'use strict';

  var links = document.querySelectorAll('a[data-keep-hash]');
  function keepHash() {
    for (var i = 0; i < links.length; i++) links[i].href = links[i].getAttribute('href').split('#')[0] + location.hash;
  }

  function raw() {
    var h = location.hash.replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch (e) { return ''; }
    return h;
  }

  function codeBox() {
    var box = document.getElementById('code-box');
    if (!box) return;
    var kind = box.getAttribute('data-kind');           // 'verify' or 'invite'
    var out = document.getElementById('code-out');
    var none = document.getElementById('code-none');
    var bad = document.getElementById('code-bad');
    var copy = document.getElementById('code-copy');
    var v = raw();
    var ok = kind === 'invite' ? /^[A-Za-z0-9]{4,12}$/.test(v) : /^[A-Za-z0-9_-]{3,40}$/.test(v);
    if (kind === 'invite') v = v.toUpperCase();
    if (!v) { return; }
    if (!ok) { none.hidden = true; bad.hidden = false; return; }
    none.hidden = true;
    out.textContent = v;
    box.hidden = false;
    if (copy) {
      copy.hidden = false;
      copy.addEventListener('click', function () {
        function done() { copy.textContent = copy.getAttribute('data-done'); setTimeout(function () { copy.textContent = copy.getAttribute('data-label'); }, 2000); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(v).then(done, fallback);
        } else { fallback(); }
        function fallback() {
          var t = document.createElement('textarea');
          t.value = v; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
          document.body.appendChild(t); t.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* the code is on screen to copy by hand */ }
          document.body.removeChild(t);
        }
      });
    }
  }

  function init() { keepHash(); codeBox(); window.addEventListener('hashchange', function () { location.reload(); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
