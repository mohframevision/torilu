package bh.mohframevision.torilu;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import java.util.Random;

// أصوات توريلو «ورق وحبر» — نقل مباشر لـsrc/js/sfx.js بالموقع: ضجيج مفلتر يشبه
// الورق، ونغمة ناعمة، وجرس مكتب بعيد للنتيجة. كله مولَّد بالكود، بلا ملفات صوت،
// هادئ بلا إيقاع ولا طبل. كل صوت يُركَّب بثلاث نسخ (بذور عشوائية مختلفة، مثل
// تنويع ±4% بالموقع) تُحفظ بالذاكرة ويُدار بينها، فالتشغيل فوري وما يحس آلي.
// الممر: lowpass 5000 ثم ضاغط (−20dB، 6:1) مثل bus() بالموقع.
class SoundPlayer {
    static final int TICK = 0;
    static final int TAP = 1;
    static final int ON = 2;
    static final int OFF = 3;
    static final int OPEN = 4;
    static final int CLOSE = 5;
    static final int SUCCESS = 6;
    static final int SHIMMER = 7;
    // 8..15 نغمات note(i) لصفحة القصة
    static final int TORILU = 16;
    static final int FAV_ON = 17;
    static final int FAV_OFF = 18;
    static final int COPY = 19;
    static final int SHARE = 20;
    static final int THEME = 21;
    static final int FOLD = 22;
    static final int CRUMPLE = 23;
    private static final int NOTE_BASE = 8;
    private static final int COUNT = 24;
    private static final int VARIANTS = 3;
    private static final double[] SCALE = {587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98};

    static int note(int i) {
        return NOTE_BASE + (i % SCALE.length);
    }

    private static final int SR = 44100;
    // سماعة الجوال أضعف من سماعات الكمبيوتر — رفع بسيط فوق مستويات الموقع
    private static final float MASTER = 1.6f;
    // تعويض الضاغط التلقائي بالمتصفح (DynamicsCompressor: (1/fullRangeGain)^0.6 ≈ +10dB)
    private static final float MAKEUP = 3.16f;
    private static final short[][][] cache = new short[COUNT][VARIANTS][];
    private static final int[] next = new int[COUNT];

    static void playClick(Context context) {
        play(context, TAP);
    }

    static void playSuccess(Context context) {
        play(context, SUCCESS);
    }

    static void play(Context context, int sound) {
        if (sound < 0 || sound >= COUNT || !Prefs.isSoundEnabled(context)) return;
        new PlayThread(sound).start();
    }

    // يركّب كل الأصوات بالخلفية عند فتح التطبيق — أول ضغطة تطلع بلا تأخير
    static void warmUp() {
        new WarmThread().start();
    }

    private static short[] get(int sound) {
        int v;
        synchronized (next) {
            v = next[sound];
            next[sound] = (v + 1) % VARIANTS;
        }
        return get(sound, v);
    }

    private static short[] get(int sound, int v) {
        synchronized (cache[sound]) {
            if (cache[sound][v] == null) cache[sound][v] = render(sound, v);
            return cache[sound][v];
        }
    }

    private static class WarmThread extends Thread {
        @Override
        public void run() {
            for (int v = 0; v < VARIANTS; v++)
                for (int i = 0; i < COUNT; i++) get(i, v);
        }
    }

    private static class PlayThread extends Thread {
        private final int sound;

        PlayThread(int sound) {
            this.sound = sound;
        }

        @Override
        public void run() {
            short[] pcm = get(sound);
            AudioTrack track;
            try {
                track = new AudioTrack.Builder()
                        .setAudioAttributes(new AudioAttributes.Builder()
                                // على صوت الوسائط (زي الألعاب) لا صوت الإشعارات:
                                // الجوال على الصامت/الاهتزاز كان يكتم أصوات
                                // "التنبيه" كلها فما يطلع أي صوت بالتطبيق
                                .setUsage(AudioAttributes.USAGE_GAME)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build())
                        .setAudioFormat(new AudioFormat.Builder()
                                .setSampleRate(SR)
                                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                .build())
                        .setBufferSizeInBytes(pcm.length * 2)
                        .setTransferMode(AudioTrack.MODE_STATIC)
                        .build();
            } catch (Exception e) {
                return;
            }
            track.write(pcm, 0, pcm.length);
            track.play();
            // ننتظر نهاية التشغيل قبل release() — تحريرها فوراً يقطع الصوت
            try {
                Thread.sleep(pcm.length * 1000L / SR + 40);
            } catch (InterruptedException ignored) {
            }
            track.release();
        }
    }

    // ===== التركيب (نفس دوال sfx.js) =====
    private static final class Synth {
        final float[] d = new float[(int) (2.4 * SR)];
        final Random rnd;
        final double scale;

        Synth(long seed, double scale) {
            rnd = new Random(seed);
            this.scale = scale;
        }

        // vary(x, r) بالموقع: ±r/2
        double vary(double x, double r) {
            return x * (1 + (rnd.nextDouble() - 0.5) * r);
        }

        // ورق: ضجيج بحبيبات خشخشة يمر بمرشح نطاق ينزلق أسّياً من from إلى to
        void paper(double at, double dur, double from, double to, double q, double gain,
                   double attack, double hold, double grain) {
            int start = (int) (at * SR);
            int n = Math.max(1, (int) (SR * dur));
            double f0 = vary(from, 0.08), f1 = vary(to, 0.08);
            double peak = vary(gain, 0.2) * scale;
            int aN = Math.max(1, (int) (attack * SR));
            int hN = hold > 0 ? Math.max(aN, (int) (dur * hold * SR)) : aN;
            double env = 0, target = 0;
            double x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, a1 = 0, a2 = 0;
            for (int i = 0; i < n && start + i < d.length; i++) {
                if (i % 180 == 0) target = rnd.nextDouble() < 0.25 ? rnd.nextDouble() : rnd.nextDouble() * 0.25;
                env += (target - env) * 0.02;
                double x = (rnd.nextDouble() * 2 - 1) * (1 - grain + grain * env * 2.2);
                if (i % 64 == 0) {
                    double f = f0 * Math.pow(f1 / f0, (double) i / n);
                    double w = 2 * Math.PI * f / SR;
                    double alpha = Math.sin(w) / (2 * q);
                    double a0 = 1 + alpha;
                    b0 = alpha / a0;
                    a1 = -2 * Math.cos(w) / a0;
                    a2 = (1 - alpha) / a0;
                }
                double y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
                x2 = x1;
                x1 = x;
                y2 = y1;
                y1 = y;
                double g;
                if (i < aN) g = 0.0001 * Math.pow(peak / 0.0001, (double) i / aN);
                else if (i < hN) g = peak;
                else g = peak * Math.pow(0.0001 / peak, (double) (i - hN) / Math.max(1, n - hN));
                d[start + i] += (float) (g * y);
            }
        }

        void paper(double at, double dur, double from, double to, double q, double gain, double attack, double grain) {
            paper(at, dur, from, to, q, gain, attack, 0, grain);
        }

        // نغمة جيبية ناعمة تنزلق (glide) وتخفت
        void tone(double at, double freq, double glide, double attack, double decay, double gain) {
            int start = (int) (at * SR);
            double f = vary(freq, 0.03);
            gain *= scale;
            int aN = Math.max(1, (int) (attack * SR));
            int dN = Math.max(1, (int) (decay * SR));
            int total = aN + dN + (int) (0.02 * SR);
            double phase = 0;
            for (int i = 0; i < total && start + i < d.length; i++) {
                double g = i < aN ? 0.0001 * Math.pow(gain / 0.0001, (double) i / aN)
                        : i < aN + dN ? gain * Math.pow(0.0001 / gain, (double) (i - aN) / dN) : 0.0001;
                double ff = glide == 1 ? f : f * Math.pow(glide, Math.min(1, (double) i / dN));
                phase += 2 * Math.PI * ff / SR;
                d[start + i] += (float) (g * Math.sin(phase));
            }
        }

        // جرس مكتب صغير بعيد: أساسية ونغمتان فوقها تخفتان أسرع
        void bell(double at, double freq, double gain, double decay) {
            tone(at, freq, 1, 0.01, decay, gain);
            tone(at, freq * 2.0, 1, 0.01, decay * 0.45, gain * 0.22);
            tone(at, freq * 2.76, 1, 0.01, decay * 0.25, gain * 0.1);
        }

        void tap(double gain, double dur) {
            paper(0, dur, 2200, 1500, 0.9, gain, 0.004, 0.3);
            paper(0, dur * 0.9, 520, 400, 0.7, gain / 3, 0.004, 0);
        }

        void close() {
            paper(0, 0.26, 2000, 700, 0.7, 0.1, 0.03, 0.5);
            paper(0.2, 0.12, 450, 300, 0.8, 0.08, 0.025, 0);
        }

        void copy() {
            paper(0, 0.04, 3000, 2600, 2.5, 0.1, 0.004, 0.5);
            paper(0.06, 0.1, 2400, 3200, 2.5, 0.09, 0.01, 0.5);
        }

        void on() {
            paper(0, 0.05, 1800, 1300, 0.9, 0.1, 0.004, 0.3);
            bell(0.03, 880, 0.045, 0.5);
        }
    }

    static float[] renderRaw(int sound, int variant) {
        Synth s = new Synth(sound * 31L + variant * 7919L + 1, sound == OFF ? 0.7 : 1);
        switch (sound) {
            case TICK:
                s.tap(0.08, 0.02);
                break;
            case TAP:
                s.tap(0.24, 0.05);
                break;
            case OPEN:
                s.paper(0, 0.42, 600, 2400, 0.7, 0.11, 0.16, 0.6);
                s.paper(0.33, 0.08, 1800, 1200, 1, 0.08, 0.005, 0);
                break;
            case OFF:
            case CLOSE:
                s.close();
                break;
            case FAV_ON:
                s.paper(0, 0.16, 420, 300, 0.6, 0.24, 0.025, 0);
                s.paper(0.11, 0.07, 1400, 1900, 1, 0.04, 0.01, 0.8);
                break;
            case FAV_OFF:
                s.paper(0, 0.22, 900, 2600, 1.2, 0.18, 0.06, 0.9);
                break;
            case SHIMMER:
            case COPY:
                s.copy();
                break;
            case SHARE:
                s.paper(0, 0.34, 900, 1500, 0.6, 0.1, 0.1, 0.15);
                break;
            case THEME:
                s.paper(0, 0.025, 1800, 1800, 3, 0.09, 0.002, 0);
                s.tone(0, 640, 1, 0.003, 0.05, 0.025);
                s.paper(0.09, 0.035, 900, 900, 2, 0.11, 0.003, 0);
                s.tone(0.09, 260, 0.9, 0.004, 0.08, 0.06);
                break;
            case SUCCESS:
                s.bell(0, 659.25, 0.06, 0.8);
                s.bell(0.17, 880, 0.05, 0.85);
                break;
            case ON:
            case TORILU:
                s.on();
                break;
            case CRUMPLE:
                for (int i = 0; i < 5; i++) {
                    double f = 1300 + s.rnd.nextDouble() * 1500;
                    s.paper(i * 0.1 + s.rnd.nextDouble() * 0.04, 0.08 + s.rnd.nextDouble() * 0.06,
                            f, f * 0.7, 0.8, 0.1 - i * 0.012, 0.006, 1);
                }
                break;
            case FOLD:
                s.paper(0, 0.9, 1600, 1600, 0.6, 0.07, 0.12, 0.6, 1);
                s.paper(1.05, 0.95, 1600, 1600, 0.6, 0.07, 0.12, 0.6, 1);
                break;
            default:
                // note(i): جرس ناعم بسلّم ري الكبير، يعلو مع كل فقرة بالقصة
                if (sound >= NOTE_BASE && sound < NOTE_BASE + SCALE.length)
                    s.bell(0, SCALE[sound - NOTE_BASE], 0.035, 0.6);
                break;
        }
        float[] x = s.d;
        lowpass(x, 5000, 1.06);
        compress(x);
        return x;
    }

    private static short[] render(int sound, int variant) {
        float[] x = renderRaw(sound, variant);
        int end = 0;
        for (int i = 0; i < x.length; i++) if (Math.abs(x[i]) > 0.0003f) end = i;
        // نقص الذيل الصامت — ملف أقصر = تشغيل أسرع وذاكرة أقل
        int fadeN = SR / 50;
        int len = Math.min(x.length, end + fadeN);
        short[] pcm = new short[len];
        for (int i = 0; i < len; i++) {
            float fade = i > len - fadeN ? (len - i) / (float) fadeN : 1f;
            float v = x[i] * fade;
            pcm[i] = (short) (Math.max(-1f, Math.min(1f, v)) * Short.MAX_VALUE);
        }
        return pcm;
    }

    // ضاغط بسيط مثل DynamicsCompressor بالموقع: −20dB، 6:1، knee 10، هجوم 3ms
    // وتحرير 150ms، ثم تعويض الكسب ورفع الجوال
    private static void compress(float[] x) {
        double att = Math.exp(-1.0 / (0.003 * SR)), rel = Math.exp(-1.0 / (0.15 * SR));
        double thr = -20, ratio = 6, knee = 10, envDb = -120;
        for (int i = 0; i < x.length; i++) {
            double lvl = 20 * Math.log10(Math.abs(x[i]) + 1e-9);
            envDb = lvl > envDb ? att * envDb + (1 - att) * lvl : rel * envDb + (1 - rel) * lvl;
            double over = envDb - thr, red;
            if (over <= -knee / 2) red = 0;
            else if (over >= knee / 2) red = over - over / ratio;
            else {
                double k = over + knee / 2;
                red = (1 - 1 / ratio) * k * k / (2 * knee);
            }
            x[i] *= (float) (Math.pow(10, -red / 20) * MAKEUP * MASTER);
        }
    }

    static void lowpass(float[] x, double freq, double q) {
        double w = 2 * Math.PI * freq / SR;
        double alpha = Math.sin(w) / (2 * q);
        double cos = Math.cos(w);
        double a0 = 1 + alpha;
        double b0 = (1 - cos) / 2 / a0, b1 = (1 - cos) / a0, b2 = b0, a1 = -2 * cos / a0, a2 = (1 - alpha) / a0;
        double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (int i = 0; i < x.length; i++) {
            double in = x[i];
            double y = b0 * in + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            x2 = x1;
            x1 = in;
            y2 = y1;
            y1 = y;
            x[i] = (float) y;
        }
    }
}
