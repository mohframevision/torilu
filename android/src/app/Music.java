package bh.mohframevision.torilu;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import java.util.ArrayList;
import java.util.Random;

// موسيقى خلفية هادئة مولَّدة بالكود (لصفحة القصة وغيرها): وسادة ناعمة على سلّم
// ري الخماسي تتبدّل كل 8–12 ثانية بتلاشٍ 4 ثوانٍ، وأجراس مكتب خفيفة متباعدة بلا
// انتظام، فوق صدى خفيف ومرشح 3500. بلا طبل ولا نبض ولا إيقاع منتظم ولا مقامات طرب.
// تطيع إعداد الصوت: start لا تعمل إن كان مطفأً، والحلقة تفحصه كل كتلة فتخفت وتقف
// إن أُطفئ. المستدعي يستدعي Music.stop() في onPause.
final class Music {
    private static final int SR = 44100;
    private static final int BLOCK = 4096;
    private static MusicThread current;

    private Music() {
    }

    static synchronized boolean isPlaying() {
        return current != null && !current.stopping;
    }

    static synchronized void start(Context c) {
        if (isPlaying() || !Prefs.isSoundEnabled(c)) return;
        current = new MusicThread(c.getApplicationContext());
        current.start();
    }

    static synchronized void stop() {
        if (current != null) current.stopping = true;
        current = null;
    }

    // يرجع الحالة الجديدة (true = تعزف)
    static synchronized boolean toggle(Context c) {
        if (isPlaying()) stop();
        else start(c);
        return isPlaying();
    }

    // ===== التركيب =====
    private static final double D3 = 146.83, E3 = 164.81, FS3 = 185.0, A3 = 220.0, B3 = 246.94;
    private static final double A2 = 110.0, B2 = 123.47, D4 = 293.66, E4 = 329.63, FS4 = 369.99, A4 = 440.0, B4 = 493.88, D5 = 587.33;
    // توزيعات مفتوحة كلها من سلّم ري الخماسي (ري مي فا# لا سي)
    private static final double[][] CHORDS = {
            {D3, A3, FS4}, {B2, FS3, D4}, {E3, B3, FS4}, {A2, E3, B3}, {D3, A3, E4}, {B2, FS3, A3},
    };
    private static final double[] BELLS = {D4, E4, FS4, A4, B4, D5};
    private static final int TABLE = 4096;
    private static final float[] SINE = new float[TABLE];

    static {
        for (int i = 0; i < TABLE; i++) SINE[i] = (float) Math.sin(2 * Math.PI * i / TABLE);
    }

    private static float sin(double phase) {
        return SINE[(int) (phase * TABLE) & (TABLE - 1)];
    }

    // صوت واحد: أساسية + 2f و3f خفيفتان (قريبة من المثلث)، بتذبذب بطيء جداً بالطبقة
    private static final class Voice {
        final double freq, drift;
        double phase, lfo, amp, target, rate;
        final boolean bell;
        final double decay;

        Voice(double freq, double drift, boolean bell, double decay) {
            this.freq = freq;
            this.drift = drift;
            this.bell = bell;
            this.decay = decay;
        }
    }

    static final class MusicThread extends Thread {
        private final Context ctx;
        volatile boolean stopping;
        private final Random rnd = new Random();
        private final ArrayList<Voice> voices = new ArrayList<>();

        MusicThread(Context ctx) {
            super("torilu-music");
            this.ctx = ctx;
        }

        @Override
        public void run() {
            AudioTrack track;
            try {
                int min = AudioTrack.getMinBufferSize(SR, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT);
                track = new AudioTrack.Builder()
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_MEDIA)
                                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                                .build())
                        .setAudioFormat(new AudioFormat.Builder()
                                .setSampleRate(SR)
                                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                                .build())
                        .setBufferSizeInBytes(Math.max(min, BLOCK * 4 * 2))
                        .setTransferMode(AudioTrack.MODE_STREAM)
                        .build();
                track.play();
            } catch (Exception e) {
                return;
            }
            short[] out = new short[BLOCK * 2];
            float[] mono = new float[BLOCK];
            // صدى: خطّا تأخير بأطوال مختلفة لكل قناة مع تخميد بالحلقة
            float[] dl = new float[(int) (0.37 * SR)], dr = new float[(int) (0.43 * SR)];
            int il = 0, ir = 0;
            float dampL = 0, dampR = 0, lpL = 0, lpR = 0;
            float lpA = (float) (1 - Math.exp(-2 * Math.PI * 3500 / SR));
            double master = 0;
            double fadeIn = 1.0 / (2.0 * SR), fadeOut = 1.0 / (1.2 * SR);
            long t = 0;
            long nextChord = 0, nextBell = (long) (SR * (2.5 + rnd.nextDouble() * 4.5));
            int chord = -1;
            boolean finishing = false;
            while (true) {
                if (!finishing && (stopping || !Prefs.isSoundEnabled(ctx))) {
                    finishing = true;
                    stopping = true;
                }
                if (t >= nextChord) {
                    chord = changeChord(chord);
                    nextChord = t + (long) (SR * (8 + rnd.nextDouble() * 4));
                }
                if (t >= nextBell) {
                    double f = BELLS[rnd.nextInt(BELLS.length)];
                    double g = 0.012 + rnd.nextDouble() * 0.018;
                    bell(f, g, 2.2);
                    bell(f * 2.0, g * 0.22, 1.0);
                    bell(f * 2.76, g * 0.1, 0.55);
                    nextBell = t + (long) (SR * (2.5 + rnd.nextDouble() * 4.5));
                }
                renderBlock(mono);
                for (int i = 0; i < BLOCK; i++) {
                    master = finishing ? Math.max(0, master - fadeOut) : Math.min(1, master + fadeIn);
                    float x = (float) (mono[i] * master);
                    float yl = dl[il], yr = dr[ir];
                    dampL += (yl - dampL) * 0.35f;
                    dampR += (yr - dampR) * 0.35f;
                    dl[il] = x + dampR * 0.42f;
                    dr[ir] = x + dampL * 0.42f;
                    il = (il + 1) % dl.length;
                    ir = (ir + 1) % dr.length;
                    lpL += (x * 0.8f + yl * 0.35f - lpL) * lpA;
                    lpR += (x * 0.8f + yr * 0.35f - lpR) * lpA;
                    out[i * 2] = (short) (Math.max(-1f, Math.min(1f, lpL)) * Short.MAX_VALUE);
                    out[i * 2 + 1] = (short) (Math.max(-1f, Math.min(1f, lpR)) * Short.MAX_VALUE);
                }
                t += BLOCK;
                if (track.write(out, 0, out.length) < 0) break;
                if (finishing && master <= 0) break;
            }
            try {
                track.stop();
            } catch (Exception ignored) {
            }
            track.release();
        }

        private int changeChord(int prev) {
            int c;
            do c = rnd.nextInt(CHORDS.length); while (c == prev);
            double rate = 0.045 / (4.0 * SR); // تلاشٍ 4 ثوانٍ للدخول والخروج
            for (Voice v : voices) if (!v.bell) {
                v.target = 0;
                v.rate = rate;
            }
            for (double f : CHORDS[c]) {
                Voice v = new Voice(f, 0.05 + rnd.nextDouble() * 0.08, false, 0);
                v.phase = rnd.nextDouble();
                v.target = 0.045;
                v.rate = rate;
                voices.add(v);
            }
            return c;
        }

        private void bell(double f, double gain, double decaySec) {
            Voice v = new Voice(f, 0, true, Math.exp(Math.log(0.0001) / (decaySec * SR)));
            v.amp = Math.min(gain, 0.03);
            voices.add(v);
        }

        private void renderBlock(float[] mono) {
            java.util.Arrays.fill(mono, 0);
            for (int k = voices.size() - 1; k >= 0; k--) {
                Voice v = voices.get(k);
                double inc = v.freq / SR;
                for (int i = 0; i < BLOCK; i++) {
                    if (v.bell) {
                        v.amp *= v.decay;
                    } else if (v.amp != v.target) {
                        v.amp = v.amp < v.target ? Math.min(v.target, v.amp + v.rate) : Math.max(v.target, v.amp - v.rate);
                    }
                    v.phase += inc;
                    if (v.phase >= 1) v.phase -= 1;
                    float s;
                    if (v.bell) {
                        s = sin(v.phase);
                    } else {
                        v.lfo += v.drift / SR;
                        float sw = 0.85f + 0.15f * sin(v.lfo);
                        s = (sin(v.phase) + 0.3f * sin(v.phase * 2) + 0.12f * sin(v.phase * 3)) * sw;
                    }
                    mono[i] += (float) (v.amp * s);
                }
                if ((v.bell && v.amp < 0.00005) || (!v.bell && v.target == 0 && v.amp <= 0)) voices.remove(k);
            }
        }
    }
}
