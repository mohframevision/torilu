/* ===== خريطة توريلو المجسّمة (map.html) =====
   تقرأ الأماكن من data.js (SITE_DATA) وتجمعها حسب المنطقة، وتضع كل منطقة لساناً ورقياً واقفاً
   على خريطة البحرين. المناطق المتقاربة تندمج في لسان واحد حتى لا تتزاحم، وتنفصل عند التقريب.
   إضافة مكان جديد = ملف جديد فقط: الخريطة تحسب كل شيء من البيانات.
   الحالة أربعة أرقام: rz (دوران)، z (تقريب)، fx/fy (النقطة التي في وسط المشهد بوحدات الخريطة). */
(function () {
  const root = document.getElementById("mp");
  if (!root || typeof SITE_DATA === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const stage = $("mpStage");
  const sheet = $("mpSheet");
  const panel = $("mpPanel");
  const select = $("mpSelect");
  const back = $("mpBack");
  const say = $("mpSay");
  const en = window.SITE_LANG === "en";
  const D = root.dataset;
  const W = +D.w;
  const H = +D.h;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const snd = (name) => window.toriluSfx && window.toriluSfx.play(name);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  // «٣ أماكن»، «١٤ مكاناً»: صيغة العدد العربية
  const count = (n) => {
    if (en) return n + (n === 1 ? " place" : " places");
    if (n === 1) return "مكان واحد";
    if (n === 2) return "مكانان";
    const r = n % 100;
    return n + (r >= 3 && r <= 10 ? " أماكن" : r >= 11 ? " مكاناً" : " مكان");
  };

  // ---------- المناطق من البيانات ----------
  // اسم القسم القصير كما في قائمة الموقع («مطاعم» لا «مطاعم البحرين»)
  const kinds = {};
  const kindOf = (slug, sec) => {
    if (!(slug in kinds)) {
      const a = document.querySelector('#main-nav a[href$="/' + slug + '.html"]');
      kinds[slug] = a ? a.textContent.trim() : en ? sec.title_en || sec.title : sec.title;
    }
    return kinds[slug];
  };
  const byName = new Map();
  const loose = []; // أماكن لها إحداثيات وليس لها منطقة مكتوبة
  for (const [slug, sec] of Object.entries(SITE_DATA)) {
    if (slug === "guides") continue;
    for (const it of sec.items || []) {
      const row = { it, slug, kind: kindOf(slug, sec) };
      const has = typeof it.lat === "number" && typeof it.lng === "number";
      const x = has ? (it.lng - +D.lon0) * +D.kx : null;
      const y = has ? (+D.lat1 - it.lat) * +D.ky : null;
      // مكان بعدة فروع يظهر في كل منطقة من مناطقه؛ إحداثياته لفرعه الأول فقط
      const names = (it.tags || []).filter((tg) => AREA_NAMES.includes(tg));
      if (!names.length && has) loose.push({ row, x, y });
      names.forEach((name, i) => {
        if (!byName.has(name)) byName.set(name, { name, label: en ? TAGS_EN[name] || name : name, items: [], xs: [], ys: [] });
        const a = byName.get(name);
        a.items.push(row);
        if (has && !i) {
          a.xs.push(x);
          a.ys.push(y);
        }
      });
    }
  }
  const median = (v) => v.slice().sort((p, q) => p - q)[v.length >> 1];
  const areas = [...byName.values()];
  for (const a of areas) {
    // موقع المنطقة = وسيط إحداثيات أماكنها (الوسيط لا يتأثر بمكان واحد إحداثياته خاطئة)
    if (a.xs.length) {
      a.x = Math.min(W - 8, Math.max(8, median(a.xs)));
      a.y = Math.min(H - 8, Math.max(8, median(a.ys)));
    }
  }
  const placed = areas.filter((a) => a.x != null);
  // المكان بلا منطقة مكتوبة (معلم سياحي مثلاً) يُعرض مع أقرب منطقة إليه على الخريطة
  for (const p of loose) {
    let best = null;
    for (const a of placed) if (!best || Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = a;
    if (best) best.items.push(p.row);
  }
  for (const a of areas) a.n = a.items.length;
  areas.sort((p, q) => q.n - p.n);
  placed.sort((p, q) => q.n - p.n);

  // ---------- الحالة والرسم ----------
  const LEVELS = [1, 2.3, 4.6];
  const TILT = 50;
  const view = { rz: -14, z: 1, fx: W / 2, fy: H / 2 };
  let level = 0;
  let picked = null; // المناطق المعروضة في اللوحة
  let px = 1; // بكسل لكل وحدة خريطة عند التقريب 1
  let base = 0; // عرض الورقة بالبكسل عند التقريب 1
  let drawn = 1; // التقريب المرسوم فعلاً بحجم الورقة؛ الباقي تحويل مؤقت أثناء الانتقال
  function apply() {
    const s = view.z / drawn;
    sheet.style.transform =
      `rotateX(${TILT}deg) rotateZ(${view.rz}deg) scale(${s}) translate(${(W / 2 - view.fx) * px * drawn}px, ${(H / 2 - view.fy) * px * drawn}px)`;
    sheet.style.setProperty("--rz", view.rz);
    sheet.style.setProperty("--iz", 1 / s);
  }
  // بعد الوقوف نرسم الورقة بحجمها الحقيقي بدل تكبير صورتها، فتبقى الخطوط حادّة عند التقريب
  function sharpen() {
    // سقف لحجم الطبقة على الجوالات عالية الكثافة حتى لا تأكل الذاكرة؛ ما فوقه يبقى تكبيراً
    drawn = Math.max(1, Math.min(view.z, 3000 / (base * (H / W) * (window.devicePixelRatio || 1))));
    sheet.style.width = base * drawn + "px";
    sheet.style.setProperty("--sw", drawn / view.z);
    apply();
  }

  // دمج المناطق المتقاربة: الأكبر أولاً، وكل منطقة أقرب من نصف القطر تنضم لما سبقها
  function clusters(z) {
    // البطاقة عريضة وقصيرة، والميل يضغط المسافة الرأسية على الشاشة: فالمسافة الآمنة بيضاوية
    const rx = 78 / (z * px);
    const ry = 48 / (z * px);
    const out = [];
    for (const a of placed) {
      const c = out.find((k) => Math.hypot((k.x - a.x) / rx, (k.y - a.y) / ry) < 1);
      if (c) {
        c.members.push(a);
        c.n += a.n;
      } else out.push({ x: a.x, y: a.y, n: a.n, members: [a] });
    }
    return out;
  }

  const halves = [...sheet.querySelectorAll(".mp-half")];
  let tabs = [];
  let shown = 0; // المستوى الذي رُسمت له الألسنة فعلاً (رحلة مقطوعة تتركه مختلفاً عن level)
  function draw() {
    const had = tabs.find((t) => t.node.contains(document.activeElement));
    const keep = had && had.c.members[0];
    tabs.forEach((t) => t.node.remove());
    tabs = clusters(LEVELS[level]).map((c, i) => {
      const node = el("div", "mp-tab");
      const right = c.x >= W / 2;
      node.style.left = ((c.x - (right ? W / 2 : 0)) / (W / 2)) * 100 + "%";
      node.style.top = (c.y / H) * 100 + "%";
      const btn = el("button");
      btn.type = "button";
      const extra = c.members.length - 1;
      btn.append(el("span", "", c.members[0].label), el("b", "", String(c.n)));
      btn.setAttribute("aria-label", c.members[0].label + (extra ? " " + D.tMore.replace("{n}", extra) : "") + (en ? ", " : "، ") + count(c.n));
      btn.style.setProperty("--st", Math.round(10 + Math.min(34, 6 * Math.sqrt(c.n))) + "px");
      btn.style.setProperty("--d", (still ? 0 : 0.03 * i) + "s");
      btn.addEventListener("click", () => tap(c));
      // لوحة المفاتيح: اللسان الذي خارج المشهد يأتي إلى الوسط حين يأخذ التركيز
      btn.addEventListener("focus", () => {
        if (btn.matches(":focus-visible") && !sheet.classList.contains("mp-flat")) fly(level, c.x, c.y);
      });
      node.append(btn);
      halves[right ? 1 : 0].append(node);
      return { node, c };
    });
    shown = level;
    if (keep) {
      const t = tabs.find((k) => k.c.members.includes(keep));
      if (t) t.node.firstChild.focus({ preventScroll: true });
    }
    mark();
  }
  function mark() {
    for (const t of tabs) t.node.classList.toggle("is-on", !!picked && t.c.members.some((a) => picked.includes(a)));
  }

  // ---------- الانتقال ----------
  let flying = 0;
  function fly(toLevel, x, y, done) {
    const from = { ...view };
    const to = { z: LEVELS[toLevel], fx: x, fy: y };
    const changed = toLevel !== shown;
    level = toLevel;
    back.hidden = level === 0;
    if (changed) sheet.classList.add("mp-flat");
    const t0 = performance.now();
    const dur = still ? 0 : 650;
    const id = ++flying;
    const end = () => {
      sharpen();
      if (changed) {
        draw();
        // إطاران: الأول يرسم الألسنة مطوية، والثاني يرفعها
        requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.remove("mp-flat")));
        snd("mapPop");
      } else mark();
      if (done) done();
    };
    (function step(now) {
      if (id !== flying) return;
      const k = dur ? Math.min(1, Math.max(0, (now - t0) / dur)) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      view.z = from.z + (to.z - from.z) * e;
      view.fx = from.fx + (to.fx - from.fx) * e;
      view.fy = from.fy + (to.fy - from.fy) * e;
      apply();
      if (k < 1) requestAnimationFrame(step);
      else end();
    })(t0);
  }

  function show(list) {
    picked = list;
    panel.replaceChildren(
      ...list.map((a) => {
        const box = el("section", "mp-area");
        const h = el("h2", "", a.label);
        h.append(el("small", "", count(a.n)));
        const ul = el("ul", "mp-list");
        const rows = a.items.slice().sort((p, q) => !!q.it.detailUrl - !!p.it.detailUrl);
        for (const { it, kind, slug } of rows) {
          const li = el("li");
          // بلا صفحة خاصة: يفتح قسمه مبحوثاً باسمه، كما تفعل الرئيسية والبحث
          const title = (en && it.title_en) || it.title;
          const row = el("a");
          row.href = (en ? "/en/" : "/") + ((en && it.detailUrlEn) || it.detailUrl || slug + ".html?q=" + encodeURIComponent(title));
          row.append(el("b", "", title), el("i", "", kind));
          li.append(row);
          ul.append(li);
        }
        box.append(h, ul);
        return box;
      })
    );
    select.value = list.length === 1 ? list[0].name : "";
    say.textContent = list.map((a) => a.label + (en ? ", " : "، ") + count(a.n)).join(" · ");
    mark();
  }

  function tap(c) {
    if (moved || sheet.classList.contains("mp-flat")) return;
    if (c.members.length > 1 && level < LEVELS.length - 1) {
      snd("mapZoom");
      say.textContent = c.members[0].label + " " + D.tMore.replace("{n}", c.members.length - 1);
      fly(level + 1, c.x, c.y);
      return;
    }
    snd("mapPin");
    show(c.members);
    fly(Math.max(level, 1), c.x, c.y);
  }

  // القائمة المنسدلة: طريق ثانٍ لكل منطقة (لوحة المفاتيح، وقارئ الشاشة، والمناطق المتلاصقة)
  select.append(new Option(D.tPick, ""));
  for (const a of areas.slice().sort((p, q) => p.label.localeCompare(q.label, en ? "en" : "ar"))) select.append(new Option(a.label + " (" + a.n + ")", a.name));
  select.addEventListener("change", () => {
    const a = byName.get(select.value);
    if (!a) return;
    snd("mapPin");
    show([a]);
    if (a.x != null) fly(LEVELS.length - 1, a.x, a.y);
  });
  back.addEventListener("click", () => {
    snd("mapBack");
    fly(0, W / 2, H / 2);
    select.focus({ preventScroll: true }); // الزر يختفي الآن، فلا نترك التركيز يضيع
  });

  // ---------- السحب: يدير الخريطة حول النقطة التي في الوسط، مع قصور ذاتي قصير ----------
  let moved = false;
  let drag = null;
  let spin = 0;
  stage.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary || ev.button) return;
    drag = { x: ev.clientX, last: ev.clientX, v: 0 };
    moved = false;
    cancelAnimationFrame(spin);
  });
  stage.addEventListener("pointermove", (ev) => {
    if (!drag || !ev.isPrimary) return;
    if (!moved && Math.abs(ev.clientX - drag.x) < 7) return;
    if (!moved) {
      moved = true;
      stage.setPointerCapture(ev.pointerId);
      stage.classList.add("is-drag");
    }
    drag.v = (drag.last - ev.clientX) * 0.38;
    drag.last = ev.clientX;
    view.rz += drag.v;
    apply();
  });
  const drop = () => {
    if (!drag) return;
    let v = still ? 0 : drag.v;
    drag = null;
    stage.classList.remove("is-drag");
    // الضغطة التي تلي السحب مباشرة ليست اختياراً
    setTimeout(() => (moved = false), 0);
    (function glide() {
      if (Math.abs(v) < 0.05) return;
      view.rz += v;
      v *= 0.93;
      apply();
      spin = requestAnimationFrame(glide);
    })();
  };
  // على النافذة لا على المشهد: الإفلات خارج الخريطة يجب أن ينهي السحب أيضاً
  window.addEventListener("pointerup", drop);
  window.addEventListener("pointercancel", drop);
  stage.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    ev.preventDefault();
    view.rz += ev.key === "ArrowLeft" ? 12 : -12;
    apply();
  });

  // ---------- البداية: الورقة تنفتح ككتاب، ثم تقف الألسنة ----------
  function start() {
    base = sheet.offsetWidth;
    px = base / W;
    draw();
    apply();
    if (still) {
      sheet.classList.remove("mp-closed", "mp-flat");
      return;
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        sheet.classList.remove("mp-closed");
        snd("mapOpen");
        setTimeout(() => {
          sheet.classList.remove("mp-flat");
          snd("mapPop");
        }, 750);
      })
    );
  }
  start();
  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      sheet.style.width = "";
      const next = sheet.offsetWidth;
      if (Math.abs(next - base) >= 1) {
        base = next;
        px = base / W;
        draw();
      }
      sharpen();
    }, 150);
  });
})();
