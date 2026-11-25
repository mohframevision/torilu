/* ===== خريطة توريلو المجسّمة (map.html) =====
   تقرأ الأماكن من data.js (SITE_DATA) وتجمعها حسب المنطقة، وتضع كل منطقة لساناً ورقياً واقفاً
   على خريطة البحرين. المناطق المتقاربة تندمج في لسان واحد حتى لا تتزاحم، وتنفصل عند التقريب.
   إضافة مكان جديد = ملف جديد فقط: الخريطة تحسب كل شيء من البيانات.
   الحالة أربعة أرقام: rz (دوران)، z (تقريب متصل من 1 إلى 6)، fx/fy (النقطة التي في وسط المشهد بوحدات الخريطة).
   التحكم مثل خرائط قوقل: سحب، وإصبعان للتقريب والتدوير، وعجلة، وضغطتان. */
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
  // «ومنطقتان بقربها»، «و3 مناطق بقربها»: المناطق المضمومة إلى اللسان
  const nearby = (n) => {
    if (en) return D.tMore.replace("{n}", n);
    if (n === 1) return "ومنطقة أخرى بقربها";
    if (n === 2) return "ومنطقتان بقربها";
    const r = n % 100;
    return "و" + n + (r >= 3 && r <= 10 ? " مناطق" : r >= 11 ? " منطقةً" : " منطقة") + " بقربها";
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
  const ZMIN = 1;
  const ZMAX = 6;
  const TILT = 50;
  const COS = Math.cos((TILT * Math.PI) / 180);
  const SIN = Math.sin((TILT * Math.PI) / 180);
  const PERSP = 1100; // نفس perspective في map.css
  const view = { rz: -14, z: 1, fx: W / 2, fy: H / 2 };
  const clampZ = (z) => Math.min(ZMAX, Math.max(ZMIN, z));
  let picked = null; // المناطق المعروضة في اللوحة
  let px = 1; // بكسل لكل وحدة خريطة عند التقريب 1
  let base = 0; // عرض الورقة بالبكسل عند التقريب 1
  let drawn = 1; // التقريب المرسوم فعلاً بحجم الورقة؛ الباقي تحويل مؤقت أثناء الحركة
  function apply() {
    view.z = clampZ(view.z);
    view.fx = Math.min(W, Math.max(0, view.fx));
    view.fy = Math.min(H, Math.max(0, view.fy));
    const s = view.z / drawn;
    sheet.style.transform =
      `rotateX(${TILT}deg) rotateZ(${view.rz}deg) scale(${s}) translate(${(W / 2 - view.fx) * px * drawn}px, ${(H / 2 - view.fy) * px * drawn}px)`;
    sheet.style.setProperty("--rz", view.rz);
    sheet.style.setProperty("--iz", 1 / s);
    const home = view.z < 1.05 && Math.hypot(view.fx - W / 2, view.fy - H / 2) < W * 0.06;
    if (back.hidden !== home) back.hidden = home;
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
  // الألسنة تُعاد بنصف درجة تقريب (×1.41)، لا مع كل إطار
  const bucket = (z) => Math.max(0, Math.min(4, Math.floor(Math.log2(z) * 2 + 1e-6)));

  const halves = [...sheet.querySelectorAll(".mp-half")];
  let tabs = [];
  let shown = -1; // درجة التقريب التي رُسمت لها الألسنة
  function draw() {
    const had = tabs.find((t) => t.node.contains(document.activeElement));
    const keep = had && had.c.members[0];
    tabs.forEach((t) => t.node.remove());
    shown = bucket(view.z);
    const z = 2 ** (shown / 2);
    let cs = clusters(z);
    for (;;) {
      tabs = cs.map(build);
      const hit = clash(z);
      if (!hit) break;
      // بطاقتان تتراكبان على الشاشة (البيضاوي تقدير): الأصغر تنضم للأكبر ونعيد الرسم
      const [host, guest] = hit[0].n >= hit[1].n ? hit : [hit[1], hit[0]];
      host.members.push(...guest.members);
      host.n += guest.n;
      cs = cs.filter((k) => k !== guest);
      tabs.forEach((t) => t.node.remove());
    }
    if (keep) {
      const t = tabs.find((k) => k.c.members.includes(keep));
      if (t) t.node.firstChild.focus({ preventScroll: true });
    }
    mark();
  }
  // مكان البطاقة الواقفة على الشاشة تقريباً: عكس under() (الدوران ثم الميل ثم المنظور)، والبطاقة والساق مائلتان بزاوية الميل
  function clash(z) {
    const a = (view.rz * Math.PI) / 180;
    const f = px * z;
    const oy = stage.offsetHeight * 0.3 - (stage.offsetHeight / 2 - 16); // perspective-origin نسبةً لمركز الورقة
    const box = ({ node, c }) => {
      const b = node.firstChild;
      const x = (c.x - view.fx) * f;
      const y = (c.y - view.fy) * f;
      const v = x * Math.sin(a) + y * Math.cos(a);
      const d = 1 - (v * SIN) / PERSP; // البعيد أصغر والقريب أكبر
      const sx = (x * Math.cos(a) - y * Math.sin(a)) / d;
      const sy = (v * COS * PERSP - v * oy * SIN) / (PERSP - v * SIN);
      const w = b.offsetWidth / d / 2;
      const st = (parseFloat(b.style.getPropertyValue("--st")) * SIN) / d;
      return { c, l: sx - w, r: sx + w, t: sy - st - (b.offsetHeight * SIN) / d, b: sy - st };
    };
    const bs = tabs.map(box);
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const p = bs[i];
        const q = bs[j];
        // هامش 6px: النموذج تقريبي، فيبقى بين البطاقات فراغ ظاهر
        if (p.l < q.r + 6 && q.l < p.r + 6 && p.t < q.b + 6 && q.t < p.b + 6) return [p.c, q.c];
      }
    return null;
  }
  function build(c, i) {
    const node = el("div", "mp-tab");
    const right = c.x >= W / 2;
    node.style.left = ((c.x - (right ? W / 2 : 0)) / (W / 2)) * 100 + "%";
    node.style.top = (c.y / H) * 100 + "%";
    const btn = el("button");
    btn.type = "button";
    const extra = c.members.length - 1;
    btn.append(el("span", "", c.members[0].label));
    // العدد للمجموعة كلها، فيظهر أن معها مناطق قريبة حتى لا يُنسب كله للمنطقة المسمّاة
    if (extra) btn.append(el("i", "", "+" + extra));
    btn.append(el("b", "", String(c.n)));
    btn.setAttribute("aria-label", c.members[0].label + (extra ? " " + nearby(extra) : "") + (en ? ", " : "، ") + count(c.n));
    btn.style.setProperty("--st", Math.round(10 + Math.min(34, 6 * Math.sqrt(c.n))) + "px");
    btn.style.setProperty("--d", (still ? 0 : 0.03 * i) + "s");
    btn.addEventListener("click", () => tap(c));
    // لوحة المفاتيح: اللسان الذي خارج المشهد يأتي إلى الوسط حين يأخذ التركيز
    btn.addEventListener("focus", () => {
      if (btn.matches(":focus-visible") && !sheet.classList.contains("mp-flat")) fly({ fx: c.x, fy: c.y });
    });
    node.append(btn);
    halves[right ? 1 : 0].append(node);
    return { node, c };
  }
  function mark() {
    for (const t of tabs) t.node.classList.toggle("is-on", !!picked && t.c.members.some((a) => picked.includes(a)));
  }
  // بعد كل حركة: الورقة حادّة، وإن تغيّرت درجة التقريب تنطوي الألسنة ثم تقف من جديد
  let settleT = 0;
  function settle() {
    sharpen();
    clearTimeout(settleT);
    // الدوران يغيّر تراكب البطاقات على الشاشة: نعيد الدمج فقط إن تراكبت بطاقتان
    if (bucket(view.z) === shown && !clash(2 ** (shown / 2))) {
      sheet.classList.remove("mp-flat");
      return mark();
    }
    const wait = still || sheet.classList.contains("mp-flat") ? 0 : 180;
    sheet.classList.add("mp-flat");
    settleT = setTimeout(() => {
      draw();
      // إطاران: الأول يرسم الألسنة مطوية، والثاني يرفعها
      requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.remove("mp-flat")));
      snd("mapPop");
    }, wait);
  }

  // ---------- الانتقال ----------
  let flying = 0;
  let spin = 0;
  function fly(to, done) {
    cancelAnimationFrame(spin);
    const from = { ...view };
    const goal = { ...view, ...to };
    goal.z = clampZ(goal.z);
    goal.rz = from.rz + ((((goal.rz - from.rz) % 360) + 540) % 360) - 180; // أقصر دورة
    if (bucket(goal.z) !== shown) sheet.classList.add("mp-flat");
    const t0 = performance.now();
    const dur = still ? 0 : 650;
    const id = ++flying;
    (function step(now) {
      if (id !== flying) return;
      const k = dur ? Math.min(1, Math.max(0, (now - t0) / dur)) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      for (const p of ["z", "fx", "fy", "rz"]) view[p] = from[p] + (goal[p] - from[p]) * e;
      apply();
      if (k < 1) return requestAnimationFrame(step);
      settle();
      if (done) done();
    })(t0);
  }

  // نقطة على الشاشة ← نقطة على الخريطة: عكس المنظور والميل والدوران تماماً،
  // فالنقطة التي تحت الإصبع تبقى تحته في السحب والتقريب (مثل خرائط قوقل)
  function local(ev) {
    const r = stage.getBoundingClientRect();
    const k = r.width / stage.offsetWidth || 1; // الشاشات العريضة عليها zoom للصفحة
    return [(ev.clientX - r.left) / k, (ev.clientY - r.top) / k];
  }
  function under(s, rz, z) {
    const w = stage.offsetWidth;
    const h = stage.offsetHeight;
    const cx = w / 2;
    const cy = h / 2 - 16; // مركز الورقة (top: calc(50% - 16px))
    const oy = h * 0.3; // perspective-origin
    const v = (PERSP * (s[1] - cy)) / (COS * PERSP + (s[1] - oy) * SIN);
    const u = (s[0] - cx) * (1 - (v * SIN) / PERSP);
    const a = (rz * Math.PI) / 180;
    const f = px * z;
    return [(u * Math.cos(a) + v * Math.sin(a)) / f, (-u * Math.sin(a) + v * Math.cos(a)) / f];
  }
  const mapAt = (s) => {
    const [a, b] = under(s, view.rz, view.z);
    return [view.fx + a, view.fy + b];
  };
  function pin(m, s) {
    const [a, b] = under(s, view.rz, view.z);
    view.fx = m[0] - a;
    view.fy = m[1] - b;
  }
  function zoomAt(s, factor) {
    const m = mapAt(s);
    const z = clampZ(view.z * factor);
    const [a, b] = under(s, view.rz, z);
    fly({ z, fx: m[0] - a, fy: m[1] - b });
  }

  function tap(c) {
    if (moved || sheet.classList.contains("mp-flat")) return;
    if (c.members.length > 1 && view.z < ZMAX) {
      snd("mapZoom");
      say.textContent = c.members[0].label + " " + nearby(c.members.length - 1);
      fly({ z: Math.max(view.z * 2, 2), fx: c.x, fy: c.y });
      return;
    }
    snd("mapPin");
    show(c.members);
    fly({ z: Math.max(view.z, 2.3), fx: c.x, fy: c.y });
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

  // القائمة المنسدلة: طريق ثانٍ لكل منطقة (لوحة المفاتيح، وقارئ الشاشة، والمناطق المتلاصقة)
  select.append(new Option(D.tPick, ""));
  for (const a of areas.slice().sort((p, q) => p.label.localeCompare(q.label, en ? "en" : "ar"))) select.append(new Option(a.label + " (" + a.n + ")", a.name));
  select.addEventListener("change", () => {
    const a = byName.get(select.value);
    if (!a) return;
    snd("mapPin");
    show([a]);
    if (a.x != null) fly({ z: 4.6, fx: a.x, fy: a.y });
  });
  back.addEventListener("click", () => {
    snd("mapBack");
    fly({ z: 1, fx: W / 2, fy: H / 2, rz: -14 });
    select.focus({ preventScroll: true }); // الزر يختفي الآن، فلا نترك التركيز يضيع
  });
  $("mpIn").addEventListener("click", () => fly({ z: view.z * 2 }));
  $("mpOut").addEventListener("click", () => fly({ z: view.z / 2 }));

  // ---------- اللمس والفأرة، مثل خرائط قوقل ----------
  // إصبع واحد يسحب الخريطة (مع انزلاق بعد الإفلات)، وإصبعان يقرّبان ويدوّران حول نقطتهما،
  // والعجلة تقرّب نحو المؤشر، والضغطتان السريعتان تقرّبان. السحب الطويل لا يُحسب ضغطة على منطقة.
  const pts = new Map();
  let g = null;
  let moved = false;
  let hist = [];
  let lastTap = null;
  const mid = () => {
    const l = [...pts.values()];
    return l.length > 1 ? [(l[0][0] + l[1][0]) / 2, (l[0][1] + l[1][1]) / 2] : l[0];
  };
  const pair = () => {
    const [p, q] = [...pts.values()];
    return { d: Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) };
  };
  function begin() {
    const s = mid();
    g = { m: mapAt(s), s, z: view.z, rz: view.rz, two: pts.size > 1, ...(pts.size > 1 ? pair() : {}) };
    hist = [];
  }
  stage.addEventListener("pointerdown", (ev) => {
    if (ev.button || pts.size >= 2 || ev.target.closest(".mp-zoom, .mp-back")) return;
    flying++;
    cancelAnimationFrame(spin);
    if (!pts.size) moved = false;
    pts.set(ev.pointerId, local(ev));
    begin();
  });
  stage.addEventListener("pointermove", (ev) => {
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, local(ev));
    const s = mid();
    if (!moved) {
      if (pts.size < 2 && Math.hypot(s[0] - g.s[0], s[1] - g.s[1]) < 7) return;
      moved = true;
      stage.setPointerCapture(ev.pointerId);
      stage.classList.add("is-drag");
    }
    if (g.two && pts.size > 1) {
      const p = pair();
      view.z = clampZ((g.z * p.d) / g.d);
      view.rz = g.rz + ((p.ang - g.ang) * 180) / Math.PI;
    }
    pin(g.m, s);
    apply();
    hist.push({ fx: view.fx, fy: view.fy, t: ev.timeStamp });
    if (hist.length > 6) hist.shift();
  });
  function lift(ev) {
    if (!pts.has(ev.pointerId)) return;
    const s = pts.get(ev.pointerId);
    pts.delete(ev.pointerId);
    if (pts.size) {
      g.two = false; // الإصبع الباقي يكمل سحباً من حيث هو، بلا قفزة
      return begin();
    }
    stage.classList.remove("is-drag");
    if (!moved) {
      // ضغطتان سريعتان على الأرض (لا على لسان) تقرّبان نحو موضعهما
      const onTab = ev.target instanceof Element && ev.target.closest(".mp-tab");
      if (!onTab && lastTap && ev.timeStamp - lastTap.t < 320 && Math.hypot(s[0] - lastTap.s[0], s[1] - lastTap.s[1]) < 30) {
        lastTap = null;
        snd("mapZoom");
        zoomAt(s, 2);
      } else lastTap = onTab ? null : { t: ev.timeStamp, s };
      return;
    }
    // الضغطة التي تلي السحب مباشرة ليست اختياراً
    setTimeout(() => (moved = false), 0);
    const a = hist.find((h) => ev.timeStamp - h.t < 100);
    const b = hist[hist.length - 1];
    if (still || g.two || !a || b === a || ev.timeStamp - b.t > 60) return settle();
    let vx = ((b.fx - a.fx) / (b.t - a.t)) * 16;
    let vy = ((b.fy - a.fy) / (b.t - a.t)) * 16;
    (function glide() {
      vx *= 0.92;
      vy *= 0.92;
      view.fx += vx;
      view.fy += vy;
      apply();
      if (Math.hypot(vx, vy) * px * view.z < 0.3) return settle();
      spin = requestAnimationFrame(glide);
    })();
  }
  // على النافذة لا على المشهد: الإفلات خارج الخريطة يجب أن ينهي السحب أيضاً
  window.addEventListener("pointerup", lift);
  window.addEventListener("pointercancel", lift);
  let wheelT = 0;
  stage.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      flying++;
      cancelAnimationFrame(spin);
      const s = local(ev);
      const m = mapAt(s);
      const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1);
      // ctrlKey: قرص لوحة اللمس في الحاسوب، دفعاته صغيرة فتحتاج معاملاً أكبر
      view.z = clampZ(view.z * Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0018)));
      pin(m, s);
      apply();
      clearTimeout(wheelT);
      wheelT = setTimeout(settle, 160);
    },
    { passive: false }
  );
  stage.addEventListener("keydown", (ev) => {
    if (ev.target.closest("button")?.id === "mpBack") return;
    const k = ev.key;
    if (k === "ArrowLeft" || k === "ArrowRight") fly({ rz: view.rz + (k === "ArrowLeft" ? 15 : -15) });
    else if (k === "+" || k === "=") fly({ z: view.z * 2 });
    else if (k === "-" || k === "_") fly({ z: view.z / 2 });
    else return;
    ev.preventDefault();
  });

  // ---------- البداية: الورقة تنفتح ككتاب، ثم تقف الألسنة ----------
  function start() {
    // الصفحة تُرسم والورقة مفتوحة (بلا JS أو أثناء انتظار البيانات)؛ نطويها هنا فوراً بلا حركة ثم تنفتح
    const halves = sheet.querySelectorAll(".mp-half");
    halves.forEach((h) => (h.style.transition = "none"));
    sheet.classList.add("mp-closed");
    base = sheet.offsetWidth;
    halves.forEach((h) => (h.style.transition = ""));
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
