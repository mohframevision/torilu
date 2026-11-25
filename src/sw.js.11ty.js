// عامل الخدمة — يُولَّد وقت البناء عشان يُحقن فيه رقم النسخة (buildVersion).
// كان ملفاً ثابتاً يُنسخ كما هو، لكن التخزين يحتاج اسم كاش مربوطاً بالنسخة
// وإلا بقيت ملفات النسخة القديمة عند المستخدم بعد كل نشر.
exports.data = {
  permalink: "sw.js",
  eleventyExcludeFromCollections: true,
};

const crypto = require("crypto");

exports.render = function (data) {
  const v = (f) => JSON.stringify(data.assetV[f]);
  // اسم الكاش من بصمة قائمة الملفات (روابطها بنسخها): يتغيّر فقط لما يتغيّر ملف منها،
  // فلا يُحذف كاش الزائر (صفحات وصور تصفّحها) مع كل نشر لا يمسّ هذه الملفات
  const body = `
const PRECACHE = [
  BASE,
  BASE + "index.html",
  BASE + "en/index.html",
  OFFLINE_AR,
  OFFLINE_EN,
  // نفس روابط base.njk حرفياً (مع ?v=النسخة): هكذا تتطابق بالكاش بلا تجاهل للمعاملات
  // ملفات ثابتة: نسختها بصمة محتواها (src/_data/assetV.js)؛ المولَّدة (theme.css وdata.js) بنسخة البناء
  BASE + "css/style.css?v=" + ${v("css/style.css")},
  BASE + "theme.css?v=" + VERSION,
  // الأربعة مطلوبة لعرض أي صفحة: بلا data.js تطلع الصفحة بلا بطاقات
  BASE + "js/theme-init.js?v=" + ${v("js/theme-init.js")},
  BASE + "js/bootstrap.js?v=" + ${v("js/bootstrap.js")},
  BASE + "js/data.js?v=" + VERSION,
  BASE + "js/sfx.js?v=" + ${v("js/sfx.js")},
  BASE + "js/main.js?v=" + ${v("js/main.js")},
  // الرئيسية تحتاج home.js لتملأ صفوفها، وخط Amiri لشعار وعناوين شكل «د»
  BASE + "js/home.js?v=" + ${v("js/home.js")},
  // أيقونات الواجهة كلها في ملف واحد (src/_data/icons.js)
  ${JSON.stringify(data.icons.href)},
  BASE + "assets/fonts/cairo-arabic.woff2",
  BASE + "assets/fonts/cairo-latin.woff2",
  BASE + "assets/fonts/amiri-arabic.woff2",
  BASE + "assets/fonts/amiri-latin.woff2",
];
`;
  const cacheId = crypto.createHash("sha1").update(body).digest("hex").slice(0, 10);
  return `/* مولَّد وقت البناء — لا تعدّله هنا، عدّل src/sw.js.11ty.js */
const VERSION = ${JSON.stringify(String(data.buildVersion))};
const CACHE = "torilu-${cacheId}";
// النسخة الحالية لكل ملف CSS/JS ثابت؛ ما ليس هنا (data.js وtheme.css وmenus.js) نسخته VERSION
const ASSET_V = ${JSON.stringify(Object.fromEntries(Object.entries(data.assetV).map(([k, x]) => ["/" + k, x])))};
const BASE = "/";
const OFFLINE_AR = BASE + "offline.html";
const OFFLINE_EN = BASE + "en/offline.html";

/* الحد الأدنى فقط: صفحتا "بلا اتصال" والواجهة الأساسية. ما نخزّن كل صفحات
   الموقع مسبقاً — تسعون صفحة تعني تنزيلاً ثقيلاً على أول زيارة، ومحتوى
   يقدم بسرعة. الباقي يُخزَّن أثناء التصفح فعلياً */
/* الرئيسية مضمّنة عمداً: عامل الخدمة لا يتحكّم بأول صفحة يفتحها الزائر
   (يُثبَّت أثناءها) فلا تُخزَّن، والرئيسية أكثر صفحة يُرجع لها بلا اتصال */
${body}
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll تفشل كلها لو فشل ملف واحد — نخزّن كلاً على حدة عشان ملف
      // واحد ناقص ما يمنع التثبيت بالكامل
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(purgeOldVersions)
      .then(() => self.clients.claim())
  );
});

/* الكاش يبقى بين عمليات النشر، فنحذف منه النسخ القديمة من الملفات ذات ?v= كي لا تتراكم.
   ونحذف معها الصفحات المخزّنة أثناء التصفح: تشير إلى ?v= القديمة المحذوفة، فلو عُرضت بلا اتصال
   طلعت بلا بطاقات أو بلا تنسيق؛ صفحة «بلا اتصال» أفضل منها. صفحات PRECACHE جُدّدت للتو في install */
async function purgeOldVersions() {
  const cache = await caches.open(CACHE);
  const keep = new Set(PRECACHE.map((p) => new URL(p, self.location.origin).href));
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    const v = u.searchParams.get("v");
    const page = u.pathname.endsWith(".html") || u.pathname.endsWith("/");
    if (page ? !keep.has(u.href) : v && v !== (ASSET_V[u.pathname] || VERSION) && !u.pathname.startsWith("/assets/")) await cache.delete(req);
  }
}

async function networkFirst(request, offlineUrl) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    // ignoreSearch: الصفحات تُطلب أحياناً بمعاملات بحث (?q=...) ونفس
    // الصفحة المخزّنة تفي بالغرض بلا اتصال
    const cached = await cache.match(request, { ignoreSearch: true });
    return cached || (await cache.match(offlineUrl)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  /* ملف بنسخة (?v=…) يُطابق حرفياً: تجاهل المعاملات كان يرجّع CSS/JS النسخة
     القديمة مع HTML النشر الجديد، فأول صفحتين بعد كل نشر تطلعان بتنسيق قديم
     أو سكربت لا يطابق الصفحة. الملفات بلا نسخة (صور، خطوط) تبقى كما كانت */
  const versioned = new URL(request.url).searchParams.has("v");
  const cached = await cache.match(request, { ignoreSearch: !versioned });
  const fetching = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await fetching) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // خارج نطاقنا (خطوط جوجل، خادم الإعجابات، الإعلانات): بلا تدخّل
  if (url.origin !== self.location.origin) return;
  // ملف فحص التحديث لازم يبقى طازجاً دائماً وإلا ما عرفنا إن فيه نسخة جديدة
  if (url.pathname.endsWith("/version.json")) return;
  // لوحة التحكم تتطلب شبكة وجلسة، ولا معنى لتخزينها
  if (url.pathname.includes("/admin/")) return;

  if (request.mode === "navigate") {
    const offlineUrl = url.pathname.startsWith(BASE + "en/") ? OFFLINE_EN : OFFLINE_AR;
    event.respondWith(networkFirst(request, offlineUrl));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

`;
};
