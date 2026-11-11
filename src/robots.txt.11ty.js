exports.data = {
  permalink: "robots.txt",
  eleventyExcludeFromCollections: true,
};

exports.render = function () {
  return (
    "User-agent: *\n" +
    "Allow: /\n" +
    "Disallow: /admin/\n\n" +
    // برامج تدريب النماذج: تأخذ البيانات بلا رابط لنا (قرار المالك 2026-11-11).
    // برامج بحث الذكاء الاصطناعي (OAI-SearchBot, Claude-SearchBot, PerplexityBot) تبقى مسموحة تحت * لأنها تضع رابطنا.
    // ponytail: المنع طوعي؛ الإجباري يحتاج حماية كلاودفلير (خدمة خارجية، تُناقش أولاً).
    ["GPTBot", "CCBot", "Google-Extended", "ClaudeBot", "anthropic-ai", "Bytespider", "Applebot-Extended", "meta-externalagent"]
      .map((b) => "User-agent: " + b + "\nDisallow: /\n\n")
      .join("") +
    "Sitemap: https://torilu.com/sitemap.xml\n" +
    // نسخة طبق الأصل باسم ثانٍ — سيرش كونسول عالقة بحالة فشل قديمة مربوطة
    // باسم "sitemap.xml" تحديداً رغم إن الملف سليم؛ راجع sitemap-v2.xml.11ty.js
    "Sitemap: https://torilu.com/sitemap-v2.xml\n"
  );
};
