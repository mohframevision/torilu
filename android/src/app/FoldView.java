package bh.mohframevision.torilu;

import android.animation.Animator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Camera;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.provider.Settings;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/* الجريدة المطويّة (fold.js + قواعد np-fold بالموقع): الورقة تبدأ مطويّة مرتين وعليها
   «اضغط لفتح الجريدة»؛ بالضغط تنفتح الطيّة السفلى (rotateX) ثم النصف الأيسر (rotateY)
   بصوت ورق، ثم تظهر الورقة الحقيقية وتتلاشى علامات الطيّ. الورقة الحقيقية تبقى داخل هذا
   الإطار؛ وهي مطويّة لا تُرسم ولا تأخذ اللمس، والإطار مقصوص لارتفاع الجريدة المطويّة.
   مع تقليل الحركة (مدة الحركات 0) لا طيّ إطلاقاً. */
public class FoldView extends FrameLayout implements ValueAnimator.AnimatorUpdateListener,
        Animator.AnimatorListener, View.OnClickListener {
    private static final int FOLDED = 0, BUSY = 1, OPEN = 2;
    private static final float END = 2400f; // 0-1000 الطيّة السفلى، 1050-2050 النصف الأيسر، ثم تلاشٍ 350
    private static final int[] EDGES = {0xFFE7E0D0, 0xFFCFC6B0, 0xFFEBE5D7, 0xFFC9BFA7};

    private final ScrollView scroll;
    private final NewspaperSheet sheet;
    private final String title;
    private TextView closeBtn;
    private final PathInterpolator ease = new PathInterpolator(.45f, .05f, .25f, 1f);
    private final Camera camera = new Camera();
    private final Matrix tmp = new Matrix(), global = new Matrix();
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private final Paint shadow = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float dp;
    private float elev;

    private int state = FOLDED;
    private boolean closing, soundDone;
    private float t;
    private ValueAnimator anim, pulse;
    private float hintAlpha = 1f;
    private Bitmap snap;

    // المقاسات: W×H الجريدة المطويّة، w×h ربعها، s تكبير الربع المطويّ
    private int W, H, h;
    private float w, s, s1, dy;
    private StaticLayout nameL, titleL, hintL;
    private int layoutFor;

    private FoldView(Context c, ScrollView scroll, NewspaperSheet sheet, String title) {
        super(c);
        this.scroll = scroll;
        this.sheet = sheet;
        this.title = title == null ? "" : title;
        dp = c.getResources().getDisplayMetrics().density;
        camera.setLocation(0, 0, -2400f * dp / 72f); // perspective: 2400px
        setWillNotDraw(false);
        setOutlineProvider(ViewOutlineProvider.BOUNDS);
    }

    static boolean reducedMotion(Context c) {
        return Settings.Global.getFloat(c.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f;
    }

    // يضع الورقة داخل إطار الطيّ مكانها بالصفحة، وزر «اطوِ الجريدة» فوقها (يظهر بعد الفتح)
    static FoldView wrap(Activity a, ScrollView scroll, NewspaperSheet sheet, String title) {
        FoldView f = new FoldView(a, scroll, sheet, title);
        ViewGroup parent = (ViewGroup) sheet.getParent();
        int idx = parent.indexOfChild(sheet);
        ViewGroup.LayoutParams lp = sheet.getLayoutParams();
        parent.removeViewAt(idx);
        f.elev = sheet.getElevation();
        f.setElevation(f.elev);
        sheet.setElevation(0); // الظل على الإطار، فلا يقصّه
        f.addView(sheet, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        parent.addView(f, idx, lp);

        TextView b = Ui.text(a, a.getString(R.string.fold_close), 13, a.getColor(R.color.text_muted), true);
        b.setBackgroundResource(R.drawable.btn_pill_secondary);
        b.setPadding(Ui.dp(a, 14), Ui.dp(a, 6), Ui.dp(a, 14), Ui.dp(a, 6));
        b.setOnClickListener(f);
        b.setVisibility(GONE);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        blp.gravity = Gravity.END;
        blp.topMargin = Ui.dp(a, 12);
        blp.bottomMargin = Ui.dp(a, 4);
        parent.addView(b, idx, blp);
        f.closeBtn = b;

        if (reducedMotion(a)) {
            f.state = OPEN;
            sheet.setCrease(0);
        } else {
            f.setFolded();
        }
        return f;
    }

    boolean isOpen() {
        return state == OPEN;
    }

    private void setFolded() {
        state = FOLDED;
        setElevation(0); // الظل للورقة المفتوحة؛ المطويّة ترسم ظلّها بنفسها
        closing = false;
        setClickable(true);
        setFocusable(true);
        setContentDescription(getContext().getString(R.string.fold_hint));
        sheet.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        startPulse();
    }

    // ===== الفتح والطيّ =====

    void open() {
        if (state != FOLDED || W == 0) return;
        state = BUSY;
        closing = false;
        stopPulse();
        snapshot();
        SoundPlayer.play(getContext(), SoundPlayer.FOLD);
        run(0f, END);
    }

    void refold() {
        if (state != OPEN) return;
        state = BUSY;
        closing = true;
        soundDone = false;
        closeBtn.setVisibility(GONE);
        setElevation(0);
        sheet.setCrease(1f);
        int y = getTop();
        if (scroll != null) {
            for (View v = (View) getParent(); v != null && v != scroll && v.getParent() instanceof View; v = (View) v.getParent()) y += v.getTop();
            scroll.smoothScrollTo(0, Math.max(0, y - closeBtn.getHeight() - Ui.dp(getContext(), 16)));
        }
        snapshot();
        sheet.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        t = END;
        requestLayout(); // يرجع الإطار لارتفاع الجريدة المطويّة
        run(END, 0f);
    }

    private void run(float from, float to) {
        if (anim != null) anim.cancel();
        anim = ValueAnimator.ofFloat(from, to);
        anim.setDuration((long) END);
        anim.setInterpolator(null); // كل مرحلة لها تسهيلها
        anim.addUpdateListener(this);
        anim.addListener(this);
        anim.start();
    }

    // نسخة من أعلى الورقة الحقيقية (بعلامات الطيّ) تُرسم عليها القطع
    private void snapshot() {
        try {
            snap = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(snap);
            sheet.draw(c);
        } catch (OutOfMemoryError e) {
            snap = null;
        }
    }

    @Override
    public void onAnimationUpdate(ValueAnimator a) {
        float prev = t;
        t = (Float) a.getAnimatedValue();
        if (!closing && prev < 2050 && t >= 2050) requestLayout(); // الورقة الحقيقية تظهر بطولها
        if (closing && !soundDone && t < 2050) {
            soundDone = true;
            SoundPlayer.play(getContext(), SoundPlayer.FOLD);
        }
        invalidate();
    }

    @Override
    public void onAnimationEnd(Animator a) {
        if (a != anim) return;
        anim = null;
        snap = null;
        if (closing) {
            t = 0;
            setFolded();
        } else {
            state = OPEN;
            setClickable(false);
            setFocusable(false);
            setContentDescription(null);
            sheet.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_AUTO);
            setElevation(elev);
            closeBtn.setVisibility(VISIBLE);
            sheet.fadeCrease(2650, 1500); // ثلاث ثوانٍ بعد ظهور الورقة
        }
        requestLayout();
        invalidate();
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

    @Override
    public void onClick(View v) {
        refold();
    }

    // «اضغط لفتح الجريدة» تنبض بهدوء (np-hint)
    private void startPulse() {
        if (pulse != null || !isAttachedToWindow()) return;
        pulse = ValueAnimator.ofFloat(1f, .55f);
        pulse.setDuration(1200);
        pulse.setRepeatMode(ValueAnimator.REVERSE);
        pulse.setRepeatCount(ValueAnimator.INFINITE);
        pulse.addUpdateListener(new Pulse(this));
        pulse.start();
    }

    private void stopPulse() {
        if (pulse != null) pulse.cancel();
        pulse = null;
        hintAlpha = 1f;
    }

    private static final class Pulse implements ValueAnimator.AnimatorUpdateListener {
        private final FoldView f;

        Pulse(FoldView f) {
            this.f = f;
        }

        @Override
        public void onAnimationUpdate(ValueAnimator a) {
            f.hintAlpha = (Float) a.getAnimatedValue();
            f.invalidate();
        }
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (state == FOLDED) startPulse();
    }

    @Override
    protected void onDetachedFromWindow() {
        stopPulse();
        if (anim != null) {
            anim.removeAllListeners();
            anim.removeAllUpdateListeners();
            anim.cancel();
        }
        super.onDetachedFromWindow();
    }

    // ===== اللمس =====

    @Override
    public boolean onInterceptTouchEvent(MotionEvent e) {
        return state != OPEN;
    }

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        if (state == OPEN) return super.onTouchEvent(e);
        if (e.getActionMasked() == MotionEvent.ACTION_UP) performClick();
        return true;
    }

    @Override
    public boolean performClick() {
        super.performClick();
        open();
        return true;
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent e) {
        if (state == FOLDED && (keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_SPACE
                || keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER)) {
            open();
            return true;
        }
        return super.onKeyUp(keyCode, e);
    }

    // ===== المقاسات =====

    private boolean cropped() {
        return state == FOLDED || (state == BUSY && (closing || t < 2050));
    }

    @Override
    protected void onMeasure(int wSpec, int hSpec) {
        super.onMeasure(wSpec, hSpec);
        W = sheet.getMeasuredWidth();
        int sh = sheet.getMeasuredHeight();
        if (W <= 0 || sh <= 0) return;
        H = Math.min(sh, (int) Math.max(W * .68f, 460 * dp));
        h = H / 2;
        H = 2 * h;
        w = W / 2f;
        s = Math.min(1.88f, Math.max(1f, 620 * dp / w));
        s1 = 1 + (s - 1) * .35f;
        dy = Math.min(24 * dp, Math.max(0, (2 * h - h * s) / 2));
        sheet.setFoldHeight(h);
        if (state != OPEN && cropped()) setMeasuredDimension(getMeasuredWidth(), H);
    }

    // ===== الرسم =====

    @Override
    protected void dispatchDraw(Canvas canvas) {
        if (state == OPEN || W == 0) {
            super.dispatchDraw(canvas);
            return;
        }
        if (!closing && t >= 2050 || closing && t > 2050) {
            super.dispatchDraw(canvas);
            float k = 1f - (t - 2050) / 350f;
            if (snap != null && k > 0) {
                paint.setAlpha(Math.round(255 * Math.min(1f, k)));
                canvas.drawBitmap(snap, 0, 0, paint);
                paint.setAlpha(255);
            }
            return;
        }
        drawPaper(canvas);
    }

    private float clamp(float v) {
        return Math.max(0f, Math.min(1f, v));
    }

    private void drawPaper(Canvas canvas) {
        float pA = ease.getInterpolation(clamp(t / 1000f));
        float pB = ease.getInterpolation(clamp((t - 1050f) / 1000f));
        float ox = 1.5f * w;
        float tx = -w / 2 + (w / 2) * pB;
        float ty = dy * (1 - pA);
        float sc = pB > 0 ? s1 + (1 - s1) * pB : s + (s1 - s) * pA;
        global.setRotate(-1.2f * (1 - pA), ox, 0);
        global.postScale(sc, sc, ox, 0);
        global.postTranslate(tx, ty);

        canvas.save();
        canvas.concat(global);

        // سماكة الطبقات المطويّة وظلّها (np-fold-paper::before)
        float L = w * (1 - pB), B = h + h * pA;
        float ea = 1f - clamp(pA / .4f);
        shadow.setColor(sheet.getContext().getColor(R.color.np_paper));
        shadow.setShadowLayer((22 + 3 * pA) * dp, -6 * dp * (1 - pA), (10 + 8 * pA) * dp, Color.argb(89, 40, 30, 10));
        canvas.drawRect(L, 0, 2 * w, B, shadow);
        if (ea > 0) {
            for (int i = 4; i >= 1; i--) {
                paint.setColor(EDGES[i - 1]);
                paint.setAlpha(Math.round(255 * ea));
                canvas.drawRect(L - i * dp, i * dp, 2 * w - i * dp, B + i * dp, paint);
            }
            paint.setAlpha(255);
        }

        // النصف الأيسر: يدور من خلف النصف الأيمن حول حافته اليمنى
        if (pB > 0) {
            float deg = 180f * (1 - pB);
            canvas.save();
            canvas.concat(cam(-deg, false, w, 0));
            if (deg > 90) drawBack(canvas, 0, 0, w, 2 * h);
            else drawFace(canvas, 0, 0, w, 2 * h);
            shade(canvas, 0, 0, w, 2 * h, (float) Math.sin(Math.PI * pB), false);
            canvas.restore();
        }

        // النصف الأيمن: القطعة العليا ثابتة، والطيّة السفلى تنزل حول حافتها العليا
        drawFace(canvas, w, 0, 2 * w, h);
        float deg = 180f * (1 - pA);
        canvas.save();
        canvas.concat(cam(deg, true, 0, h));
        if (deg > 90) {
            canvas.save();
            canvas.scale(1, -1, 0, 1.5f * h); // يُرسم مقلوباً فيظهر معتدلاً بعد الدوران
            drawCover(canvas);
            canvas.restore();
        } else {
            drawFace(canvas, w, h, 2 * w, 2 * h);
        }
        shade(canvas, w, h, 2 * w, 2 * h, (float) Math.sin(Math.PI * pA), true);
        canvas.restore();

        canvas.restore();
    }

    private Matrix cam(float deg, boolean aroundX, float px, float py) {
        camera.save();
        if (aroundX) camera.rotateX(deg);
        else camera.rotateY(deg);
        camera.getMatrix(tmp);
        camera.restore();
        tmp.preTranslate(-px, -py);
        tmp.postTranslate(px, py);
        return tmp;
    }

    private void drawFace(Canvas c, float l, float t0, float r, float b) {
        if (snap == null) {
            paint.setColor(getContext().getColor(R.color.np_paper));
            c.drawRect(l, t0, r, b, paint);
            return;
        }
        c.save();
        c.clipRect(l, t0, r, b);
        paint.setColor(Color.BLACK); // ألفا كاملة (سطور الظهر تتركها 18)
        c.drawBitmap(snap, 0, 0, paint);
        c.restore();
    }

    // ظهر الورقة: سطور الطباعة من الوجه الآخر باهتة
    private void drawBack(Canvas c, float l, float t0, float r, float b) {
        paint.setColor(getContext().getColor(R.color.np_back));
        c.drawRect(l, t0, r, b, paint);
        float in = (r - l) * .06f;
        paint.setColor(Color.argb(18, 60, 45, 20));
        for (float y = t0 + in; y + 2 * dp < b - in; y += 9 * dp) c.drawRect(l + in, y, r - in, y + 2 * dp, paint);
    }

    // ظلّ يمرّ على القطعة وهي تدور (np-shade)
    private void shade(Canvas c, float l, float t0, float r, float b, float k, boolean vertical) {
        if (k <= 0.01f) return;
        int a0 = Color.argb(Math.round((vertical ? .55f : .5f) * k * 255), 40, 30, 10);
        int a1 = Color.argb(Math.round((vertical ? .15f : .12f) * k * 255), 40, 30, 10);
        paint.setShader(vertical ? new LinearGradient(0, t0, 0, b, a0, a1, Shader.TileMode.CLAMP)
                : new LinearGradient(r, 0, l, 0, a0, a1, Shader.TileMode.CLAMP));
        c.drawRect(l, t0, r, b, paint);
        paint.setShader(null);
    }

    // الوجه الخارجي للجريدة المطويّة (np-cover): الاسم والعنوان وسطور ودعوة للضغط
    private void drawCover(Canvas c) {
        Context ctx = getContext();
        float l = w, t0 = h, r = 2 * w, b = 2 * h;
        int ink = ctx.getColor(R.color.np_ink);
        paint.setColor(ctx.getColor(R.color.np_paper));
        c.drawRect(l, t0, r, b, paint);
        paint.setShader(new LinearGradient(0, b, 0, b - h * .07f, Color.argb(46, 60, 45, 20), 0, Shader.TileMode.CLAMP));
        c.drawRect(l, t0, r, b, paint);
        paint.setShader(new LinearGradient(l, 0, l + w * .06f, 0, Color.argb(41, 60, 45, 20), 0, Shader.TileMode.CLAMP));
        c.drawRect(l, t0, r, b, paint);
        paint.setShader(null);

        float pad = w * .07f, iw = w - 2 * pad;
        if (layoutFor != W * 31 + h) buildText(ctx, (int) iw, ink);
        float y = t0 + pad;
        c.save();
        c.translate(l + pad, y);
        nameL.draw(c);
        c.restore();
        y += nameL.getHeight() + w * .02f;
        paint.setColor(ink);
        float rule = Math.max(1f, dp);
        c.drawRect(l + pad, y, r - pad, y + rule, paint);
        c.drawRect(l + pad, y + 2 * rule, r - pad, y + 3 * rule, paint);
        y += 3 * rule + w * .05f;
        c.save();
        c.translate(l + pad, y);
        titleL.draw(c);
        c.restore();
        y += titleL.getHeight() + w * .05f;

        float hintTop = b - pad - hintL.getHeight();
        float linesBot = hintTop - w * .03f;
        if (linesBot > y) {
            float span = linesBot - y;
            float cx = l + w / 2;
            for (float yy = y; yy < linesBot; yy += 10 * dp) {
                float f = (yy - y) / span;
                float m = f < .3f ? 1f : 1f - (f - .3f) / .7f;
                paint.setColor(Color.argb(Math.round(.16f * m * 255), Color.red(ink), Color.green(ink), Color.blue(ink)));
                c.drawRect(l + pad, yy, r - pad, yy + 3 * dp * .6f, paint);
            }
            paint.setShader(new LinearGradient(0, y, 0, linesBot, new int[]{a(ink, .35f), a(ink, .35f), 0},
                    new float[]{0f, .3f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(cx - iw * .005f - .5f * dp, y, cx + iw * .005f + .5f * dp, linesBot, paint);
            paint.setShader(null);
        }
        hintL.getPaint().setAlpha(Math.round(255 * hintAlpha));
        c.save();
        c.translate(l + pad, hintTop);
        hintL.draw(c);
        c.restore();
    }

    private static int a(int c, float alpha) {
        return Color.argb(Math.round(alpha * 255), Color.red(c), Color.green(c), Color.blue(c));
    }

    private void buildText(Context ctx, int iw, int ink) {
        layoutFor = W * 31 + h;
        Typeface serif = Typeface.DEFAULT_BOLD;
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            try {
                serif = Typeface.create(ctx.getResources().getFont(R.font.amiri), Typeface.BOLD);
            } catch (Exception ignored) {
            }
        }
        TextPaint np = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        np.setTypeface(serif);
        np.setColor(ink);
        np.setTextSize(h * .2f);
        CharSequence mark = Masthead.wordmark(ctx);
        float mw = np.measureText(mark, 0, mark.length());
        if (mw > iw) np.setTextSize(h * .2f * iw / mw * .96f); // شاشة ضيقة: يصغر الاسم بدل «Tor…»
        nameL = layout(mark, np, iw, 1, 1.1f);
        TextPaint tp = new TextPaint(np);
        tp.setTextSize(h * .085f);
        titleL = layout(title, tp, iw, 3, .8f); // أميري واسع السطور أصلاً؛ 1.35 فرّق العنوان
        TextPaint hp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        hp.setTypeface(Typeface.DEFAULT_BOLD);
        hp.setColor(ctx.getColor(R.color.np_link));
        hp.setTextSize(Math.max(11 * dp, h * .05f));
        hintL = layout(ctx.getString(R.string.fold_hint), hp, iw, 2, 1.2f);
    }

    private static StaticLayout layout(CharSequence s, TextPaint p, int width, int maxLines, float spacing) {
        return StaticLayout.Builder.obtain(s, 0, s.length(), p, Math.max(1, width))
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setLineSpacing(0, spacing)
                .setIncludePad(false)
                .setMaxLines(maxLines)
                .setEllipsize(TextUtils.TruncateAt.END)
                .build();
    }
}
