/* فحص معادلة «كم يكلّف منيو محلك؟» (src/js/menu-price.js) على أمثلة المالك وحدود الشرائح.
   node scripts/check-menu-price.js — يرجع 1 لو اختلف أي رقم. الأرقام بالدينار. */
require("../src/js/menu-price.js");
const price = globalThis.menuPrice;
// n: [رقمية، مطبوعة، الاثنتان، الصور]
const cases = {
  10: [22.5, 20, 32.5, 5],
  60: [52.5, 42.5, 72.5, 25],
  200: [100, 80, 140, 60],
  1: [22.5, 20, 32.5, 2.5],
  15: [22.5, 20, 32.5, 7.5],
  16: [25, 20, 35, 10],
  40: [42.5, 35, 60, 20],
  41: [42.5, 35, 60, 22.5],
  80: [62.5, 50, 87.5, 30],
  81: [62.5, 50, 87.5, 32.5],
  150: [87.5, 70, 122.5, 47.5],
  151: [90, 72.5, 125, 50],
  250: [112.5, 90, 157.5, 72.5],
};
let bad = 0;
const eq = (label, got, want) => {
  if (got !== want * 1000) {
    bad++;
    console.log(`FAIL ${label}: ${got / 1000} != ${want}`);
  }
};
for (const [n, [d, p, b, ph]] of Object.entries(cases)) {
  eq(`${n} digital`, price(+n, "digital", false).price, d);
  eq(`${n} print`, price(+n, "print", false).price, p);
  eq(`${n} both`, price(+n, "both", false).price, b);
  eq(`${n} photos`, price(+n, "both", true).price - price(+n, "both", false).price, ph);
}
if (price(251, "digital", false) !== null) bad++, console.log("FAIL 251 should be null");
console.log(bad ? `${bad} failures` : "menu price: all cases OK");
process.exit(bad ? 1 : 0);
