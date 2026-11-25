/* GitHub Pages يخدم ملف 404.html واحداً لأي رابط غير موجود بكل الموقع (حتى تحت
   /en/)، فنحوّل روابط /en/ إلى en/404.html المبنية من القالب الإنجليزي كاملاً.
   ملف خارجي عمداً — عشان تشتغل سياسة CSP بدون unsafe-inline. */
(function () {
  if (location.pathname.indexOf("/en/") === -1 || /\/en\/404\.html$/.test(location.pathname)) return;
  location.replace("/en/404.html");
})();
