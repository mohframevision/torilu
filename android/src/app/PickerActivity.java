package bh.mohframevision.torilu;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.drawable.GradientDrawable;
import android.location.Location;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/* «اختار لي» مثل picker.html (src/js/picker.js): القمر يفتح عجلة الأقسام، والقسم المختار
   يتكوّر كرة ورق جريدة تتمايل ثم تنفرد قصاصة فيها المكان. «غيره» يكوّر القصاصة ويفرد غيرها.
   الاختيار كما بالموقع: المنطقة، والأقرب لي، وكيس خلط بالمحل (لا يتكرر محل قبل أن يطلع الكل).
   بلا lambdas ولا كلاسات مجهولة — d8 بهذي البيئة يفشل عليها. */
public class PickerActivity extends Activity implements View.OnClickListener, View.OnLayoutChangeListener,
        ValueAnimator.AnimatorUpdateListener, DialogInterface.OnClickListener {
    private static final String[] PICK_ORDER = {"restaurants", "cafes", "bakeries", "any", "stores", "places"};
    private static final String[] PK_KEYS = {"restaurants", "cafes", "bakeries", "places", "stores"};
    private static final String STEP_MOON = "moon", STEP_WHEEL = "wheel", STEP_BALL = "ball", STEP_CLIP = "clip";
    private static final String NEAR = "near";
    private static final int NEAR_COUNT = 8;
    private static final int LOCATION_REQUEST = 7;
    private static final int W_PICK = 1, W_CRUMPLE = 2, W_UNFOLD = 3, W_SUCCESS = 4, W_DONE = 5;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Random random = new Random();
    private final Map<JSONObject, String> sectionOf = new IdentityHashMap<>();
    private final Set<String> areaNames = new HashSet<>();

    private FrameLayout root;
    private PickerStage stage;
    private FrameLayout center;
    private LinearLayout prompt;
    private TextView title, sub, moonLabel, searching;
    private FrameLayout moon;
    private View moonInk, moonImg, moonX;
    private final List<View> petals = new ArrayList<>();
    private final List<String> petalSlugs = new ArrayList<>();
    private ScrollView resultScroll;
    private LinearLayout resultCol;
    private ClippingView current;
    private TextView areaView;

    private boolean motion;
    private String step = STEP_MOON;
    private String section;
    private String area = "";
    private boolean busy;
    private Object backCallback;

    // مقاسات المسرح (بكسل) ومراكز كل خطوة
    private float b, p, rad, ballD, moonCy, wheelCy, ballCy;
    private float shiftFrom, shiftTo, haloFrom, haloTo, ringFrom, ringTo;
    private ValueAnimator stepAnim;

    private List<JSONObject> items = new ArrayList<>();
    private List<JSONObject> nearPool = new ArrayList<>();
    private List<String> bag = new ArrayList<>();
    private String lastBrand;
    private List<String> areaValues = new ArrayList<>();
    private AlertDialog areaDialog;

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapThemeContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_picker);
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.surface));
        motion = !FoldView.reducedMotion(this);
        for (String a : getResources().getStringArray(R.array.pk_areas)) areaNames.add(a);
        JSONObject sections = MainActivity.cachedSections;
        if (sections != null) {
            for (String k : PK_KEYS) {
                JSONObject s = sections.optJSONObject(k);
                JSONArray arr = s == null ? null : s.optJSONArray("items");
                if (arr == null) continue;
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject it = arr.optJSONObject(i);
                    if (it != null) sectionOf.put(it, k);
                }
            }
        }
        root = findViewById(R.id.pkRoot);
        build();
        root.addOnLayoutChangeListener(this);
        BottomNav.attach(this, findViewById(R.id.bottomNav), BottomNav.PICKER);
    }

    // ===== بناء المسرح =====
    private void build() {
        stage = new PickerStage(this);
        root.addView(stage, new FrameLayout.LayoutParams(-1, -1));

        prompt = new LinearLayout(this);
        prompt.setOrientation(LinearLayout.VERTICAL);
        prompt.setGravity(Gravity.CENTER_HORIZONTAL);
        title = Ui.text(this, getString(R.string.pk_q1), 32, getColor(R.color.text), true);
        Ui.display(title);
        title.setGravity(Gravity.CENTER);
        title.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        prompt.addView(title, new LinearLayout.LayoutParams(-1, -2));
        sub = Ui.text(this, getString(R.string.pk_s1), 15, getColor(R.color.text_muted), false);
        sub.setGravity(Gravity.CENTER);
        sub.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(-1, -2);
        slp.topMargin = Ui.dp(this, 4);
        prompt.addView(sub, slp);
        int side = Ui.dp(this, 20);
        prompt.setPadding(side, 0, side, 0);
        root.addView(prompt, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        // كل ما يدور حول المركز داخل حاوية واحدة تتحرك عمودياً بين الخطوات
        center = new FrameLayout(this);
        center.setClipChildren(false);
        root.addView(center, new FrameLayout.LayoutParams(-1, -1));

        for (String slug : PICK_ORDER) {
            if (itemsFor(slug).isEmpty()) continue;
            petals.add(petal(slug));
            petalSlugs.add(slug);
        }

        moon = new FrameLayout(this);
        GradientDrawable paper = new GradientDrawable();
        paper.setShape(GradientDrawable.OVAL);
        paper.setColor(getColor(R.color.pk_news));
        paper.setStroke(Ui.dp(this, 2), 0x1F1A1F29);
        moon.setBackground(paper);
        moon.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        moon.setElevation(Ui.dp(this, 10));
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            moon.setOutlineSpotShadowColor(getColor(R.color.pk_ink));
            moon.setOutlineAmbientShadowColor(getColor(R.color.pk_ink));
        }
        moonInk = new View(this);
        GradientDrawable ink = new GradientDrawable();
        ink.setShape(GradientDrawable.OVAL);
        ink.setColor(getColor(R.color.pk_ink));
        moonInk.setBackground(ink);
        moon.addView(moonInk, new FrameLayout.LayoutParams(-1, -1));
        ImageView img = new ImageView(this);
        img.setImageResource(R.drawable.pk_moon);
        moonImg = img;
        moon.addView(img, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        ImageView x = new ImageView(this);
        x.setImageResource(R.drawable.ic_close);
        x.setImageTintList(ColorStateList.valueOf(getColor(R.color.text)));
        x.setAlpha(0f);
        moonX = x;
        moon.addView(x, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        moon.setClickable(true);
        moon.setFocusable(true);
        moon.setContentDescription(getString(R.string.pk_moon));
        moon.setOnClickListener(this);
        center.addView(moon, new FrameLayout.LayoutParams(1, 1, Gravity.TOP | Gravity.LEFT));

        moonLabel = Ui.text(this, getString(R.string.pk_moon), 17, getColor(R.color.brand_accent), true);
        moonLabel.setGravity(Gravity.CENTER);
        moonLabel.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        moonLabel.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        center.addView(moonLabel, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        searching = Ui.text(this, getString(R.string.pk_searching), 22, getColor(R.color.text), true);
        Ui.display(searching);
        searching.setGravity(Gravity.CENTER);
        searching.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        searching.setAlpha(0f);
        searching.setVisibility(View.INVISIBLE);
        center.addView(searching, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        resultScroll = new ScrollView(this);
        resultScroll.setClipChildren(false);
        resultScroll.setVisibility(View.GONE);
        resultCol = new LinearLayout(this);
        resultCol.setOrientation(LinearLayout.VERTICAL);
        resultCol.setGravity(Gravity.CENTER_HORIZONTAL);
        resultCol.setClipChildren(false);
        resultCol.setPadding(0, Ui.dp(this, 12), 0, Ui.dp(this, 20));
        resultScroll.setFillViewport(true);
        resultScroll.addView(resultCol, new FrameLayout.LayoutParams(-1, -2));
        root.addView(resultScroll, new FrameLayout.LayoutParams(-1, -1));
    }

    private View petal(String slug) {
        LinearLayout v = new LinearLayout(this);
        v.setOrientation(LinearLayout.VERTICAL);
        v.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(getColor(R.color.surface));
        v.setBackground(bg);
        v.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        v.setElevation(Ui.dp(this, 5));
        ImageView g = new ImageView(this);
        g.setImageResource(glyph(slug));
        v.addView(g);
        TextView t = Ui.text(this, label(slug), 12, getColor(R.color.text), true);
        t.setGravity(Gravity.CENTER);
        t.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        t.setMaxLines(2);
        t.setIncludeFontPadding(false);
        t.setLineSpacing(0, 0.95f);
        v.addView(t);
        v.setClickable(true);
        v.setFocusable(true);
        v.setTag(slug);
        v.setOnClickListener(this);
        v.setVisibility(View.INVISIBLE);
        center.addView(v, new FrameLayout.LayoutParams(1, 1, Gravity.TOP | Gravity.LEFT));
        return v;
    }

    private static int glyph(String slug) {
        switch (slug) {
            case "restaurants": return R.drawable.pk_restaurants;
            case "cafes": return R.drawable.pk_cafes;
            case "bakeries": return R.drawable.pk_bakeries;
            case "stores": return R.drawable.pk_stores;
            case "places": return R.drawable.pk_places;
            default: return R.drawable.pk_any;
        }
    }

    private String label(String slug) {
        switch (slug) {
            case "restaurants": return getString(R.string.pk_sec_restaurants);
            case "cafes": return getString(R.string.pk_sec_cafes);
            case "bakeries": return getString(R.string.pk_sec_bakeries);
            case "stores": return getString(R.string.pk_sec_stores);
            case "places": return getString(R.string.pk_sec_places);
            default: return getString(R.string.pk_sec_any);
        }
    }

    // ===== المقاسات: نفس fit() بالموقع — لا يغطي القمر ولا العجلة سطرَي العنوان =====
    @Override
    public void onLayoutChange(View v, int l, int t, int r, int bt, int ol, int ot, int or, int ob) {
        if (r - l == or - ol && bt - t == ob - ot) return;
        root.post(new Later(this, 0));
    }

    private void fit() {
        int W = root.getWidth(), H = root.getHeight();
        if (W == 0 || H == 0) return;
        float d = getResources().getDisplayMetrics().density;
        boolean wide = W / d >= 600;
        boolean shortWide = wide && H / d < 820;
        b = (wide ? (shortWide ? 168 : 210) : 132) * d;
        p = (wide ? (shortWide ? 108 : 136) : 82) * d;
        rad = (wide ? (shortWide ? 158 : 200) : 116) * d;
        ballD = (wide ? (shortWide ? 280 : 340) : 220) * d;
        int top = Math.round((wide && !shortWide ? 64 : H / d < 600 ? 16 : 36) * d);
        ((FrameLayout.LayoutParams) prompt.getLayoutParams()).topMargin = top;
        title.setTextSize(wide ? 48 : H / d < 600 ? 26 : 32);
        // جوال أفقي (قصير وعريض): العنوان في عمود جانبي والمسرح بجانبه، وإلا غطّى القمر العنوان
        boolean side = W > H * 1.4f && H / d < 500;
        FrameLayout.LayoutParams plp = (FrameLayout.LayoutParams) prompt.getLayoutParams();
        plp.width = side ? Math.round(W * 0.46f) : -1;
        plp.gravity = side ? Gravity.TOP | Gravity.START : Gravity.TOP;
        if (side) title.setTextSize(28);
        prompt.measure(View.MeasureSpec.makeMeasureSpec(side ? plp.width : W, View.MeasureSpec.EXACTLY), View.MeasureSpec.UNSPECIFIED);
        if (side) plp.topMargin = Math.max(top, Math.round((H - prompt.getMeasuredHeight()) / 2f));
        prompt.setLayoutParams(plp);
        float below = top + prompt.getMeasuredHeight();
        float room = H - below - 20 * d - 40 * d;
        float k = Math.min(1f, Math.max(0.4f, room / (2 * rad + p)));
        b *= k;
        p *= k;
        rad *= k;
        ballD = Math.min(ballD, H * 0.5f);
        moonCy = Math.max(H * 0.48f, below + b / 2 + 36 * d);
        moonCy = Math.min(moonCy, H - b / 2 - 70 * d);
        wheelCy = Math.max(H * 0.60f, below + rad + p / 2 + 20 * d);
        wheelCy = Math.min(wheelCy, H - rad - p / 2 - 8 * d);
        ballCy = H * 0.42f;
        boolean rtl = root.getLayoutDirection() == View.LAYOUT_DIRECTION_RTL;
        float cx = side ? (rtl ? W * 0.27f : W * 0.73f) : W / 2f, cy = H / 2f;
        if (side) {
            p = 82 * d;
            rad = Math.min(116 * d, (H - p - 24 * d) / 2);
            b = Math.min(132 * d, H * 0.45f);
            ballD = Math.min(220 * d, H * 0.6f);
            moonCy = cy - 20 * d;
            wheelCy = cy;
        }
        // التسمية و«نبحث لك» تتوسّطان تحت المسرح لا تحت الشاشة كلها
        int lw = Math.round(Math.min(cx, W - cx) * 2);
        for (View t : new View[] {moonLabel, searching}) {
            FrameLayout.LayoutParams tl = (FrameLayout.LayoutParams) t.getLayoutParams();
            tl.width = lw;
            tl.gravity = Gravity.TOP | Gravity.LEFT;
            tl.leftMargin = Math.round(cx - lw / 2f);
        }
        setBox(moon, cx, cy, b);
        ((ImageView) moonImg).setPadding(Math.round(b * 0.13f), Math.round(b * 0.13f), Math.round(b * 0.13f), Math.round(b * 0.13f));
        int xp = Math.round(b * 0.3f);
        moonX.setPadding(xp, xp, xp, xp);
        moon.setPivotX(b / 2);
        moon.setPivotY(b / 2);
        ((FrameLayout.LayoutParams) moonLabel.getLayoutParams()).topMargin = Math.round(cy + b / 2 + 26 * d);
        ((FrameLayout.LayoutParams) searching.getLayoutParams()).topMargin = Math.round(cy + ballD / 2 + 18 * d);
        for (int i = 0; i < petals.size(); i++) {
            LinearLayout v = (LinearLayout) petals.get(i);
            setBox(v, cx, cy, p);
            int gs = Math.round(p * 0.4f);
            v.getChildAt(0).setLayoutParams(new LinearLayout.LayoutParams(gs, gs));
            TextView t = (TextView) v.getChildAt(1);
            t.setTextSize(android.util.TypedValue.COMPLEX_UNIT_PX, p * 0.145f);
            t.setMaxWidth(Math.round(p * 0.84f));
            if (STEP_WHEEL.equals(step)) {
                v.setTranslationX(rad * petalX(i));
                v.setTranslationY(rad * petalY(i));
            }
        }
        stage.cx = cx;
        stage.b = b;
        stage.p = p;
        stage.rad = rad;
        stage.ballD = ballD;
        float shift = targetCy() - cy;
        if (stepAnim == null || !stepAnim.isRunning()) applyShift(shift);
        shiftTo = shift;
        root.requestLayout();
        stage.invalidate();
    }

    private static void setBox(View v, float cx, float cy, float size) {
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) v.getLayoutParams();
        lp.width = Math.round(size);
        lp.height = Math.round(size);
        lp.leftMargin = Math.round(cx - size / 2);
        lp.topMargin = Math.round(cy - size / 2);
        v.setLayoutParams(lp);
    }

    private float petalX(int i) {
        return (float) Math.sin((double) i / petals.size() * Math.PI * 2);
    }

    private float petalY(int i) {
        return (float) -Math.cos((double) i / petals.size() * Math.PI * 2);
    }

    private float targetCy() {
        if (STEP_WHEEL.equals(step)) return wheelCy;
        if (STEP_MOON.equals(step)) return moonCy;
        return ballCy;
    }

    private void applyShift(float shift) {
        center.setTranslationY(shift);
        stage.cy = root.getHeight() / 2f + shift;
    }

    // ===== الخطوات (data-step) =====
    private void setStep(String s) {
        String prev = step;
        step = s;
        boolean wheel = STEP_WHEEL.equals(s), moonStep = STEP_MOON.equals(s);
        boolean top = wheel || moonStep;
        long dur = motion ? 450 : 200;

        prompt.animate().cancel();
        String q = getString(wheel ? R.string.pk_q2 : R.string.pk_q1);
        boolean changed = prompt.getVisibility() != View.VISIBLE || !q.contentEquals(title.getText());
        prompt.setVisibility(top ? View.VISIBLE : View.INVISIBLE);
        if (top && changed) {
            title.setText(q);
            sub.setText(wheel ? R.string.pk_s2 : R.string.pk_s1);
            prompt.setAlpha(0f);
            prompt.setTranslationY(motion ? Ui.dp(this, 6) : 0);
            prompt.animate().alpha(1f).translationY(0).setDuration(350).setInterpolator(new DecelerateInterpolator(2f)).start();
        }

        // القمر: يصغر لزر إغلاق (×) بالعجلة، ويختفي بالكرة والقصاصة
        float ms = wheel ? 0.52f : moonStep ? 1f : 0f;
        moon.setVisibility(View.VISIBLE);
        moon.animate().scaleX(ms).scaleY(ms).alpha(top ? 1f : 0f).setDuration(top ? dur : 250)
                .setInterpolator(motion && top ? new PathInterpolator(0.34f, 1.4f, 0.5f, 1f) : new DecelerateInterpolator())
                .withEndAction(top ? null : new Hide(moon)).start();
        moonInk.animate().alpha(wheel ? 0f : 1f).setDuration(350).start();
        moonImg.animate().alpha(wheel ? 0f : 1f).rotation(wheel ? 90 : 0).scaleX(wheel ? 0.6f : 1f).scaleY(wheel ? 0.6f : 1f).setDuration(dur).start();
        moonX.animate().alpha(wheel ? 1f : 0f).rotation(wheel ? 0 : -90).setDuration(dur).start();
        moon.setContentDescription(getString(wheel ? R.string.pk_close : R.string.pk_moon));
        moonLabel.animate().alpha(moonStep ? 1f : 0f).setDuration(200).start();

        boolean wasOpen = STEP_WHEEL.equals(prev);
        if (wheel) openPetals();
        else if (wasOpen) closePetals();

        boolean ball = STEP_BALL.equals(s);
        searching.animate().cancel();
        if (ball) {
            searching.setVisibility(View.VISIBLE);
            searching.animate().alpha(1f).setDuration(200).start();
        } else {
            searching.setAlpha(0f);
            searching.setVisibility(View.INVISIBLE);
        }
        if (!ball) stage.hideBall();
        if (ball) resultScroll.setVisibility(View.GONE);
        else if (!STEP_CLIP.equals(s)) clearResult();

        // المركز والحلقات
        if (stepAnim != null) stepAnim.cancel();
        shiftFrom = center.getTranslationY();
        shiftTo = targetCy() - root.getHeight() / 2f;
        haloFrom = stage.haloAlpha;
        haloTo = moonStep ? 1f : 0f;
        ringFrom = stage.ringAlpha;
        ringTo = wheel ? 1f : 0f;
        stepAnim = ValueAnimator.ofFloat(0f, 1f);
        stepAnim.setDuration(motion ? 500 : 150);
        stepAnim.setInterpolator(new DecelerateInterpolator(2f));
        stepAnim.addUpdateListener(this);
        stepAnim.start();
        syncBack();
    }

    @Override
    public void onAnimationUpdate(ValueAnimator a) {
        float t = (Float) a.getAnimatedValue();
        applyShift(shiftFrom + (shiftTo - shiftFrom) * t);
        stage.haloAlpha = haloFrom + (haloTo - haloFrom) * t;
        stage.haloScale = stage.haloAlpha * 0.4f + 0.6f;
        // حلقة العجلة تتأخر 120ms عن الأزرار
        float rt = Math.max(0f, Math.min(1f, (t * 500 - 120) / 380));
        stage.ringAlpha = ringFrom + (ringTo - ringFrom) * (ringTo > ringFrom ? rt : t);
        stage.ringScale = 0.5f + 0.5f * stage.ringAlpha;
        stage.invalidate();
    }

    // الأزرار تحت القمر وهي مغلقة، وتتفتّح لمواضعها بتتابع نابض هادئ
    private void openPetals() {
        for (int i = 0; i < petals.size(); i++) {
            View v = petals.get(i);
            setSelected(v, false);
            v.animate().cancel();
            v.setVisibility(View.VISIBLE);
            v.setTranslationX(0);
            v.setTranslationY(0);
            v.setScaleX(0.3f);
            v.setScaleY(0.3f);
            v.setAlpha(0f);
            v.animate().translationX(rad * petalX(i)).translationY(rad * petalY(i)).scaleX(1f).scaleY(1f).alpha(1f)
                    .setStartDelay(motion ? i * 42L + 30 : 0).setDuration(motion ? 600 : 200)
                    .setInterpolator(motion ? new PathInterpolator(0.34f, 1.42f, 0.5f, 1f) : new DecelerateInterpolator())
                    .withEndAction(null).start();
        }
    }

    private void closePetals() {
        int n = petals.size();
        for (int i = 0; i < n; i++) {
            View v = petals.get(i);
            v.animate().cancel();
            v.animate().translationX(0).translationY(0).scaleX(0.3f).scaleY(0.3f).alpha(0f)
                    .setStartDelay(motion ? (n - 1 - i) * 22L : 0).setDuration(motion ? 340 : 150)
                    .setInterpolator(new PathInterpolator(0.5f, 0f, 0.75f, 0f))
                    .withEndAction(new Hide(v)).start();
        }
    }

    private void setSelected(View v, boolean on) {
        LinearLayout l = (LinearLayout) v;
        ((GradientDrawable) l.getBackground()).setColor(getColor(on ? R.color.pk_on : R.color.surface));
        ((ImageView) l.getChildAt(0)).setImageTintList(on ? ColorStateList.valueOf(getColor(R.color.pk_on_text)) : null);
        ((TextView) l.getChildAt(1)).setTextColor(getColor(on ? R.color.pk_on_text : R.color.text));
    }

    private void openWheel() {
        SoundPlayer.play(this, SoundPlayer.OPEN);
        Touch.haptic(moon, Touch.TAP);
        setStep(STEP_WHEEL);
    }

    private void closeWheel() {
        SoundPlayer.play(this, SoundPlayer.CLOSE);
        Touch.haptic(moon, Touch.TAP);
        setStep(STEP_MOON);
    }

    // ===== النقرات =====
    @Override
    public void onClick(View v) {
        if (v == moon) {
            if (busy) return;
            if (STEP_WHEEL.equals(step)) closeWheel();
            else if (STEP_MOON.equals(step)) openWheel();
            return;
        }
        Object tag = v.getTag();
        if (!(tag instanceof String)) return;
        String t = (String) tag;
        if (petalSlugs.contains(t)) {
            if (busy || !STEP_WHEEL.equals(step)) return;
            Touch.feedback(v, Touch.TAP, SoundPlayer.TAP);
            busy = true;
            section = t;
            setSelected(v, true);
            area = "";
            applyPool();
            if (motion) stage.startTrails(petals.size());
            later(120, W_PICK, null);
        } else if ("again".equals(t)) {
            if (busy) return;
            SoundPlayer.play(this, SoundPlayer.TAP);
            Touch.haptic(v, Touch.TAP);
            pickNow();
        } else if ("chip".equals(t)) {
            if (busy) return;
            clearResult();
            openWheel();
        } else if ("area".equals(t)) {
            if (busy) return;
            Touch.feedback(v, Touch.TAP, SoundPlayer.TAP);
            showAreas();
        } else if (t.startsWith("url:")) {
            Touch.feedback(v, Touch.CONFIRM, SoundPlayer.OPEN);
            LinkButtons.handleClick(this, t);
        } else if ("page".equals(t) && v.getParent() != null) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.OPEN);
            JSONObject it = (JSONObject) ((View) v).getTag(R.id.pkRoot);
            if (it != null) ItemAdapter.open(this, it, sectionOf.get(it), null);
        }
    }

    @Override
    public void onBackPressed() {
        if (busy) return;
        if (STEP_CLIP.equals(step)) {
            clearResult();
            openWheel();
            return;
        }
        if (STEP_WHEEL.equals(step)) {
            closeWheel();
            return;
        }
        super.onBackPressed();
        overridePendingTransition(0, 0);
    }

    private void syncBack() {
        if (android.os.Build.VERSION.SDK_INT < 33) return;
        boolean need = !STEP_MOON.equals(step);
        if (need && backCallback == null) {
            backCallback = new Ui.BackCallback(this);
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, (android.window.OnBackInvokedCallback) backCallback);
        } else if (!need && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback((android.window.OnBackInvokedCallback) backCallback);
            backCallback = null;
        }
    }

    // ===== منطق الاختيار (كما بالموقع): المنطقة، والأقرب لي، وكيس الخلط بالمحل =====
    private List<JSONObject> itemsFor(String k) {
        List<JSONObject> out = new ArrayList<>();
        JSONObject sections = MainActivity.cachedSections;
        if (sections == null || k == null) return out;
        for (String key : PK_KEYS) {
            if (!"any".equals(k) && !key.equals(k)) continue;
            JSONObject s = sections.optJSONObject(key);
            JSONArray arr = s == null ? null : s.optJSONArray("items");
            if (arr == null) continue;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject it = arr.optJSONObject(i);
                if (it != null) out.add(it);
            }
        }
        return out;
    }

    private String areaOf(JSONObject it) {
        JSONArray tags = it.optJSONArray("tags");
        if (tags == null) return "";
        for (int i = 0; i < tags.length(); i++) if (areaNames.contains(tags.optString(i))) return tags.optString(i);
        return "";
    }

    private void applyPool() {
        List<JSONObject> list = itemsFor(section);
        if (NEAR.equals(area)) items = nearPool;
        else if (area.isEmpty()) items = list;
        else {
            items = new ArrayList<>();
            for (JSONObject it : list) {
                JSONArray tags = it.optJSONArray("tags");
                if (tags == null) continue;
                for (int i = 0; i < tags.length(); i++) {
                    if (area.equals(tags.optString(i))) {
                        items.add(it);
                        break;
                    }
                }
            }
        }
        bag = new ArrayList<>();
    }

    // الفائز: بالمحل لا بالفرع (العنوان قبل " - ")، وكيس خلط: كل المحلات تطلع مرة قبل
    // أن يتكرر أي محل، ولا يطلع نفس المحل مرتين وراء بعض
    private static String brandOf(JSONObject it) {
        return it.optString("title", "").split(" - ")[0].trim();
    }

    private JSONObject pickWinner() {
        Map<String, List<JSONObject>> groups = new LinkedHashMap<>();
        for (JSONObject it : items) {
            String k = brandOf(it);
            List<JSONObject> g = groups.get(k);
            if (g == null) {
                g = new ArrayList<>();
                groups.put(k, g);
            }
            g.add(it);
        }
        List<String> kept = new ArrayList<>();
        for (String k : bag) if (groups.containsKey(k)) kept.add(k);
        bag = kept;
        if (bag.isEmpty()) {
            bag = new ArrayList<>(groups.keySet());
            for (int i = bag.size() - 1; i > 0; i--) {
                int j = random.nextInt(i + 1);
                String t = bag.get(i);
                bag.set(i, bag.get(j));
                bag.set(j, t);
            }
            int last = bag.size() - 1;
            if (bag.size() > 1 && bag.get(last).equals(lastBrand)) {
                String t = bag.get(0);
                bag.set(0, bag.get(last));
                bag.set(last, t);
            }
        }
        lastBrand = bag.remove(bag.size() - 1);
        List<JSONObject> g = groups.get(lastBrand);
        return g.get(random.nextInt(g.size()));
    }

    // ===== الكرة والقصاصة =====
    private void pickNow() {
        if (items.isEmpty()) {
            busy = false;
            return;
        }
        busy = true;
        if (areaView != null) areaView.setEnabled(false);
        JSONObject winner = pickWinner();
        if (STEP_CLIP.equals(step) && current != null && motion) {
            SoundPlayer.play(this, SoundPlayer.CRUMPLE);
            current.play(true, new Go(this, winner));
        } else {
            go(winner);
        }
    }

    private void go(JSONObject winner) {
        boolean en = Lang.en(this);
        String[] words = en ? new String[]{"Torilu", "Bahrain", "Today", "News", "Manama", "Menu"}
                : new String[]{"توريلو", "البحرين", "اليوم", "أخبار", "المنامة", "قهوة"};
        stage.showBall(random.nextInt(1000000000), words, motion);
        setStep(STEP_BALL);
        later(380, W_CRUMPLE, null);
        later(1050, W_UNFOLD, winner);
    }

    private void unfold(JSONObject item) {
        clearResult();
        long seed = random.nextInt(1000000000);
        current = new ClippingView(this, seed, ballD * 0.4f);
        fillClip(current, item);
        int W = root.getWidth();
        float d = getResources().getDisplayMetrics().density;
        boolean wide = W / d >= 600;
        int inner = Math.min(Math.round((wide ? 700 : 340) * d), W - Math.round(32 * d));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(inner + 2 * current.inset(), -2);
        current.setVisibility(View.INVISIBLE);
        resultCol.addView(current, lp);
        resultCol.addView(tools(item));
        resultScroll.scrollTo(0, 0);
        resultScroll.setVisibility(View.VISIBLE);
        setStep(STEP_CLIP);
        current.post(new Later(this, -1, item));
    }

    // بعد تخطيط القصاصة: نعرف مكانها فنبدأ من مركز الكرة
    private void startUnfold(JSONObject item) {
        if (current == null) return;
        int[] a = new int[2];
        int[] r = new int[2];
        root.getLocationInWindow(r);
        current.getLocationInWindow(a);
        float clipCx = a[0] - r[0] + current.getWidth() / 2f - current.getTranslationX();
        float clipCy = a[1] - r[1] + current.getHeight() / 2f - current.getTranslationY();
        current.setFrom(stage.cx - clipCx, stage.cy - clipCy);
        current.setVisibility(View.VISIBLE);
        root.announceForAccessibility(getString(R.string.pk_result, Lang.title(this, item)));
        later(420, W_SUCCESS, null);
        if (motion) {
            current.play(false, new Later(this, W_DONE));
        } else {
            current.showFlat();
            current.setAlpha(0f);
            current.animate().alpha(1f).setDuration(250).start();
            done();
        }
        View tools = resultCol.getChildAt(1);
        tools.setAlpha(0f);
        tools.animate().alpha(1f).setStartDelay(motion ? 800 : 0).setDuration(350).start();
    }

    private void done() {
        busy = false;
        if (areaView != null) areaView.setEnabled(true);
    }

    private void clearResult() {
        if (current != null) current.cancel();
        current = null;
        areaView = null;
        resultCol.removeAllViews();
        resultScroll.setVisibility(View.GONE);
    }

    // نص القصاصة (clipHtml): ترويسة، السطر الأزرق، الاسم، الدوام والوصف، ثم زر واحد بارز
    private void fillClip(ClippingView clip, JSONObject item) {
        float d = getResources().getDisplayMetrics().density;
        boolean wide = root.getWidth() / d >= 600;
        String sec = sectionOf.get(item);
        String secLabel = label(sec == null ? "any" : sec);
        String ar = areaOf(item);
        String areaLabel = ar.isEmpty() ? "" : Lang.tag(this, ar);
        int text = getColor(R.color.text), muted = getColor(R.color.text_muted), accent = getColor(R.color.brand_accent);
        int m = clip.inset();
        boolean compact = root.getHeight() / d < 600;
        int ph = Math.round((wide ? 48 : compact ? 18 : 24) * d), pv = Math.round((wide ? 36 : compact ? 14 : 22) * d);
        clip.setPadding(m + ph, m + pv, m + ph, m + pv);

        LinearLayout mast = new LinearLayout(this);
        mast.setOrientation(LinearLayout.HORIZONTAL);
        mast.setGravity(Gravity.BOTTOM);
        TextView logo = Ui.text(this, wordmark(), wide ? 28 : 22, text, true);
        Ui.display(logo);
        logo.setIncludeFontPadding(false);
        mast.addView(logo);
        mast.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        String pick = getString(R.string.pk_yours) + " · " + secLabel;
        if (wide) pick = pick + "   " + today();
        TextView pk = Ui.text(this, pick, 12.5f, muted, false);
        pk.setMaxLines(1);
        pk.setEllipsize(TextUtils.TruncateAt.END);
        mast.addView(pk);
        mast.setPadding(0, 0, 0, Math.round(8 * d));
        clip.addView(mast, new LinearLayout.LayoutParams(-1, -2));
        View dbl = new View(this);
        dbl.setBackgroundResource(R.drawable.rule_double);
        dbl.getBackground().mutate().setTint((text & 0x00FFFFFF) | 0xBF000000);
        clip.addView(dbl, new LinearLayout.LayoutParams(-1, Math.round(3 * d)));

        TextView kick = Ui.text(this, areaLabel.isEmpty() ? secLabel : secLabel + "  •  " + areaLabel, wide ? 14 : 13, accent, true);
        kick.setMaxLines(1);
        kick.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams klp = new LinearLayout.LayoutParams(-1, -2);
        klp.topMargin = Math.round(16 * d);
        clip.addView(kick, klp);

        TextView name = Ui.text(this, Lang.title(this, item), wide ? 64 : compact ? 32 : 40, text, true);
        Ui.display(name);
        name.setIncludeFontPadding(false);
        name.setLineSpacing(0, 0.8f);
        name.setPadding(0, Math.round(6 * d), 0, Math.round(4 * d));
        clip.addView(name, new LinearLayout.LayoutParams(-1, -2));

        View hr = new View(this);
        hr.setBackgroundColor((text & 0x00FFFFFF) | 0x59000000);
        LinearLayout.LayoutParams hlp = new LinearLayout.LayoutParams(-1, Math.max(1, Math.round(d)));
        hlp.topMargin = Math.round(14 * d);
        hlp.bottomMargin = Math.round(12 * d);
        clip.addView(hr, hlp);

        String hours = Lang.hours(this, item);
        if (!hours.isEmpty()) {
            TextView h = Ui.text(this, hours, 14.5f, text, true);
            h.setCompoundDrawablesRelativeWithIntrinsicBounds(R.drawable.pk_clock, 0, 0, 0);
            h.setCompoundDrawableTintList(ColorStateList.valueOf((text & 0x00FFFFFF) | 0xB3000000));
            h.setCompoundDrawablePadding(Math.round(8 * d));
            h.setGravity(Gravity.CENTER_VERTICAL);
            clip.addView(h, new LinearLayout.LayoutParams(-1, -2));
        }
        String desc = Lang.desc(this, item);
        if (!desc.isEmpty()) {
            TextView lead = Ui.text(this, desc, 16, getColor(R.color.pk_news_ink), false);
            lead.setMaxLines(3);
            lead.setEllipsize(TextUtils.TruncateAt.END);
            lead.setLineSpacing(0, 0.95f);
            LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(-1, -2);
            dlp.topMargin = Math.round(8 * d);
            clip.addView(lead, dlp);
        }

        // خط نقاط أزرق ثم الأزرار: «خذني له» البارز، وتحته «صفحة المكان» و«غيره» صغيرين
        View dots = new View(this);
        GradientDrawable dl = new GradientDrawable();
        dl.setShape(GradientDrawable.LINE);
        dl.setStroke(Math.round(2.2f * d), (accent & 0x00FFFFFF) | 0x8C000000, 2.2f * d, 5.8f * d);
        dots.setBackground(dl);
        dots.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        LinearLayout.LayoutParams dotlp = new LinearLayout.LayoutParams(-1, Math.round(4 * d));
        dotlp.topMargin = Math.round(20 * d);
        dotlp.bottomMargin = Math.round(16 * d);
        clip.addView(dots, dotlp);

        JSONObject links = item.optJSONObject("links");
        String maps = links == null ? "" : links.optString("maps", "");
        if (!maps.isEmpty()) clip.addView(primary(getString(R.string.pk_go), R.drawable.pk_go, "url:" + maps));
        LinearLayout subs = new FitRow(this);
        subs.setOrientation(LinearLayout.HORIZONTAL);
        subs.setGravity(Gravity.CENTER);
        if (maps.isEmpty()) {
            View pg = primary(getString(R.string.pk_page), R.drawable.pk_page, "page");
            pg.setTag(R.id.pkRoot, item);
            clip.addView(pg);
        } else {
            View pg = subBtn(getString(R.string.pk_page), R.drawable.pk_page, "page");
            pg.setTag(R.id.pkRoot, item);
            subs.addView(pg);
            subs.addView(new View(this), new LinearLayout.LayoutParams(Math.round(26 * d), 1));
        }
        subs.addView(subBtn(getString(R.string.pk_again), R.drawable.pk_again, "again"));
        LinearLayout.LayoutParams sublp = new LinearLayout.LayoutParams(-1, -2);
        sublp.topMargin = Math.round(4 * d);
        clip.addView(subs, sublp);
    }

    private View primary(String label, int icon, String tag) {
        float d = getResources().getDisplayMetrics().density;
        TextView v = Ui.text(this, label, 17, getColor(R.color.pk_on_text), true);
        v.setGravity(Gravity.CENTER);
        v.setCompoundDrawablesRelativeWithIntrinsicBounds(icon, 0, 0, 0);
        v.setCompoundDrawableTintList(ColorStateList.valueOf(getColor(R.color.pk_on_text)));
        v.setCompoundDrawablePadding(Math.round(10 * d));
        v.setBackground(Ui.rounded(this, getColor(R.color.pk_on), 999));
        v.setElevation(Math.round(3 * d));
        v.setPadding(Math.round(24 * d), 0, Math.round(24 * d), 0);
        v.setTag(tag);
        v.setOnClickListener(this);
        Touch.springy(v, 0.96f);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, Math.round(54 * d));
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        v.setLayoutParams(lp);
        v.setMinWidth(Math.round(220 * d));
        return v;
    }

    private View subBtn(String label, int icon, String tag) {
        float d = getResources().getDisplayMetrics().density;
        int text = getColor(R.color.text);
        TextView v = Ui.text(this, label, 14.5f, text, true);
        v.setGravity(Gravity.CENTER);
        v.setCompoundDrawablesRelativeWithIntrinsicBounds(icon, 0, 0, 0);
        v.setCompoundDrawableTintList(ColorStateList.valueOf(text));
        v.setCompoundDrawablePadding(Math.round(6 * d));
        v.setMinHeight(Math.round(44 * d));
        v.setPadding(Math.round(4 * d), 0, Math.round(4 * d), 0);
        v.setTag(tag);
        v.setOnClickListener(this);
        Touch.springy(v, 0.94f);
        return v;
    }

    // الزرّان الصغيران فوق بعض إن لم يتسعا جنباً إلى جنب (لا تنكسر الكلمة: «Anoth/er»)
    static final class FitRow extends LinearLayout {
        FitRow(Context c) {
            super(c);
        }

        @Override
        protected void onMeasure(int wSpec, int hSpec) {
            if (getOrientation() == HORIZONTAL && MeasureSpec.getMode(wSpec) != MeasureSpec.UNSPECIFIED) {
                super.onMeasure(MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED), hSpec);
                if (getMeasuredWidth() > MeasureSpec.getSize(wSpec)) setOrientation(VERTICAL);
            }
            super.onMeasure(wSpec, hSpec);
        }
    }

    // تحت القصاصة: رقاقة القسم (ترجع للعجلة) و«من أين؟»
    private View tools(JSONObject item) {
        float d = getResources().getDisplayMetrics().density;
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        TextView chip = Ui.text(this, label(section), 13.5f, getColor(R.color.on_tonal), true);
        chip.setGravity(Gravity.CENTER_VERTICAL);
        chip.setCompoundDrawablesRelativeWithIntrinsicBounds(glyph(section), 0, 0, 0);
        android.graphics.drawable.Drawable gd = chip.getCompoundDrawablesRelative()[0];
        if (gd != null) gd.setBounds(0, 0, Math.round(20 * d), Math.round(20 * d));
        chip.setCompoundDrawablesRelative(gd, null, null, null);
        chip.setCompoundDrawablePadding(Math.round(6 * d));
        chip.setBackground(Ui.rounded(this, getColor(R.color.tonal), 999));
        chip.setPadding(Math.round(12 * d), 0, Math.round(14 * d), 0);
        chip.setMinHeight(Math.round(40 * d));
        chip.setContentDescription(getString(R.string.pk_change) + ": " + label(section));
        chip.setTag("chip");
        chip.setOnClickListener(this);
        row.addView(chip);
        row.addView(new View(this), new LinearLayout.LayoutParams(Math.round(14 * d), 1));
        areaView = Ui.text(this, areaText() + " ▾", 13.5f, getColor(R.color.text_muted), false);
        areaView.setGravity(Gravity.CENTER_VERTICAL);
        areaView.setMaxLines(2); // شاشة ضيقة: يلتف بدل «All of Bahrain (4…»
        areaView.setEllipsize(TextUtils.TruncateAt.END);
        areaView.setMinHeight(Math.round(40 * d));
        areaView.setPaintFlags(areaView.getPaintFlags() | android.graphics.Paint.UNDERLINE_TEXT_FLAG);
        areaView.setContentDescription(getString(R.string.pk_area_label) + " " + areaText());
        areaView.setTag("area");
        areaView.setOnClickListener(this);
        areaView.setEnabled(!busy);
        row.addView(areaView);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = Math.round(18 * d);
        lp.leftMargin = lp.rightMargin = Math.round(16 * d);
        row.setLayoutParams(lp);
        return row;
    }

    // «توريلو.» والنقطة بأزرق الواجهة (np_link غامق يختفي على ورق القصاصة الداكن)
    private CharSequence wordmark() {
        String name = getString(R.string.brand);
        android.text.SpannableString s = new android.text.SpannableString(name + ".");
        s.setSpan(new android.text.style.ForegroundColorSpan(getColor(R.color.brand_accent)),
                name.length(), name.length() + 1, android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    private String areaText() {
        if (NEAR.equals(area)) return getString(R.string.pk_area_near);
        if (area.isEmpty()) return getString(R.string.pk_area_all, String.valueOf(itemsFor(section).size()));
        return Lang.tag(this, area);
    }

    private String today() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        return cal.get(java.util.Calendar.DAY_OF_MONTH) + " " + getResources().getStringArray(R.array.np_months)[cal.get(java.util.Calendar.MONTH)]
                + " " + cal.get(java.util.Calendar.YEAR);
    }

    // ===== «من أين؟»: الكل، الأقرب لي، ثم المناطق بعدد أماكنها =====
    private void showAreas() {
        List<JSONObject> list = itemsFor(section);
        Map<String, Integer> counts = new LinkedHashMap<>();
        boolean hasLoc = false;
        for (JSONObject it : list) {
            JSONArray tags = it.optJSONArray("tags");
            if (tags != null) {
                for (int i = 0; i < tags.length(); i++) {
                    String tg = tags.optString(i);
                    if (!areaNames.contains(tg)) continue;
                    Integer c = counts.get(tg);
                    counts.put(tg, c == null ? 1 : c + 1);
                }
            }
            if ((!it.isNull("lat") && it.has("lat")) || (it.optJSONArray("branches") != null && it.optJSONArray("branches").length() > 0)) hasLoc = true;
        }
        List<String> keys = new ArrayList<>(counts.keySet());
        for (int i = 1; i < keys.size(); i++) {
            String k = keys.get(i);
            int j = i - 1;
            while (j >= 0 && counts.get(keys.get(j)) < counts.get(k)) {
                keys.set(j + 1, keys.get(j));
                j--;
            }
            keys.set(j + 1, k);
        }
        areaValues = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        areaValues.add("");
        labels.add(getString(R.string.pk_area_all, String.valueOf(list.size())));
        if (hasLoc) {
            areaValues.add(NEAR);
            labels.add(getString(R.string.pk_area_near));
        }
        for (String k : keys) {
            areaValues.add(k);
            labels.add(Lang.tag(this, k) + " (" + counts.get(k) + ")");
        }
        int checked = Math.max(0, areaValues.indexOf(area));
        areaDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.pk_area_label)
                .setSingleChoiceItems(labels.toArray(new String[0]), checked, this)
                .show();
    }

    @Override
    public void onClick(DialogInterface dialog, int which) {
        dialog.dismiss();
        if (which < 0 || which >= areaValues.size()) return;
        String v = areaValues.get(which);
        if (!NEAR.equals(v)) {
            area = v;
            applyPool();
            again();
            return;
        }
        if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            locate();
        } else {
            new AlertDialog.Builder(this)
                    .setTitle(getString(R.string.loc_title))
                    .setMessage(getString(R.string.loc_msg))
                    .setPositiveButton(getString(R.string.loc_continue), new AskLocation(this))
                    .setNegativeButton(getString(R.string.cancel), null)
                    .show();
        }
    }

    private void again() {
        if (busy) return;
        SoundPlayer.play(this, SoundPlayer.TAP);
        pickNow();
    }

    private static final class AskLocation implements DialogInterface.OnClickListener {
        private final Activity a;

        AskLocation(Activity a) {
            this.a = a;
        }

        @Override
        public void onClick(DialogInterface dialog, int which) {
            a.requestPermissions(new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION}, LOCATION_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != LOCATION_REQUEST) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) locate();
        else Toast.makeText(this, R.string.loc_fail, Toast.LENGTH_LONG).show();
    }

    // ponytail: آخر موقع معروف فقط (مثل «قريب مني» بـSectionActivity)؛ requestSingleUpdate لو صار فارغاً كثيراً
    private void locate() {
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        Location best = null;
        for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                Location loc = lm.getLastKnownLocation(provider);
                if (loc != null && (best == null || loc.getTime() > best.getTime())) best = loc;
            } catch (Exception ignored) {
            }
        }
        if (best == null) {
            Toast.makeText(this, R.string.loc_fail, Toast.LENGTH_LONG).show();
            return;
        }
        List<JSONObject> list = itemsFor(section);
        List<JSONObject> withKm = new ArrayList<>();
        List<Double> kms = new ArrayList<>();
        for (JSONObject it : list) {
            double km = nearestKm(it, best.getLatitude(), best.getLongitude());
            if (km < 0) continue;
            int j = 0;
            while (j < kms.size() && kms.get(j) <= km) j++;
            kms.add(j, km);
            withKm.add(j, it);
        }
        nearPool = new ArrayList<>(withKm.subList(0, Math.min(NEAR_COUNT, withKm.size())));
        area = NEAR;
        applyPool();
        Toast.makeText(this, getString(R.string.pk_area_near_done, String.valueOf(nearPool.size())), Toast.LENGTH_SHORT).show();
        if (!items.isEmpty()) again();
    }

    // nearestBranch بالموقع: أقرب فرع، أو lat/lng المكان نفسه؛ -1 = بلا موقع
    private static double nearestKm(JSONObject it, double lat, double lng) {
        double best = -1;
        JSONArray br = it.optJSONArray("branches");
        if (br != null && br.length() > 0) {
            for (int i = 0; i < br.length(); i++) {
                JSONObject b = br.optJSONObject(i);
                if (b == null || !b.has("lat") || !b.has("lng") || b.isNull("lat")) continue;
                double km = haversineKm(lat, lng, b.optDouble("lat"), b.optDouble("lng"));
                if (best < 0 || km < best) best = km;
            }
        } else if (it.has("lat") && !it.isNull("lat") && !it.isNull("lng")) {
            best = haversineKm(lat, lng, it.optDouble("lat"), it.optDouble("lng"));
        }
        return best;
    }

    private static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ===== مؤقّتات =====
    private void later(long ms, int what, JSONObject arg) {
        handler.postDelayed(new Later(this, what, arg), motion ? ms : Math.min(ms, 250));
    }

    private void run(int what, JSONObject arg) {
        switch (what) {
            case 0:
                fit();
                break;
            case -1:
                startUnfold(arg);
                break;
            case W_PICK:
                pickNow();
                break;
            case W_CRUMPLE:
                if (STEP_BALL.equals(step)) SoundPlayer.play(this, SoundPlayer.CRUMPLE);
                break;
            case W_UNFOLD:
                unfold(arg);
                break;
            case W_SUCCESS:
                SoundPlayer.play(this, SoundPlayer.SUCCESS);
                Touch.haptic(root, Touch.CONFIRM);
                break;
            case W_DONE:
                done();
                break;
            default:
                break;
        }
    }

    private static final class Later implements Runnable {
        private final PickerActivity a;
        private final int what;
        private final JSONObject arg;

        Later(PickerActivity a, int what) {
            this(a, what, null);
        }

        Later(PickerActivity a, int what, JSONObject arg) {
            this.a = a;
            this.what = what;
            this.arg = arg;
        }

        @Override
        public void run() {
            if (!a.isDestroyed()) a.run(what, arg);
        }
    }

    // بعد تكوير القصاصة الحالية: كرة جديدة ثم قصاصة جديدة
    private static final class Go implements Runnable {
        private final PickerActivity a;
        private final JSONObject winner;

        Go(PickerActivity a, JSONObject winner) {
            this.a = a;
            this.winner = winner;
        }

        @Override
        public void run() {
            if (!a.isDestroyed()) a.go(winner);
        }
    }

    private static final class Hide implements Runnable {
        private final View v;

        Hide(View v) {
            this.v = v;
        }

        @Override
        public void run() {
            v.setVisibility(View.INVISIBLE);
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (current != null) current.cancel();
        if (stepAnim != null) stepAnim.cancel();
        if (areaDialog != null && areaDialog.isShowing()) areaDialog.dismiss();
        super.onDestroy();
    }
}
