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

// ===== الورقة: القصاصة تُكرمش باليد كرةً وتُفرد من جديد (WebGL) =====
// القصاصة تُرسم مرة واحدة صورةً (من عناصر الصفحة نفسها)، ثم تُشدّ على شبكة ثلاثية الأبعاد تنضغط كرة:
// الأطراف أولاً، بضغطتين، والطباعة تنثني مع الورق، والضوء من ميل كل وجه. بلا WebGL تبقى الحركة القديمة.
const PP = { GX: 14, GY: 16, REST: 0.05 };
const ppSn = (x, y, s) => Math.sin(x * 0.011 + s) * Math.cos(y * 0.009 - s * 1.3) + 0.5 * Math.sin((x + y) * 0.021 + s * 2.1);

// صورة القصاصة كما تظهر: الخلفية والحدود والأيقونات والكلمات بخطوط الصفحة، داخل حافتها الممزقة
async function ppSnapshot(clip, torn) {
  const wrap = clip.parentElement;
  const keepT = wrap.style.transform;
  const keepV = clip.style.visibility;
  wrap.style.transform = "none"; // القياس بلا الميل الخفيف
  clip.style.visibility = "visible"; // القصاصة قد تكون مخفية تنتظر الفرد؛ لا تُرسم الشاشة بين هذين السطرين
  try {
    return await ppPaint(clip, torn);
  } finally {
    wrap.style.transform = keepT;
    clip.style.visibility = keepV;
  }
}
async function ppPaint(clip, torn) {
  for (const a of clip.getAnimations({ subtree: true })) {
    if (a.effect?.target === clip || a.effect?.getComputedTiming().iterations === Infinity) continue;
    a.finish(); // الشكل الأخير (مثل زر يظهر متأخراً)
  }
  const box = clip.getBoundingClientRect();
  const w = clip.offsetWidth;
  const h = clip.offsetHeight;
  const s = box.width / w || 1; // zoom الشاشات العريضة
  const dpr = Math.min(3, (window.devicePixelRatio || 1) * s); // بدقة الشاشة (ومعها zoom الشاشات العريضة)
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d");
  g.scale(dpr, dpr);
  const rel = (r) => [(r.left - box.left) / s, (r.top - box.top) / s, r.width / s, r.height / s];
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e && e !== clip.parentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 0;
    return o;
  };
  const svgs = [];
  const under = [];
  const jobs = [];
  const tasks = [];
  g.beginPath();
  torn.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, (x / 100) * w, (y / 100) * h));
  g.closePath();
  g.clip();
  g.fillStyle = getComputedStyle(clip).backgroundColor;
  g.fillRect(0, 0, w, h);
  const creases = clip.querySelector(".pk-creases svg");
  if (creases) {
    const [x, y, ew, eh] = rel(creases.getBoundingClientRect());
    under.push({ el: creases, x, y, ew, eh, op: 1 });
  }
  for (const el of clip.querySelectorAll("*")) {
    if (el.closest(".pk-crumple") || (el.ownerSVGElement && el.closest("svg") !== el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const [x, y, ew, eh] = rel(el.getBoundingClientRect());
    if (!ew || !eh) continue;
    const op = opacityOf(el);
    if (op <= 0.01) continue;
    if (el.tagName.toLowerCase() === "svg") {
      if (!el.closest(".pk-creases")) svgs.push({ el, x, y, ew, eh, op });
      continue;
    }
    tasks.push(() => {
    g.globalAlpha = op;
    const bg = cs.backgroundColor;
    if (bg && !/rgba\(.*,\s*0\)$|transparent/.test(bg)) {
      g.fillStyle = bg;
      const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, ew / 2, eh / 2);
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, ew, eh, rad);
      else g.rect(x, y, ew, eh);
      g.fill();
    }
    for (const [side, x0, y0, x1, y1] of [
      ["Top", x, y, x + ew, y],
      ["Bottom", x, y + eh, x + ew, y + eh],
      ["Left", x, y, x, y + eh],
      ["Right", x + ew, y, x + ew, y + eh],
    ]) {
      const bw = parseFloat(cs[`border${side}Width`]) || 0;
      const st = cs[`border${side}Style`];
      if (!bw || st === "none" || st === "hidden") continue;
      g.strokeStyle = cs[`border${side}Color`];
      g.lineWidth = st === "double" ? Math.max(1, bw / 3) : bw;
      g.setLineDash(st === "dashed" ? [bw * 3, bw * 2] : st === "dotted" ? [bw, bw * 1.6] : []);
      const off = side === "Top" || side === "Left" ? bw / 2 : -bw / 2;
      const hz = side === "Top" || side === "Bottom";
      const line = (o) => {
        g.beginPath();
        g.moveTo(x0 + (hz ? 0 : o), y0 + (hz ? o : 0));
        g.lineTo(x1 + (hz ? 0 : o), y1 + (hz ? o : 0));
        g.stroke();
      };
      if (st === "double") {
        line(off > 0 ? bw / 6 : -bw / 6);
        line(off > 0 ? bw - bw / 6 : -bw + bw / 6);
      } else line(off);
    }
    g.setLineDash([]);
    });
    // الكلمات: كل كلمة في مكانها الحقيقي (فالأسطر والاتجاه والتشكيل كما في الصفحة)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const txt = node.textContent;
      const tf = cs.textTransform;
      const re = /\S+/g;
      let m;
      g.font = font;
      g.fillStyle = cs.color;
      g.direction = cs.direction;
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      if ("letterSpacing" in g) g.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      // نص مقصوص بـ line-clamp: الكلمات خارج صندوق العنصر لا تظهر في الصفحة، فلا تُرسم
      const clipBox = cs.overflow !== "visible" ? rel(el.getBoundingClientRect()) : null;
      while ((m = re.exec(txt))) {
        const r = document.createRange();
        r.setStart(node, m.index);
        r.setEnd(node, m.index + m[0].length);
        const rects = r.getClientRects();
        const rect = rects[0];
        if (!rect) continue;
        if (rects.length > 1) {
          for (let ci = m.index; ci < m.index + m[0].length; ci++) {
            const rc = document.createRange();
            rc.setStart(node, ci);
            rc.setEnd(node, ci + 1);
            const cr = rc.getClientRects()[0];
            if (!cr) continue;
            const [cx2, cy2] = rel(cr);
            const ch = txt[ci];
            jobs.push({ word: ch, x: cx2, y: cy2 + (g.measureText(ch).fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.85), font, color: cs.color, dir: cs.direction, ls: g.letterSpacing, op });
          }
          continue;
        }
        const [wx, wy, ww, wh] = rel(rect);
        if (clipBox && (wy + wh > clipBox[1] + clipBox[3] + 1 || wx + ww > clipBox[0] + clipBox[2] + 1 || wx < clipBox[0] - 1)) continue;
        const word = tf === "uppercase" ? m[0].toUpperCase() : tf === "lowercase" ? m[0].toLowerCase() : m[0];
        const mt = g.measureText(word);
        const asc = mt.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.85;
        jobs.push({ word, x: wx, y: wy + asc, font, color: cs.color, dir: cs.direction, ls: g.letterSpacing, op });
      }
    }
  }
  await ppDrawSvgs(g, under);
  for (const task of tasks) task();
  for (const j of jobs) {
    g.globalAlpha = j.op;
    g.font = j.font;
    g.fillStyle = j.color;
    g.direction = j.dir;
    if ("letterSpacing" in g) g.letterSpacing = j.ls;
    g.fillText(j.word, j.x, j.y);
  }
  await ppDrawSvgs(g, svgs);
  return { cv, w, h };
}
// الأيقونات وخطوط التجعيد (SVG): تُنسخ بألوانها المحسوبة وتُرسم صوراً
function ppDrawSvgs(g, svgs) {
  const props = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stop-color", "color", "mix-blend-mode"];
  return Promise.all(
    svgs.map(
      ({ el, x, y, ew, eh, op }) =>
        new Promise((ok) => {
          const copy = el.cloneNode(true);
          const src = [el, ...el.querySelectorAll("*")];
          const dst = [copy, ...copy.querySelectorAll("*")];
          src.forEach((n, i) => {
            const cs = getComputedStyle(n);
            dst[i].setAttribute("style", props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
          });
          copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          copy.setAttribute("width", ew);
          copy.setAttribute("height", eh);
          const img = new Image();
          img.onload = () => {
            g.globalAlpha = op;
            g.drawImage(img, x, y, ew, eh);
            ok();
          };
          img.onerror = ok;
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
        })
    )
  );
}

// المشهد: شبكة الورقة وظلّها، فوق القصاصة، بحجم المسرح
function ppScene(host) {
  const cv = document.createElement("canvas");
  cv.className = "pk-paper";
  cv.setAttribute("aria-hidden", "true");
  const gl = cv.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return null;
  let lost = false; // كرت الشاشة قد يُسحب (جوال بالخلفية)؛ عندها تعود الحركة القديمة
  cv.addEventListener("webglcontextlost", () => (lost = true));
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec3 p;attribute vec2 u;attribute vec3 n;uniform vec2 res;uniform vec2 off;varying vec2 v;varying vec3 m;void main(){v=u;m=n;vec2 q=p.xy+off;gl_Position=vec4(q.x/res.x*2.-1.,1.-q.y/res.y*2.,-p.z/3000.,1.);}"));
  gl.attachShader(
    pr,
    sh(
      gl.FRAGMENT_SHADER,
      "precision mediump float;uniform sampler2D t;uniform vec3 bk;uniform float amt;uniform vec4 sc;varying vec2 v;varying vec3 m;" +
        "void main(){vec4 c=texture2D(t,v);if(c.a<.5)discard;if(sc.a>0.){gl_FragColor=sc;return;}vec3 col=gl_FrontFacing?c.rgb:bk;vec3 L=normalize(vec3(-.45,-.55,.7));" +
        "float l=(dot(normalize(m),L)-L.z)*1.15*amt-(gl_FrontFacing?0.:.06);" +
        "col=l>0.?mix(col,vec3(1.,.99,.965),min(.5,l)):mix(col,vec3(.22,.18,.12),min(.32,-l));gl_FragColor=vec4(col,1.);}"
    )
  );
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const { GX, GY } = PP;
  const grid = [];
  for (let j = 0; j <= GY; j++)
    for (let i = 0; i <= GX; i++) {
      const inner = i > 0 && i < GX && j > 0 && j < GY;
      const n = j * 99 + i;
      const r1 = Math.sin(n * 12.9898) * 43758.5453;
      const r2 = Math.sin(n * 78.233) * 43758.5453;
      grid.push([i / GX + (inner ? (r1 - Math.floor(r1) - 0.5) * 0.7 / GX : 0), j / GY + (inner ? (r2 - Math.floor(r2) - 0.5) * 0.7 / GY : 0)]);
    }
  const tris = [];
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const a = j * (GX + 1) + i;
      const b = a + 1;
      const c = a + GX + 1;
      const d = c + 1;
      tris.push(...((i + j) % 2 ? [a, b, d, a, d, c] : [a, b, c, b, d, c]));
    }
  const uv = new Float32Array(tris.length * 2);
  tris.forEach((k, i) => uv.set(grid[k], i * 2));
  const pos = new Float32Array(tris.length * 3);
  const nrm = new Float32Array(tris.length * 3);
  const buf = (data, name, size) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, data === uv ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
    const loc = gl.getAttribLocation(pr, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return b;
  };
  buf(uv, "u", 2);
  const pB = buf(pos, "p", 3);
  const nB = buf(nrm, "n", 3);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [
    [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
    [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ])
    gl.texParameteri(gl.TEXTURE_2D, k, v);
  const U = (n) => gl.getUniformLocation(pr, n);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  let shadow = [0.24, 0.19, 0.1];
  gl.frontFace(gl.CW); // y يُقلب إلى الأعلى في WebGL، فالوجه المطبوع يُرسم مع عقارب الساعة
  let paper = null; // { w, h, balls }
  host.append(cv);
  // كرة مختلفة كل مرة: لكل نقطة مكانها على الكرة (الحواف تنطوي للداخل فلا زعانف)
  const makeBall = (w, h, seed) =>
    grid.map(([gx, gy]) => {
      const x = (gx - 0.5) * w;
      const y = (gy - 0.5) * h;
      const nd = Math.min(1, Math.hypot(x / (w / 2), y / (h / 2)) / Math.SQRT2);
      const a = Math.atan2(y, x) + 0.5 * ppSn(x, y, seed);
      let r = Math.pow(nd, 0.6) * (0.84 + 0.18 * ppSn(y, x, seed + 2.5));
      if (nd > 0.8) r *= 1 - 0.22 * ((nd - 0.8) / 0.2);
      return { x, y, nd, bx: Math.cos(a) * Math.min(r, 0.95), by: Math.sin(a) * Math.min(r, 0.95), wz: ppSn(x, y, seed + 5.3), wx: ppSn(x, y, seed + 0.7), wy: ppSn(y, x, seed + 3.9) };
    });
  return {
    cv,
    get lost() {
      return lost || gl.isContextLost();
    },
    // keep: نفس شكل الكرة (القصاصة الجديدة تُطبع على الكرة التي في اليد)، وإلا كرة جديدة
    setPaper(snap, back, keep) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snap.cv);
      const seed = keep && paper ? paper.seed : 1.7 + Math.random() * 9;
      paper = { w: snap.w, h: snap.h, seed, ball: makeBall(snap.w, snap.h, seed) };
      gl.uniform3fv(U("bk"), back);
      shadow = back[0] + back[1] + back[2] < 1 ? [0, 0, 0] : [0.24, 0.19, 0.1]; // ظل بني على الورق الفاتح، أسود على الداكن
    },
    // k: 0 مفرودة .. 1 كرة؛ x,y مركزها بمقاس المسرح؛ R نصف قطر الكرة؛ rot ميل القصاصة؛ spin دوران الكرة
    draw({ k, x: cx, y: cy, R, rot, spin }) {
      const dpr = Math.min(3, (window.devicePixelRatio || 1) * (parseFloat(document.documentElement.style.zoom) || 1));
      const W = host.clientWidth;
      const H = host.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!paper) return;
      const P = paper.ball.map((b) => {
        const kv = Math.min(1, Math.max(0, k * 1.3 - 0.3 * (1 - b.nd)));
        const e = 0.5 - 0.5 * Math.cos(Math.PI * kv);
        const wob = Math.sin(Math.PI * kv) * R * 0.2;
        let x = b.x + (b.bx * R - b.x) * e + b.wx * wob;
        let y = b.y + (b.by * R - b.y) * e + b.wy * wob;
        const rr = Math.hypot(x, y);
        const z = Math.sqrt(Math.max(0, (R * 1.05) ** 2 - rr * rr)) * e + b.wz * (wob * 1.6 + R * 0.4 * e) + b.wz * 3 * (1 - e) * Math.min(1, k * 12); // مفرودة تماماً = مسطّحة تماماً
        const a = rot + spin * e;
        const c = Math.cos(a);
        const s = Math.sin(a);
        return [cx + x * c - y * s, cy + x * s + y * c, z];
      });
      for (let i = 0; i < tris.length; i += 3) {
        const A = P[tris[i]];
        const Bv = P[tris[i + 1]];
        const C = P[tris[i + 2]];
        const ux = Bv[0] - A[0];
        const uy = Bv[1] - A[1];
        const uz = Bv[2] - A[2];
        const vx = C[0] - A[0];
        const vy = C[1] - A[1];
        const vz = C[2] - A[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        if (nz < 0) [nx, ny, nz] = [-nx, -ny, -nz];
        for (let q = 0; q < 3; q++) {
          pos.set(P[tris[i + q]], (i + q) * 3);
          nrm.set([nx, ny, nz], (i + q) * 3);
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, pB);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.bindBuffer(gl.ARRAY_BUFFER, nB);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, nrm);
      gl.uniform2f(U("res"), W, H);
      gl.uniform1f(U("amt"), (0.4 + 0.6 * Math.min(1, k * 5)) * Math.min(1, k * 12));
      // الظل: نفس الورقة مزاحة للأسفل بطبقات شفافة (أرخص من فلتر ظل على لوحة بحجم المسرح)
      gl.disable(gl.DEPTH_TEST);
      for (const [dy, a] of [[18, 0.07], [11, 0.08], [5, 0.09]]) {
        gl.uniform2f(U("off"), 0, dy);
        gl.uniform4f(U("sc"), shadow[0] * a, shadow[1] * a, shadow[2] * a, a);
        gl.drawArrays(gl.TRIANGLES, 0, tris.length);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.uniform2f(U("off"), 0, 0);
      gl.uniform4f(U("sc"), 0, 0, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, tris.length);
    },
    hide() {
      cv.hidden = true;
    },
    show() {
      cv.hidden = false;
    },
  };
}

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
  // الورقة بـWebGL (تُنشأ عند أول حاجة؛ بلا WebGL أو مع تقليل الحركة تبقى الحركة القديمة)
  let scene = null;
  let sceneTried = false;
  let ppBall = null; // الكرة الظاهرة الآن: { x, y, R, spin }
  let ppHoldRaf = 0;
  const ppGet = () => {
    if (!sceneTried) {
      sceneTried = true;
      try {
        if (!reduceMotion) scene = ppScene(root);
      } catch {
        scene = null;
      }
      scene?.hide();
    }
    if (scene?.lost) {
      scene.cv.remove();
      scene = null;
    }
    return scene;
  };
  const ppRun = (ms, fn) =>
    new Promise((ok) => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        fn(p);
        if (p < 1) requestAnimationFrame(tick);
        else ok();
      };
      requestAnimationFrame(tick);
    });
  const ppEase = (p) => 0.5 - 0.5 * Math.cos(Math.PI * p);
  const ppSqueeze = (p) => 0.5 * (1 - (1 - Math.min(1, p / 0.55)) ** 3) + 0.5 * ppEase(Math.max(0, (p - 0.4) / 0.6)); // ضغطتان
  const ppLocal = ([x, y]) => {
    const r = root.getBoundingClientRect();
    const z = parseFloat(document.documentElement.style.zoom) || 1;
    return [x - r.left / z, y - r.top / z];
  };
  const ppRot = (el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.atan2(m.b, m.a);
  };
  const ppBack = (clip) => {
    const c = getComputedStyle(clip).backgroundColor.match(/[\d.]+/g) || [242, 236, 223];
    return [0, 1, 2].map((i) => (c[i] / 255) * 0.95);
  };
  function ppHold() {
    cancelAnimationFrame(ppHoldRaf);
    const t0 = performance.now();
    const s0 = ppBall.spin;
    const tick = (now) => {
      if (!ppBall || step !== "ball") return;
      ppBall.spin = s0 + ((now - t0) / 1000) * 0.9;
      [ppBall.x, ppBall.y] = ppBallAt(); // يتبع المسرح إن تغيّر المقاس
      scene.draw({ k: 1, x: ppBall.x, y: ppBall.y, R: ppBall.R, rot: 0, spin: ppBall.spin });
      ppHoldRaf = requestAnimationFrame(tick);
    };
    ppHoldRaf = requestAnimationFrame(tick);
  }
  const ppBallR = () => (parseFloat(getComputedStyle(root).getPropertyValue("--ball")) || 220) * 0.4; // بحجم كرة الجريدة
  const ppBallAt = () => ppLocal(centerOf(ballBox));
  function ppDone() {
    cancelAnimationFrame(ppHoldRaf);
    ppBall = null;
    scene?.hide();
    for (const p of ["visibility", "opacity", "transform", "transition"]) ballBox.style.removeProperty(p);
  }
  // القصاصة الحالية تُكرمش باليد كرةً في مكان الكرة
  async function ppCrumple(c) {
    const snap = await ppSnapshot(c.clip, c.torn);
    scene.setPaper(snap, ppBack(c.clip), true);
    const rot0 = ppRot(c.clip.parentElement);
    const R = ppBallR();
    c.clip.style.visibility = "hidden";
    scene.show();
    let to = [0, 0];
    await ppRun(680, (p) => {
      const from = ppLocal(centerOf(c.clip)); // كل إطار: يتبع المسرح إن تغيّر المقاس
      to = [from[0] + c.dx, from[1] + c.dy];
      const k = ppSqueeze(p);
      const m = ppEase(Math.min(1, p * 1.15));
      scene.draw({ k, x: from[0] + (to[0] - from[0]) * m, y: from[1] + (to[1] - from[1]) * m, R, rot: rot0 * (1 - m), spin: 0.7 * p });
    });
    ppBall = { x: to[0], y: to[1], R, spin: 0.7 };
  }
  // الكرة تُفرد القصاصة الجديدة: من مكان الكرة إلى مكان القصاصة
  async function ppUnfold(clip, torn) {
    const snap = await ppSnapshot(clip, torn);
    const fresh = !ppBall;
    if (fresh) {
      const [x, y] = ppBallAt();
      ppBall = { x, y, R: ppBallR(), spin: 0 };
    }
    scene.setPaper(snap, ppBack(clip), !fresh);
    cancelAnimationFrame(ppHoldRaf);
    ballBox.style.visibility = "hidden";
    scene.show();
    const rot1 = ppRot(clip.parentElement);
    const b = ppBall;
    await ppRun(900, (p) => {
      const to = ppLocal(centerOf(clip));
      const k = (1 - p) ** 2.2;
      const m = ppEase(Math.min(1, p * 1.1));
      scene.draw({ k, x: b.x + (to[0] - b.x) * m, y: b.y + (to[1] - b.y) * m, R: b.R, rot: rot1 * m, spin: b.spin });
    });
    clip.style.visibility = "";
    ppDone();
  }
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
    if (s === "moon" || s === "wheel") ppDone();
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
    sfx("wheelOpen");
    petals.forEach((b) => b.classList.remove("sel"));
    setStep("wheel");
    setPrompt("picker_q2", "picker_s2");
    moon.setAttribute("aria-expanded", "true");
    moon.setAttribute("aria-label", t("picker_close"));
    (petals.find((b) => b.dataset.section === section) || petals[0]).focus({ preventScroll: true });
  }
  function closeWheel() {
    sfx("wheelClose");
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
    if (ppBall) {
      ballBox.style.visibility = "hidden";
      ppHold();
    }
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
    if (ppGet()) {
      clip.style.visibility = "hidden";
      // كرة الجريدة تبقى ظاهرة حتى تحلّ الورقة محلها (لا فراغ أثناء التصوير)
      Object.assign(ballBox.style, { transition: "none", opacity: "1", transform: "none" });
      ppUnfold(clip, torn)
        .then(done)
        .catch(() => {
          clip.style.visibility = "";
          ppDone();
          crumpleFrames(current, false).onfinish = done;
        });
      return;
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
      if (ppGet()) {
        const c = current;
        ppCrumple(c)
          .then(go)
          .catch(() => {
            c.clip.style.visibility = "";
            ppDone();
            crumpleFrames(c, true).onfinish = go;
          });
        return;
      }
      const anim = crumpleFrames(current, true);
      anim.onfinish = go;
    } else go();
  }
  function again() {
    if (busy) return;
    sfx("again");
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
      sfx("petal");
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
