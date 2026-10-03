// Shared mockup helpers: theme from ?theme=, the real mark, lucide icons, and the real word timings of seg_004.
(function () {
  var qs = new URLSearchParams(location.search);
  var theme = qs.get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  window.STILL = qs.get("still") === "1";
  if (window.STILL) document.documentElement.classList.add("still");

  window.toggleTheme = function () {
    var t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
  };

  function mark(el) {
    var m = window.DATA.mark[el.dataset.mark || "wordmark"];
    el.setAttribute("viewBox", m.viewBox);
    el.innerHTML = '<path d="' + m.ink + '"/><path class="lit" d="' + m.lit + '"/>';
  }

  // Words of the Explain line with their start times, from the character alignment.
  window.wordTimes = function () {
    var chars = window.DATA.align.characters, words = [], cur = null;
    chars.forEach(function (c) {
      if (c.text === " ") { if (cur) words.push(cur); cur = null; return; }
      if (!cur) cur = { text: "", start: c.start };
      cur.text += c.text;
    });
    if (cur) words.push(cur);
    return words;
  };

  // Render a caption: words as spans; `lit` words shown lit (for stills), else play at speech pace, looping.
  window.caption = function (el, maxWords, litCount) {
    var words = window.wordTimes().slice(0, maxWords);
    el.innerHTML = words.map(function (w) { return '<span class="w">' + w.text + "</span>"; }).join(" ");
    var spans = el.querySelectorAll(".w");
    function paint(n) { spans.forEach(function (s, i) { s.className = "w" + (i < n - 1 ? " on" : i === n - 1 ? " now" : ""); }); }
    if (window.STILL || matchMedia("(prefers-reduced-motion: reduce)").matches) { paint(litCount); return; }
    var t0 = performance.now(), end = words[words.length - 1].start + 2.2;
    (function tick(now) {
      var t = ((now - t0) / 1000) % end, n = 0;
      words.forEach(function (w, i) { if (w.start <= t) n = i + 1; });
      paint(n);
      requestAnimationFrame(tick);
    })(t0);
  };

  window.wave = function (el, bars) {
    var h = [6, 12, 18, 10, 16, 8, 14, 20, 9, 13, 7, 17, 11, 15, 6, 12];
    el.innerHTML = h.slice(0, bars || 16).map(function (v) { return '<i style="height:' + v + 'px"></i>'; }).join("");
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("svg[data-mark]").forEach(mark);
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 2, class: "icon" } });
    if (window.init) window.init();
    document.documentElement.classList.add("ready");
  });
})();
