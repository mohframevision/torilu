// أنواع محلات السيارات — يقود بوابة /car-shops.html وصفحة كل نوع المستقلة
// (car-shop-type.njk). label هو نفس التصنيف المكتوب بحقل categories بعنصر
// المحل (src/car-shops/*.md)، ولازم يطابق نصياً قيمة بـ categoryOptions
// بملف src/sections/car-shops.md.
module.exports = [
  {
    slug: "wash",
    label: "غسيل",
    label_en: "Wash",
    icon: "🚿",
    tip: "غسيل خارجي فقط، أم داخلي وتلميع أيضاً؟ حدّد ما تريده قبل أن تسأل عن السعر.",
    tip_en: "Just an exterior wash, or interior and polish too? Know what you need before asking for a price.",
  },
  {
    slug: "accessories",
    label: "إكسسوارات السيارات",
    label_en: "Car Accessories",
    icon: "🎨",
    tip: "قبل أن تشتري، تأكد أن القطعة تناسب طراز سيارتك بالضبط.",
    tip_en: "Before you buy, make sure the part fits your exact car model.",
  },
  {
    slug: "garage",
    label: "كراج",
    label_en: "Garage",
    icon: "🔧",
    tip: "وصف العطل بالتفصيل (كهربائي أم ميكانيكي) يسهّل عليك المقارنة بين الكراجات.",
    tip_en: "Describing the issue in detail (electrical or mechanical) makes it easier to compare garages.",
  },
  {
    slug: "dealership",
    label: "وكالة",
    label_en: "Dealership",
    icon: "🏢",
    tip: "الوكالة الأنسب غالباً هي وكالة ماركة سيارتك نفسها: صيانة أصلية وضمان.",
    tip_en: "Usually the best choice is your car's own brand dealership — original parts and warranty.",
  },
  {
    slug: "parts",
    label: "قطع غيار",
    label_en: "Parts",
    icon: "⚙️",
    tip: "اسأل عن الفرق بين القطعة الأصلية والتجارية قبل أن تقرر.",
    tip_en: "Ask about the difference between original and aftermarket parts before deciding.",
  },
  {
    slug: "showroom",
    label: "معرض سيارات",
    label_en: "Car Showroom",
    icon: "🚗",
    tip: "قارن بين أكثر من معرض قبل أن تشتري، واسأل عن سجل الصيانة إن كانت السيارة مستعملة.",
    tip_en: "Compare more than one showroom before buying, and ask for the maintenance history if the car is used.",
  },
  {
    slug: "upholstery",
    label: "تنجيد",
    label_en: "Upholstery",
    icon: "🛋️",
    tip: "اسأل عن نوع القماش أو الجلد المستخدم ومدة الضمان قبل أن توافق.",
    tip_en: "Ask about the fabric or leather type used and the warranty period before agreeing.",
  },
  {
    slug: "tires",
    label: "إطارات",
    label_en: "Tires",
    icon: "🛞",
    tip: "جهّز مقاس إطاراتك (مكتوب على جانب الإطار) قبل أن تتواصل.",
    tip_en: "Have your tire size ready (printed on the tire's sidewall) before you contact them.",
  },
];
