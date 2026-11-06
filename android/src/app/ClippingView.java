package bh.mohframevision.torilu;

import android.animation.Animator;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.PathInterpolator;
import android.widget.LinearLayout;

/* قصاصة «اختار لي» (.pk-clip): ورقة جريدة بحافة ممزقة وآثار تكسير خفيفة. تنفرد من شكل
   الكرة (clip-path من pkBlob إلى pkTorn عبر شكل وسط مجعّد) وتتحرك من مكان الكرة مع دوران
   14° ← −4° ← 0°، والعكس عند «غيره». الأبناء = نص القصاصة (يبنيه PickerActivity). */
public class ClippingView extends LinearLayout implements ValueAnimator.AnimatorUpdateListener, Animator.AnimatorListener {
    static final float TILT = -1.2f;

    private final long seed;
    private final float ballR;
    private final int margin;
    private final Paint paper = new Paint(Paint.ANTI_ALIAS_FLAG);
    final Paint poly = new Paint(Paint.ANTI_ALIAS_FLAG);
    final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path clip = new Path();

    private float[][] torn, blob, mid;
    private Crease creases, crumple;
    private float progress = 1f;
    private float crumpleAlpha;
    private float dx, dy;
    private boolean reverse;
    private ValueAnimator anim;
    private Runnable onEnd;

    ClippingView(Context c, long seed, float ballR) {
        super(c);
        this.seed = seed;
        this.ballR = ballR;
        setOrientation(VERTICAL);
        setWillNotDraw(false);
        margin = Ui.dp(c, 16);
        paper.setColor(c.getColor(R.color.pk_news));
        int sh = c.getColor(R.color.pk_clip_shadow);
        paper.setShadowLayer(Ui.dp(c, 12), 0, Ui.dp(c, 9), sh);
        line.setStyle(Paint.Style.STROKE);
        setRotation(TILT);
    }

    /** إزاحة مركز الكرة عن مركز القصاصة (بكسل) — منها تبدأ القصاصة */
    void setFrom(float dx, float dy) {
        this.dx = dx;
        this.dy = dy;
    }

    int inset() {
        return margin;
    }

    @Override
    protected void onSizeChanged(int w, int h, int ow, int oh) {
        super.onSizeChanged(w, h, ow, oh);
        float iw = w - 2f * margin, ih = h - 2f * margin;
        if (iw <= 0 || ih <= 0) return;
        torn = torn(seed);
        PickerStage.Rng r = new PickerStage.Rng(seed);
        blob = new float[torn.length][];
        for (int i = 0; i < torn.length; i++) {
            double a = Math.atan2((torn[i][1] - 50) * ih, (torn[i][0] - 50) * iw);
            double rr = ballR * (0.82 + r.next() * 0.3);
            blob[i] = new float[]{(float) (50 + rr * Math.cos(a) / iw * 100), (float) (50 + rr * Math.sin(a) / ih * 100)};
        }
        PickerStage.Rng r3 = new PickerStage.Rng(seed + 3);
        mid = new float[torn.length][];
        for (int i = 0; i < torn.length; i++) {
            mid[i] = new float[]{blob[i][0] + (torn[i][0] - blob[i][0]) * 0.62f + (r3.f() - 0.5f) * 7,
                    blob[i][1] + (torn[i][1] - blob[i][1]) * 0.62f + (r3.f() - 0.5f) * 7};
        }
        float dens = getResources().getDisplayMetrics().density;
        creases = new Crease(this, iw, ih, seed, dens);
        crumple = new Crease(this, iw, ih, seed + 7, dens);
        apply();
    }

    // حافة ممزقة (pkTorn): نقاط محيط المستطيل بالنسب المئوية، نفس عددها دائماً
    private static float[][] torn(long seed) {
        PickerStage.Rng rng = new PickerStage.Rng(seed);
        int k = 26;
        float[][] pts = new float[(k + 1) * 4][];
        int n = 0;
        for (int i = 0; i <= k; i++) pts[n++] = new float[]{i * 100f / k, rng.f() * 0.9f};
        for (int i = 0; i <= k; i++) pts[n++] = new float[]{100 - rng.f() * 0.5f, i * 100f / k};
        for (int i = k; i >= 0; i--) pts[n++] = new float[]{i * 100f / k, 100 - rng.f() * 0.9f};
        for (int i = k; i >= 0; i--) pts[n++] = new float[]{rng.f() * 0.5f, i * 100f / k};
        return pts;
    }

    /** يفرد القصاصة من الكرة (1150ms)؛ reverse = يكوّرها (520ms) */
    void play(boolean reverse, Runnable end) {
        this.reverse = reverse;
        this.onEnd = end;
        if (anim != null) anim.cancel();
        anim = ValueAnimator.ofFloat(0f, 1f);
        anim.setDuration(reverse ? 520 : 1150);
        anim.setInterpolator(reverse ? new PathInterpolator(0.5f, 0f, 0.75f, 0f) : new PathInterpolator(0.3f, 0.75f, 0.3f, 1f));
        anim.addUpdateListener(this);
        anim.addListener(this);
        setFrame(0f);
        anim.start();
    }

    /** بلا حركة («تقليل الحركة»): القصاصة مفرودة مباشرة */
    void showFlat() {
        setFrame(1f);
        reverse = false;
        progress = 1f;
        crumpleAlpha = 0f;
        apply();
    }

    void cancel() {
        if (anim != null) {
            anim.removeAllListeners();
            anim.cancel();
        }
        onEnd = null;
    }

    @Override
    public void onAnimationUpdate(ValueAnimator a) {
        setFrame((Float) a.getAnimatedValue());
    }

    // t: 0..1 من بداية الحركة لنهايتها. المفاتيح: كرة (0) ← مجعّدة (0.5) ← مفرودة (1)
    private void setFrame(float t) {
        float k = reverse ? 1 - t : t; // k: 0 = كرة، 1 = مفرودة
        progress = k;
        float tx, ty, rot, sc;
        if (k < 0.5f) {
            float u = k / 0.5f;
            tx = dx + (dx * 0.25f - dx) * u;
            ty = dy + (dy * 0.25f - dy) * u;
            rot = 14 + (-4 - 14) * u;
            sc = 0.96f + (1.01f - 0.96f) * u;
        } else {
            float u = (k - 0.5f) / 0.5f;
            tx = dx * 0.25f * (1 - u);
            ty = dy * 0.25f * (1 - u);
            rot = -4 * (1 - u);
            sc = 1.01f + (1 - 1.01f) * u;
        }
        setTranslationX(tx);
        setTranslationY(ty);
        setRotation(TILT + rot);
        setScaleX(sc);
        setScaleY(sc);
        // نص القصاصة: 0 ← 0.5 ← 1 (تكوير: 1 ← 0.6 ← 0)؛ آثار التكسير الكثيفة: 1 ← 0.85 ← 0
        float lines;
        if (reverse) {
            lines = t < 0.5f ? 1 - 0.8f * t : 0.6f * (1 - (t - 0.5f) / 0.5f);
            crumpleAlpha = t < 0.5f ? t * 2 : 1f;
        } else {
            lines = t < 0.5f ? t : 0.5f + (t - 0.5f);
            crumpleAlpha = t < 0.5f ? 1 - 0.3f * t : 0.85f * (1 - (t - 0.5f) / 0.5f);
        }
        for (int i = 0; i < getChildCount(); i++) getChildAt(i).setAlpha(lines);
        apply();
    }

    private void apply() {
        if (torn == null) return;
        float iw = getWidth() - 2f * margin, ih = getHeight() - 2f * margin;
        clip.rewind();
        for (int i = 0; i < torn.length; i++) {
            float x, y;
            if (progress < 0.5f) {
                float u = progress / 0.5f;
                x = blob[i][0] + (mid[i][0] - blob[i][0]) * u;
                y = blob[i][1] + (mid[i][1] - blob[i][1]) * u;
            } else {
                float u = (progress - 0.5f) / 0.5f;
                x = mid[i][0] + (torn[i][0] - mid[i][0]) * u;
                y = mid[i][1] + (torn[i][1] - mid[i][1]) * u;
            }
            x = margin + x / 100f * iw;
            y = margin + y / 100f * ih;
            if (i == 0) clip.moveTo(x, y);
            else clip.lineTo(x, y);
        }
        clip.close();
        invalidate();
    }

    @Override
    public void draw(Canvas c) {
        if (torn == null) {
            super.draw(c);
            return;
        }
        c.drawPath(clip, paper);
        c.save();
        c.clipPath(clip);
        super.draw(c);
        c.restore();
    }

    @Override
    protected void onDraw(Canvas c) {
        if (creases != null) creases.draw(c, margin, 1f, false);
    }

    @Override
    protected void dispatchDraw(Canvas c) {
        super.dispatchDraw(c);
        if (crumple != null && crumpleAlpha > 0.01f) crumple.draw(c, margin, crumpleAlpha, true);
    }

    @Override
    public void onAnimationEnd(Animator a) {
        Runnable r = onEnd;
        onEnd = null;
        if (r != null) r.run();
    }

    @Override
    public void onAnimationStart(Animator a) {
    }

    @Override
    public void onAnimationCancel(Animator a) {
    }

    @Override
    public void onAnimationRepeat(Animator a) {
    }

    // آثار التكسير (pkCreases): شبكة مثلثات بإضاءة عشوائية + خطوط طيّ + تدرّج خفيف
    private static final class Crease {
        final ClippingView owner;
        final float w, h;
        final Path[] tris;
        final float[] vals;
        final Path lines = new Path();
        final Path folds = new Path();
        final Paint grad = new Paint();

        Crease(ClippingView o, float w, float h, long seed, float dens) {
            this.owner = o;
            this.w = w;
            this.h = h;
            PickerStage.Rng rng = new PickerStage.Rng(seed);
            int cols = Math.max(4, Math.round(w / dens / 95));
            int rows = Math.max(5, Math.round(h / dens / 95));
            float[][][] P = new float[rows + 1][cols + 1][];
            for (int j = 0; j <= rows; j++) {
                for (int i = 0; i <= cols; i++) {
                    boolean ex = i == 0 || i == cols, ey = j == 0 || j == rows;
                    P[j][i] = new float[]{i * w / cols + (ex ? 0 : (rng.f() - 0.5f) * (w / cols) * 0.8f),
                            j * h / rows + (ey ? 0 : (rng.f() - 0.5f) * (h / rows) * 0.8f)};
                }
            }
            tris = new Path[rows * cols * 2];
            vals = new float[tris.length];
            int n = 0;
            for (int j = 0; j < rows; j++) {
                for (int i = 0; i < cols; i++) {
                    float[] a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
                    float[][][] tr = rng.next() < 0.5 ? new float[][][]{{a, b, c}, {a, c, d}} : new float[][][]{{a, b, d}, {b, c, d}};
                    for (float[][] t : tr) {
                        Path p = new Path();
                        p.moveTo(t[0][0], t[0][1]);
                        p.lineTo(t[1][0], t[1][1]);
                        p.lineTo(t[2][0], t[2][1]);
                        p.close();
                        tris[n] = p;
                        vals[n++] = rng.f();
                    }
                    if (rng.next() < 0.45) {
                        lines.moveTo(a[0], a[1]);
                        lines.lineTo(c[0], c[1]);
                    }
                    if (rng.next() < 0.3) {
                        lines.moveTo(b[0], b[1]);
                        lines.lineTo(d[0], d[1]);
                    }
                }
            }
            folds.moveTo(0, h * 0.36f);
            folds.lineTo(w, h * 0.31f);
            folds.moveTo(w * 0.58f, 0);
            folds.lineTo(w * 0.53f, h);
            Context ctx = owner.getContext();
            grad.setShader(new LinearGradient(0, 0, w, h, ctx.getColor(R.color.pk_cg1), ctx.getColor(R.color.pk_cg2), Shader.TileMode.CLAMP));
        }

        void draw(Canvas c, float off, float alpha, boolean heavy) {
            Context ctx = owner.getContext();
            int white = ctx.getColor(heavy ? R.color.pk_crw : R.color.pk_cw);
            int dark = ctx.getColor(heavy ? R.color.pk_crk : R.color.pk_ck);
            c.save();
            c.translate(off, off);
            for (int i = 0; i < tris.length; i++) {
                float v = vals[i];
                int col = v > 0.5f ? white : dark;
                float o = v > 0.5f ? (v - 0.5f) * 2 : (0.5f - v) * 2;
                owner.poly.setColor(col);
                owner.poly.setAlpha(Math.round(((col >>> 24) & 0xFF) * o * alpha));
                c.drawPath(tris[i], owner.poly);
            }
            stroke(c, lines, R.color.pk_cline, 0.9f, alpha);
            c.save();
            c.translate(1, 1);
            stroke(c, lines, R.color.pk_cline_hi, 0.9f, alpha);
            c.restore();
            stroke(c, folds, R.color.pk_cfold, 1.1f, alpha);
            c.save();
            c.translate(1.2f, 1.2f);
            stroke(c, folds, R.color.pk_cfold_hi, 1.4f, alpha);
            c.restore();
            grad.setAlpha(Math.round(255 * alpha));
            c.drawRect(0, 0, w, h, grad);
            c.restore();
        }

        private void stroke(Canvas c, Path p, int color, float width, float alpha) {
            int col = owner.getContext().getColor(color);
            owner.line.setColor(col);
            owner.line.setAlpha(Math.round(((col >>> 24) & 0xFF) * alpha));
            owner.line.setStrokeWidth(width * owner.getResources().getDisplayMetrics().density * 0.6f);
            c.drawPath(p, owner.line);
        }
    }
}
