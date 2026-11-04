package bh.mohframevision.torilu;

import android.content.Context;
import android.graphics.Typeface;
import android.text.BidiFormatter;
import android.text.TextDirectionHeuristics;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

// أدوات واجهة صغيرة مشتركة بين الشاشات
final class Ui {
    private Ui() {}

    // HorizontalScrollView داخل واجهة RTL يفتح على الطرف الغلط (نهاية القائمة
    // لا بدايتها) — أول عنصر (الأيمن) ما يبان. بعد أول تخطيط نمرّره لأقصى
    // اليمين، وهو "بداية" القائمة بالعربي
    static void scrollToStart(HorizontalScrollView scroll) {
        scroll.post(new ScrollRight(scroll));
    }

    private static final class ScrollRight implements Runnable {
        private final HorizontalScrollView scroll;

        ScrollRight(HorizontalScrollView scroll) {
            this.scroll = scroll;
        }

        @Override
        public void run() {
            if (scroll.getLayoutDirection() == View.LAYOUT_DIRECTION_RTL) scroll.fullScroll(View.FOCUS_RIGHT);
        }
    }

    static int dp(Context c, float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics());
    }

    // خط Cairo طويل الأسطر أصلاً: مضاعف تباعد فوقه (1.3-1.4) كان يفرّق الفقرات
    // ويقص السطر الثاني بالعناوين. نص عادي بلا مضاعف + إضافة صغيرة ثابتة
    static TextView text(Context c, CharSequence s, float sp, int color, boolean bold) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(null, Typeface.BOLD);
        t.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        return t;
    }

    // أرقام الهاتف والأسعار لاتينية ومن اليسار لليمين حتى وسط نص عربي —
    // بدونها "+973" أو "2.400 BD" تنقلب أجزاؤها
    static String ltr(String s) {
        return BidiFormatter.getInstance().unicodeWrap(s, TextDirectionHeuristics.LTR);
    }

    // إيماءة الرجوع التنبؤية (Android 13+، إجبارية مع targetSdk 36): النظام ما
    // يستدعي onBackPressed بعدها، فالشاشة اللي عندها رجوع خاص (إغلاق نتيجة
    // "اختار لي"، صفحة سابقة بالمتصفح الداخلي) تسجّل هذا وقت الحاجة فقط —
    // وبغيره يشتغل أنيميشن الرجوع الافتراضي للنظام
    static final class BackCallback implements android.window.OnBackInvokedCallback {
        private final android.app.Activity activity;

        BackCallback(android.app.Activity activity) {
            this.activity = activity;
        }

        @Override
        public void onBackInvoked() {
            activity.onBackPressed();
        }
    }

    // HTML المحتوى (مقال أو نبذة مكان) لـTextView: عناوين <h2> بخط الجريدة،
    // والروابط النسبية (/contact.html) تفتح صفحة الموقع داخل التطبيق — URLSpan
    // العادي يرسلها لـACTION_VIEW بلا scheme فلا يحدث شيء
    static CharSequence html(Context c, String html) {
        String marked = html.replaceAll("(?s)(<h2[^>]*>)(.*?)(</h2>)", "$1<tt>$2</tt>$3");
        android.text.SpannableStringBuilder b = new android.text.SpannableStringBuilder(
                android.text.Html.fromHtml(marked, android.text.Html.FROM_HTML_MODE_COMPACT));
        for (android.text.style.TypefaceSpan t : b.getSpans(0, b.length(), android.text.style.TypefaceSpan.class)) {
            if (!"monospace".equals(t.getFamily())) continue;
            int s = b.getSpanStart(t), e = b.getSpanEnd(t);
            b.removeSpan(t);
            if (android.os.Build.VERSION.SDK_INT >= 28) {
                try {
                    b.setSpan(new android.text.style.TypefaceSpan(c.getResources().getFont(R.font.amiri)), s, e, 0);
                } catch (Exception ignored) {
                }
            }
        }
        for (android.text.style.URLSpan u : b.getSpans(0, b.length(), android.text.style.URLSpan.class)) {
            String href = u.getURL();
            if (href == null || href.contains(":") || href.startsWith("#")) continue;
            String path = href.replaceFirst("^/", "");
            if (path.startsWith("en/")) path = path.substring(3); // siteUrl يضيفها حسب لغة التطبيق
            int s = b.getSpanStart(u), e = b.getSpanEnd(u);
            b.removeSpan(u);
            b.setSpan(new SiteLink(path), s, e, 0);
        }
        return b;
    }

    private static final class SiteLink extends android.text.style.ClickableSpan {
        private final String path;

        SiteLink(String path) {
            this.path = path;
        }

        @Override
        public void onClick(View w) {
            Context c = w.getContext();
            android.content.Intent i = new android.content.Intent(c, WebViewActivity.class);
            i.putExtra(WebViewActivity.EXTRA_TITLE, c.getString(R.string.brand));
            i.putExtra(WebViewActivity.EXTRA_URL, Lang.siteUrl(c, path));
            c.startActivity(i);
        }
    }

    // خط الجريدة (Amiri) للشعار والعناوين وأسماء الأماكن — نفس --font-serif
    // بالموقع، عريضاً كما يرسمه المتصفح. النص العادي يبقى Cairo. getFont من
    // API 26؛ الأقدم يبقى Cairo عريضاً
    static void display(TextView t) {
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            try {
                t.setTypeface(Typeface.create(t.getResources().getFont(R.font.amiri), Typeface.BOLD));
                return;
            } catch (Exception ignored) {
            }
        }
        t.setTypeface(null, Typeface.BOLD);
    }

    // عنوان قسم مثل الجريدة: خط مزدوج بلون الحبر فوقه، والعنوان بخط Amiri
    static LinearLayout head(Context c, CharSequence title) {
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        View rule = new View(c);
        rule.setBackgroundResource(R.drawable.rule_double);
        box.addView(rule, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(c, 4)));
        TextView t = text(c, title, 24, c.getColor(R.color.text), false);
        display(t);
        t.setPadding(0, dp(c, 8), 0, 0);
        box.addView(t);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(c, 32);
        lp.bottomMargin = dp(c, 14);
        box.setLayoutParams(lp);
        return box;
    }

    // السطر الصغير الأزرق فوق الاسم (القسم · النوع) — .d-kicker بالموقع
    static TextView kicker(Context c, CharSequence s) {
        TextView t = text(c, s, 12.5f, c.getColor(R.color.brand_accent), true);
        t.setMaxLines(1);
        t.setEllipsize(android.text.TextUtils.TruncateAt.END);
        return t;
    }

    static android.graphics.drawable.GradientDrawable rounded(Context c, int color, float radiusDp) {
        android.graphics.drawable.GradientDrawable d = new android.graphics.drawable.GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(c, radiusDp));
        return d;
    }

    // أيقونة خطية داخل مربع بزوايا ناعمة. لون واحد هادي للكل (بلا ألوان
    // لكل قسم): العين ترتاح، والأزرق محجوز للأزرار المهمة والحالة النشطة
    static ImageView iconTile(Context c, int iconRes, int sizeDp, int bgColor, int iconColor) {
        ImageView v = new ImageView(c);
        v.setImageResource(iconRes);
        v.setColorFilter(iconColor);
        int pad = Math.round(dp(c, sizeDp) * 0.24f);
        v.setPadding(pad, pad, pad, pad);
        v.setBackground(rounded(c, bgColor, sizeDp * 0.3f));
        v.setLayoutParams(new LinearLayout.LayoutParams(dp(c, sizeDp), dp(c, sizeDp)));
        v.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        return v;
    }

    // ---- حافة لحافة (إجباري من Android 15/16 مع targetSdk 35+) ----
    // التطبيق يرسم تحت شريط الحالة وشريط التنقّل، وكل شاشة تعطي لونَي الحافتين:
    // لون = شريط بنفس اللون بارتفاع الشريط الفعلي (سطح الشريط السفلي...)،
    // 0 = الخلفية نفسها تمتد تحت الشريط والمحتوى يُزاح بـpadding (شاشات التدرّج الداكن).
    // أيقونات الشريط فاتحة أو داكنة حسب اللون تحتها. بلا AndroidX.
    static void edgeToEdge(android.app.Activity a, int topColor, int bottomColor) {
        android.view.Window w = a.getWindow();
        android.view.ViewGroup content = a.findViewById(android.R.id.content);
        View root = content.getChildAt(0);
        w.setStatusBarColor(0);
        w.setNavigationBarColor(0);
        if (android.os.Build.VERSION.SDK_INT >= 29) w.setNavigationBarContrastEnforced(false);
        boolean lightTop = topColor != 0 && isLight(topColor);
        boolean lightBottom = bottomColor != 0 && isLight(bottomColor);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            android.view.WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                int flags = (lightTop ? android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0)
                        | (lightBottom ? android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0);
                c.setSystemBarsAppearance(flags, android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(legacyFlags(lightTop, lightBottom));
        }
        View top = null;
        View bottom = null;
        // غلاف عمودي جديد دائماً (padding الجذر الأصلي يبقى كما هو). بوضع
        // الـpadding، خلفية الجذر (تدرّج) تنسخ للغلاف فتمتد تحت الشريطين
        content.removeView(root);
        LinearLayout column = new LinearLayout(a);
        column.setOrientation(LinearLayout.VERTICAL);
        if ((topColor == 0 || bottomColor == 0) && root.getBackground() != null && root.getBackground().getConstantState() != null) {
            column.setBackground(root.getBackground().getConstantState().newDrawable());
        }
        column.addView(root, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        content.addView(column, new android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (topColor != 0) {
            top = new View(a);
            top.setBackgroundColor(topColor);
            column.addView(top, 0, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0));
        }
        if (bottomColor != 0) {
            bottom = new View(a);
            bottom.setBackgroundColor(bottomColor);
            column.addView(bottom, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0));
        }
        content.setOnApplyWindowInsetsListener(new Insets(column, top, bottom));
        content.requestApplyInsets();
    }

    // أعلام النظام القديمة (API 24-29) لنفس الشي: الرسم تحت الشريطين مع لون الأيقونات
    static int legacyFlags(boolean lightTop, boolean lightBottom) {
        int f = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (lightTop) f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (lightBottom && android.os.Build.VERSION.SDK_INT >= 26) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        return f;
    }

    private static boolean isLight(int color) {
        double r = ((color >> 16) & 0xFF) / 255.0;
        double g = ((color >> 8) & 0xFF) / 255.0;
        double b = (color & 0xFF) / 255.0;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
    }

    // يطبّق أبعاد الشريطين (والنتوء/الكاميرا) على الشريطين الملوّنين أو كـpadding
    private static final class Insets implements View.OnApplyWindowInsetsListener {
        private final View column;
        private final View top;
        private final View bottom;

        Insets(View column, View top, View bottom) {
            this.column = column;
            this.top = top;
            this.bottom = bottom;
        }

        @Override
        public android.view.WindowInsets onApplyWindowInsets(View v, android.view.WindowInsets in) {
            int t;
            int b;
            int l;
            int r;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = in.getInsets(android.view.WindowInsets.Type.systemBars()
                        | android.view.WindowInsets.Type.displayCutout());
                t = bars.top;
                b = bars.bottom;
                l = bars.left;
                r = bars.right;
            } else {
                t = in.getSystemWindowInsetTop();
                b = in.getSystemWindowInsetBottom();
                l = in.getSystemWindowInsetLeft();
                r = in.getSystemWindowInsetRight();
            }
            column.setPadding(l, top == null ? t : 0, r, bottom == null ? b : 0);
            if (top != null && top.getLayoutParams().height != t) {
                top.getLayoutParams().height = t;
                top.requestLayout();
            }
            if (bottom != null && bottom.getLayoutParams().height != b) {
                bottom.getLayoutParams().height = b;
                bottom.requestLayout();
            }
            return in;
        }
    }
}
