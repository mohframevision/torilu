/* «اختار لي» — زر واحد (القمر) يفتح عجلة الأقسام، والقسم المختار يتكوّر كرة ورق جريدة
   تتمايل ثم تنفرد قصاصة فيها المكان. «غيره» يكوّر القصاصة ويفرد غيرها.
   الشكل كله في CSS (.pk بـstyle.css) وخطوة الصفحة بـdata-step؛ هنا الحالة والاختيار
   والرسوم المولّدة (رموز نقطية، كرة، آثار تكسير). ألوان الرسوم متغيّرات CSS، فتتبع
   الوضع الداكن بلا إعادة رسم.
   تُحمَّل بصفحة picker.html فقط (pageScript)، بعد main.js، وتستخدم دواله العامة (t،
   itemTitle، itemDesc، itemHours، tagLabel، sectionLabel، escapeHtml، safeUrl، sfx،
   showToast، nearestBranch). main.js يستدعي initRandomPicker. */

const PK_KEYS = ["restaurants", "cafes", "bakeries", "places", "stores"];

// رموز الأقسام: شكل ممتلئ بنقاط نصف تونية + خط خارجي (--knock = لون خلفية الزر)
const PK_SHAPES = {
  restaurants: {
    fill: '<circle cx="24" cy="25" r="12.5"/>',
    line: '<circle cx="24" cy="25" r="12.5"/><circle cx="24" cy="25" r="8" stroke-opacity=".55"/><path d="M5.5 11v8.5a2.5 2.5 0 0 0 5 0V11M8 11v29"/><path d="M42.5 40V11c-3 1.5-4.5 6-4.5 11v6h4.5"/>',
  },
  cafes: {
    fill: '<path d="M9 19h24v9a12 12 0 0 1-24 0z"/>',
    line: '<path d="M9 19h24v9a12 12 0 0 1-24 0z"/><path d="M33 22h3a5 5 0 0 1 0 10h-3.5"/><path d="M6 43.5h30"/><path d="M16 14c-2-2.5 2-4.5 0-8M24 14c-2-2.5 2-4.5 0-8" stroke-opacity=".7"/>',
  },
  bakeries: {
    fill: '<path d="M6 34c0-12 8-20 18-20s18 8 18 20v3.5H6z"/>',
    line: '<path d="M6 34c0-12 8-20 18-20s18 8 18 20v3.5H6z"/><path d="M15 21.5l4.5 6M23 18.5l4.5 6.5M31 20l4 6" stroke-opacity=".75"/><path d="M3.5 41.5h41"/>',
  },
  places: {
    fill: '<path d="M24 5a14 14 0 0 1 14 14c0 10.5-14 24-14 24S10 29.5 10 19A14 14 0 0 1 24 5z"/>',
    line: '<path d="M24 5a14 14 0 0 1 14 14c0 10.5-14 24-14 24S10 29.5 10 19A14 14 0 0 1 24 5z"/><circle cx="24" cy="19" r="5" style="fill:var(--knock)"/>',
  },
  stores: {
    fill: '<path d="M9 17h30l-2.2 24H11.2z"/>',
    line: '<path d="M9 17h30l-2.2 24H11.2z"/><path d="M17 21v-7a7 7 0 0 1 14 0v7"/>',
  },
  any: {
    fill: '<rect x="8" y="8" width="32" height="32" rx="7" transform="rotate(-8 24 24)"/>',
    line: '<rect x="8" y="8" width="32" height="32" rx="7" transform="rotate(-8 24 24)"/><g stroke="none" style="fill:var(--knock)" transform="rotate(-8 24 24)"><circle cx="16.5" cy="16.5" r="3"/><circle cx="24" cy="24" r="3"/><circle cx="31.5" cy="31.5" r="3"/></g>',
  },
};

const PK_ICONS = {
  go: '<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M516-120 402-402 120-516v-56l720-268-268 720h-56Zm26-148 162-436-436 162 196 78 78 196Zm-34-240Z"/></svg>',
  page: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14 3.5V8h5M9 12h7M9 15.5h7"/></svg>',
  again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.5H15"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
};

// عشوائي ثابت البذرة: نفس البذرة = نفس الشكل
function pkRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
let pkUid = 0;
const f1 = (v) => v.toFixed(1);

// النقاط كلها رسم واحد (path) بدل مئات الدوائر: كل نقطة دائرة من قوسين، ونفس المظهر بعناصر أقل
const pkDot = (cx, cy, r) => {
  const n = (v) => +v.toFixed(2);
  return `M${n(cx - r)} ${cy}a${r} ${r} 0 1 0 ${n(2 * r)} 0a${r} ${r} 0 1 0 ${n(-2 * r)} 0`;
};
let pkGlyphDots = "";
function pkGlyph(key) {
  const g = PK_SHAPES[key] || PK_SHAPES.any;
  const id = `pkg${++pkUid}`;
  if (!pkGlyphDots) {
    for (let y = 1.55, row = 0; y < 50; y += 2.68, row++) {
      for (let x = row % 2 ? 1.55 : 0; x < 50; x += 3.1) {
        pkGlyphDots += pkDot(+f1(x), f1(y), +(0.35 + (x / 48 + y / 48) / 2).toFixed(2));
      }
    }
  }
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><mask id="${id}"><g fill="#fff">${g.fill}</g></mask></defs><g mask="url(#${id})" fill="currentColor"><path d="${pkGlyphDots}"/></g><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${g.line}</g></svg>`;
}

// حلقة نقاط بنصف قطر r داخل مربع 200 (المقاس الفعلي من CSS)؛ كل حلقة رسم واحد بشفافيتها
function pkHalo(cls, rings) {
  let c = "";
  for (const [r, n, dot, op] of rings) {
    let d = "";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.55 + 0.45 * Math.sin(a * 3 + 1);
      d += pkDot(+f1(100 + r * Math.cos(a)), f1(100 + r * Math.sin(a)), +(dot * k).toFixed(2));
    }
    c += `<path d="${d}" opacity="${op}"/>`;
  }
  return `<svg class="${cls}" viewBox="0 0 200 200" aria-hidden="true"><g fill="currentColor">${c}</g></svg>`;
}

// كرة ورق جريدة: حافة مضلّعة، وجوه مثلثة بإضاءة من أعلى اليسار، وعلى أغلب الوجوه
// بقايا طباعة (أعمدة سطور، عناوين عريضة، كلمات) — عشان تُقرأ جريدة لا حجراً
function pkBall(seed, words) {
  const R = pkRng(seed);
  const id = `pkb${++pkUid}`;
  const n = 17;
  const edge = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.25;
    const r = 78 + R() * 16 - Math.abs(Math.sin(a)) * 4;
    edge.push([r * Math.cos(a), r * Math.sin(a) * 0.93]);
  }
  const blob = `M${edge.map((p) => p.map(f1).join(" ")).join("L")}Z`;
  const rings = [[[(R() - 0.5) * 14, (R() - 0.5) * 14]]];
  for (const [k, rr] of [
    [6, 30],
    [11, 58],
    [17, 100],
  ]) {
    const ring = [];
    const off = R() * 6;
    for (let i = 0; i < k; i++) {
      const a = ((i + off + (R() - 0.5) * 0.5) / k) * Math.PI * 2;
      const r = rr * (0.85 + R() * 0.3);
      ring.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    rings.push(ring);
  }
  const ang = (p) => Math.atan2(p[1], p[0]);
  const tris = [];
  for (let j = 0; j < rings.length - 1; j++) {
    const A = rings[j].slice().sort((p, q) => ang(p) - ang(q));
    const B = rings[j + 1].slice().sort((p, q) => ang(p) - ang(q));
    if (A.length === 1) {
      for (let i = 0; i < B.length; i++) tris.push([A[0], B[i], B[(i + 1) % B.length]]);
      continue;
    }
    let ia = 0;
    let ib = 0;
    for (let s = 0; s < A.length + B.length; s++) {
      const a0 = A[ia % A.length];
      const b0 = B[ib % B.length];
      const na = ang(A[(ia + 1) % A.length]) + (ia + 1 >= A.length ? Math.PI * 2 : 0);
      const nb = ang(B[(ib + 1) % B.length]) + (ib + 1 >= B.length ? Math.PI * 2 : 0);
      if ((na <= nb && ia < A.length) || ib >= B.length) {
        tris.push([a0, A[(ia + 1) % A.length], b0]);
        ia++;
      } else {
        tris.push([a0, B[(ib + 1) % B.length], b0]);
        ib++;
      }
    }
  }
  let facets = "";
  let print = "";
  let clips = "";
  let creases = "";
  tris.forEach((t, k) => {
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    const light = (-cx * 0.55 - cy * 0.8) / 100;
    const v = Math.max(0, Math.min(1, 0.6 + light * 0.45 + (R() - 0.5) * 0.7));
    const pts = t.map((p) => p.map(f1).join(",")).join(" ");
    const col = `color-mix(in srgb,var(--bh) ${Math.round(v * 100)}%,var(--bl))`;
    facets += `<polygon points="${pts}" style="fill:${col};stroke:${col}" stroke-width=".6"/>`;
    if (R() < 0.55) creases += `M${f1(t[0][0])} ${f1(t[0][1])}L${f1(t[1][0])} ${f1(t[1][1])}`;
    const roll = R();
    if (roll > 0.72) return;
    const cid = `${id}f${k}`;
    clips += `<clipPath id="${cid}"><polygon points="${pts}"/></clipPath>`;
    const rot = Math.round((R() - 0.5) * 150);
    const op = (0.3 + R() * 0.25) * (0.55 + v * 0.6);
    let ink = "";
    if (roll < 0.18) {
      // كلمة بخط الجريدة
      const w = words[Math.floor(R() * words.length)];
      ink = `<text x="${f1(cx)}" y="${f1(cy + 4)}" text-anchor="middle" font-family="Amiri, serif" font-weight="700" font-size="${f1(10 + R() * 5)}">${w}</text>`;
    } else if (roll < 0.3) {
      // عنوان عريض فوق عمود
      ink = `<rect x="${f1(cx - 22)}" y="${f1(cy - 9)}" width="${f1(30 + R() * 14)}" height="3.4" rx="1"/>`;
      for (let L = 0; L < 4; L++) ink += `<rect x="${f1(cx - 22)}" y="${f1(cy - 2 + L * 3.6)}" width="${f1(28 + R() * 18)}" height="1.1"/>`;
    } else {
      // عمودا سطور مطبوعة
      for (let L = -3; L <= 3; L++) {
        const y = f1(cy + L * 3.6);
        ink += `<rect x="${f1(cx - 26)}" y="${y}" width="${f1(16 + R() * 6)}" height="1.1"/><rect x="${f1(cx - 4)}" y="${y}" width="${f1(14 + R() * 12)}" height="1.1"/>`;
      }
    }
    print += `<g clip-path="url(#${cid})" transform="rotate(${rot} ${f1(cx)} ${f1(cy)})" opacity="${op.toFixed(2)}">${ink}</g>`;
  });
  return `<svg viewBox="-110 -110 220 220" aria-hidden="true">
  <defs><clipPath id="${id}c"><path d="${blob}"/></clipPath>${clips}
    <filter id="${id}r" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="${seed % 97}"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
    <radialGradient id="${id}s" cx="38%" cy="32%" r="78%"><stop offset="0" style="stop-color:var(--bsh1)"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" style="stop-color:var(--bsh2)"/></radialGradient>
    <radialGradient id="${id}d"><stop offset="0" style="stop-color:var(--bshadow)"/><stop offset="1" style="stop-color:var(--bshadow)" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="12" cy="103" rx="74" ry="11" fill="url(#${id}d)" style="opacity:var(--bshadow-op)"/>
  <g class="pk-ball-body"><g filter="url(#${id}r)" transform="rotate(-9)">
    <g clip-path="url(#${id}c)">${facets}
      <g style="fill:var(--bprint);opacity:var(--bprint-op)">${print}</g>
      <path d="${creases}" fill="none" style="stroke:var(--bcrease)" stroke-width=".7"/>
      <path d="${creases}" fill="none" style="stroke:var(--bcrease-hi)" stroke-width=".6" transform="translate(.7 .7)"/>
      <rect x="-110" y="-110" width="220" height="220" fill="url(#${id}s)"/></g>
    <path d="${blob}" fill="none" style="stroke:var(--bcrease)" stroke-width=".8"/>
  </g></g></svg>`;
}

// آثار تكسير على القصاصة: شبكة مثلثات بإضاءة عشوائية + خطوط طيّ؛ الألوان والشدة من CSS
function pkCreases(w, h, seed) {
  const R = pkRng(seed);
  const id = `pkc${++pkUid}`;
  const cols = Math.max(4, Math.round(w / 95));
  const rows = Math.max(5, Math.round(h / 95));
  const P = [];
  for (let j = 0; j <= rows; j++) {
    P.push([]);
    for (let i = 0; i <= cols; i++) {
      const ex = i === 0 || i === cols;
      const ey = j === 0 || j === rows;
      P[j].push([
        (i / cols) * w + (ex ? 0 : (R() - 0.5) * (w / cols) * 0.8),
        (j / rows) * h + (ey ? 0 : (R() - 0.5) * (h / rows) * 0.8),
      ]);
    }
  }
  let white = "";
  let dark = "";
  let lines = "";
  const poly = (t, o) => `<polygon points="${t.map((p) => p.map(f1).join(",")).join(" ")}" fill-opacity="${o.toFixed(2)}"/>`;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = P[j][i];
      const b = P[j][i + 1];
      const c = P[j + 1][i + 1];
      const d = P[j + 1][i];
      const tr = R() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const t of tr) {
        const v = R();
        if (v > 0.5) white += poly(t, (v - 0.5) * 2);
        else dark += poly(t, (0.5 - v) * 2);
      }
      if (R() < 0.45) lines += `M${f1(a[0])} ${f1(a[1])}L${f1(c[0])} ${f1(c[1])}`;
      if (R() < 0.3) lines += `M${f1(b[0])} ${f1(b[1])}L${f1(d[0])} ${f1(d[1])}`;
    }
  }
  const folds = `M0 ${f1(h * 0.36)}L${w} ${f1(h * 0.31)}M${f1(w * 0.58)} 0L${f1(w * 0.53)} ${h}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cg1)"/><stop offset="1" style="stop-color:var(--cg2)"/></linearGradient></defs>
    <g class="pk-cw">${white}</g><g class="pk-ck">${dark}</g>
    <path class="pk-cl" d="${lines}"/><path class="pk-cl hi" d="${lines}" transform="translate(1 1)"/>
    <path class="pk-cf" d="${folds}"/><path class="pk-cf hi" d="${folds}" transform="translate(1.2 1.2)"/>
    <rect width="100%" height="100%" fill="url(#${id})"/></svg>`;
}

// حافة ممزقة: نقاط محيط المستطيل بالنسب المئوية (نفس عددها دائماً، فتتحوّل لكرة وتعود)
function pkTorn(seed) {
  const R = pkRng(seed);
  const k = 26;
  const pts = [];
  for (let i = 0; i <= k; i++) pts.push([(i / k) * 100, R() * 0.9]);
  for (let i = 0; i <= k; i++) pts.push([100 - R() * 0.5, (i / k) * 100]);
  for (let i = k; i >= 0; i--) pts.push([(i / k) * 100, 100 - R() * 0.9]);
  for (let i = k; i >= 0; i--) pts.push([R() * 0.5, (i / k) * 100]);
  return pts;
}
// نفس النقاط ملمومة حول المركز بنصف قطر r (بكسل) وحافة مضلّعة — شكل الكرة
function pkBlob(pts, w, h, r, seed) {
  const R = pkRng(seed);
  return pts.map(([x, y]) => {
    const a = Math.atan2((y - 50) * h, (x - 50) * w);
    const rr = r * (0.82 + R() * 0.3);
    return [50 + ((rr * Math.cos(a)) / w) * 100, 50 + ((rr * Math.sin(a)) / h) * 100];
  });
}
const pkPoly = (pts) => `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`;

function initRandomPicker() {
  const root = document.getElementById("picker");
  if (!root) return;
  const $ = (id) => document.getElementById(id);
  const moon = $("pkMoon");
  const wheel = $("pkWheel");
  const ballBox = $("pkBall");
  const resultBox = $("pkResult");
  const chip = $("pkChip");
  const areaSelect = $("pickerArea");
  const live = $("pkLive");
  const prompt = root.querySelector(".pk-prompt");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isEn = window.SITE_LANG === "en";
  const BALL_WORDS = isEn
    ? ["Torilu", "Bahrain", "Today", "News", "Manama", "Menu"]
    : ["توريلو", "البحرين", "اليوم", "أخبار", "المنامة", "قهوة"];

  // ارتفاع المسرح = الشاشة ناقص الهيدر والشريط السفلي (تحت zoom الشاشات العريضة
  // نقسم innerHeight على نسبة التكبير، لأن مقاسات CSS قبل التكبير)
  const header = document.querySelector(".site-header");
  const bottomNav = document.querySelector(".bottom-nav");
  function fit() {
    const z = parseFloat(document.documentElement.style.zoom) || 1;
    const h = window.innerHeight / z - (header?.offsetHeight || 0) - (bottomNav?.offsetHeight || 0);
    root.style.setProperty("--pk-h", `${Math.max(240, Math.round(h))}px`);
    // لا يغطي القمر ولا العجلة سطرَي العنوان بأي مقاس: مركزهما لا يرتفع فوق
    // (أسفل العنوان + نصف القطعة + فراغ)، وإن ضاق المسرح يطول بقدر الحاجة
    for (const v of ["--b", "--p", "--R"]) root.style.removeProperty(v);
    const cs = getComputedStyle(root);
    const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    // بشاشة قصيرة جداً يختفي العنوان وقت العجلة (CSS)، فلا يُحسب
    const hidden = getComputedStyle(prompt).visibility === "hidden";
    const below = hidden ? 0 : prompt.offsetTop + prompt.offsetHeight;
    // شاشة قصيرة (جوال بالعرض، لابتوب منخفض): تصغر العجلة والقمر حتى يتّسعا فوق الشريط السفلي
    const room = h - below - 20 - 40; // 40: اسم البتلة السفلية تحتها
    const k = Math.min(1, Math.max(0.4, room / (2 * px("--R") + px("--p"))));
    if (k < 1) for (const v of ["--b", "--p", "--R"]) root.style.setProperty(v, `${Math.round(px(v) * k)}px`);
    const cs2 = getComputedStyle(root);
    const q = (v) => parseFloat(root.style.getPropertyValue(v) || cs2.getPropertyValue(v)) || 0;
    const moonMin = below + q("--b") / 2 + 36;
    const wheelMin = below + q("--R") + q("--p") / 2 + 20;
    root.style.setProperty("--moon-min", `${Math.round(moonMin)}px`);
    root.style.setProperty("--wheel-min", `${Math.round(wheelMin)}px`);
    const need = Math.max(moonMin + q("--b") / 2 + 70, wheelMin + q("--R") + q("--p") / 2 + 24);
    if (need > root.offsetHeight) root.style.setProperty("--pk-h", `${Math.ceil(need)}px`);
  }
  fit();
  window.addEventListener("resize", fit);
  document.fonts?.ready.then(fit);
  new MutationObserver(fit).observe(prompt, { childList: true, subtree: true, characterData: true });
  new MutationObserver(fit).observe(root, { attributes: true, attributeFilter: ["data-step"] });

  // الأقسام: «أي شيء» = كل الأقسام معاً؛ القسم الفارغ يختفي زرّه
  const secItems = (k) => SITE_DATA[k]?.items || [];
  const sectionOf = new Map();
  for (const k of PK_KEYS) for (const it of secItems(k)) sectionOf.set(it, k);
  const itemsFor = (k) => (k === "any" ? PK_KEYS.flatMap(secItems) : secItems(k));
  const petals = [...wheel.querySelectorAll(".pk-petal")].filter((b) => {
    if (itemsFor(b.dataset.section).length) return true;
    b.remove();
    return false;
  });
  const labelOf = {};
  petals.forEach((b, i) => {
    const a = (i / petals.length) * Math.PI * 2;
    b.style.setProperty("--x", Math.sin(a).toFixed(4));
    b.style.setProperty("--y", (-Math.cos(a)).toFixed(4));
    b.style.setProperty("--i", i);
    b.querySelector(".pk-glyph").innerHTML = pkGlyph(b.dataset.section);
    labelOf[b.dataset.section] = b.textContent.trim();
  });
  root.style.setProperty("--n", petals.length);
  wheel.insertAdjacentHTML("afterbegin", pkHalo("pk-ring", [[95, 90, 0.75, 0.55]]));
  moon.insertAdjacentHTML(
    "afterbegin",
    pkHalo("pk-halo", [
      [66, 54, 0.9, 0.32],
      [80, 72, 0.6, 0.18],
    ])
  );

  let step = "moon";
  let section = null;
  let busy = false;
  let current = null; // { clip, wrap, torn } القصاصة الظاهرة
  const later = (ms, fn) => setTimeout(fn, reduceMotion ? Math.min(ms, 250) : ms);

  function setStep(s) {
    step = s;
    root.dataset.step = s;
    wheel.inert = s !== "wheel";
    moon.inert = s === "ball" || s === "clip";
  }
  function setPrompt(q, s) {
    $("pkTitle").textContent = t(q);
    $("pkSub").textContent = t(s);
    prompt.classList.remove("swap");
    void prompt.offsetWidth;
    prompt.classList.add("swap");
  }

  function openWheel() {
    sfx("open");
    petals.forEach((b) => b.classList.remove("sel"));
    setStep("wheel");
    setPrompt("picker_q2", "picker_s2");
    moon.setAttribute("aria-expanded", "true");
    moon.setAttribute("aria-label", t("picker_close"));
    (petals.find((b) => b.dataset.section === section) || petals[0]).focus({ preventScroll: true });
  }
  function closeWheel() {
    sfx("close");
    setStep("moon");
    setPrompt("picker_q1", "picker_s1");
    moon.setAttribute("aria-expanded", "false");
    moon.removeAttribute("aria-label");
    moon.focus({ preventScroll: true });
  }
  moon.addEventListener("click", () => busy || (step === "wheel" ? closeWheel() : openWheel()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && step === "wheel" && !busy) closeWheel();
  });

  // ===== منطق الاختيار (كما كان): المنطقة، والأقرب لي، وكيس الخلط بالمحل =====
  const NEAR_COUNT = 8;
  let items = [];
  let nearPool = [];
  function fillAreas() {
    const list = itemsFor(section);
    const counts = {};
    list.forEach((it) =>
      (it.tags || []).forEach((tg) => AREA_NAMES.includes(tg) && (counts[tg] = (counts[tg] || 0) + 1))
    );
    const hasLoc = list.some((it) => (it.lat != null && it.lng != null) || it.branches?.length);
    areaSelect.innerHTML = [
      `<option value="">${t("picker_area_all").replace("{n}", list.length)}</option>`,
      hasLoc ? `<option value="near">${t("picker_area_near")}</option>` : "",
      ...Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([area, n]) => `<option value="${escapeHtml(area)}">${escapeHtml(tagLabel(area))} (${n})</option>`),
    ].join("");
  }
  function applyPool() {
    const list = itemsFor(section);
    const v = areaSelect.value;
    items = v === "near" ? nearPool : v ? list.filter((it) => (it.tags || []).includes(v)) : list;
    bag = [];
  }

  // الفائز: عدالة + "عشوائية يحسّها الناس عشوائية" —
  // 1) بالمحل مو بالفرع: نجمع الفروع باسم المحل (اللي قبل " - " بالعنوان) ونختار محل ثم فرع منه.
  // 2) كيس خلط: كل المحلات تطلع مرة قبل ما يتكرر أي محل، وما يطلع نفس المحل مرتين ورا بعض.
  let bag = [];
  let lastBrand = null;
  const brandOf = (it) => (it.title || "").split(" - ")[0].trim();
  function pickWinner() {
    const groups = new Map();
    for (const it of items) {
      const k = brandOf(it);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    bag = bag.filter((k) => groups.has(k));
    if (!bag.length) {
      bag = [...groups.keys()];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === lastBrand) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    lastBrand = bag.pop();
    const g = groups.get(lastBrand);
    return g[Math.floor(Math.random() * g.length)];
  }

  // ===== الكرة والقصاصة =====
  function showBall() {
    ballBox.innerHTML = pkBall(Math.floor(Math.random() * 1e9), BALL_WORDS);
    setStep("ball");
    later(380, () => sfx("crumple"));
  }
  const zoomOf = () => parseFloat(document.documentElement.style.zoom) || 1;
  const centerOf = (el) => {
    const r = el.getBoundingClientRect();
    const z = zoomOf();
    return [(r.left + r.width / 2) / z, (r.top + r.height / 2) / z];
  };

  function clipHtml(item) {
    const sec = sectionOf.get(item);
    const secLabel = escapeHtml(labelOf[sec] || sectionLabel(sec));
    const area = (item.tags || []).find((tg) => AREA_NAMES.includes(tg));
    const areaLabel = area ? escapeHtml(tagLabel(area)) : "";
    const hours = escapeHtml(itemHours(item));
    const desc = escapeHtml(itemDesc(item));
    const maps = item.links?.maps || item.mapsUrl || "";
    const page =
      (isEn && item.detailUrlEn) || item.detailUrl || `${sec}.html?q=${encodeURIComponent(itemTitle(item))}`;
    const date = new Date().toLocaleDateString(isEn ? "en-GB" : "ar-BH-u-nu-latn", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const fact = (cls, k, v) => `<div class="${cls}"><dt>${t(k)}</dt><dd>${v}</dd></div>`;
    const goCls = maps ? "pk-sub" : "pk-go";
    // «الاسم - الفرع»: الفرع سطر صغير تحت الاسم، فلا يكبر العنوان إلى ثلاثة أسطر
    const nm = itemTitle(item).split(" - ");
    if (nm.length > 2) nm.splice(1, nm.length - 1, nm.slice(1).join(" - "));
    return `
      <div class="pk-creases"></div>
      <header class="pk-mast"><span class="pk-mast-pick">${t("picker_yours")} · ${secLabel}</span><span class="pk-logo">${isEn ? "Torilu" : "توريلو"}<i>.</i></span><span class="pk-mast-date">${escapeHtml(date)}</span></header>
      <p class="pk-kicker">${secLabel}${areaLabel ? `<i></i>${areaLabel}` : ""}</p>
      <h2 class="pk-name${nm[0].length > 16 ? " is-long" : ""}" id="pkName" tabindex="-1">${escapeHtml(nm[0])}${nm[1] && escapeHtml(nm[1]) !== areaLabel ? `<small class="pk-branch">${escapeHtml(nm[1])}</small>` : ""}</h2>
      <div class="pk-body">
        ${desc ? `<p class="pk-lead">${desc}</p>` : ""}
        <dl class="pk-facts">${areaLabel ? fact("pk-f-area", "picker_f_area", areaLabel) : ""}${hours ? fact("pk-f-hours", "picker_f_hours", PK_ICONS.clock + hours) : ""}${fact("pk-f-sec", "picker_f_section", secLabel)}</dl>
      </div>
      <div class="pk-acts">${maps ? `<a class="pk-go" href="${safeUrl(maps)}" target="_blank" rel="noopener noreferrer">${PK_ICONS.go}${t("picker_go")}</a>` : ""}<a class="${goCls}" href="${escapeHtml(page)}">${PK_ICONS.page}${t("picker_page")}</a><button type="button" class="pk-sub pk-again">${PK_ICONS.again}${t("picker_again")}</button></div>
      <div class="pk-crumple"></div>`;
  }

  // الكرة تنفرد قصاصة: clip-path من شكل الكرة (بمكانها) إلى الحافة الممزقة
  function unfold(item) {
    const from = centerOf(ballBox);
    const wrap = document.createElement("div");
    wrap.className = "pk-clipwrap";
    const clip = document.createElement("article");
    clip.className = "pk-clip";
    clip.setAttribute("aria-labelledby", "pkName");
    clip.innerHTML = clipHtml(item);
    wrap.append(clip);
    resultBox.replaceChildren(wrap);
    setStep("clip");
    const w = clip.offsetWidth;
    const h = clip.offsetHeight;
    const seed = Math.floor(Math.random() * 1e9);
    clip.querySelector(".pk-creases").innerHTML = pkCreases(w, h, seed);
    clip.querySelector(".pk-crumple").innerHTML = pkCreases(w, h, seed + 7);
    const torn = pkTorn(seed);
    clip.style.clipPath = pkPoly(torn);
    current = { clip, torn, w, h, seed };
    clip.querySelector(".pk-again").addEventListener("click", again);
    const to = centerOf(clip);
    current.dx = from[0] - to[0];
    current.dy = from[1] - to[1];
    live.textContent = t("picker_result").replace("{name}", itemTitle(item));
    later(420, () => sfx("success"));
    const done = () => {
      busy = false;
      areaSelect.disabled = false;
      (clip.querySelector(".pk-go") || clip.querySelector("a")).focus({ preventScroll: true });
    };
    if (reduceMotion) {
      clip.animate({ opacity: [0, 1] }, 250);
      return done();
    }
    crumpleFrames(current, false).onfinish = done;
  }

  // حركة واحدة بالاتجاهين: كرة ← مجعّدة ← مفرودة (reverse = تكوير)
  function crumpleFrames(c, reverse) {
    const r = (parseFloat(getComputedStyle(root).getPropertyValue("--ball")) || 220) * 0.4;
    const ball = pkBlob(c.torn, c.w, c.h, r, c.seed);
    const R = pkRng(c.seed + 3);
    const mid = c.torn.map(([x, y], i) => [
      ball[i][0] + (x - ball[i][0]) * 0.62 + (R() - 0.5) * 7,
      ball[i][1] + (y - ball[i][1]) * 0.62 + (R() - 0.5) * 7,
    ]);
    const frames = [
      { clipPath: pkPoly(ball), transform: `translate(${c.dx}px, ${c.dy}px) rotate(14deg) scale(.96)`, offset: 0 },
      { clipPath: pkPoly(mid), transform: `translate(${c.dx * 0.25}px, ${c.dy * 0.25}px) rotate(-4deg) scale(1.01)`, offset: 0.5 },
      { clipPath: pkPoly(c.torn), transform: "none", offset: 1 },
    ];
    const opts = { duration: reverse ? 520 : 1150, easing: reverse ? "cubic-bezier(.5,0,.75,0)" : "cubic-bezier(.3,.75,.3,1)", fill: "both" };
    const crumple = c.clip.querySelector(".pk-crumple");
    const lines = c.clip.querySelectorAll(".pk-clip > :not(.pk-creases, .pk-crumple)");
    if (reverse) {
      frames.reverse().forEach((f, i) => (f.offset = [0, 0.5, 1][i]));
      crumple.animate({ opacity: [0, 1, 1] }, opts);
      lines.forEach((el) => el.animate({ opacity: [1, 0.6, 0] }, opts));
    } else {
      crumple.animate({ opacity: [1, 0.85, 0] }, opts);
      lines.forEach((el) => el.animate({ opacity: [0, 0.5, 1] }, opts));
    }
    return c.clip.animate(frames, opts);
  }

  // اختيار جديد: (القصاصة الحالية تتكوّر أولاً) ← كرة تتمايل ← تنفرد قصاصة جديدة
  function pickNow() {
    if (!items.length) return;
    busy = true;
    areaSelect.disabled = true;
    const winner = pickWinner();
    const go = () => {
      showBall();
      later(1050, () => unfold(winner));
    };
    if (step === "clip" && current && !reduceMotion) {
      sfx("crumple");
      const anim = crumpleFrames(current, true);
      anim.onfinish = go;
    } else go();
  }
  function again() {
    if (busy) return;
    sfx("tap");
    pickNow();
  }

  function setChip() {
    chip.innerHTML = `${pkGlyph(section)}<span>${escapeHtml(labelOf[section])}</span>`;
    chip.setAttribute("aria-label", `${t("picker_change")}: ${labelOf[section]}`);
    chip.title = t("picker_change");
  }

  // عودة الأزرار للمركز بنقاط حبر خلفها
  function trails() {
    if (reduceMotion) return;
    const center = root.querySelector(".pk-center");
    const n = petals.length;
    const made = [];
    petals.forEach((_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      [
        [0.96, 0.11, 0.5, 40],
        [0.8, 0.08, 0.32, 110],
        [0.64, 0.055, 0.2, 180],
      ].forEach(([k, s, o, d]) => {
        const dot = document.createElement("i");
        dot.className = "pk-trail";
        dot.style.cssText = `--tx:${(Math.sin(a) * k).toFixed(3)};--ty:${(-Math.cos(a) * k).toFixed(3)};--s:calc(var(--p) * ${s});--o:${o};--d:${d + (n - 1 - i) * 22}ms`;
        center.append(dot);
        made.push(dot);
      });
    });
    setTimeout(() => made.forEach((d) => d.remove()), 1200);
  }

  petals.forEach((b) => {
    b.addEventListener("click", () => {
      if (busy || step !== "wheel") return;
      sfx("tap");
      busy = true;
      section = b.dataset.section;
      b.classList.add("sel");
      fillAreas();
      applyPool();
      setChip();
      moon.setAttribute("aria-expanded", "false");
      moon.removeAttribute("aria-label");
      trails();
      // الزر المختار يبقى أزرق لحظة ثم يعود مع البقية
      later(120, pickNow);
    });
  });

  chip.addEventListener("click", () => {
    if (busy) return;
    resultBox.replaceChildren();
    current = null;
    openWheel();
  });

  function resetArea(msg) {
    showToast(msg);
    areaSelect.value = "";
    applyPool();
  }
  areaSelect.addEventListener("change", () => {
    if (areaSelect.value !== "near") {
      applyPool();
      return again();
    }
    if (!navigator.geolocation) return resetArea(t("geolocation_unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (areaSelect.value !== "near") return;
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        nearPool = itemsFor(section)
          .map((it) => ({ it, near: nearestBranch(it, me) }))
          .filter((x) => x.near)
          .sort((a, b) => a.near.km - b.near.km)
          .slice(0, NEAR_COUNT)
          .map((x) => x.it);
        applyPool();
        showToast(t("picker_area_near_done").replace("{n}", nearPool.length));
        if (items.length) again();
      },
      () => resetArea(t("geolocation_denied")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });

  setStep("moon");
}
