package bh.mohframevision.torilu;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.View;
import java.util.ArrayList;
import java.util.List;

/* مسرح «اختار لي» (رسم فقط، بلا لمس): حلقتا نقاط حول القمر، حلقة العجلة، آثار حبر
   الأزرار وهي ترجع للمركز، وكرة ورق الجريدة المكوّرة (pkHalo / pkBall / .pk-trail
   بـsrc/js/picker.js). القمر والأزرار نفسها Views عادية فوقه (لمس وقارئ شاشة). */
public class PickerStage extends View {
    // عشوائي ثابت البذرة (pkRng = mulberry32 بالموقع): نفس البذرة = نفس الشكل
    static final class Rng {
        private int s;

        Rng(long seed) {
            s = (int) seed;
        }

        double next() {
            s += 0x6d2b79f5;
            int x = s;
            x = (x ^ (x >>> 15)) * (x | 1);
            x ^= x + (x ^ (x >>> 7)) * (x | 61);
            return ((x ^ (x >>> 14)) & 0xffffffffL) / 4294967296.0;
        }

        float f() {
            return (float) next();
        }
    }

    private final Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint bmp = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private final Paint shadow = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float density;

    float cx, cy, b, rad, p, ballD;
    float haloAlpha = 1f, haloScale = 1f, ringAlpha, ringScale = 0.5f;

    // الكرة
    private Bitmap ball;
    private long ballShownAt = -1;
    private float ballScale = 0.2f, ballAlpha;
    private boolean wobble;

    // آثار الحبر: [tx, ty, size, opacity, delayMs]
    private final List<float[]> trails = new ArrayList<>();
    private long trailsAt;

    public PickerStage(Context c) {
        super(c);
        density = c.getResources().getDisplayMetrics().density;
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    void startTrails(int n) {
        trails.clear();
        float[][] k = {{0.96f, 0.11f, 0.5f, 40}, {0.8f, 0.08f, 0.32f, 110}, {0.64f, 0.055f, 0.2f, 180}};
        for (int i = 0; i < n; i++) {
            double a = (double) i / n * Math.PI * 2 + 0.3;
            for (float[] q : k) {
                trails.add(new float[]{(float) Math.sin(a) * q[0], (float) -Math.cos(a) * q[0], q[1], q[2], q[3] + (n - 1 - i) * 22});
            }
        }
        trailsAt = SystemClock.uptimeMillis();
        invalidate();
    }

    // كرة جديدة تظهر (wobble = تتمايل؛ بلا حركة مع «تقليل الحركة»)
    void showBall(long seed, String[] words, boolean motion) {
        int size = Math.max(2, Math.round(ballD));
        if (ball != null) ball.recycle();
        ball = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        drawBall(new Canvas(ball), size, seed, words);
        wobble = motion;
        ballShownAt = SystemClock.uptimeMillis() - (motion ? 0 : 800);
        invalidate();
    }

    void hideBall() {
        ballShownAt = -1;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas c) {
        long now = SystemClock.uptimeMillis();
        boolean again = false;
        int ink = getContext().getColor(R.color.brand_accent);
        dot.setColor(ink);

        // حلقتا القمر (pkHalo: [r, n, dot, opacity] بمربع 200 = 1.9 قطر القمر)
        if (haloAlpha > 0.01f) {
            float u = b * 1.9f / 200f * haloScale;
            ring(c, u, 66, 54, 0.9f, 0.32f * haloAlpha);
            ring(c, u, 80, 72, 0.6f, 0.18f * haloAlpha);
        }
        if (ringAlpha > 0.01f) ring(c, rad * 2.1f / 200f * ringScale, 95, 90, 0.75f, 0.55f * 0.7f * ringAlpha);

        // آثار الحبر 800ms: تظهر لـ20% ثم تخفت
        if (!trails.isEmpty()) {
            boolean live = false;
            for (float[] t : trails) {
                float e = (now - trailsAt - t[4]) / 800f;
                if (e < 0) {
                    live = true;
                    continue;
                }
                if (e > 1) continue;
                live = true;
                float o = e < 0.2f ? t[3] * e / 0.2f : t[3] * (1 - (e - 0.2f) / 0.8f);
                dot.setAlpha(Math.round(255 * o));
                c.drawCircle(cx + rad * t[0], cy + rad * t[1], p * t[2] / 2f, dot);
            }
            dot.setAlpha(255);
            if (live) again = true;
            else trails.clear();
        }

        // الكرة: تكبر بنابض بعد 200ms، ثم تتمايل ±6° حول (50%، 60%)
        float targetScale = ballShownAt >= 0 ? 1f : 0.2f;
        float targetAlpha = ballShownAt >= 0 ? 1f : 0f;
        if (ballShownAt >= 0) {
            float e = (now - ballShownAt - 200) / 550f;
            ballScale = e <= 0 ? 0.2f : e >= 1 ? 1f : 0.2f + 0.8f * overshoot(e);
            ballAlpha = Math.max(0f, Math.min(1f, (now - ballShownAt - 200) / 200f));
            again = true;
        } else if (ballAlpha > 0) {
            ballAlpha = Math.max(0f, ballAlpha - 0.12f);
            ballScale += (targetScale - ballScale) * 0.25f;
            again = ballAlpha > 0;
        }
        if (ball != null && ballAlpha > 0.01f) {
            float u = ballD / 220f;
            c.save();
            c.translate(cx, cy);
            c.scale(ballScale, ballScale);
            // ظل بيضاوي تحت الكرة (لا يتمايل)
            int sc = getContext().getColor(R.color.pk_shadow);
            shadow.setShader(new RadialGradient(12 * u, 103 * u, 74 * u, sc, sc & 0x00FFFFFF, Shader.TileMode.CLAMP));
            shadow.setAlpha(Math.round(255 * ballAlpha));
            c.save();
            c.scale(1f, 11f / 74f, 12 * u, 103 * u);
            c.drawCircle(12 * u, 103 * u, 74 * u, shadow);
            c.restore();
            if (wobble && ballShownAt >= 0) {
                float t = (now - ballShownAt - 300) / 450f;
                if (t > 0) {
                    float ph = t % 2f;
                    float k = ph < 1 ? ph : 2 - ph;
                    k = (float) (0.5 - Math.cos(k * Math.PI) / 2);
                    float rot = -6 + 12 * k;
                    float ty = (1 - 4 * k) * u;
                    c.translate(0, ty);
                    c.rotate(rot, 0, ballD * 0.1f);
                }
            }
            bmp.setAlpha(Math.round(255 * ballAlpha));
            c.drawBitmap(ball, -ballD / 2f, -ballD / 2f, bmp);
            c.restore();
        }
        if (again) postInvalidateOnAnimation();
    }

    private static float overshoot(float t) {
        // cubic-bezier(.34, 1.5, .5, 1) تقريباً: يتجاوز قليلاً ثم يستقر
        float s = 1.9f;
        t -= 1;
        return t * t * ((s + 1) * t + s) + 1;
    }

    private void ring(Canvas c, float u, float r, int n, float d, float op) {
        dot.setAlpha(Math.round(255 * op));
        for (int i = 0; i < n; i++) {
            double a = (double) i / n * Math.PI * 2;
            float k = (float) (0.55 + 0.45 * Math.sin(a * 3 + 1));
            c.drawCircle(cx + (float) (r * Math.cos(a)) * u, cy + (float) (r * Math.sin(a)) * u, d * k * u, dot);
        }
        dot.setAlpha(255);
    }

    // ===== كرة ورق الجريدة (pkBall): حافة مضلّعة، وجوه مثلثة بإضاءة من أعلى اليسار،
    // وعلى أغلب الوجوه بقايا طباعة (سطور، عناوين، كلمات) — تُقرأ جريدة لا حجراً =====
    private void drawBall(Canvas cv, int size, long seed, String[] words) {
        Context ctx = getContext();
        Rng r = new Rng(seed);
        int n = 17;
        float[][] edge = new float[n][];
        Path blob = new Path();
        for (int i = 0; i < n; i++) {
            double a = (double) i / n * Math.PI * 2 + r.next() * 0.25;
            double rr = 78 + r.next() * 16 - Math.abs(Math.sin(a)) * 4;
            edge[i] = new float[]{(float) (rr * Math.cos(a)), (float) (rr * Math.sin(a) * 0.93)};
            if (i == 0) blob.moveTo(edge[i][0], edge[i][1]);
            else blob.lineTo(edge[i][0], edge[i][1]);
        }
        blob.close();
        List<float[][]> rings = new ArrayList<>();
        rings.add(new float[][]{{(r.f() - 0.5f) * 14, (r.f() - 0.5f) * 14}});
        int[][] spec = {{6, 30}, {11, 58}, {17, 100}};
        for (int[] s : spec) {
            float[][] ring = new float[s[0]][];
            double off = r.next() * 6;
            for (int i = 0; i < s[0]; i++) {
                double a = (i + off + (r.next() - 0.5) * 0.5) / s[0] * Math.PI * 2;
                double rr = s[1] * (0.85 + r.next() * 0.3);
                ring[i] = new float[]{(float) (rr * Math.cos(a)), (float) (rr * Math.sin(a))};
            }
            rings.add(ring);
        }
        List<float[][]> tris = new ArrayList<>();
        for (int j = 0; j < rings.size() - 1; j++) {
            float[][] A = sortByAngle(rings.get(j));
            float[][] B = sortByAngle(rings.get(j + 1));
            if (A.length == 1) {
                for (int i = 0; i < B.length; i++) tris.add(new float[][]{A[0], B[i], B[(i + 1) % B.length]});
                continue;
            }
            int ia = 0, ib = 0;
            for (int s = 0; s < A.length + B.length; s++) {
                float[] a0 = A[ia % A.length];
                float[] b0 = B[ib % B.length];
                double na = ang(A[(ia + 1) % A.length]) + (ia + 1 >= A.length ? Math.PI * 2 : 0);
                double nb = ang(B[(ib + 1) % B.length]) + (ib + 1 >= B.length ? Math.PI * 2 : 0);
                if ((na <= nb && ia < A.length) || ib >= B.length) {
                    tris.add(new float[][]{a0, A[(ia + 1) % A.length], b0});
                    ia++;
                } else {
                    tris.add(new float[][]{a0, B[(ib + 1) % B.length], b0});
                    ib++;
                }
            }
        }

        int lo = ctx.getColor(R.color.pk_ball_lo), hi = ctx.getColor(R.color.pk_ball_hi);
        int printColor = ctx.getColor(R.color.pk_ball_print);
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint ink = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        line.setStyle(Paint.Style.STROKE);
        Typeface amiri = Typeface.SERIF;
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            try {
                amiri = Typeface.create(ctx.getResources().getFont(R.font.amiri), Typeface.BOLD);
            } catch (Exception ignored) {
            }
        }
        ink.setTypeface(amiri);
        ink.setTextAlign(Paint.Align.CENTER);
        Path creases = new Path();

        cv.save();
        cv.translate(size / 2f, size / 2f);
        cv.scale(size / 220f, size / 220f);
        cv.rotate(-9);
        cv.save();
        cv.clipPath(blob);
        for (float[][] t : tris) {
            float tcx = (t[0][0] + t[1][0] + t[2][0]) / 3;
            float tcy = (t[0][1] + t[1][1] + t[2][1]) / 3;
            float light = (-tcx * 0.55f - tcy * 0.8f) / 100f;
            float v = Math.max(0f, Math.min(1f, 0.6f + light * 0.45f + (r.f() - 0.5f) * 0.7f));
            int col = mix(hi, lo, v);
            Path tp = new Path();
            tp.moveTo(t[0][0], t[0][1]);
            tp.lineTo(t[1][0], t[1][1]);
            tp.lineTo(t[2][0], t[2][1]);
            tp.close();
            fill.setStyle(Paint.Style.FILL_AND_STROKE);
            fill.setStrokeWidth(0.6f);
            fill.setColor(col);
            cv.drawPath(tp, fill);
            if (r.next() < 0.55) {
                creases.moveTo(t[0][0], t[0][1]);
                creases.lineTo(t[1][0], t[1][1]);
            }
            double roll = r.next();
            if (roll > 0.72) continue;
            float rot = Math.round((r.next() - 0.5) * 150);
            float op = (0.3f + r.f() * 0.25f) * (0.55f + v * 0.6f);
            cv.save();
            cv.clipPath(tp);
            cv.rotate(rot, tcx, tcy);
            ink.setColor(printColor);
            ink.setAlpha(Math.round(Color_alpha(printColor) * op));
            if (roll < 0.18) {
                String w = words[(int) (r.next() * words.length)];
                ink.setTextSize(10 + r.f() * 5);
                cv.drawText(w, tcx, tcy + 4, ink);
            } else if (roll < 0.3) {
                cv.drawRect(tcx - 22, tcy - 9, tcx - 22 + 30 + r.f() * 14, tcy - 9 + 3.4f, ink);
                for (int L = 0; L < 4; L++) {
                    float y = tcy - 2 + L * 3.6f;
                    cv.drawRect(tcx - 22, y, tcx - 22 + 28 + r.f() * 18, y + 1.1f, ink);
                }
            } else {
                for (int L = -3; L <= 3; L++) {
                    float y = tcy + L * 3.6f;
                    cv.drawRect(tcx - 26, y, tcx - 26 + 16 + r.f() * 6, y + 1.1f, ink);
                    cv.drawRect(tcx - 4, y, tcx - 4 + 14 + r.f() * 12, y + 1.1f, ink);
                }
            }
            cv.restore();
        }
        line.setColor(ctx.getColor(R.color.pk_crease));
        line.setStrokeWidth(0.7f);
        cv.drawPath(creases, line);
        line.setColor(ctx.getColor(R.color.pk_crease_hi));
        line.setStrokeWidth(0.6f);
        cv.save();
        cv.translate(0.7f, 0.7f);
        cv.drawPath(creases, line);
        cv.restore();
        // ظلّ كروي: ضوء من أعلى اليسار وعتمة نحو الحافة
        Paint shade = new Paint(Paint.ANTI_ALIAS_FLAG);
        int s1 = ctx.getColor(R.color.pk_shade_hi), s2 = ctx.getColor(R.color.pk_shade_lo);
        shade.setShader(new RadialGradient(-26.4f, -39.6f, 171.6f, new int[]{s1, 0x00FFFFFF, s2}, new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP));
        cv.drawRect(-110, -110, 110, 110, shade);
        cv.restore();
        line.setColor(ctx.getColor(R.color.pk_crease));
        line.setStrokeWidth(0.8f);
        cv.drawPath(blob, line);
        cv.restore();
    }

    private static int Color_alpha(int c) {
        return (c >>> 24) & 0xFF;
    }

    private static int mix(int a, int b, float t) {
        int r = Math.round(((a >> 16) & 0xFF) * t + ((b >> 16) & 0xFF) * (1 - t));
        int g = Math.round(((a >> 8) & 0xFF) * t + ((b >> 8) & 0xFF) * (1 - t));
        int bl = Math.round((a & 0xFF) * t + (b & 0xFF) * (1 - t));
        return 0xFF000000 | (r << 16) | (g << 8) | bl;
    }

    private static double ang(float[] p) {
        return Math.atan2(p[1], p[0]);
    }

    // ترتيب إدراج بالزاوية (بلا Comparator: d8 بهذي البيئة يفشل على bridge methods)
    private static float[][] sortByAngle(float[][] in) {
        float[][] a = in.clone();
        for (int i = 1; i < a.length; i++) {
            float[] k = a[i];
            int j = i - 1;
            while (j >= 0 && ang(a[j]) > ang(k)) {
                a[j + 1] = a[j];
                j--;
            }
            a[j + 1] = k;
        }
        return a;
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        if (ball != null) ball.recycle();
        ball = null;
    }
}
