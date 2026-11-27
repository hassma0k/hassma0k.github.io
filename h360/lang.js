/* H360 landing page: Arabic / English switch.
   No cookies, no storage, no network. The choice lives only in the URL (?lang=ar|en);
   without it the browser language decides. Without JavaScript both languages are shown, Arabic first. */
(function () {
  var html = document.documentElement;
  html.classList.add("js");

  function pick() {
    var m = /[?&]lang=(ar|en)\b/.exec(location.search);
    if (m) return m[1];
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var l = String(langs[i] || "").toLowerCase();
      if (l.indexOf("ar") === 0) return "ar";
      if (l.indexOf("en") === 0) return "en";
    }
    return "en";
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
    var btn = document.getElementById("lang-toggle");
    if (btn) {
      btn.textContent = lang === "ar" ? "English" : "العربية";
      btn.setAttribute("lang", lang === "ar" ? "en" : "ar");
      btn.setAttribute("aria-label", lang === "ar" ? "Switch to English" : "التبديل إلى العربية");
    }
  }

  var current = pick();
  apply(current); // before first paint, so the page never flashes the other language

  document.addEventListener("DOMContentLoaded", function () {
    apply(current);
    var btn = document.getElementById("lang-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      current = current === "ar" ? "en" : "ar";
      apply(current);
      if (window.history && history.replaceState) {
        history.replaceState(null, "", location.pathname + "?lang=" + current + location.hash);
      }
    });
  });
})();
