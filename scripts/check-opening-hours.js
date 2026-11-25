/*
  فحص صغير لمحلّل الساعات (eleventy-opening-hours.js) + تقرير التغطية:
    node scripts/check-opening-hours.js
  يفشل لو انكسر أي مثال. بعدها يطبع كم مكان منشور تحوّلت ساعاته، والأنماط اللي ما انقرت.
*/
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { parseOpeningHours: p } = require("../eleventy-opening-hours.js");

const D = (...n) => n.map((d) => `https://schema.org/${d}`);
const S = (days, opens, closes) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes });
const ALL = D("Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday");

assert.deepStrictEqual(p("Open 24 hours"), [S(ALL, "00:00", "23:59")]);
assert.deepStrictEqual(p("Daily 11am - 12:30am"), [S(ALL, "11:00", "00:30")]);
assert.deepStrictEqual(p("Daily 12 PM – 12 AM"), [S(ALL, "12:00", "00:00")]);
assert.deepStrictEqual(p("Daily 11am - 3pm, 6pm - 12am"), [S(ALL, "11:00", "15:00"), S(ALL, "18:00", "00:00")]);
assert.deepStrictEqual(p("Sat & Wed - Fri 11am - 12:30am; Sun - Tue 11am - 12am"), [
  S(D("Saturday", "Wednesday", "Thursday", "Friday"), "11:00", "00:30"),
  S(D("Sunday", "Monday", "Tuesday"), "11:00", "00:00"),
]);
assert.deepStrictEqual(p("Sat - Thu 8am - 9pm; Fri Closed"), [S(D("Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"), "08:00", "21:00")]);
assert.deepStrictEqual(p("Sat - Wed 10:30am - 12:30am, Thu, Fri 10:30am - 2am")[1], S(D("Thursday", "Friday"), "10:30", "02:00"));
assert.deepStrictEqual(p("Sun - Wed 12pm - 11pm · Thu - Sat 12pm - 12am")[1], S(D("Thursday", "Friday", "Saturday"), "12:00", "00:00"));
assert.deepStrictEqual(p("Sat - Sun & Tue - Fri 12pm - 12am; Mon 24 hours")[1], S(D("Monday"), "00:00", "23:59"));
assert.deepStrictEqual(p("Saturday–Thursday 8:00 AM – 6:00 PM; Friday Closed")[0].closes, "18:00");
// غامض أو خارج الصيغة → null
for (const bad of [
  "Daily 8am - 12am (Friday from 12pm)",
  "Weekdays 6:30pm - 12am · Weekends 6:30pm - 1am",
  "Daily except Friday 7:30 AM – 6:00 PM",
  "Sat–Thu 8:00 AM–1:00 PM, 4:30–6:30 PM, 7:00–10:00 PM",
  "11:00am - 5:00pm",
  "Daily 6:30am - 4pm; 6pm - 11pm",
  "Daily 8am - 10pm; Fri 9am - 1pm", // يوم مكرر
  "Sat - Thu 8am - 9pm", // الجمعة غير مذكورة
  "Sat - Thu 8am - 8am",
  "Thurs 8am - 9pm",
  "",
  undefined,
]) assert.strictEqual(p(bad), null, bad);
console.log("opening-hours: self-check OK");

// تقرير: الأماكن المنشورة (لها صفحة) في أقسام الأماكن
const root = path.join(__dirname, "..", "src");
const full = new Set(
  fs.readdirSync(path.join(root, "sections")).filter((f) => f.endsWith(".md"))
    .map((f) => matter.read(path.join(root, "sections", f)).data)
    .filter((d) => d.hasDetailPages).map((d) => d.slug)
);
const sections = ["restaurants", "cafes", "bakeries", "stores", "car-shops", "places"];
let pages = 0, withHours = 0, parsed = 0;
const misses = new Map();
for (const sec of sections) {
  const dir = path.join(root, sec);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) {
    const d = matter.read(path.join(dir, f)).data;
    if (!full.has(sec) && !d.hasDetailPage) continue;
    pages++;
    if (!d.hours_en) continue;
    withHours++;
    if (p(d.hours_en)) parsed++;
    else misses.set(d.hours_en, (misses.get(d.hours_en) || 0) + 1);
  }
}
console.log(`published places: ${pages}, with hours_en: ${withHours}, structured: ${parsed}, unparsed: ${withHours - parsed}`);
[...misses].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${n}  ${t}`));
