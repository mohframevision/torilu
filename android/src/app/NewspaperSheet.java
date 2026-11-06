package bh.mohframevision.torilu;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.view.View;
import android.widget.LinearLayout;

/* ورقة الجريدة (.np-sheet بالموقع): ورق دافئ، وفوق كل شيء (النص والصور) طبقة الحبيبات
   والطيّتين والتظليل كما ::after/::before بالموقع. بالداكن تبقى ورقاً (ألوان values-night).
   الطيّة تتلاشى بعد الفتح (setCrease/fadeCrease). */
public class NewspaperSheet extends LinearLayout implements ValueAnimator.AnimatorUpdateListener {
    private static Bitmap grain;

    private final Paint grainPaint = new Paint();
    private final Paint paint = new Paint();
    private float crease = 1f;
    private int foldH;
    private ValueAnimator anim;

    public NewspaperSheet(Context c) {
        super(c);
        setOrientation(VERTICAL);
        setLayoutDirection(View.LAYOUT_DIRECTION_LOCALE);
        setBackgroundColor(c.getColor(R.color.np_paper));
        setPadding(Ui.dp(c, 18), Ui.dp(c, 24), Ui.dp(c, 18), Ui.dp(c, 28));
        setElevation(Ui.dp(c, 2));
        BitmapShader s = new BitmapShader(grain(), Shader.TileMode.REPEAT, Shader.TileMode.REPEAT);
        Matrix m = new Matrix();
        float k = Math.max(1f, c.getResources().getDisplayMetrics().density / 2f);
        m.setScale(k, k);
        s.setLocalMatrix(m);
        grainPaint.setShader(s);
    }

    // حبيبات ورق الصحف: نفس feColorMatrix بالموقع — لون rgb(.3,.27,.2) بشفافية حتى .16
    private static Bitmap grain() {
        if (grain == null) {
            java.util.Random r = new java.util.Random(7);
            int[] px = new int[160 * 160];
            for (int i = 0; i < px.length; i++) px[i] = Color.argb((int) (r.nextFloat() * 0.16f * 255), 77, 69, 51);
            grain = Bitmap.createBitmap(px, 160, 160, Bitmap.Config.ARGB_8888);
        }
        return grain;
    }

    public void setCrease(float v) {
        if (anim != null) anim.cancel();
        crease = Math.max(0f, Math.min(1f, v));
        invalidate();
    }

    public float getCrease() {
        return crease;
    }

    // علامات الطيّ تتلاشى بعد الفتح (np-clean بالموقع)
    public void fadeCrease(long delayMs, long durMs) {
        if (anim != null) anim.cancel();
        anim = ValueAnimator.ofFloat(crease, 0f);
        anim.setStartDelay(delayMs);
        anim.setDuration(durMs);
        anim.addUpdateListener(this);
        anim.start();
    }

    @Override
    public void onAnimationUpdate(ValueAnimator a) {
        crease = (Float) a.getAnimatedValue();
        invalidate();
    }

    // ارتفاع الطيّة الأولى (--fold-h): بالورقة الطويلة تُرسم الطيّة الأفقية عندها لا بالمنتصف
    public void setFoldHeight(int px) {
        foldH = px;
        invalidate();
    }

    @Override
    protected void onDetachedFromWindow() {
        if (anim != null) anim.cancel();
        super.onDetachedFromWindow();
    }

    @Override
    protected void dispatchDraw(Canvas canvas) {
        super.dispatchDraw(canvas);
        float w = getWidth(), h = getHeight();
        if (w <= 0 || h <= 0) return;
        canvas.drawRect(0, 0, w, h, grainPaint);

        // تظليل الأطراف الخفيف (radial-gradient 120% 90%)
        float rx = w * 1.2f;
        RadialGradient v = new RadialGradient(w / 2, h / 2, rx,
                new int[]{0, 0, Color.argb(26, 80, 60, 30)}, new float[]{0f, 0.6f, 1f}, Shader.TileMode.CLAMP);
        Matrix m = new Matrix();
        m.setScale(1f, (h * 0.9f) / rx, w / 2, h / 2);
        v.setLocalMatrix(m);
        paint.setShader(v);
        canvas.drawRect(0, 0, w, h, paint);

        if (crease > 0.001f) {
            boolean tall = foldH > 0 && h > w * 1.6f;
            float ref = tall ? foldH * 2f : h; // الطيّة على مقاس الجريدة المطويّة لا الورقة كلها
            float y0 = tall ? foldH : h / 2;
            float top = y0 - 0.012f * ref, bot = y0 + 0.024f * ref, span = bot - top;
            int c = Color.rgb(60, 45, 20);
            paint.setShader(new LinearGradient(0, top, 0, bot,
                    new int[]{0, a(c, .10f), a(c, .22f), 0, a(c, .06f), 0},
                    new float[]{0f, .009f * ref / span, .012f * ref / span, .014f * ref / span, .024f * ref / span, 1f},
                    Shader.TileMode.CLAMP));
            canvas.drawRect(0, top, w, bot, paint);
            float l = w * .495f, r = w * .506f;
            paint.setShader(new LinearGradient(l, 0, r, 0, new int[]{0, a(c, .08f), 0},
                    new float[]{0f, .45f / 1.1f, 1f}, Shader.TileMode.CLAMP));
            canvas.drawRect(l, 0, r, h, paint);
            // لمعة تحت الطيّة
            float t2 = y0 + .001f * ref, b2 = y0 + .012f * ref;
            paint.setShader(new LinearGradient(0, t2, 0, b2, new int[]{0, a(Color.WHITE, .28f), 0},
                    new float[]{0f, .25f / 1.1f, 1f}, Shader.TileMode.CLAMP));
            canvas.drawRect(0, t2, w, b2, paint);
        }
        paint.setShader(null);
    }

    private int a(int color, float alpha) {
        return Color.argb(Math.round(alpha * crease * 255), Color.red(color), Color.green(color), Color.blue(color));
    }

    static int ink(Context c) {
        return c.getColor(R.color.np_ink);
    }

    static int inkMuted(Context c) {
        return c.getColor(R.color.np_ink_muted);
    }
}
