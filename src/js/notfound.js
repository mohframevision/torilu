/* GitHub Pages يخدم ملف 404.html واحد لأي رابط غير موجود بكل الموقع (حتى تحت
   /en/) — ما فيه دعم لصفحة 404 مختلفة لكل مجلد فرعي، فنكتشف اللغة من المسار.
   ملف خارجي عمداً — عشان تشتغل سياسة CSP بدون unsafe-inline. */
(function () {
  if (location.pathname.indexOf("/en/") === -1) return;

  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  document.title = "Page Not Found | Torilu";

  var set = function (id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
    return el;
  };
  // الرقم وسمة data-n معاً: الطبعة المنزاحة تُرسم من السمة
  var num = set("notFoundNum", "404");
  if (num) num.setAttribute("data-n", "404");
  set("notFoundCap", "Misprint");
  var h1 = document.querySelector("#notFoundHeader h1");
  if (h1) h1.textContent = "Page not found";
  set("notFoundText", "The link you opened doesn't exist or was moved. Go back to the homepage, or browse a section from the menu.");

  var homeLink = document.getElementById("notFoundHomeLink");
  if (homeLink) {
    homeLink.href = "/en/index.html";
    homeLink.textContent = "Back to Home";
  }
})();
