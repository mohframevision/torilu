/* «كم يكلّف منيو محلك؟» بصفحة business: منيو يُسحب طرفه فيطول ويقصر، والسعر يتغيّر معه.
   الحساب بالفلس (أعداد صحيحة، بلا كسور عشرية). المعادلة في E:\توريلو\تسعير-المنيو.md (نسخة المالك المنصّفة):
   الرقمية ٢٢٫٥ حتى ١٥ صنفاً، ثم سعر للصنف الزائد ينزل بالشرائح؛ المطبوعة ٨٠٪ والنسختان ١٤٠٪،
   وكل سعر يُقرَّب إلى أعلى مضاعف لـ٢٫٥. الصور ٥٠٠ فلس للصنف في أول ٤٠ ثم ٢٥٠. فوق ٢٥٠ صنفاً: تواصل معنا.
   الفحص: node scripts/check-menu-price.js */
(() => {
  const MAX = 250;
  const TIERS = [[40, 750], [80, 500], [150, 375], [250, 250]];
  const RATIO = { digital: [1, 1], print: [4, 5], both: [7, 5] };
  const up = (fils, num = 1, den = 1) => Math.ceil((fils * num) / (den * 2500)) * 2500;

  // n أصناف، v نسخة، photos صور → { price, photos } بالفلس، أو null فوق ٢٥٠
  function menuPrice(n, v, photos) {
    if (n > MAX) return null;
    let d = 22500;
    let prev = 15;
    for (const [cap, rate] of TIERS) {
      if (n > prev) d += (Math.min(n, cap) - prev) * rate;
      prev = cap;
    }
    const ph = up(Math.min(n, 40) * 500 + Math.max(n - 40, 0) * 250);
    const base = up(d, ...(RATIO[v] || RATIO.digital));
    return { price: base + (photos ? ph : 0), photos: photos ? ph : 0 };
  }
  globalThis.menuPrice = menuPrice;

  const box = typeof document !== "undefined" && document.querySelector("[data-mp]");
  if (!box) return;
  const ds = box.dataset;
  const sheet = box.querySelector(".mp-rows-wrap");
  const rows = [...sheet.querySelectorAll("li")];
  const more = box.querySelector(".mp-more");
  const edge = box.querySelector(".mp-edge");
  const input = box.querySelector(".mp-n");
  const unit = box.querySelector(".mp-u");
  const priceEl = box.querySelector(".mp-price");
  const photoNote = box.querySelector(".mp-photos");
  const photosBox = box.querySelector(".mp-ph");
  const btn = box.querySelector(".mp-go");
  const vBtns = [...box.querySelectorAll("[data-v]")];
  const sfx = (name) => window.toriluSfx && window.toriluSfx.play(name);
  const fmt = (fils) => (fils / 1000).toFixed(3);
  const [u1, u2, u3, u11, u100] = ds.units.split("|");
  // تمييز العدد بالفصحى: ٣–١٠ أصناف، ١١–٩٩ صنفاً، ومئة ومئتا… صنف (يحكمه آخر جزأين من العدد)
  const unitOf = (n, r = n % 100) => (n === 1 ? u1 : n === 2 ? u2 : r >= 3 && r <= 10 ? u3 : r >= 11 || n < 100 ? u11 : u100);

  let n = 15;
  let v = "digital";

  // الطول: كل صنف صفّ كامل حتى K صفّاً، ثم ينضغط ما بعده (لوغاريتمياً: يقسو السحب كلما كبر)
  // حتى ٢٥٠ داخل سقف نحو ٧٠٪ من الشاشة
  const ROW = 30;
  const C = 12;
  let K = 6;
  let A = 12 * ROW;
  let L = 1;
  const measure = () => {
    A = Math.max(8 * ROW, Math.min(rows.length * ROW, innerHeight / (+document.documentElement.style.zoom || 1) * 0.7 - 150)); // zoom الشاشات العريضة
    K = Math.floor((A * 0.55) / ROW);
    L = Math.log(1 + (MAX + 1 - K) / C);
  };
  const hOf = (c) => (c <= K ? c * ROW : K * ROW + ((A - K * ROW) * Math.log(1 + (Math.min(c, MAX + 1) - K) / C)) / L);
  const nOf = (h) => Math.round(h <= K * ROW ? h / ROW : K + C * (Math.exp(((h - K * ROW) / (A - K * ROW)) * L) - 1));

  function render() {
    const shown = n > K ? K - 1 : n;
    rows.forEach((li, i) => li.classList.toggle("on", i < shown));
    more.hidden = n <= K;
    if (n > K) {
      more.textContent = "+" + (n - shown);
      more.style.top = shown * ROW + "px";
    }
    sheet.style.height = hOf(n) + "px";
    unit.textContent = unitOf(n);
    if (document.activeElement !== input) input.value = n;
    const p = menuPrice(n, v, photosBox.checked);
    priceEl.innerHTML = p ? `<b dir="ltr">${fmt(p.price)}</b> ${ds.cur}` : `<b>${ds.contact}</b>`;
    photoNote.hidden = !p || !p.photos;
    if (p) photoNote.textContent = ds.photos.replace("{p}", fmt(p.photos) + " " + ds.cur);
    const sv = Math.min(n, MAX + 1);
    edge.setAttribute("aria-valuenow", sv);
    edge.setAttribute("aria-valuetext", p ? ds.vt.replace("{n}", n).replace("{u}", unitOf(n)).replace("{p}", fmt(p.price) + " " + ds.cur) : ds.over);
    const q = new URLSearchParams({ owner: "menu", items: n, v, photos: photosBox.checked ? 1 : 0 });
    btn.href = btn.dataset.href + "?" + q;
  }

  let lastSound = 0;
  function set(c, quiet) {
    c = Math.min(Math.max(c, 1), 999);
    if (c === n) return;
    n = c;
    render();
    const now = performance.now();
    if (!quiet && now - lastSound > 70) {
      lastSound = now;
      sfx("tick");
    }
  }

  // السحب: مؤشّر واحد (فأرة أو لمس أو قلم)، والطرف وحده touch-action:none فما يُخطف تمرير الصفحة
  // وفي المنطقة المضغوطة يقاوم الورق: الطرف يتحرّك أبطأ من الإصبع (R) فيبقى ضبط العدد ممكناً
  const R = 1.8;
  const toF = (h) => (h <= K * ROW ? h : K * ROW + (h - K * ROW) * R);
  const fromF = (f) => (f <= K * ROW ? f : K * ROW + (f - K * ROW) / R);
  let drag = null;
  edge.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    edge.setPointerCapture(e.pointerId);
    const z = sheet.getBoundingClientRect().height / (sheet.offsetHeight || 1) || 1; // zoom الشاشات العريضة
    drag = { y: e.clientY, f: toF(hOf(Math.min(n, MAX + 1))), z };
    box.classList.add("dragging");
    edge.focus({ preventScroll: true });
  });
  edge.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const f = drag.f + (e.clientY - drag.y) / drag.z;
    const lo = ROW;
    const hi = toF(A);
    // مطّاط عند الحدّين: يتجاوز قليلاً بمقاومة ثم يرجع عند الإفلات
    const over = f < lo ? f - lo : f > hi ? f - hi : 0;
    const rubber = over ? Math.sign(over) * 40 * (1 - 1 / (Math.abs(over) / 120 + 1)) : 0;
    set(nOf(fromF(Math.min(Math.max(f, lo), hi))));
    sheet.style.height = hOf(n) + rubber + "px";
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    box.classList.remove("dragging");
    render();
  };
  edge.addEventListener("pointerup", end);
  edge.addEventListener("pointercancel", end);

  edge.addEventListener("keydown", (e) => {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (step) set(Math.min(Math.min(n, MAX + 1) + step, MAX + 1));
    else if (e.key === "Home") set(1);
    else if (e.key === "End") set(MAX + 1);
    else return;
    e.preventDefault();
  });

  input.addEventListener("input", () => {
    const c = parseInt(input.value, 10);
    if (c >= 1) set(c, true);
  });
  input.addEventListener("change", () => {
    input.value = n;
  });
  input.addEventListener("focus", () => input.select());

  vBtns.forEach((b) =>
    b.addEventListener("click", () => {
      v = b.dataset.v;
      vBtns.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      sfx("view");
      render();
    })
  );
  photosBox.addEventListener("change", () => {
    sfx("check");
    render();
  });

  measure();
  render();
  addEventListener("resize", () => {
    measure();
    render();
  });
})();
