/* ===== أصوات توريلو: ورق وحبر =====
   كل صوت مصنوع بالمتصفح (WebAudio) — بلا ملفات صوت ولا شيء مولَّد: ضجيج مفلتر يشبه
   الورق، ونبضة منخفضة ناعمة كالختم، وجرس مكتب بعيد للنتيجة. هادئة بلا إيقاع ولا طبل.
   مطفأة افتراضياً (site_sound_pref = "on" بزر السمّاعة بالهيدر)، وما يُنشأ AudioContext
   إلا بأول صوت بعد ضغطة الزائر نفسه. window.toriluSfx = { play, enabled }. */
(function () {
  const KEY = "site_sound_pref";
  // تنويع خفيف كل مرة (±r/2) عشان التكرار ما يحس آلي
  const vary = (x, r = 0.08) => x * (1 + (Math.random() - 0.5) * r);

  // ورق: ضجيج بحبيبات خشخشة (grain 0..1) يمر بمرشّح يتحرك من from إلى to
  function paper(ctx, out, t0, o) {
    const { at = 0, dur, from, to = from, q = 0.8, gain, attack = 0.005, hold = 0, grain = 0 } = o;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let env = 0;
    let target = 0;
    for (let i = 0; i < n; i++) {
      if (i % 180 === 0) target = Math.random() < 0.25 ? Math.random() : Math.random() * 0.25;
      env += (target - env) * 0.02;
      d[i] = (Math.random() * 2 - 1) * (1 - grain + grain * env * 2.2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = q;
    const t = t0 + at;
    band.frequency.setValueAtTime(vary(from), t);
    band.frequency.exponentialRampToValueAtTime(vary(to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    const peak = vary(gain, 0.2);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    if (hold) g.gain.setValueAtTime(peak, t + dur * hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(band).connect(g).connect(out);
    src.start(t);
  }

  // نغمة جيبية ناعمة تنزل قليلاً (glide) وتخفت — جسم الختم والمصباح والجرس
  function tone(ctx, out, t0, o) {
    const { at = 0, freq, glide = 1, attack = 0.008, decay, gain } = o;
    const t = t0 + at;
    const osc = ctx.createOscillator();
    const f = vary(freq, 0.03);
    osc.frequency.setValueAtTime(f, t);
    if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(f * glide, t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + attack + decay + 0.02);
  }

  // جرس مكتب صغير بعيد: نغمة أساسية ونغمتان فوقها تخفتان أسرع
  function bell(ctx, out, t0, at, freq, gain, decay) {
    tone(ctx, out, t0, { at, freq, attack: 0.01, decay, gain });
    tone(ctx, out, t0, { at, freq: freq * 2.0, attack: 0.01, decay: decay * 0.45, gain: gain * 0.22 });
    tone(ctx, out, t0, { at, freq: freq * 2.76, attack: 0.01, decay: decay * 0.25, gain: gain * 0.1 });
  }

  const SOUNDS = {
    // لمسة ورق: احتكاك قصير جداً
    tap(c, o, t) {
      paper(c, o, t, { dur: 0.05, from: 2200, to: 1500, q: 0.9, gain: 0.24, attack: 0.004, grain: 0.3 });
      paper(c, o, t, { dur: 0.045, from: 520, to: 400, q: 0.7, gain: 0.08, attack: 0.004 });
    },
    // قلب صفحة: خشخشة تعلو ثم نقرة طرف الورقة
    open(c, o, t) {
      paper(c, o, t, { dur: 0.42, from: 600, to: 2400, q: 0.7, gain: 0.11, attack: 0.16, grain: 0.6 });
      paper(c, o, t, { at: 0.33, dur: 0.08, from: 1800, to: 1200, q: 1, gain: 0.08 });
    },
    // الورقة تستقر: خشخشة نازلة ونزول ناعم على الطاولة
    close(c, o, t) {
      paper(c, o, t, { dur: 0.26, from: 2000, to: 700, q: 0.7, gain: 0.1, attack: 0.03, grain: 0.5 });
      paper(c, o, t, { at: 0.2, dur: 0.12, from: 450, to: 300, q: 0.8, gain: 0.08, attack: 0.025 });
    },
    // ختم حبر: ضغطة منخفضة مكتومة كاللباد، ثم رفع الختم عن الورق
    // (بلا نغمة منخفضة نازلة ولا بداية حادة — تلك بصمة الطبل)
    favOn(c, o, t) {
      paper(c, o, t, { dur: 0.16, from: 420, to: 300, q: 0.6, gain: 0.24, attack: 0.025 });
      paper(c, o, t, { at: 0.11, dur: 0.07, from: 1400, to: 1900, q: 1, gain: 0.04, attack: 0.01, grain: 0.8 });
    },
    // تقشير خفيف: ورقة لاصقة تنرفع
    favOff(c, o, t) {
      paper(c, o, t, { dur: 0.22, from: 900, to: 2600, q: 1.2, gain: 0.18, attack: 0.06, grain: 0.9 });
    },
    // علامة قلم رصاص ✓: خط قصير نازل ثم أطول صاعد
    copy(c, o, t) {
      paper(c, o, t, { dur: 0.04, from: 3000, to: 2600, q: 2.5, gain: 0.1, attack: 0.004, grain: 0.5 });
      paper(c, o, t, { at: 0.06, dur: 0.1, from: 2400, to: 3200, q: 2.5, gain: 0.09, attack: 0.01, grain: 0.5 });
    },
    // ورقة تنزلق على الطاولة نحو غيرك
    share(c, o, t) {
      paper(c, o, t, { dur: 0.34, from: 900, to: 1500, q: 0.6, gain: 0.1, attack: 0.1, grain: 0.15 });
    },
    // سحب سلسلة مصباح المكتب: تكّة خفيفة ثم أخفض
    theme(c, o, t) {
      paper(c, o, t, { dur: 0.025, from: 1800, q: 3, gain: 0.09, attack: 0.002 });
      tone(c, o, t, { freq: 640, attack: 0.003, decay: 0.05, gain: 0.025 });
      paper(c, o, t, { at: 0.09, dur: 0.035, from: 900, q: 2, gain: 0.11, attack: 0.003 });
      tone(c, o, t, { at: 0.09, freq: 260, glide: 0.9, attack: 0.004, decay: 0.08, gain: 0.06 });
    },
    // نتيجة («اختار لي»، خطة اليوم): جرس مكتب بعيد بنغمتين دافئتين
    success(c, o, t) {
      bell(c, o, t, 0, 659.25, 0.06, 0.8);
      bell(c, o, t, 0.17, 880, 0.05, 0.85);
    },
    // تشغيل الأصوات: لمسة ورق ونغمة جرس واحدة قصيرة
    on(c, o, t) {
      paper(c, o, t, { dur: 0.05, from: 1800, to: 1300, q: 0.9, gain: 0.1, attack: 0.004, grain: 0.3 });
      bell(c, o, t, 0.03, 880, 0.045, 0.5);
    },
    // ورقة تتكوّر بين الأصابع («اختار لي»): خمس طقطقات ورق قصيرة متقاربة، بلا نغمة
    crumple(c, o, t) {
      for (let i = 0; i < 5; i++) {
        const f = 1300 + Math.random() * 1500;
        paper(c, o, t, { at: i * 0.1 + Math.random() * 0.04, dur: 0.08 + Math.random() * 0.06, from: f, to: f * 0.7, q: 0.8, gain: 0.1 - i * 0.012, attack: 0.006, grain: 1 });
      }
    },
    // الجريدة تنفرد طيّتين (fold.js): خشخشتان أطول
    fold(c, o, t) {
      paper(c, o, t, { dur: 0.9, from: 1600, q: 0.6, gain: 0.07, attack: 0.12, hold: 0.6, grain: 1 });
      paper(c, o, t, { at: 1.05, dur: 0.95, from: 1600, q: 0.6, gain: 0.07, attack: 0.12, hold: 0.6, grain: 1 });
    },
  };

  // ممر واحد لكل الأصوات: مرشّح يقص الحدة فوق 5 كيلوهرتز، ثم ضاغط يمسك القمم
  function bus(ctx) {
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 5000;
    low.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    low.connect(comp).connect(ctx.destination);
    return low;
  }

  function enabled() {
    try {
      return localStorage.getItem(KEY) === "on";
    } catch {
      return false;
    }
  }

  let ctx;
  let out;
  // force: صفحة الاستماع المحلية تشغّل بلا تفضيل محفوظ
  function play(name, force) {
    if ((!force && !enabled()) || !SOUNDS[name]) return;
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        out = bus(ctx);
      }
      if (ctx.state === "suspended") ctx.resume();
      SOUNDS[name](ctx, out, ctx.currentTime + 0.01);
    } catch {
      /* بلا صوت إن ما دعمه المتصفح */
    }
  }

  window.toriluSfx = { play, enabled, SOUNDS, bus };

  // زر السمّاعة بالهيدر: الأيقونتان بالقالب، والظاهرة منهما حسب data-on (CSS)
  const btn = document.querySelector(".sound-toggle");
  if (!btn) return;
  const T = (window.I18N && window.I18N[window.SITE_LANG || "ar"]) || {};
  function paint() {
    const on = enabled();
    btn.dataset.on = String(on);
    const label = on ? T.sound_on : T.sound_off;
    if (label) {
      btn.title = label;
      btn.setAttribute("aria-label", label);
    }
  }
  paint();
  btn.addEventListener("click", () => {
    const next = !enabled();
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* تخزين محجوب: يبقى مطفأ */
    }
    paint();
    if (next) play("on");
  });
})();
