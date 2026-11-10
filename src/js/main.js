/* ===== دعم اللغتين (عربي/إنجليزي) — window.SITE_LANG وwindow.I18N يُضبطان من
   base.njk. t() يرجع نص الواجهة المناسب، itemTitle/itemDesc يرجعان الترجمة
   الإنجليزية للعنصر لو متوفرة، وإلا يرجعان النص العربي (تدهور تدريجي — عنصر
   ما تُرجم بعد يبقى يظهر بالعربي حتى بصفحة إنجليزية، بدل ما يختفي) ===== */
function t(key) {
  const lang = window.SITE_LANG || "ar";
  return (window.I18N && window.I18N[lang] && window.I18N[lang][key]) || key;
}

function itemTitle(item) {
  return window.SITE_LANG === "en" && item.title_en ? item.title_en : item.title;
}

function itemDesc(item) {
  return window.SITE_LANG === "en" && item.desc_en ? item.desc_en : item.desc || "";
}

function itemHours(item) {
  return window.SITE_LANG === "en" && item.hours_en ? item.hours_en : item.hours || "";
}

// قاموس ترجمة التصنيفات يجي من ملف data.js (متغيّر TAGS_EN)، ومصدره
// الأصلي src/_data/tags_en.js — نفسه اللي تستخدمه القوالب وقت البناء.

function tagLabel(tag) {
  if (window.SITE_LANG === "en") return (typeof TAGS_EN !== "undefined" && TAGS_EN[tag]) || tag;
  return tag;
}

function tagIcon(tag) {
  return (typeof TAG_ICONS !== "undefined" && TAG_ICONS[tag]) || "";
}

// اسم القسم بلغة الصفحة الحالية — يقرأ title_en المولّد ببناء data.js من
// sections/*.md مباشرة (مو قاموس ثابت هنا)، فقسم جديد يُضاف من لوحة التحكم
// يظهر باسمه الإنجليزي تلقائياً بدون تعديل هذا الملف
function sectionLabel(section) {
  const meta = SITE_DATA[section];
  if (!meta) return section;
  return window.SITE_LANG === "en" ? meta.title_en || meta.title : meta.title;
}

/* ===== تخزين آمن: Safari بوضع "منع كل الكوكيز" وبعض أوضاع الخصوصية ترمي استثناء
   بمجرد لمس localStorage. بدون هذا الغلاف كان الاستثناء يوقف تهيئة الموقع كلها
   (القائمة ما تنفتح، والرئيسية بلا بطاقات). القراءة الفاشلة = null، والكتابة
   الفاشلة (محجوب أو ممتلئ) تُتجاهل بصمت فيكمل الموقع بلا حفظ. ===== */
function storageCall(area, method, ...args) {
  try {
    return window[area][method](...args);
  } catch {
    return null;
  }
}
const lsGet = (key) => storageCall("localStorage", "getItem", key);
// الكتابة ترجّع true لو نجحت فعلاً — حاسبة المصروفات تنبّه المستخدم لو بياناته ما انحفظت
const lsSet = (key, value) => storageCall("localStorage", "setItem", key, value) !== null;

// أصوات الموقع (js/sfx.js، صامتة إلا لو فعّلها الزائر بزر السمّاعة)
const sfx = (name) => window.toriluSfx && window.toriluSfx.play(name);
const lsRemove = (key) => storageCall("localStorage", "removeItem", key);
const ssGet = (key) => storageCall("sessionStorage", "getItem", key);
const ssSet = (key, value) => storageCall("sessionStorage", "setItem", key, value) !== null;

// نص من بيانات المحتوى داخل HTML مبني كسلسلة: علامة " بعنوان (موجودة فعلاً بعناوين
// بعض الأدلة) كانت تقطع سمة alt وتكسر وسم الصورة
function escapeHtml(text) {
  return String(text ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
// رابط من البيانات داخل href: بروتوكولات معروفة فقط
const safeUrl = (u) => (/^(https?:|tel:|mailto:|\/)/i.test(String(u ?? "")) ? escapeHtml(u) : "#");

/* ===== بحث ذكي متسامح مع الأخطاء الإملائية ===== */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      currRow[j] =
        a[i - 1] === b[j - 1]
          ? prevRow[j - 1]
          : 1 + Math.min(prevRow[j], currRow[j - 1], prevRow[j - 1]);
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

/* توحيد النص للبحث (فلتر القسم وصفحة البحث search.js معاً): أشكال الألف والتاء المربوطة والياء
   والتشكيل والتطويل، چ گ ← ج ق، الأرقام العربية والفارسية ← 0-9، والنقطة تبقى بين رقمين فقط
   (سعر 1.800)، و«ال» بأول الكلمة («الشعلة» = «شعلة») */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function searchNorm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // التشكيل والتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/چ/g, "ج")
    .replace(/گ/g, "ق")
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d))
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^(و?ال)(?=\S{2,})/, ""))
    .join(" ");
}

// كلمات عامة قبل الاسم الحقيقي: «مطعم المحور» يُبحث عنه بـ«المحور»
const SEARCH_GENERIC = new Set(
  ["مطعم", "مطاعم", "مقهي", "مقهى", "كافيه", "كافي", "كوفي", "مخبز", "مخابز", "محل", "محلات", "مطبخ", "فرع", "restaurant", "cafe", "coffee", "bakery", "kitchen", "the", "branch"].map((w) => searchNorm(w))
);

/* مدى تطابق العنصر مع البحث (٠ = ما يطابق): الاسم أولاً، وبالذات بدايته بعد الكلمات
   العامة، ثم الكلمات الكاملة، ثم التصنيفات والوصف، ثم الأخطاء الإملائية آخر شي */
function searchScore(item, query) {
  const q = searchNorm(query);
  if (!q) return 1;
  const title = searchNorm(`${item.title || ""} ${item.title_en || ""}`);
  const names = [item.title, item.title_en].map((tt) => searchNorm(tt).split(" ").filter((w) => !SEARCH_GENERIC.has(w)).join(" "));
  const words = title.split(" ");
  const qWords = q.split(" ").filter((w) => !SEARCH_GENERIC.has(w));
  const core = qWords.join(" ") || q;
  if (names.some((n) => n === core)) return 100;
  if (names.some((n) => n.startsWith(core))) return 90;
  if (qWords.length && qWords.every((w) => words.includes(w))) return 80;
  if (qWords.length && qWords.every((w) => words.some((tw) => tw.startsWith(w)))) return 70;
  if (title.includes(q)) return 60;
  const rest = searchNorm(
    [item.desc, item.desc_en, item.keywords, ...(item.tags || []).flatMap((tag) => [tag, tagLabel(tag)])]
      .filter(Boolean)
      .join(" ")
  );
  const restWords = rest.split(" ");
  if (qWords.length && qWords.every((w) => restWords.includes(w))) return 40;
  if (rest.includes(q)) return 30;
  return fuzzyIncludes(`${title} ${rest}`, q) ? 10 : 0;
}

function fuzzyIncludes(haystack, query) {
  const hay = (haystack || "").toLowerCase();
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  if (hay.includes(q)) return true;

  const hayWords = hay.split(/\s+/).filter(Boolean);
  const qWords = q.split(/\s+/).filter(Boolean);

  return qWords.every((qw) => {
    if (qw.length < 2) return hay.includes(qw);
    const maxDist = qw.length <= 4 ? 1 : 2;
    return hayWords.some((hw) => hw.includes(qw) || levenshtein(hw, qw) <= maxDist);
  });
}

/* ===== قائمة اقتراحات تظهر أثناء الكتابة بصندوق البحث ===== */
function initSearchSuggestions(searchInput, items, onSelect) {
  if (!searchInput) return;

  let wrap = searchInput.closest(".search-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "search-wrap";
    searchInput.parentNode.insertBefore(wrap, searchInput);
    wrap.appendChild(searchInput);
  }

  let dropdown = wrap.querySelector(".search-suggestions");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.className = "search-suggestions";
    wrap.appendChild(dropdown);
  }

  function close() {
    dropdown.classList.remove("open");
    dropdown.innerHTML = "";
  }

  function renderSuggestions() {
    const query = searchInput.value.trim();
    if (!query) {
      close();
      return;
    }

    const matches = items
      .map((item) => ({ item, score: searchScore({ title: item.title, title_en: item.title_en }, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((r) => r.item);

    if (matches.length === 0) {
      close();
      return;
    }

    dropdown.innerHTML = matches
      .map(
        (item) =>
          `<div class="search-suggestion" data-id="${escapeHtml(item.id)}">
            <span>${escapeHtml(itemTitle(item))}</span>
          </div>`
      )
      .join("");
    dropdown.classList.add("open");

    dropdown.querySelectorAll(".search-suggestion").forEach((el, i) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        searchInput.value = itemTitle(matches[i]);
        close();
        onSelect();
      });
    });
  }

  searchInput.addEventListener("input", renderSuggestions);
  searchInput.addEventListener("focus", renderSuggestions);
  searchInput.addEventListener("blur", close);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

/* ===== نموذج تواصل معنا (Web3Forms) ===== */
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  // تعبئة تلقائية لو الزائر جا من زر "🚩 إبلاغ عن خطأ" بأي بطاقة عنصر
  // (رابط بصيغة contact.html?report=اسم-العنصر&section=قسم)
  const params = new URLSearchParams(location.search);
  // ‎?owner=correct|remove‎ من زرّي «محلك في توريلو؟» بصفحة business (مع ‎?report=‎ إن جاء من صفحة مكان)،
  // و‎?owner=menu&items=60&v=both&photos=1‎ من حاسبة «كم يكلّف منيو محلك؟» (js/menu-price.js)
  const reportItem = params.get("report");
  const owner = ["correct", "remove", "menu"].includes(params.get("owner")) ? params.get("owner") : "";
  if (reportItem || owner) {
    const typeSelect = form.querySelector('[name="request_type"]');
    const messageField = form.querySelector('[name="message"]');
    if (typeSelect) typeSelect.value = t(owner ? `contact_owner_${owner}` : "contact_report_option");
    if (messageField) {
      const section = params.get("section") || "";
      const sectionSuffix = section ? ` (${t("contact_report_section_label")}: ${sectionLabel(section)})` : "";
      const about = reportItem ? `${reportItem}${sectionSuffix}` : "";
      const [vNames, yesNo] = [t("contact_menu_versions").split("|"), t("contact_menu_yesno").split("|")];
      const menuDetails = t("contact_menu_details")
        .replace("{items}", Math.min(Math.max(parseInt(params.get("items"), 10) || 1, 1), 999))
        .replace("{v}", vNames[["digital", "print", "both"].indexOf(params.get("v"))] || vNames[0])
        .replace("{photos}", yesNo[params.get("photos") === "1" ? 0 : 1]);
      messageField.value = owner === "menu"
        ? `${t("contact_owner_menu")}\n${menuDetails}\n${t("contact_owner_place_label")}: `
        : owner
        ? `${t(`contact_owner_${owner}`)}\n${t("contact_owner_place_label")}: ${about}\n\n${owner === "correct" ? `${t("contact_owner_correct_label")}: ` : ""}`
        : `${t("contact_report_regarding")}: ${about}\n\n${t("contact_report_wrong_info_label")}: `;
      messageField.focus();
    }
    if (owner === "remove") document.getElementById("ownerRemoveNote")?.removeAttribute("hidden");
  }

  const formMessage = document.getElementById("formMessage");
  const submitBtn = document.getElementById("submitBtn");
  const btnText = document.getElementById("btnText");
  const btnLoading = document.getElementById("btnLoading");

  function showMessage(type, text) {
    if (!formMessage) return;
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = "block";
    formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function validate() {
    const name = form.querySelector('[name="name"]');
    const email = form.querySelector('[name="email"]');
    const message = form.querySelector('[name="message"]');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (name && name.value.trim().length < 2) {
      showMessage("error", t("contact_err_name"));
      name.focus();
      return false;
    }
    if (email && !emailRegex.test(email.value.trim())) {
      showMessage("error", t("contact_err_email"));
      email.focus();
      return false;
    }
    if (message && message.value.trim().length < 5) {
      showMessage("error", t("contact_err_message"));
      message.focus();
      return false;
    }
    return true;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validate()) return;

    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.style.display = "none";
    if (btnLoading) btnLoading.style.display = "inline";
    if (formMessage) formMessage.style.display = "none";

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: new FormData(form),
      });
      const result = await res.json();

      if (result.success) {
        showMessage("success", t("contact_success"));
        form.reset();
      } else {
        showMessage("error", t("contact_err_submit"));
      }
    } catch {
      showMessage("error", t("contact_err_network"));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.style.display = "inline";
      if (btnLoading) btnLoading.style.display = "none";
    }
  });
}

/* ===== أيقونات الواجهة: كلها في ملف واحد assets/icons.svg (مصدره src/_data/icons.js)، ونفس
   الرمز الذي يكتبه icon.njk في القوالب. fill="currentColor" يخلّيها تتبع لون الزر ===== */
function svgIcon(name, size = 20) {
  return `<svg width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><use href="${window.ICONS_URL}#${name}"/></svg>`;
}

const TOGGLE_ICON_SVG = { light: svgIcon("light-mode"), dark: svgIcon("dark-mode"), auto: svgIcon("brightness-auto") };

const ICON_SVG = {
  heart: svgIcon("heart"),
  "heart-fill": svgIcon("heart-fill"),
  ...Object.fromEntries(["share", "schedule", "location-pin", "language", "call", "photo-camera", "menu-book"].map((n) => [n, svgIcon(n, 16)])),
};

/* ===== تبديل المظهر: تلقائي (يتبع النظام) / فاتح / داكن ===== */
function initThemeToggle() {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;

  const KEY = "site_theme_pref";
  const ICONS = {
    auto: TOGGLE_ICON_SVG.auto,
    light: TOGGLE_ICON_SVG.light,
    dark: TOGGLE_ICON_SVG.dark,
  };
  const NEXT = { auto: "light", light: "dark", dark: "auto" };

  function getPref() {
    const stored = lsGet(KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  }

  function apply(pref) {
    if (pref === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", pref);
    }
    // أيقونة فقط داخل الزر (الزر مربّع بالهيدر) والشرح النصي بالـ title/aria
    btn.innerHTML = ICONS[pref];
    const label = `${t("theme_current_label")}: ${t(`theme_label_${pref}`)} — ${t("theme_click_to_toggle")}`;
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }

  apply(getPref());

  // المظهر الفعلي (التلقائي يتبع النظام): إن لم يتغيّر اللون فلا انتقال يجمّد الصفحة بلا سبب
  const isDark = (pref) => (pref === "auto" ? window.matchMedia("(prefers-color-scheme: dark)").matches : pref === "dark");

  btn.addEventListener("click", () => {
    const cur = getPref();
    const next = NEXT[cur];
    if (next === "auto") {
      lsRemove(KEY);
    } else {
      lsSet(KEY, next);
    }
    sfx("theme");
    // المظهر الجديد يظهر كشبكة نقاط طباعة تكبر حتى تلتحم (style.css: theme-vt). تحسين تدريجي:
    // بلا الواجهة أو مع تقليل الحركة يتبدّل فوراً كما كان
    const root = document.documentElement;
    if (!document.startViewTransition || isDark(cur) === isDark(next) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(next);
      return;
    }
    root.classList.add("theme-vt");
    document.startViewTransition(() => apply(next)).finished.finally(() => root.classList.remove("theme-vt"));
  });
}

/* ===== قائمة الجوال ===== */
function initNavToggle() {
  const toggles = document.querySelectorAll(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (!toggles.length || !nav) return;
  function setOpen(isOpen) {
    sfx(isOpen ? "open" : "close");
    nav.classList.toggle("open", isOpen);
    toggles.forEach((btn) => {
      btn.classList.toggle("open", isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.setAttribute("aria-label", isOpen ? t("nav_toggle_close") : t("nav_toggle_open"));
    });
  }
  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  });
  // Escape يغلق القائمة كما يغلق نافذة المنيو وكشف «اختار لي»، ويعيد التركيز للزر
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !nav.classList.contains("open")) return;
    setOpen(false);
    const visible = [...toggles].find((btn) => btn.offsetParent !== null) || toggles[0];
    visible.focus();
  });
}

/* ===== ظل الهيدر عند التمرير ===== */
/* فلترة بطاقات الأقسام بالرئيسية بين "أماكن" و"أدوات ومحتوى".
   بطاقة المفضلة بلا data-group فتبقى ظاهرة دائماً — هي أداة للاثنين معاً */
function initSectionFilter() {
  const filter = document.getElementById("sectionFilter");
  const grid = document.getElementById("sectionGrid");
  if (!filter || !grid) return;

  filter.addEventListener("click", (event) => {
    const btn = event.target.closest(".section-filter-btn");
    if (!btn) return;
    sfx("tap");
    const group = btn.dataset.group;
    filter
      .querySelectorAll(".section-filter-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    grid.querySelectorAll(".section-card").forEach((card) => {
      const cardGroup = card.dataset.group;
      card.hidden = Boolean(cardGroup) && group !== "all" && cardGroup !== group;
    });
  });
}

/* زر "ثبّت التطبيق" — المتصفح يطلق beforeinstallprompt فقط لو الموقع مستوفٍ
   شروط التثبيت وغير مثبَّت أصلاً. نخزّن الحدث ونظهر الزر عنده فقط: زر ظاهر
   لا يعمل (بمتصفح لا يدعم، أو والتطبيق مثبَّت) أسوأ من غيابه */
function initInstallPrompt() {
  const btn = document.getElementById("installBtn");
  if (!btn) return;
  let deferred = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    btn.hidden = false;
  });

  btn.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // الحدث يُستهلك بعد أول عرض ولا يُعاد استخدامه
    deferred = null;
    if (outcome === "accepted") btn.hidden = true;
  });

  // ثُبِّت من داخل الصفحة أو من قائمة المتصفح — ما عاد للزر معنى
  window.addEventListener("appinstalled", () => {
    deferred = null;
    btn.hidden = true;
  });
}

function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ارتفاع الهيدر الفعلي → متغيّر CSS يستخدمه صندوق البحث اللاصق. يتغيّر
  // بتغيّر عرض الشاشة (القائمة تلتف لسطرين)، فنعيد قياسه مع كل تغيير حجم
  const setHeaderHeight = () =>
    document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
  setHeaderHeight();
  window.addEventListener("resize", setHeaderHeight, { passive: true });

  /* القائمة تنزلق أفقياً لو فاضت، لكن الانزلاق بلا إشارة يبان "قصّاً" —
     وهذا اللي صار لما وصلت الأقسام لعشرة. نعلّمها لتتلاشى أطرافها فيفهم
     المستخدم إن فيه بقية. يشتغل تلقائياً مع أي قسم يُضاف مستقبلاً */
  const nav = header.querySelector(".main-nav");
  if (nav) {
    const syncNavOverflow = () =>
      nav.classList.toggle("is-scrollable", nav.scrollWidth > nav.clientWidth + 1);
    syncNavOverflow();
    window.addEventListener("resize", syncNavOverflow, { passive: true });
  }
}

/* ===== تحديث تلقائي: يكتشف نسخة جديدة من الموقع ويعيد التحميل بدون تدخل المستخدم =====
   المشكلة: المتصفح يخزّن الصفحة/الملفات مؤقتاً (Cache)، فلو كان تبويب الموقع مفتوح
   عند المستخدم ونشرنا تحديث، ما يشوفه إلا بعد تحديث يدوي. هذا يتحقق من version.json
   بدون كاش، ولو تغيّرت النسخة عن آخر مرة شافها هالتبويب، يعيد التحميل تلقائياً. */
function initAutoUpdateCheck() {
  const SEEN_KEY = "site_seen_version";
  // نسخة جديدة اكتُشفت والزائر يستخدم الصفحة: ما نعيد التحميل تحت يده (كان يمسح
  // نص نموذج التواصل، واختبار الكتابة، وتسجيلاً جارياً بالصوتيات). ننتظر لين
  // يترك التبويب، فيلقى النسخة الجديدة لما يرجع بلا ما يحس بشي
  let pending = false;
  const hasTypedText = () =>
    [
      ...document.querySelectorAll(
        "textarea, input[type=text], input[type=email], input[type=tel], input[type=number], input:not([type])"
      ),
    ].some((el) => el.value && el.value !== el.defaultValue);
  // .recording = تسجيل جارٍ باستوديو الصوتيات (يستمر والتبويب بالخلفية)
  function reloadWhenSafe() {
    if (
      pending &&
      document.visibilityState === "hidden" &&
      !hasTypedText() &&
      !document.querySelector(".recording")
    )
      location.reload();
  }

  async function checkVersion() {
    try {
      // مسار مطلق: الرابط النسبي كان ينحل على مجلد الصفحة، فيصير
      // /ai-experiments/version.json ويرجع 404 بكل صفحات التفاصيل
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const seen = ssGet(SEEN_KEY);
      if (seen && data.version && seen !== data.version) {
        ssSet(SEEN_KEY, data.version);
        pending = true;
        reloadWhenSafe();
        return;
      }
      if (data.version) ssSet(SEEN_KEY, data.version);
    } catch {
      /* تجاهل أي خطأ شبكة، نحاول مرة ثانية بالفحص القادم */
    }
  }

  // بلا اتصال لا نطلب version.json (كل طلب يفشل ويملأ الـconsole بأخطاء)؛
  // نفحص حين يعود الاتصال
  const checkIfOnline = () => navigator.onLine && checkVersion();
  checkIfOnline();
  setInterval(checkIfOnline, 5 * 60 * 1000);
  window.addEventListener("online", checkVersion);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkIfOnline();
    else reloadWhenSafe();
  });
}

/* ===== المفضلة (تُحفظ محلياً في المتصفح عبر localStorage - لا تحتاج تسجيل دخول) ===== */
const FAVORITES_KEY = "site_favorites_v1";

function getFavorites() {
  try {
    return JSON.parse(lsGet(FAVORITES_KEY)) || {};
  } catch {
    return {};
  }
}

function saveFavorites(favs) {
  lsSet(FAVORITES_KEY, JSON.stringify(favs));
}

function isFavorite(section, id) {
  const favs = getFavorites();
  return Boolean(favs[section] && favs[section][id]);
}

function toggleFavorite(section, id) {
  const favs = getFavorites();
  if (!favs[section]) favs[section] = {};
  if (favs[section][id]) {
    delete favs[section][id];
  } else {
    favs[section][id] = true;
  }
  saveFavorites(favs);
  return isFavorite(section, id);
}

/* ===== أزرار الروابط (يدعم رابط واحد قديم item.url أو عدة روابط item.links) ===== */
const LINK_META = {
  website: { icon: ICON_SVG.language, labelKey: "link_website" },
  phone: { icon: ICON_SVG.call, labelKey: "link_phone" },
  maps: { icon: ICON_SVG["location-pin"], labelKey: "link_maps" },
  instagram: { icon: ICON_SVG["photo-camera"], labelKey: "link_instagram" },
  menu: { icon: ICON_SVG["menu-book"], labelKey: "link_menu" },
};

// ترتيب ثابت للأزرار بغض النظر عن ترتيب الحقول باللوحة. الخريطة أولاً وهي الزر
// الأزرق الوحيد (موجودة لكل مكان تقريباً، فيبقى الزر نفسه بكل بطاقة بالشبكة،
// ومثل صفحة المكان: الهدف أن يروح له). بعدها رابطان ثانويان كحد أقصى
const LINK_ORDER = ["maps", "phone", "website", "instagram", "menu"];
const MAX_SECONDARY_ACTIONS = 2;

/* ===== ترتيب "قريب مني" حسب المسافة ===== */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  return km < 1
    ? `${Math.round(km * 1000)} ${t("unit_meters")}`
    : `${km.toFixed(1)} ${t("unit_km")}`;
}

/*
  أقرب فرع للزائر. العنصر متعدد الفروع (مثل سلسلة مطاعم) يحمل مصفوفة
  branches، فنحسب المسافة لكل فرع ونرجّع الأقرب — بدل ما نقيس لفرع واحد
  ثابت فيطلع ترتيب "قريب مني" مضلّلاً. العنصر بفرع واحد يستخدم lat/lng.
  يرجّع null لو ما عنده أي موقع.
*/
function nearestBranch(item, userCoords) {
  const points =
    Array.isArray(item.branches) && item.branches.length
      ? item.branches
      : item.lat != null && item.lng != null
        ? [{ label: "", lat: item.lat, lng: item.lng }]
        : [];
  if (!points.length) return null;

  let best = null;
  for (const p of points) {
    const km = haversineKm(userCoords.lat, userCoords.lng, p.lat, p.lng);
    if (!best || km < best.km) best = { km, label: p.label || "" };
  }
  return best;
}

/* ===== مشاركة عبر واتساب ===== */
const SITE_ORIGIN = "https://torilu.com/";
const SITE_ROOT_PATH = "/";

function initArticleShare() {
  // نسخ الجريدة المطوية (fold.js) تسبق الأصل بالصفحة، فنتخطاها
  const btn = document.querySelector(".article-share-btn:not(.np-fold *)");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const text = `${document.title}\n${location.href}`;
    // العنوان بالصفحة مكتوب "أيقونة + عنوان" بنص واحد (h1) — نفصل الإيموجي
    // الأول عن باقي النص عشان نرسمهم منفصلين بصورة الستوري
    const heading =
      document.querySelector(".page-header h1")?.textContent?.trim() || document.title;
    const match = heading.match(/^(\p{Extended_Pictographic}(?:️)?)\s*/u);
    const icon = match ? match[1] : "🧭";
    const title = match ? heading.slice(match[0].length).trim() : heading;
    shareText(text, { section: (window.PAGE || {}).section || "" }, { icon, title });
  });
}

// زر المفضلة بصفحة المكان: نفس مفتاح بطاقات القسم (القسم + اسم الملف). نسخة الجريدة
// المطوية (fold.js) تُنسخ قبل هذا، فنحدّث كل النسخ ونربط الحقيقية فقط
function initPlaceFav() {
  const btn = document.querySelector(".place-fav-btn:not(.np-fold *)");
  if (!btn) return;
  const { section, slug: id } = btn.dataset;
  const paint = (fav) =>
    document.querySelectorAll(".place-fav-btn").forEach((b) => {
      const label = fav ? t("fav_remove") : t("fav_add");
      b.classList.toggle("active", fav);
      b.innerHTML = fav ? ICON_SVG["heart-fill"] : ICON_SVG.heart;
      b.title = label;
      b.setAttribute("aria-label", label);
      b.setAttribute("aria-pressed", String(fav));
    });
  paint(isFavorite(section, id));
  btn.addEventListener("click", () => {
    const nowFav = toggleFavorite(section, id);
    sfx(nowFav ? "favOn" : "favOff");
    paint(nowFav);
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
  });
}

function initArticleListen() {
  const btn = document.querySelector(".article-listen-btn:not(.np-fold *)");
  const player = document.querySelector(".article-audio-player:not(.np-fold *)");
  if (!btn || !player) return;
  btn.addEventListener("click", () => {
    // يتحمّل الملف بأول ضغطة بس (preload="none" بالقالب) — ما يحمّل صوت
    // كل مقال لزائر ما بيسمعه أصلاً
    if (!player.src) player.src = btn.dataset.audioSrc;
    player.classList.remove("hidden");
    if (player.paused) player.play();
    else player.pause();
  });
}

function buildShareUrl(section, item) {
  const isEn = window.SITE_LANG === "en";
  const prefix = isEn ? "en/" : "";
  const relPath =
    isEn && item.detailUrlEn
      ? item.detailUrlEn
      : item.detailUrl || `${section}.html?q=${encodeURIComponent(itemTitle(item))}`;
  return SITE_ORIGIN + prefix + relPath;
}

function buildShareText(section, item) {
  const url = buildShareUrl(section, item);
  return `${itemTitle(item)} ${t("share_suffix")}\n${url}`;
}

/* ===== توليد صورة "ستوري" (1080×1920) من بيانات البطاقة — تُستخدم مع
   navigator.share({files}) بدل نص فقط، لأن قصص إنستقرام تحتاج صورة لا رابطاً
   (ما فيه رابط مباشر "أضف لستوري" يُفتح من متصفح ويب — فقط من تطبيقات
   أصلية). نرسمها من الصفر بألوان الموقع الحالية (لا نصوّر البطاقة نفسها)
   لأن مقاس البطاقة عرضي وما يناسب المقاس الطولي للستوري. */
function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// تفاف نص تلقائي عند حافة العرض المتاح — يرجّع إحداثي Y بعد آخر سطر
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
      lines++;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

async function buildStoryImage({ icon, title, subtitle, photo }) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const rootStyles = getComputedStyle(document.documentElement);
  const primary = rootStyles.getPropertyValue("--color-primary").trim() || "#1b4d3e";
  const primaryDark = rootStyles.getPropertyValue("--color-primary-dark").trim() || primary;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, primary);
  bg.addColorStop(1, primaryDark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const isRtl = window.SITE_LANG !== "en";
  ctx.direction = isRtl ? "rtl" : "ltr";
  ctx.textAlign = "center";

  if (document.fonts?.ready) {
    try {
      await document.fonts.load("800 76px Cairo");
      await document.fonts.ready;
    } catch {
      /* خط احتياطي كافٍ لو تعذّر تحميل Cairo */
    }
  }

  let cursorY;
  let photoLoaded = false;
  if (photo) {
    try {
      const img = await loadImageEl(photo);
      const photoH = Math.round(H * 0.5);
      drawImageCover(ctx, img, 0, 0, W, photoH);
      const fade = ctx.createLinearGradient(0, photoH - 260, 0, photoH);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, primary);
      ctx.fillStyle = fade;
      ctx.fillRect(0, photoH - 260, W, 260);
      cursorY = photoH + 90;
      photoLoaded = true;
    } catch {
      photoLoaded = false;
    }
  }
  if (!photoLoaded) {
    ctx.font = "340px sans-serif"; // الإيموجي يُرسم بخط النظام بغض النظر عن Cairo
    ctx.fillText(icon || "⭐", W / 2, 700);
    cursorY = 840;
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 72px Cairo, sans-serif";
  cursorY = wrapText(ctx, title, W / 2, cursorY, W - 160, 88, 3) + 30;

  if (subtitle) {
    ctx.font = "600 42px Cairo, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    wrapText(ctx, subtitle, W / 2, cursorY, W - 200, 56, 2);
  }

  ctx.font = "800 46px Cairo, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(isRtl ? "● توريلو" : "● Torilu", W / 2, H - 150);
  ctx.font = "500 32px Cairo, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(SITE_ORIGIN.replace(/^https?:\/\//, ""), W / 2, H - 100);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/* ===== مشاركة عبر نظام المشاركة الأصلي بالجهاز (Web Share API) — يفتح نفس
   قائمة المشاركة اللي تشوفها بإنستقرام (واتساب، رسائل، تلغرام، نسخ رابط،
   وإضافة لستوري إنستقرام لو أرفقنا صورة). المتصفحات اللي ما تدعم مشاركة
   الملفات (أغلب أجهزة الحاسوب) ترجع تلقائياً لمشاركة نصية، وإلا لفتح واتساب
   مباشرة كما كانت الحال قبل هذي الميزة كلها */
async function shareText(text, trackParams, card) {
  sfx("share");
  let file = null;
  if (card && navigator.canShare) {
    try {
      const blob = await buildStoryImage(card);
      if (blob) {
        const candidate = new File([blob], "torilu.png", { type: "image/png" });
        if (navigator.canShare({ files: [candidate] })) file = candidate;
      }
    } catch {
      file = null; // تعذّر توليد الصورة (مثلاً صورة المكان ما انحمّلت) — نكمل بالنص فقط
    }
  }

  if (navigator.share) {
    const payload = file ? { text, files: [file] } : { text };
    navigator
      .share(payload)
      .catch(() => {}); // المستخدم ألغى المشاركة — سلوك طبيعي، لا خطأ يُسجَّل
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
}

/* مصدر اللحم بالبطاقة التفاعلية — نفس بناء item-card.njk (عنصر <details>
   أصلي بلا جافاسكربت للفتح)، بس نضيف هنا وصفاً لعُمر المعلومة يُحسب لحظة
   العرض. الحساب هنا لا وقت البناء عمداً: لو ما رُفع الموقع من شهور، الوصف
   المبني وقت النشر يصير كذباً، أما المحسوب بالمتصفح فيبقى صحيحاً دايماً. */
function meatSourceAgeLabel(checked) {
  if (!checked) return "";
  const days = (Date.now() - new Date(checked).getTime()) / 86400000;
  if (!Number.isFinite(days) || days < 0) return "";
  if (days < 30) return t("meat_source_age_recent");
  if (days < 365) return t("meat_source_age_months");
  return t("meat_source_age_old");
}

function buildMeatSourceHtml(item) {
  const meat = item.meatSource;
  if (!meat || !meat.text) return "";
  const isEn = window.SITE_LANG === "en";
  const text = (isEn && meat.text_en) || meat.text;
  const viaKey = {
    asked: "meat_source_via_asked",
    instagram: "meat_source_via_instagram",
    menu: "meat_source_via_menu",
  }[meat.via];
  const parts = [];
  if (viaKey) parts.push(t(viaKey));
  if (meat.checked)
    parts.push(`${t("meat_source_checked")}: <span dir="ltr">${escapeHtml(meat.checked)}</span>`);
  const age = meatSourceAgeLabel(meat.checked);
  if (age) parts.push(age);
  return `
      <details class="meat-source">
        <summary>${t("meat_source_label")}</summary>
        <p class="meat-source-text">${escapeHtml(text)}</p>
        <p class="meat-source-meta">${parts.join(" · ")}</p>
      </details>`;
}

function buildActionsHtml(item) {
  // زر أزرق واحد (أول رابط بالترتيب، غالباً الخريطة)، ثم صفحة التفاصيل والمنيو
  // التفاعلي إن وُجدا، ثم الباقي — وما بعد الرابطين الثانويين لا يظهر بالبطاقة
  const isEn = window.SITE_LANG === "en";
  // قائمة الطعام التفاعلية تحل محل زر صورة المنيو العادي، لا تظهران معاً
  const hasStructuredMenu = item.menuCount > 0 || (Array.isArray(item.menuItems) && item.menuItems.length > 0);
  const links = { ...(item.links || (item.url ? { website: item.url } : {})) };
  if (hasStructuredMenu) delete links.menu;
  const orderedKeys = Object.keys(links)
    .filter((key) => links[key])
    .sort((a, b) => LINK_ORDER.indexOf(a) - LINK_ORDER.indexOf(b));
  const linkBtn = (key, cls) => {
    const url = links[key];
    const meta = LINK_META[key] || { icon: ICON_SVG.language, labelKey: "link_generic" };
    const metaLabel = t(meta.labelKey);
    if (key === "phone") {
      // يدعم أكثر من رقم بالحقل الواحد (مفصولة بفاصلة) — زر لكل رقم
      const numbers = url
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      return numbers.map((num, idx) => {
        const label = numbers.length > 1 ? `${metaLabel} ${idx + 1}` : metaLabel;
        return `<button type="button" class="${idx ? "btn secondary" : cls} phone-copy-btn" data-phone="${escapeHtml(num)}">${meta.icon} ${escapeHtml(label)}</button>`;
      });
    }
    const cta = isEn ? item.cta_en || item.cta : item.cta;
    const label = key === "website" && cta ? cta : metaLabel;
    const rel = key === "website" && item.affiliate ? "noopener noreferrer sponsored" : "noopener noreferrer";
    return [`<a class="${cls}" href="${safeUrl(url)}" target="_blank" rel="${rel}">${meta.icon} ${escapeHtml(label)}</a>`];
  };
  const [primaryKey, ...restKeys] = orderedKeys;
  const primary = primaryKey ? linkBtn(primaryKey, "btn") : [];
  const secondary = [];
  if (item.detailUrl) {
    const href = isEn && item.detailUrlEn ? item.detailUrlEn : item.detailUrl;
    secondary.push(`<a class="btn secondary" href="${href}">${ICON_SVG["menu-book"]} ${t("read_details")}</a>`);
  }
  if (hasStructuredMenu)
    secondary.push(`<button type="button" class="btn secondary menu-open-btn">${ICON_SVG["menu-book"]} ${t("link_menu")}</button>`);
  restKeys.forEach((key) => secondary.push(...linkBtn(key, "btn secondary")));
  // بلا أي رابط: أول زر ثانوي يصير هو الأساسي، فلا تبقى البطاقة بلا زر أزرق
  if (!primary.length && secondary.length) secondary[0] = secondary[0].replace('class="btn secondary', 'class="btn');
  return primary.concat(secondary.slice(0, MAX_SECONDARY_ACTIONS + (primary.length ? 0 : 1))).join("");
}

/* ===== رسالة تأكيد عابرة (Toast) ===== */
let toastTimer = null;
function showToast(message) {
  let toast = document.getElementById("site-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "site-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("open");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("open"), 2000);
}

// المميز يُثبَّت أول القائمة (لا مكان يدفع ليظهر أو يتقدّم). الترتيب الأصلي
// محفوظ داخل كل مرتبة لأن Array.sort ثابت (stable) بكل المتصفحات الحديثة
function pinRank(item) {
  return item.featured ? 1 : 0;
}

/* شارة القسم — تظهر فقط حين تختلط الأقسام ببعضها (الرئيسية، المفضلة،
   "اختار لي"): هناك يصعب تمييز مطعم بحريني من أداة رقمية بنظرة واحدة.
   بصفحة القسم نفسه كل العناصر من قسم واحد فالشارة ضجيج بلا فائدة. */
function sectionBadge(section) {
  if (!section || (window.PAGE && window.PAGE.section === section)) return "";
  const meta = SITE_DATA[section];
  if (!meta) return "";
  const isEn = window.SITE_LANG === "en";
  const label = (isEn && meta.title_en) || meta.title;
  if (!label) return "";
  const span = document.createElement("span");
  span.textContent = label;
  return `<span class="section-badge">${span.innerHTML}</span>`;
}

/* «الاسم - الفرع»: الاسم عنواناً والفرع سطراً صغيراً تحته (.t-branch). النص كاملاً يبقى في الصفحة
   (الشرطة مخفية بصرياً فقط). نفس ما يطبعه item-card.njk وplace-newspaper.njk */
function titleHtml(title) {
  const i = title.indexOf(" - ");
  if (i < 0) return `<bdi>${escapeHtml(title)}</bdi>`;
  return `<bdi>${escapeHtml(title.slice(0, i))}</bdi><span class="sr-only"> - </span><bdi class="t-branch">${escapeHtml(title.slice(i + 3))}</bdi>`;
}

/* ===== بناء بطاقة عنصر واحدة ===== */
function buildItemCard(section, item, index = 0, distanceKm = null, branchLabel = "") {
  const card = document.createElement("div");
  // نفس منطق item-card.njk بالضبط — أي تغيير هنا لازم ينعكس هناك، وإلا اختلف
  // شكل البطاقة قبل تشغيل جافاسكربت وبعده (وبوّابة التطابق بالبناء تكشفها)
  card.className = [
    "item-card",
    item.featured ? "featured" : "",
    item.verified ? "verified" : "",
  ]
    .filter(Boolean)
    .join(" ");
  // الدخول المتتابع لأول عشر بطاقات فقط: ما بعدها تحت أول الشاشة، ولو فُتحت الصفحة على موضع
  // عميق لكانت كلها تنتظر مخفية معاً
  if (index < 10) card.style.animationDelay = `${index * 45}ms`;
  else card.style.animation = "none";

  const fav = isFavorite(section, item.id);
  const title = itemTitle(item);
  const desc = itemDesc(item);
  const isLongDesc = desc.length > 100;

  card.innerHTML = `
    ${item.image ? `<img class="item-photo" src="${escapeHtml(item.image)}" alt="${escapeHtml(title)}" loading="${index < 4 ? "eager" : "lazy"}" decoding="async" />${item.imageCredit ? `<a class="photo-credit card" dir="ltr" href="${escapeHtml(item.imageCreditUrl)}" target="_blank" rel="noopener">${escapeHtml(item.imageCredit)}</a>` : ""}` : ""}
    ${item.featured ? `<span class="featured-badge">${t("featured_badge")}</span>` : ""}
    <div class="item-body">
      ${sectionBadge(section)}
      <div class="item-top">
        ${item.illus ? `<img class="item-illus" src="/assets/illus/${escapeHtml(item.illus)}.webp" alt="" width="56" height="56" loading="lazy" decoding="async" />` : `<span class="item-icon" aria-hidden="true">${escapeHtml(item.icon || "⭐")}</span>`}
        <div class="item-top-actions">
          <button class="share-btn" title="${t("share_whatsapp")}" aria-label="${t("share_whatsapp")}">${ICON_SVG.share}</button>
          <button class="fav-btn ${fav ? "active" : ""}" title="${fav ? t("fav_remove") : t("fav_add")}" aria-label="${fav ? t("fav_remove") : t("fav_add")}" aria-pressed="${fav}">
            ${fav ? ICON_SVG["heart-fill"] : ICON_SVG.heart}
          </button>
        </div>
      </div>
      <h3>${titleHtml(title)}${item.verified ? ` <span class="verified-badge" title="${t("verified_badge")}">${t("verified_badge")}</span>` : ""}${item.liked ? ` <span class="liked-badge" title="${t("liked_badge")}">${t("liked_badge")}</span>` : ""}</h3>
      <p class="item-desc${isLongDesc ? " clamped" : ""}">${escapeHtml(desc)}</p>
      ${isLongDesc && !item.detailUrl ? `<button class="desc-toggle" aria-expanded="false">${t("read_more")}</button>` : ""}
      ${itemHours(item) ? `<p class="item-hours">${ICON_SVG.schedule} ${escapeHtml(itemHours(item))}</p>` : ""}
      <div class="item-meta">
        ${item.isNew ? `<span class="tag new-tag">${t("new_badge")}</span>` : ""}
        ${distanceKm !== null ? `<span class="tag distance-tag">${ICON_SVG["location-pin"]} ${formatDistance(distanceKm)}${branchLabel ? ` — ${t("nearest_branch")} ${escapeHtml(branchLabel)}` : ""}</span>` : ""}
        ${(item.tags || []).map((tag) => `<span class="tag">${tagIcon(tag) ? `<span class="tag-icon" aria-hidden="true">${escapeHtml(tagIcon(tag))}</span>` : ""}${escapeHtml(tagLabel(tag))}</span>`).join("")}
      </div>
      ${buildMeatSourceHtml(item)}
      <div class="item-actions">
        ${buildActionsHtml(item)}
      </div>
      ${item.affiliate ? `<p class="affiliate-note">${t("promo_affiliate_note")}</p>` : ""}
      <a class="report-link" href="${SITE_ROOT_PATH}${window.SITE_LANG === "en" ? "en/" : ""}contact.html?report=${encodeURIComponent(title)}&section=${encodeURIComponent(section)}">${t("report_wrong_info")}</a>
    </div>
  `;

  const favBtn = card.querySelector(".fav-btn");
  favBtn.addEventListener("click", () => {
    const nowFav = toggleFavorite(section, item.id);
    sfx(nowFav ? "favOn" : "favOff");
    favBtn.classList.toggle("active", nowFav);
    favBtn.innerHTML = nowFav ? ICON_SVG["heart-fill"] : ICON_SVG.heart;
    const label = nowFav ? t("fav_remove") : t("fav_add");
    favBtn.title = label;
    favBtn.setAttribute("aria-label", label);
    favBtn.setAttribute("aria-pressed", String(nowFav));
    favBtn.classList.remove("pop");
    void favBtn.offsetWidth;
    favBtn.classList.add("pop");
  });

  const shareBtn = card.querySelector(".share-btn");
  shareBtn.addEventListener("click", () => {
    const text = buildShareText(section, item);
    const subtitle = (item.tags || []).map((tag) => tagLabel(tag)).join(" · ");
    shareText(
      text,
      { section, item_name: itemTitle(item) },
      {
        icon: item.icon,
        title,
        subtitle,
        photo: item.image,
      }
    );
  });

  const descToggle = card.querySelector(".desc-toggle");
  if (descToggle) {
    const descEl = card.querySelector(".item-desc");
    descToggle.addEventListener("click", () => {
      const expanded = descEl.classList.toggle("clamped") === false;
      descToggle.textContent = expanded ? t("read_less") : t("read_more");
      descToggle.setAttribute("aria-expanded", String(expanded));
      sfx(expanded ? "open" : "close");
      if (expanded) {
        card.classList.add("just-expanded");
        setTimeout(() => card.classList.remove("just-expanded"), 900);
      }
    });
  }

  wireItemActions(card, item);

  return card;
}

// أزرار buildActionsHtml اللي تحتاج JS (نسخ الرقم، المنيو التفاعلي) — مشتركة بين
// بطاقة القائمة ونتيجة "اختار لي"
function wireItemActions(root, item) {
  root.querySelectorAll(".phone-copy-btn").forEach((phoneBtn) => {
    phoneBtn.addEventListener("click", async () => {
      const phone = phoneBtn.dataset.phone;
      try {
        await navigator.clipboard.writeText(phone);
      } catch {
        showToast(`${t("phone_copy_failed")} ${phone}`);
        return;
      }
      sfx("copy");
      showToast(t("phone_copied"));
    });
  });
  const menuBtn = root.querySelector(".menu-open-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      openMenuOverlay(item);
    });
  }
}

/* ===== عرض قسم كامل: بحث + فلاتر + شبكة بطاقات =====
   typeFilter (اختياري): يقصر القسم على عناصر تاجها يحتوي هالقيمة — تستخدمه
   صفحة نوع محل السيارات (car-shop-type.njk) عشان تعرض غسيل بس مثلاً، بدل
   كل محلات السيارات. التاج نفسه يُستبعد من رقاقات الفلتر لأنه بديهي بالفعل. */

function renderSection(section, typeFilter) {
  const data = SITE_DATA[section];
  if (!data) return;

  const grid = document.querySelector(".card-grid");
  const searchInput = document.querySelector(".search-box");
  const filtersWrap = document.querySelector(".filters");
  const nearMeBtn = document.querySelector(".near-me-btn");

  if (!grid) return;

  const items = typeFilter
    ? data.items.filter((item) => item.group === typeFilter || (item.tags || []).includes(typeFilter))
    : data.items;

  // بناء الفلاتر من التاجات المتوفرة
  const allTags = new Set();
  items.forEach((item) =>
    (item.tags || []).forEach((t) => {
      if (t !== typeFilter) allTags.add(t);
    })
  );

  // فلتر لكل نوع (منطقة، سعر، الباقي) يشتغلون مع بعض: «المحرق + مشاوي + اقتصادي»
  const active = {};
  const tagKind = (tag) =>
    AREA_NAMES.includes(tag) ? "area" : PRICE_TAGS.includes(tag) ? "price" : "type";
  let filtersExpanded = false;
  // قانون هيك: الجوال يعرض أهم ٥ فلاتر بس (الشاشة الأولى كانت ١٣ زراً)، والباقي ورا «عرض المزيد»
  const FILTER_CHIP_LIMIT = matchMedia("(max-width: 700px)").matches ? 5 : 10;
  let userCoords = null;
  let sortByDistance = false;

  function renderFilters() {
    if (!filtersWrap) return;
    filtersWrap.innerHTML = "";
    // «الأقرب مني» أول سطر الفلاتر بدل صف وحده (العنصر نفسه يُنقل، فمستمعه ونصّه باقيان)
    if (nearMeBtn && hasLocations) filtersWrap.appendChild(nearMeBtn);
    const allChip = document.createElement("button");
    allChip.className = "filter-chip active";
    allChip.textContent = t("all_filter");
    allChip.dataset.tag = "all";
    allChip.setAttribute("aria-pressed", "true");
    allChip.addEventListener("click", () => {
      sfx("tap");
      for (const k in active) delete active[k];
      updateActiveChip();
      renderGrid();
    });
    filtersWrap.appendChild(allChip);

    const tagsList = [...allTags];
    const hasMore = tagsList.length > FILTER_CHIP_LIMIT;
    const visibleTags = filtersExpanded ? tagsList : tagsList.slice(0, FILTER_CHIP_LIMIT);

    visibleTags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.className = "filter-chip";
      chip.textContent = tagLabel(tag); // شكل «د»: بلا إيموجي
      chip.dataset.tag = tag;
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", () => {
        sfx("tap");
        const kind = tagKind(tag);
        if (active[kind] === tag) delete active[kind];
        else active[kind] = tag;
        updateActiveChip();
        renderGrid();
      });
      filtersWrap.appendChild(chip);
    });

    if (hasMore) {
      const toggleChip = document.createElement("button");
      toggleChip.className = "filter-chip filter-toggle";
      toggleChip.textContent = filtersExpanded
        ? `${t("filters_show_less")} ▲`
        : `${t("filters_show_more")} (+${tagsList.length - FILTER_CHIP_LIMIT}) ▼`;
      toggleChip.setAttribute("aria-expanded", String(filtersExpanded));
      toggleChip.addEventListener("click", () => {
        sfx("tap");
        filtersExpanded = !filtersExpanded;
        renderFilters();
        updateActiveChip();
      });
      filtersWrap.appendChild(toggleChip);
    }
  }

  function updateActiveChip() {
    if (!filtersWrap) return;
    [...filtersWrap.children].forEach((chip) => {
      const tag = chip.dataset.tag;
      if (!tag) return;
      const isActive = tag === "all" ? !Object.keys(active).length : active[tagKind(tag)] === tag;
      chip.classList.toggle("active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function renderGrid() {
    const query = (searchInput?.value || "").trim();
    grid.innerHTML = "";

    // الاسم والوصف والتصنيفات باللغتين (رابط مشاركة إنجليزي ?q= يشتغل بالصفحة العربية)
    const relevance = new Map();
    const filtered = items.filter((item) => {
      const matchesTag = Object.values(active).every((tag) => (item.tags || []).includes(tag));
      if (!matchesTag) return false;
      const score = searchScore(item, query);
      relevance.set(item, score);
      return score > 0;
    });

    let ranked = filtered.map((item) => {
      const near = sortByDistance && userCoords ? nearestBranch(item, userCoords) : null;
      return {
        item,
        distanceKm: near ? near.km : null,
        branchLabel: near ? near.label : "",
      };
    });

    ranked =
      sortByDistance && userCoords
        ? ranked.sort((a, b) => {
            if (a.distanceKm === null && b.distanceKm === null) return 0;
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
          })
        : ranked.sort(
            (a, b) =>
              (query ? relevance.get(b.item) - relevance.get(a.item) : 0) || pinRank(b.item) - pinRank(a.item)
          );

    if (ranked.length === 0) {
      const isSectionEmpty = items.length === 0;
      grid.innerHTML = isSectionEmpty
        ? `
        <div class="empty-state full-row">
          <p>${t("empty_section")}</p>
        </div>
      `
        : `
        <div class="empty-state full-row">
          <p>${t("empty_search")}</p>
        </div>
      `;
      return;
    }

    ranked.forEach(({ item, distanceKm, branchLabel }, index) =>
      grid.appendChild(buildItemCard(section, item, index, distanceKm, branchLabel))
    );
  }

  const sharedQuery = new URLSearchParams(location.search).get("q");
  if (sharedQuery && searchInput) searchInput.value = sharedQuery;

  // قسم ما فيه ولا عنصر بموقع (روابط، مقالات…): الزر يطلب صلاحية الموقع بلا فايدة — نشيله
  const hasLocations = items.some(
    (item) => (item.lat != null && item.lng != null) || item.branches?.length
  );
  if (nearMeBtn && !hasLocations) nearMeBtn.remove();
  else if (nearMeBtn) {
    nearMeBtn.addEventListener("click", () => {
      sfx("tap");
      if (sortByDistance) {
        sortByDistance = false;
        nearMeBtn.classList.remove("active");
        nearMeBtn.setAttribute("aria-pressed", "false");
        nearMeBtn.textContent = t("near_me");
        renderGrid();
        return;
      }
      if (!navigator.geolocation) {
        showToast(t("geolocation_unsupported"));
        return;
      }
      nearMeBtn.textContent = t("near_me_locating");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          sortByDistance = true;
          nearMeBtn.classList.add("active");
          nearMeBtn.setAttribute("aria-pressed", "true");
          nearMeBtn.textContent = t("near_me_active");
          renderGrid();
          // بالجوال القائمة تحت الشاشة: ننزل لأول بطاقة ونقول كم وحدة ترتّبت، عشان يبان إن شي تغيّر
          const sorted = grid.querySelectorAll(".distance-tag").length;
          showToast(t("near_me_sorted").replace("{n}", sorted));
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({
            top: grid.getBoundingClientRect().top + window.scrollY - 140,
            behavior: reduce ? "auto" : "smooth",
          });
        },
        () => {
          showToast(t("geolocation_denied"));
          nearMeBtn.textContent = t("near_me");
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
  }

  renderFilters();
  renderGrid();
  // دخول البطاقات (sheetIn) للعرض الأول فقط: إعادة الرسم بالبحث والفلترة تظهر فوراً.
  // وعند الرجوع أو إعادة التحميل يعود المتصفح إلى موضع التمرير السابق، فلا دخول أصلاً (كانت الصفحة تظهر فارغة لحظة)
  const navEntry = performance.getEntriesByType("navigation")[0];
  if (navEntry && navEntry.type !== "navigate") grid.classList.add("is-settled");
  else setTimeout(() => grid.classList.add("is-settled"), 900);

  if (searchInput) {
    searchInput.addEventListener("input", renderGrid);
    initSearchSuggestions(searchInput, items, renderGrid);
  }
}

/* ===== نقل المفضلة من هكوله (كل موقع له تخزينه الخاص) =====
   favorites.html#import=<base64url(JSON ["section/id", ...])> — يُدمج ثم يُمسح الرابط.
   لا يُقبل إلا عنصر موجود فعلاً بـSITE_DATA، وبحد أقصى 500. */
function importFavoritesFromHash() {
  const m = location.hash.match(/^#import=([A-Za-z0-9_-]{1,40000})$/);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  let list;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    list = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return;
  }
  if (!Array.isArray(list)) return;
  const favs = getFavorites();
  for (const key of list.slice(0, 500)) {
    if (typeof key !== "string" || key.length > 200) continue;
    const slash = key.indexOf("/");
    const section = key.slice(0, slash);
    const id = key.slice(slash + 1);
    if (slash < 1 || !Object.hasOwn(SITE_DATA, section)) continue;
    if (!SITE_DATA[section].items.some((item) => item.id === id)) continue;
    if (!favs[section]) favs[section] = {};
    favs[section][id] = true;
  }
  saveFavorites(favs);
}

/* ===== عرض صفحة المفضلة (تجميع من كل الأقسام) ===== */
function renderFavoritesPage() {
  const grid = document.querySelector(".card-grid");
  if (!grid) return;
  importFavoritesFromHash();

  const favs = getFavorites();
  const collected = [];

  Object.keys(SITE_DATA).forEach((section) => {
    const sectionFavs = favs[section] || {};
    SITE_DATA[section].items.forEach((item) => {
      if (sectionFavs[item.id]) {
        collected.push({ section, item });
      }
    });
  });

  grid.innerHTML = "";

  if (collected.length === 0) {
    grid.innerHTML = `
      <div class="empty-state full-row fav-clip">
        <span class="fav-clip-heart halftone" aria-hidden="true"></span>
        <p>${t("favorites_empty_html")}</p>
        <a class="fav-clip-link" href="${SITE_ROOT_PATH}${window.SITE_LANG === "en" ? "en/" : ""}picker.html">${t("favorites_empty_pick")}</a>
      </div>
    `;
    return;
  }

  collected.forEach(({ section, item }, index) =>
    grid.appendChild(buildItemCard(section, item, index))
  );
}

/* عدّاد الزيارات القديم (‎/track و/stats بالـ Worker) أُزيل — Google Analytics
   المركّب أصلاً يعدّ الزيارات بدقة أعلى وبلا حدود، بينما كان العدّاد القديم
   يكتب مرتين لكل زيارة على Cloudflare KV، وحصة الخطة المجانية 1000 كتابة
   باليوم فقط — أي 500 زيارة صفحة يومياً تستهلك الحصة كلها وتوقف معها
   الإعجابات واشتراكات الإشعارات (يتشاركون نفس الحصة). */

/* ===== اختار لي: اختيار عشوائي من أي قسم بأنيميشن سلوت مشين ===== */
/* ===== كشف "اختار لي" بشاشة كاملة — انظر تعليق CSS .picker-reveal-overlay
   لتفاصيل الفكرة. القطع الكبيرة (عنوان/صورة/هاتف/موقع/تصنيفات) تضل هي
   النتيجة النهائية فوق الشاشة كاملة، ما ترجع لبطاقة صغيرة بعدها — وتحتها
   أزرار التواصل الفعلية (اتصال/موقع/إنستقرام) وزر إعادة المحاولة والإغلاق */
/* يخفي عن قارئ الشاشة كل عناصر body الظاهرة خلف حاجز شاشة كاملة (اختار لي/
   القائمة) وقت فتحه — بدونه يقدر قارئ الشاشة "يقرأ" الهيدر/الفوتر/المحتوى
   المخفي بصرياً خلف الحاجز. لا يغيّر أي شيء مرئياً (aria-hidden بلا أثر على
   العرض) ولا يلمس عنصراً مخفياً بالفعل (يدعم حواري متداخلة: فتح حاجز القائمة
   فوق حاجز "اختار لي" المفتوح يخفي الحاجز الأول أيضاً، ويرجعه ظاهراً لقارئ
   الشاشة عند إغلاق حاجز القائمة فقط، لا كل شيء دفعة وحدة). يرجّع دالة إرجاع
   خاصة بنفس العناصر اللي أخفاها فعلياً. */
function hideBackgroundFromAT(overlay) {
  const hidden = [];
  Array.from(document.body.children).forEach((el) => {
    if (el === overlay || el.tagName === "SCRIPT" || el.hasAttribute("aria-hidden")) return;
    el.setAttribute("aria-hidden", "true");
    // inert (مدعوم بكل المتصفحات الحديثة) يمنع أيضاً وصول Tab/التركيز لهذي
    // العناصر أثناء فتح الحاجز — بدونه كان ممكن لمستخدم لوحة مفاتيح يخرج
    // بـTab من الحاجز لمحتوى الصفحة الخلفي (ظل بصرياً مخفياً خلف الحاجز، بس
    // ما زال بترتيب التركيز). لا يغيّر أي سلوك فأرة/لمس (الحاجز يغطي الشاشة
    // كاملة أصلاً بـz-index أعلى فيعترض كل نقرة قبل وصولها للخلفية).
    el.setAttribute("inert", "");
    hidden.push(el);
  });
  return () =>
    hidden.forEach((el) => {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("inert");
    });
}

/* ===== بطاقة القائمة التفاعلية — حاجز بشاشة كاملة (.picker-reveal-overlay)
   ببطاقة بسيطة: اسم وسعر بس بلا صور — قرار صريح من صاحب الموقع. ===== */
function openMenuOverlay(item) {
  // نحفظ العنصر اللي كان عليه التركيز ونرجّع له بعد الإغلاق
  const trigger = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "picker-reveal-overlay menu-overlay";
  sfx("open");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `${t("link_menu")} — ${itemTitle(item)}`);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  const restoreBackground = hideBackgroundFromAT(overlay);

  function close() {
    sfx("close");
    overlay.remove();
    document.body.style.overflow = "";
    restoreBackground();
    document.removeEventListener("keydown", onKeydown);
    if (trigger && document.contains(trigger) && typeof trigger.focus === "function") {
      trigger.focus();
    }
  }
  function onKeydown(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeydown);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn secondary picker-reveal-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", t("daily_pick_close"));
  closeBtn.addEventListener("click", () => {
    close();
  });
  overlay.appendChild(closeBtn);
  closeBtn.focus();

  const card = document.createElement("div");
  card.className = "menu-card";
  card.innerHTML = `
    <h3>${escapeHtml(itemTitle(item))}</h3>
    <ul class="menu-items" aria-live="polite"><li aria-busy="true">…</li></ul>
  `;
  overlay.appendChild(card);
  // الأصناف تتحمّل عند الفتح (js/menus.js) — القائمة تظهر فوراً بنقاط تحميل ثم تتعبّى
  // فشل التحميل (بلا اتصال مثلاً): رسالة بدل قائمة فاضية، والفتح التالي يعيد المحاولة
  window
    .loadMenus()
    .then(
      () => true,
      () => false
    )
    .then((ok) => {
      if (!ok) {
        card.querySelector(".menu-items").innerHTML = `<li>${escapeHtml(t("menu_load_failed"))}</li>`;
        return;
      }
      const rows = window
        .menuOf(item)
        .map((mi) => {
          const name = window.SITE_LANG === "en" && mi.name_en ? mi.name_en : mi.name;
          return `<li><span class="menu-item-name">${escapeHtml(name)}</span>${mi.price ? `<span class="menu-item-price">${escapeHtml(mi.price)}</span>` : ""}</li>`;
        })
        .join("");
      card.querySelector(".menu-items").innerHTML = rows;
    });
}

/* ===== خطة اليوم =====
   يقترح مساراً كاملاً ليوم واحد من نفس بيانات الموقع، بلا أي محتوى جديد.

   قرار تصميمي مهم: المراحل مبنية على **الأقسام** لا على التصنيفات. فحص
   البيانات الفعلي أظهر أن التصنيفات الدقيقة شبه غائبة (تصنيف "إفطار" مثلاً
   غير مستخدم بأي كافيه إطلاقاً، و"قهوة مختصة" على كافيه واحد فقط)، فبناء
   المراحل عليها كان بينتج خططاً فاضية أو مكررة. الأقسام مضمونة الامتلاء.

   كل مرحلة تتخطى نفسها بهدوء لو قسمها فاضي، فالميزة تشتغل مهما كان المحتوى،
   وتتحسّن تلقائياً مع كل عنصر يُضاف بلا أي تعديل هنا. */
const DAY_PLAN_STEPS = [
  { key: "morning", icon: "🥐", from: ["bakeries", "cafes"] },
  { key: "activity", icon: "📍", from: ["places"] },
  { key: "lunch", icon: "🍽️", from: ["restaurants"] },
  { key: "evening", icon: "☕", from: ["cafes"] },
];

function buildDayPlan() {
  const used = new Set();
  const steps = [];

  for (const step of DAY_PLAN_STEPS) {
    // نجمع كل عناصر الأقسام المسموحة لهذي المرحلة، ونستبعد المستخدَم سابقاً
    // حتى ما يتكرر نفس المكان مرتين بنفس الخطة
    const pool = [];
    for (const slug of step.from) {
      for (const item of SITE_DATA[slug]?.items || []) {
        const id = `${slug}:${item.id}`;
        if (!used.has(id)) pool.push({ slug, item, id });
      }
    }
    if (!pool.length) continue;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    used.add(chosen.id);
    steps.push({ ...step, ...chosen });
  }
  return steps;
}

function renderDayPlan() {
  const stage = document.getElementById("dayPlanStage");
  const btn = document.getElementById("dayPlanBtn");
  const shareBtn = document.getElementById("dayPlanShare");
  if (!stage || !btn) return;

  let current = [];

  function draw() {
    current = buildDayPlan();
    stage.innerHTML = "";

    if (!current.length) {
      stage.innerHTML = `<div class="empty-state full-row"><p>${t("empty_section")}</p></div>`;
      if (shareBtn) shareBtn.classList.add("hidden");
      return;
    }

    current.forEach((step, i) => {
      const row = document.createElement("div");
      row.className = "plan-step";
      row.style.animationDelay = `${i * 90}ms`;

      const head = document.createElement("div");
      head.className = "plan-step-head";
      head.innerHTML = `<span class="plan-step-label">${t("plan_" + step.key)}</span>`;
      row.appendChild(head);

      row.appendChild(buildItemCard(step.slug, step.item, i));
      stage.appendChild(row);
    });

    if (shareBtn) shareBtn.classList.remove("hidden");
  }

  btn.addEventListener("click", () => {
    draw();
    sfx("success");
  });

  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const lines = current.map((s) => `${s.icon} ${t("plan_" + s.key)}: ${itemTitle(s.item)}`);
      const text = `${t("plan_share_title")}\n\n${lines.join("\n")}\n\n${SITE_ORIGIN}${window.SITE_LANG === "en" ? "en/" : ""}plan.html`;
      shareText(
        text,
        { section: "plan" },
        {
          icon: "🗓️",
          title: t("plan_title"),
          subtitle: current.map((s) => itemTitle(s.item)).join(" · "),
        }
      );
    });
  }

  draw();
}

function initWelcomePicker() {
  const picks = document.querySelectorAll(".welcome-pick");
  const nextBtn = document.getElementById("welcomeNextBtn");
  if (!picks.length || !nextBtn) return;
  let i = 0;
  nextBtn.addEventListener("click", () => {
    sfx("tap");
    picks[i].classList.remove("active");
    i = (i + 1) % picks.length;
    picks[i].classList.add("active");
  });
}

/* البطاقة المضغوطة تصير الجريدة المطويّة في الصفحة التالية (انتقال بين الصفحات، style.css: paper):
   الاسم على بطاقة واحدة فقط، وهي التي ضُغط رابطها الداخلي. يبقى عليها للرجوع (الصفحة المحفوظة
   bfcache) فتنكمش الجريدة إلى بطاقتها، ثم يُزال. متصفح بلا هذا الانتقال لا يتأثر */
let vtCard = null;
function clearVtCard() {
  if (vtCard) vtCard.style.viewTransitionName = "";
  vtCard = null;
}
document.addEventListener(
  "click",
  (e) => {
    clearVtCard();
    const a = e.target.closest?.("a[href]");
    if (!a || a.target || a.origin !== location.origin) return;
    vtCard = a.closest(".item-card, .d-card, .d-lead, .pk-clip");
    if (vtCard) vtCard.style.viewTransitionName = "paper";
  },
  true
);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) setTimeout(clearVtCard, 700);
});

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initNavToggle();
  initHeaderScroll();
  initInstallPrompt();
  initSectionFilter();
  initAutoUpdateCheck();
  initContactForm();
  initArticleShare();
  initArticleListen();
  initPlaceFav();

  // تسجيل الـ service worker بكل صفحة (لا بس الرئيسية) — شرط أساسي لصلاحية
  // "إضافة للشاشة الرئيسية" (PWA) بمعظم المتصفحات
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

  // ما يخص كل صفحة على حدة — كانت سكربتات مضمّنة بـ base.njk، صارت تُقرأ من
  // إعدادات الصفحة (#site-config) عشان تشتغل سياسة CSP بدون unsafe-inline
  const page = window.PAGE || {};
  if (page.section) renderSection(page.section, page.typeFilter);
  if (page.favorites) renderFavoritesPage();
  if (page.picker) initRandomPicker();
  if (page.plan) renderDayPlan();
  if (page.welcome) initWelcomePicker();
});

/* ===== «/» يفتح البحث من أي صفحة (عُرف Google وGitHub)؛ بصفحة البحث نفسها يركّز على الحقل ===== */
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest("input, textarea, select, [contenteditable]")) return;
  e.preventDefault();
  const field = document.getElementById("searchInput");
  if (field) return field.focus();
  location.href = (window.SITE_LANG === "en" ? "/en/" : "/") + "search.html";
});

/* ===== صور صفحة المكان: الضغط يكبّر الصورة لملء الشاشة داخل الموقع، و✕ يرجعها لمكانها =====
   حركة FLIP: نحرّك الصورة الكبيرة نفسها بـtransform + clip-path + opacity فقط (على الـGPU)
   — View Transitions كانت تصوّر الصفحة كاملة كل مرة فالحركة تقطّع على الشاشات السريعة */
(function photoLightbox() {
  // الصورة الرئيسية تتكبّر حتى لو المكان بلا معرض صور
  const hero = document.querySelector(".detail-hero-photo");
  if (!hero && !document.querySelector(".photo-strip, .np-inline-photo")) return;
  const dlg = document.createElement("dialog");
  dlg.className = "photo-lightbox";
  dlg.innerHTML = '<button type="button" class="photo-lightbox-close">✕</button><img alt="" />';
  dlg.firstChild.setAttribute("aria-label", window.SITE_LANG === "en" ? "Close" : "إغلاق");
  document.body.append(dlg);
  const big = dlg.querySelector("img");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timing = { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" };
  let thumb = null;
  let busy = false;

  // من مكان المصغّرة لمكان الكبيرة: تكبير موحّد يغطي المصغّرة + قصّ الزائد (لو نسبتها مختلفة مثل الصورة الرئيسية)
  function fromThumb() {
    const t = thumb.getBoundingClientRect();
    const b = big.getBoundingClientRect();
    const z = b.width / big.offsetWidth || 1; // zoom الصفحة بالشاشات العريضة
    const s = Math.max(t.width / b.width, t.height / b.height);
    const dx = (t.left + t.width / 2 - (b.left + b.width / 2)) / z;
    const dy = (t.top + t.height / 2 - (b.top + b.height / 2)) / z;
    const cx = (b.width - t.width / s) / 2 / z;
    const cy = (b.height - t.height / s) / 2 / z;
    const r = parseFloat(getComputedStyle(thumb).borderTopLeftRadius) / s || 0;
    return [
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: `inset(${cy}px ${cx}px round ${r}px)` },
      { transform: "none", clipPath: "inset(0px 0px round 0px)" },
    ];
  }

  async function open(img) {
    if (busy) return;
    thumb = img;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    try {
      await big.decode(); // فك ترميز الصورة قبل الحركة، مو في نصها
    } catch {
      /* نكمل حتى لو فشل */
    }
    dlg.showModal();
    sfx("open");
    if (still) return;
    busy = true;
    thumb.style.visibility = "hidden";
    dlg.animate({ opacity: [0, 1] }, { ...timing, pseudoElement: "::backdrop" });
    dlg.animate({ backgroundColor: ["rgb(0 0 0 / 0)", "#000"] }, timing);
    dlg.firstChild.animate({ opacity: [0, 1] }, timing);
    await big.animate(fromThumb(), timing).finished.catch(() => {});
    thumb.style.visibility = "";
    busy = false;
  }

  async function close() {
    if (busy) return;
    sfx("close");
    if (!still && thumb) {
      busy = true;
      thumb.style.visibility = "hidden";
      const back = { ...timing, fill: "forwards" };
      dlg.animate({ opacity: [1, 0] }, { ...back, pseudoElement: "::backdrop" });
      dlg.animate({ backgroundColor: ["#000", "rgb(0 0 0 / 0)"] }, back);
      dlg.firstChild.animate({ opacity: [1, 0] }, back);
      await big.animate(fromThumb().reverse(), back).finished.catch(() => {});
      thumb.style.visibility = "";
      busy = false;
    }
    dlg.close();
    dlg.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  }

  // كيبورد: Enter على رابط المصغّرة يجي الحدث على <a> مو <img>؛ والصورة الرئيسية نخليها زر قابل للتركيز
  if (hero) {
    hero.tabIndex = 0;
    hero.setAttribute("role", "button");
    hero.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      open(hero);
    });
  }
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".photo-strip a, .np-inline-photo a");
    const img = link ? link.querySelector("img") : e.target.closest(".detail-hero-photo");
    if (!img) return;
    e.preventDefault();
    open(img);
  });
  // ✕ أو الضغط خارج الصورة يقفل؛ Esc يقفل بنفسه (cancel) فنمرّره من نفس الطريق للحركة
  dlg.addEventListener("click", (e) => e.target !== big && close());
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
})();
