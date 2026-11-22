/* Baseera site: Arabic / English switch.
   No cookies, no storage, no network. The choice lives only in the URL (?lang=ar|en).
   Without JavaScript both languages are shown, Arabic first. */
(function () {
  var html = document.documentElement;
  html.classList.add("js");

  function pick() {
    var m = /[?&]lang=(ar|en)\b/.exec(location.search);
    if (m) return m[1];
    if (location.hash === "#en") return "en";
    if (location.hash === "#ar") return "ar";
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var l = String(langs[i] || "").toLowerCase();
      if (l.indexOf("ar") === 0) return "ar";
      if (l.indexOf("en") === 0) return "en";
    }
    return "ar";
  }

  function apply(lang) {
    html.setAttribute("data-lang", lang);
    html.setAttribute("lang", lang);
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    var t = html.getAttribute("data-title-" + lang);
    if (t) document.title = t;
    var desc = document.querySelector('meta[name="description"]');
    var d = html.getAttribute("data-desc-" + lang);
    if (desc && d) desc.setAttribute("content", d);
    if (!document.body) return;
    var links = document.querySelectorAll("a[data-keep-lang]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var base = a.getAttribute("data-href") || a.getAttribute("href");
      a.setAttribute("data-href", base);
      var parts = base.split("#");
      a.setAttribute("href", parts[0].split("?")[0] + "?lang=" + lang + (parts[1] ? "#" + parts[1] : ""));
    }
    var btn = document.getElementById("lang-toggle");
    if (btn) {
      btn.textContent = lang === "ar" ? "English" : "العربية";
      btn.setAttribute("lang", lang === "ar" ? "en" : "ar");
      btn.setAttribute("aria-label", lang === "ar" ? "Switch to English" : "التبديل إلى العربية");
    }
  }

  var current = pick();
  apply(current);

  document.addEventListener("DOMContentLoaded", function () {
    apply(current);
    var btn = document.getElementById("lang-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      current = current === "ar" ? "en" : "ar";
      apply(current);
      if (window.history && history.replaceState) {
        history.replaceState(null, "", location.pathname + "?lang=" + current + location.hash.replace(/^#(ar|en)$/, ""));
      }
    });
  });
})();
