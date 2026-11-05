/* ===== الجريدة المطويّة: صفحة المكان والمقال تبدأ جريدة مطويّة مرتين وعليها «اضغط لفتح
   الجريدة»؛ بالضغط (أو Enter/مسافة) تنفتح طيّة بعد طيّة بصوت ورق هادئ، ثم تتلاشى علامات
   الطيّ بعد ثوانٍ. الطيّات طبقات زينة (aria-hidden) فوق الورقة الحقيقية اللي تبقى بالصفحة
   كما هي — بلا JS أو مع تقليل الحركة ما يُطبَّق شيء من هذا وتظهر الورقة مفتوحة. ===== */
(function () {
  const sheet = document.querySelector(".np-article > .np-sheet:not(.np-front)");
  if (!sheet || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const lang = window.SITE_LANG || "ar";
  const T = (window.I18N && window.I18N[lang]) || {};
  const hint = T.fold_hint || "";
  const title = (sheet.querySelector("h1") || {}).textContent || "";

  // الوجه الأمامي لكل قطعة: نسخة صامتة من أعلى الورقة نفسها، فتطابق الورقة الحقيقية لما تنفتح
  function face() {
    const f = document.createElement("span");
    f.className = "np-face";
    const page = document.createElement("span");
    page.className = "np-sheet np-fold-face";
    for (const child of sheet.children) page.appendChild(child.cloneNode(true));
    page.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    f.appendChild(page);
    return f;
  }
  const span = (cls) => {
    const s = document.createElement("span");
    s.className = cls;
    return s;
  };
  function piece(cls, back) {
    const p = span(cls);
    p.append(face());
    if (back) p.append(back);
    return p;
  }

  const cover = span("np-cover");
  const name = span("np-cover-name");
  name.textContent = lang === "en" ? "Torilu" : "توريلو";
  name.appendChild(document.createElement("i")).textContent = ".";
  const head = span("np-cover-title");
  head.textContent = title;
  const hintEl = span("np-cover-hint");
  hintEl.textContent = hint;
  cover.append(name, head, span("np-cover-lines"), hintEl);

  const right = span("np-half r");
  right.append(piece("np-piece"), piece("np-flap", cover));
  const left = span("np-half l");
  left.append(piece("np-piece", span("np-back")), piece("np-flap", span("np-back")));
  const paper = span("np-fold-paper");
  paper.setAttribute("aria-hidden", "true");
  paper.inert = true;
  paper.append(right, left);

  const fold = document.createElement("div");
  fold.className = "np-fold";
  fold.setAttribute("role", "button");
  fold.tabIndex = 0;
  fold.setAttribute("aria-label", hint);
  fold.appendChild(paper);

  // شريط صغير فوق الورقة: زر الصوت (يُحفظ) وزر «اطوِ الجريدة» (يظهر بعد الفتح)
  const SOUND_KEY = "torilu_fold_sound";
  let soundOn = true;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    /* تخزين محجوب: الصوت مفعّل افتراضياً */
  }
  const tools = document.createElement("div");
  tools.className = "np-tools";
  const soundBtn = document.createElement("button");
  soundBtn.type = "button";
  soundBtn.className = "btn secondary np-tool";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn secondary np-tool";
  closeBtn.textContent = T.fold_close || "";
  closeBtn.hidden = true;
  function paintSound() {
    soundBtn.textContent = soundOn ? T.fold_sound_on : T.fold_sound_off;
    soundBtn.setAttribute("aria-pressed", String(soundOn));
  }
  paintSound();
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
    } catch {
      /* لا شيء */
    }
    paintSound();
  });
  tools.append(closeBtn, soundBtn);

  // المقاسات من الورقة نفسها (offset* بوحدات CSS، فتصحّ مع zoom الشاشات العريضة)
  function measure() {
    const W = sheet.offsetWidth;
    const H = Math.min(sheet.scrollHeight, Math.max(W * 0.68, 460));
    const w = W / 2;
    const h = Math.round(H / 2);
    const s = Math.min(1.88, Math.max(1, 620 / w));
    const st = fold.style;
    st.setProperty("--x", sheet.offsetLeft + "px");
    st.setProperty("--y", sheet.offsetTop + "px");
    st.setProperty("--w", w + "px");
    st.setProperty("--h", h + "px");
    st.setProperty("--s", s);
    st.setProperty("--s1", 1 + (s - 1) * 0.35);
    st.setProperty("--dx", -w / 2 + "px");
    st.setProperty("--dy", Math.min(24, Math.max(0, (2 * h - h * s) / 2)) + "px");
    sheet.style.setProperty("--fold-h", h + "px");
  }
  measure();
  sheet.classList.add("np-folded");
  sheet.before(tools, fold);
  measure();
  window.addEventListener("resize", measure);

  // صوت ورق ينفرد: ضجيج مفلتر بحبيبات خشخشة عشوائية، منخفض وبلا حدّة — يُولَّد بالمتصفح
  let ctx;
  function rustle(at, dur) {
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let env = 0;
    let target = 0;
    for (let i = 0; i < n; i++) {
      if (i % 180 === 0) target = Math.random() < 0.25 ? Math.random() : Math.random() * 0.25;
      env += (target - env) * 0.02;
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1600;
    band.Q.value = 0.6;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 3800;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.12);
    g.gain.setValueAtTime(0.11, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(band).connect(low).connect(g).connect(ctx.destination);
    src.start(t0);
  }
  function sound() {
    // يُشغَّل فقط من ضغطة الزائر نفسها وبصوت خافت، وزر الصوت فوق الورقة يطفئه
    if (!soundOn) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
      rustle(0, 0.9);
      rustle(1.05, 0.95);
    } catch {
      /* بلا صوت إن ما دعمه المتصفح */
    }
  }

  let busy = false;
  function open() {
    if (busy) return;
    busy = true;
    const hadFocus = document.activeElement === fold;
    sound();
    fold.classList.add("is-half");
    setTimeout(() => fold.classList.add("is-open"), 1050);
    setTimeout(() => {
      window.removeEventListener("resize", measure);
      sheet.classList.remove("np-folded");
      fold.classList.add("is-gone");
      if (hadFocus) {
        sheet.tabIndex = -1;
        sheet.focus({ preventScroll: true });
      }
      setTimeout(() => {
        fold.hidden = true;
        closeBtn.hidden = false;
        busy = false;
      }, 400);
      // بعد ما تنفتح بثلاث ثوانٍ تتلاشى علامات الطيّ فما تزعج القارئ
      setTimeout(() => sheet.classList.add("np-clean"), 3000);
    }, 2050);
  }
  // الطيّ من جديد: نفس الحركة بالعكس — تظهر الطيّات مفتوحة فوق الورقة ثم تنطوي
  function close() {
    if (busy) return;
    busy = true;
    closeBtn.hidden = true;
    tools.scrollIntoView({ behavior: "smooth", block: "start" });
    sheet.classList.remove("np-clean");
    fold.classList.add("is-half", "is-open", "is-gone");
    fold.hidden = false;
    measure();
    window.addEventListener("resize", measure);
    void fold.offsetWidth;
    fold.classList.remove("is-gone");
    setTimeout(() => {
      sheet.classList.add("np-folded");
      measure();
      sound();
      fold.classList.remove("is-open");
      setTimeout(() => fold.classList.remove("is-half"), 1050);
      setTimeout(() => {
        busy = false;
        if (closeBtn === document.activeElement) fold.focus({ preventScroll: true });
      }, 2100);
    }, 400);
  }
  closeBtn.addEventListener("click", close);
  fold.addEventListener("click", open);
  fold.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
})();
