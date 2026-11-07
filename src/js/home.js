/* ===== الرئيسية: أزرار وصف حسب وقت اليوم، و«جديد في توريلو» =====
   الصف الزمني يختار من الأماكن الموجودة حسب تصنيفاتها (فطور الصبح، غداء الظهر، كوفي العصر،
   عشاء الليل)، وترتيبه يتبدّل كل يوم ببذرة التاريخ — نفس اليوم يعطي نفس الترتيب (ما يتنطط مع
   كل تحديث للصفحة)، واليوم الثاني ترتيب جديد. «جديد في توريلو» = آخر ما أضافه صاحب الموقع. */
(() => {
  const chipsBox = document.getElementById("homeChips");
  if (!chipsBox || typeof SITE_DATA === "undefined") return;
  const isEn = window.SITE_LANG === "en";
  const base = isEn ? "/en/" : "/";
  const searchUrl = (q) => `${base}search.html?q=${encodeURIComponent(q)}`;

  const SLOTS = {
    morning: {
      title: "home_morning",
      chips: isEn ? ["🍳 Breakfast", "🫖 Karak", "🥐 Pastries", "☕ Specialty coffee", "🥖 Bakery"] : ["🍳 فطور", "🫖 كرك", "🥐 معجنات", "☕ قهوة مختصة", "🥖 مخبز"],
      sections: ["bakeries", "cafes", "restaurants"],
      tags: ["إفطار", "معجنات", "كرك", "قهوة مختصة"],
      query: isEn ? "Breakfast" : "فطور",
    },
    noon: {
      title: "home_noon",
      chips: isEn ? ["🍢 Grills", "🍛 Mandi", "🏠 Bahraini", "🌯 Shawarma", "🍔 Burger"] : ["🍢 مشاوي", "🍛 مندي", "🏠 بحريني", "🌯 شاورما", "🍔 برجر"],
      sections: ["restaurants"],
      tags: ["مشاوي", "بحريني", "مندي", "لبناني", "مأكولات بحرية", "عراقي", "تركي", "كبسة"],
      query: isEn ? "Grills" : "مشاوي",
    },
    evening: {
      title: "home_evening",
      chips: isEn ? ["🫖 Karak", "☕ Coffee", "🍰 Desserts", "🍦 Ice cream", "🎂 Cake"] : ["🫖 كرك", "☕ قهوة", "🍰 حلويات", "🍦 آيسكريم", "🎂 كيك"],
      sections: ["cafes", "bakeries"],
      tags: [],
      query: isEn ? "Coffee" : "قهوة",
    },
    night: {
      title: "home_night",
      chips: isEn ? ["🌯 Shawarma", "🍔 Burger", "🥪 Sandwiches", "🍢 Grills", "🍰 Desserts"] : ["🌯 شاورما", "🍔 برجر", "🥪 سندويشات", "🍢 مشاوي", "🍰 حلويات"],
      sections: ["restaurants", "bakeries"],
      tags: ["شاورما", "برجر", "سندويشات", "وجبات سريعة", "مشاوي", "حلويات", "آيسكريم"],
      query: isEn ? "Shawarma" : "شاورما",
    },
  };
  // التاريخ أعلى الرئيسية مثل الجريدة (بتقويم البحرين)
  const dateEl = document.getElementById("homeDate");
  if (dateEl) dateEl.textContent = new Intl.DateTimeFormat(isEn ? "en-GB" : "ar-BH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const h = new Date().getHours();
  const slot = SLOTS[h >= 5 && h < 11 ? "morning" : h >= 11 && h < 16 ? "noon" : h >= 16 && h < 20 ? "evening" : "night"];

  // أزرار سريعة: وقت اليوم + كراج (حاجة مستعجلة بأي وقت)
  // شكل «د»: كلمات بلا إيموجي (الإيموجي كان يعطي إحساساً طفولياً)
  const chips = [...slot.chips, isEn ? "🔧 Garage" : "🔧 كراج"].map((c) => c.replace(/^\S+\s/, ""));
  chipsBox.innerHTML = chips.map((c) => `<a class="filter-chip" href="${searchUrl(c)}">${escapeHtml(c)}</a>`).join("");

  // ترتيب يومي ثابت: بذرة من التاريخ (mulberry32)
  const d = new Date();
  let seed = d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const hrefOf = (section, item) => base + (isEn && item.detailUrlEn ? item.detailUrlEn : item.detailUrl || `${section}.html?q=${encodeURIComponent(itemTitle(item))}`);
  const areaOf = (item) => {
    const a = (item.tags || []).find((tg) => typeof AREA_NAMES !== "undefined" && AREA_NAMES.includes(tg));
    return a ? (isEn && typeof TAGS_EN !== "undefined" && TAGS_EN[a]) || a : "";
  };
  // سطر صغير مفيد: المنطقة ونوع المكان («برجر · سار») بدل اسم القسم المكرر بكل بطاقة
  const typeOf = (item) => {
    const tg = (item.tags || []).find((x) => typeof AREA_NAMES === "undefined" || !AREA_NAMES.includes(x));
    return tg ? (isEn && typeof TAGS_EN !== "undefined" && TAGS_EN[tg]) || tg : "";
  };
  // «مطاعم البحرين» → «مطاعم»: الاسم المختصر يكفي بسطر البطاقة الصغير
  const secName = (section) => (isEn ? SITE_DATA[section].title_en || SITE_DATA[section].title : SITE_DATA[section].title).replace(/\s*(البحرين|in Bahrain)$/, "");
  // فروع نفس المحل («كوجو - الجفير»، «كوجو - سار») ما تاخذ أكثر من بطاقة بنفس الصف
  const brand = (it) => itemTitle(it).split(/\s+-\s+/)[0].trim();
  const oneEach = (rows) => { const seen = new Set(); return rows.filter(([, it]) => !seen.has(brand(it)) && seen.add(brand(it))); };
  const hoursOf = (item) => (isEn ? item.hours_en || item.hours : item.hours) || "";
  const meta = (item) => {
    const area = areaOf(item), hours = hoursOf(item);
    return `<span class="d-meta">${area ? `<span>${ICON_PIN}${escapeHtml(area)}</span>` : ""}${hours ? `<span>${ICON_CLOCK}${escapeHtml(hours)}</span>` : ""}</span>`;
  };
  const ICON_PIN = ICON_SVG["location-pin"];
  const ICON_CLOCK = ICON_SVG.schedule;
  // بطاقة «د»: سطر صغير بالأزرق (القسم · النوع)، والاسم بخط الجريدة، والوصف، والمنطقة والساعات
  const card = (section, item, badge) => {
    const kicker = [badge || secName(section), typeOf(item)].filter(Boolean).join(" · ");
    return `<a class="d-card" href="${hrefOf(section, item)}">
      <small class="d-kicker">${escapeHtml(kicker)}</small>
      <b class="d-title">${escapeHtml(itemTitle(item))}</b>
      <span class="d-desc">${escapeHtml(itemDesc(item) || "")}</span>
      ${meta(item)}
    </a>`;
  };

  // مكان الأسبوع: «مميز» يختاره صاحب الموقع أولاً، وإلا مكان بمنيو كامل يتبدّل كل أسبوع (نفس الأسبوع = نفس المكان)
  const leadPool = [];
  ["restaurants", "cafes", "bakeries"].forEach((s) => (SITE_DATA[s]?.items || []).forEach((item) => item.desc && item.hours && leadPool.push([s, item])));
  const featured = leadPool.filter(([, item]) => item.featured);
  const withMenu = leadPool.filter(([, item]) => item.menuCount >= 10);
  const choices = featured.length ? featured : withMenu.length ? withMenu : leadPool;
  const shown = new Set(); // ما يتكرر مكان بين مكان الأسبوع والصفّين
  if (choices.length) {
    const week = Math.floor((Date.now() / 86400000 + 3) / 7); // يتبدّل كل أحد
    const [ls, lead] = choices[week % choices.length];
    shown.add(lead.id);
    const menuLine = lead.menuCount ? `<span class="d-lead-menu">${escapeHtml(t("home_menu_count").replace("{n}", lead.menuCount))}</span>` : "";
    const box = document.getElementById("homeLeadCard");
    box.href = hrefOf(ls, lead);
    box.innerHTML = `<span class="d-lead-art" aria-hidden="true"><span class="halftone"></span></span>
      <span class="d-lead-text"><small class="d-kicker">${escapeHtml([secName(ls), typeOf(lead)].filter(Boolean).join(" · "))}</small>
      <b class="d-lead-title">${escapeHtml(itemTitle(lead))}</b><span class="d-desc">${escapeHtml(itemDesc(lead) || "")}</span>${menuLine}${meta(lead)}</span>`;
    document.getElementById("homeLead").hidden = false;
  }

  // صف الوقت (بلا مكان الأسبوع، وبلا تكرار بين الصفّين)
  const pool = [];
  slot.sections.forEach((s) =>
    (SITE_DATA[s]?.items || []).forEach((item) => {
      if (!slot.tags.length || s !== "restaurants" || item.tags.some((tg) => slot.tags.includes(tg))) pool.push([s, item]);
    })
  );
  const timeRow = oneEach(shuffle(pool.filter(([, item]) => !shown.has(item.id)))).slice(0, 6);
  timeRow.forEach(([, item]) => shown.add(item.id));
  if (timeRow.length) {
    document.getElementById("homeTimeTitle").textContent = t(slot.title);
    document.getElementById("homeTimeAll").href = searchUrl(slot.query);
    document.getElementById("homeTimeRow").innerHTML = timeRow.map(([s, item]) => card(s, item)).join("");
    document.getElementById("homeTime").hidden = false;
  }

  // جديد في توريلو: آخر ما أُضيف بكل الأقسام (المقالات تأخذ شارة «مقال»)
  const newest = [];
  Object.entries(SITE_DATA).forEach(([s, sec]) =>
    (sec.items || []).forEach((item) => {
      if (item.addedAt && !item.hideFromNewest) newest.push([s, item]);
    })
  );
  newest.sort((a, b) => b[1].addedAt - a[1].addedAt);
  const newRow = oneEach(newest.filter(([, item]) => !shown.has(item.id))).slice(0, 6);
  if (newRow.length) {
    document.getElementById("homeNewRow").innerHTML = newRow.map(([s, item]) => card(s, item, s === "guides" ? t("home_article_badge") : t("home_new_badge"))).join("");
    document.getElementById("homeNew").hidden = false;
  }
})();
