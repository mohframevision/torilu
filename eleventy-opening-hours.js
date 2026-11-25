/*
  hours_en (نص حر) ← openingHoursSpecification لـSchema.org، بصرامة:
  يُحوَّل النص فقط إذا انطبق كله على الصيغة؛ أي شيء آخر (ملاحظة بين قوسين،
  Weekdays، وقت بلا am/pm، يوم مكرر...) يرجع null فلا يُكتب شيء. لا تخمين.

  الصيغة: مجموعات تفصلها ; أو · أو ,  — كل مجموعة = أيام + أوقات
    أيام:  Daily | يوم أو مدى (Sat - Wed) تفصلها & أو ,  (الأسبوع يبدأ السبت، والمدى يلتف)
    أوقات: Closed | 24 hours | مدى (8am - 1:30am) تفصله & أو ,
  أو النص كاملاً "Open 24 hours". الإغلاق بعد منتصف الليل يبقى كما هو (closes < opens)،
  و24 ساعة = 00:00–23:59 (توصية قوقل).
*/
const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_RE = /^(sat|sun|mon|tue|wed|thu|fri)[a-z]*/i;
const TIME_RE = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;
const DASH_RE = /^\s*[-–—]\s*/;

function dayIndex(word) {
  const i = DAYS.findIndex((d) => d.toLowerCase() === word.toLowerCase() || d.slice(0, 3).toLowerCase() === word.toLowerCase());
  return i;
}

function parseOpeningHours(text) {
  if (typeof text !== "string") return null;
  let s = text.trim();
  if (/^open 24 hours$/i.test(s)) return build(DAYS.map((d) => [d, "00:00", "23:59"]));

  const take = (re) => {
    const m = s.match(re);
    if (m) s = s.slice(m[0].length);
    return m;
  };
  const time = () => {
    const m = take(TIME_RE);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2] || 0);
    if (h < 1 || h > 12 || min > 59) return null;
    const h24 = (h % 12) + (m[3].toLowerCase() === "p" ? 12 : 0);
    return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };
  const day = () => {
    const m = s.match(/^[a-z]+/i);
    if (!m || !DAY_RE.test(m[0])) return -1;
    const i = dayIndex(m[0]);
    if (i < 0) return -1;
    s = s.slice(m[0].length);
    return i;
  };

  const rows = [];
  const seen = new Set();
  while (s.length) {
    // الأيام
    let days = [];
    if (take(/^daily\b\s*/i)) days = DAYS.map((_, i) => i);
    else {
      for (;;) {
        const a = day();
        if (a < 0) return null;
        if (take(DASH_RE)) {
          const b = day();
          if (b < 0) return null;
          for (let i = a; ; i = (i + 1) % 7) {
            days.push(i);
            if (i === b) break;
          }
        } else days.push(a);
        if (!take(/^\s*[&,]\s*(?=[a-z])/i)) break;
      }
      if (!take(/^\s+/)) return null;
    }
    for (const d of days) {
      if (seen.has(d)) return null; // يوم مذكور مرتين = غموض
      seen.add(d);
    }
    // الأوقات
    if (take(/^closed\b/i)) {
      // يوم مغلق: لا يُكتب له شيء
    } else if (take(/^24 hours\b/i)) {
      days.forEach((d) => rows.push([DAYS[d], "00:00", "23:59"]));
    } else {
      for (;;) {
        const o = time();
        if (!o || !take(DASH_RE)) return null;
        const c = time();
        if (!c || c === o) return null;
        days.forEach((d) => rows.push([DAYS[d], o, c]));
        if (!take(/^\s*[&,]\s*(?=\d)/)) break;
      }
    }
    if (!s.length) break;
    if (!take(/^\s*[;·,]\s*(?=[a-z])/i)) return null;
  }
  // كل الأيام السبعة لازم تُذكر (مغلق صراحةً أو بوقت)؛ يوم ناقص = ما نعرف حاله
  return rows.length && seen.size === 7 ? build(rows) : null;
}

// يجمع الأيام اللي لها نفس الفتح والإغلاق في عنصر واحد
function build(rows) {
  const groups = new Map();
  for (const [d, o, c] of rows) {
    const k = `${o}-${c}`;
    if (!groups.has(k)) groups.set(k, { "@type": "OpeningHoursSpecification", dayOfWeek: [], opens: o, closes: c });
    groups.get(k).dayOfWeek.push(`https://schema.org/${d}`);
  }
  return [...groups.values()];
}

module.exports = { parseOpeningHours };
