/* يقرأ إعدادات الصفحة من عنصر <script type="application/json"> (بيانات غير
   قابلة للتنفيذ، فما تحتاج أي سماح بسياسة CSP) ويحوّلها لمتغيّرات window
   اللي يعتمد عليها main.js — بديل عن السكربتات المضمّنة اللي كانت تجبرنا
   على استخدام unsafe-inline. */
(function () {
  var el = document.getElementById("site-config");
  var cfg;
  try {
    cfg = el ? JSON.parse(el.textContent) : {};
  } catch {
    cfg = {};
  }

  window.SITE_LANG = cfg.lang || "ar";
  window.I18N = cfg.i18n || {};
  window.PAGE = cfg.page || {};
  window.ICONS_URL = cfg.iconsUrl || "/assets/icons.svg";

  /* قوائم الطعام (MENU_POOL) بملف مستقل js/menus.js: ما يتحمّل إلا لما نحتاجه (فتح قائمة طعام، صفحة البحث)،
     بدل ما يثقّل data.js بكل صفحة. menuOf يرجّع أصناف العنصر بنفس شكل menuItems القديم */
  window.loadMenus = function () {
    if (typeof MENU_POOL !== "undefined") return Promise.resolve();
    return (window.__menusP =
      window.__menusP ||
      new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = cfg.menusUrl;
        s.onload = res;
        s.onerror = function () {
          window.__menusP = null;
          rej(new Error("menus"));
        };
        document.head.appendChild(s);
      }));
  };
  window.menuOf = function (item) {
    if (item.menuItems) return item.menuItems;
    if (item.menuRef == null || typeof MENU_POOL === "undefined") return [];
    return MENU_POOL[item.menuRef].map(function (m) {
      return { name: m[0], name_en: m[1], price: m[2] };
    });
  };

  /* صفحة البحث: ?q= يظهر في الحقل فوراً، قبل أن تصل data.js ويعمل search.js،
     بدل أن تبدو الصفحة كأن البحث لم يحدث */
  var sq = document.getElementById("searchInput");
  var q0 = sq && new URLSearchParams(location.search).get("q");
  if (q0) {
    sq.value = q0;
    var se = document.getElementById("searchEmpty");
    if (se) se.hidden = true;
  }

  /* «اختار لي»: ضغطة على القمر قبل أن يجهز picker.js تُحفظ، وpicker.js يفتح العجلة حين يجهز */
  var pm = document.getElementById("pkMoon");
  if (pm)
    pm.addEventListener("click", function () {
      if (pm.getAttribute("aria-busy") === "true") pm.dataset.early = "1";
    });
})();
