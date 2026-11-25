/* يطبّق المظهر المحفوظ قبل أول رسم للصفحة (يمنع وميض المظهر الفاتح).
   ملف خارجي عمداً — عشان تشتغل سياسة CSP بدون unsafe-inline. */
// علامة «JS يعمل»: style.css يخفي بدونها الأزرار التي لا تعمل إلا بـmain.js
document.documentElement.classList.add("js");

/* حماية دفاعية من clickjacking: GitHub Pages ما يدعم ترويسة X-Frame-Options
   أو frame-ancestors بـCSP (يعمل فقط بترويسة HTTP، مو meta tag — موثّق
   بتعليق الـCSP بـbase.njk). هذا احتياط JS بديل: لو الصفحة محمّلة داخل
   iframe من نطاق غير نطاقنا، نحاول كسر الإطار فوراً؛ لو فشل (متصفح يمنع
   قراءة/كتابة top عبر النطاقات، وهو المتوقع)، نخفي المحتوى بدل ما نتركه
   قابلاً للنقر بخداع (overlay شفاف فوقه). ما يؤثر على الاستخدام العادي
   (فتح الموقع مباشرة) لأن window.top === window.self دائماً بهذه الحالة. */
(function () {
  try {
    if (window.top !== window.self) {
      window.top.location.href = window.self.location.href;
      document.documentElement.style.display = "none";
    }
  } catch {
    document.documentElement.style.display = "none";
  }
})();

/* تكبير الصفحة كلها بنسبة عرض الشاشة فوق 1600px — نفس التصميم بس أكبر
   بالتناسب على الشاشات العريضة (2K/4K)، بدل محتوى صغير بنص فراغ. أغلب
   مقاسات style.css بكسل ثابت (642 مقاس)، فتكبير خط الجذر وحده ما يكفي. تحت
   1600 صفر تغيير. عرض التخطيط الفعلي يبقى 1600 — أعرض من منطقة القراءة
   (--max-width: 1320) عمداً عشان تبقى مساحة فاضية على الجانبين، وفوق أكبر
   نقطة كسر (1300px) فاستعلامات media ما تتعارض. بالـhead عشان يطبَّق قبل
   أول رسم بلا قفزة. */
(function () {
  var root = document.documentElement;
  function fit() {
    var z = Math.min(1.8, Math.max(1, window.innerWidth / 1600));
    root.style.zoom = z;
    // vh/vw تحت zoom تتضخم بنفس النسبة؛ العناصر بحجم الشاشة (بطاقة الدعم) تقسم عليه
    root.style.setProperty("--page-zoom", z);
  }
  fit();
  window.addEventListener("resize", fit);
})();

(function () {
  try {
    var pref = localStorage.getItem("site_theme_pref");
    if (pref === "light" || pref === "dark") {
      document.documentElement.setAttribute("data-theme", pref);
    }
  } catch {
    // بعض المتصفحات ترمي استثناء عند منع الكوكيز/التخزين — نتجاهله بأمان
  }
})();

/* صفحة الجريدة المطويّة (base.njk يضع <link rel="expect"> قبل هذا الملف): أول رسم ينتظر fold.js
   كي تُلتقط الجريدة مطويّة في الانتقال بين الصفحات، لكن لا أكثر من لحظة: على اتصال بطيء يُرفع
   الانتظار فتُرسم الصفحة والسكربتات ما زالت تنزل. np-wait تخفي الورقة إلى أن يطويها fold.js */
(function () {
  var ex = document.querySelector('link[rel="expect"]');
  if (!ex || !window.matchMedia(ex.media).matches) return;
  document.documentElement.classList.add("np-wait");
  setTimeout(function () {
    ex.remove();
  }, 300);
})();

/* قلوب المفضلة قبل أول رسم: بطاقات الأقسام مطبوعة وقت البناء بقلب فارغ (item-card.njk)، وmain.js
   يصل بعد أن يرسم المتصفح أولها. مراقب التحليل يملأ قلب كل بطاقة مفضلة قبل الرسم. يراقب الصفحة كلها
   فقط حتى تظهر .card-grid، ثم أبناءها المباشرين وحدهم (سجل لكل بطاقة لا لكل عقدة)، ويفحص البطاقات
   الجديدة فقط مقابل مجموعة المفاتيح، فكلفته لا تكبر بعدد المفضلة. يعمل فقط لمن عنده مفضلة، ويتوقف
   مع اكتمال الصفحة */
(function () {
  var keys = new Set();
  try {
    var favs = JSON.parse(localStorage.getItem("site_favorites_v1")) || {};
    for (var s in favs) for (var id in favs[s]) if (favs[s][id]) keys.add(s + "/" + id);
  } catch {
    return;
  }
  if (!keys.size) return;
  var grid,
    done = 0;
  function mark() {
    if (!grid) {
      grid = document.querySelector(".card-grid");
      if (!grid) return;
      mo.disconnect();
      mo.observe(grid, { childList: true });
    }
    var cards = grid.children;
    // آخر بطاقة قد لا يكون قلبها قد وصل بعد، فتُفحص ثانية مع الدفعة التالية
    for (var i = done; i < cards.length; i++) {
      var c = cards[i];
      if (!keys.has(c.getAttribute("data-key"))) continue;
      var b = c.querySelector(".fav-btn:not(.active)");
      var use = b && b.querySelector("use");
      if (!use) continue;
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      use.setAttribute("href", use.getAttribute("href").replace(/#heart$/, "#heart-fill"));
    }
    done = Math.max(0, cards.length - 1);
  }
  var mo = new MutationObserver(mark);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () {
    mo.disconnect();
    mark();
  });
})();

/* نقرات أزرار البطاقة قبل وصول main.js (على اتصال بطيء تظهر الأزرار قبله بثوانٍ): تُحفظ هنا ولا تضيع،
   وmain.js يعيد تنفيذها بعد أن يتبنّى البطاقات (replayEarlyTaps) */
window.__cardTaps = [];
document.addEventListener(
  "click",
  function (e) {
    var b = window.__cardTaps && e.target.closest && e.target.closest(".item-card button");
    if (b) window.__cardTaps.push(b);
  },
  true
);
