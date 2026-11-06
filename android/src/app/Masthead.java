package bh.mohframevision.torilu;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

/* ترويسة الجريدة (.np-mast بالموقع): سطر صغير بين خطّين، «توريلو.» كبيراً، «دليل أماكن
   البحرين»، ثم خط مزدوج. وأدوات صغيرة مشتركة لورقة الجريدة: الخطوط، التاريخ، صندوق المعلومات. */
final class Masthead {
    private Masthead() {
    }

    static View build(Context c, String left, String middle, String right) {
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);

        boolean narrow = c.getResources().getConfiguration().screenWidthDp < 360;
        LinearLayout top = row(c);
        String[] items = narrow ? new String[]{left, middle} : new String[]{left, middle, right};
        int n = 0;
        for (String s : items) {
            if (s == null || s.isEmpty()) continue;
            if (n++ > 0) top.addView(new View(c), new LinearLayout.LayoutParams(0, 1, 1f));
            top.addView(small(c, s));
        }
        if (n == 1) top.setGravity(Gravity.CENTER);
        if (n > 0) {
            box.addView(rule(c, false));
            box.addView(top);
            box.addView(rule(c, false));
        }

        TextView name = Ui.text(c, wordmark(c), 56, NewspaperSheet.ink(c), true);
        Ui.display(name);
        name.setGravity(Gravity.CENTER);
        name.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        name.setIncludeFontPadding(false);
        name.setPadding(0, Ui.dp(c, 8), 0, Ui.dp(c, 4));
        box.addView(name, match());

        TextView tag = Ui.text(c, c.getString(R.string.np_tagline), 15, NewspaperSheet.inkMuted(c), false);
        Ui.display(tag);
        tag.setGravity(Gravity.CENTER);
        tag.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        tag.setPadding(0, 0, 0, Ui.dp(c, 8));
        box.addView(tag, match());

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(c, 4));
        View dbl = rule(c, true);
        dbl.setLayoutParams(lp);
        box.addView(dbl);
        LinearLayout.LayoutParams bp = match();
        bp.bottomMargin = Ui.dp(c, 16);
        box.setLayoutParams(bp);
        return box;
    }

    // «توريلو.» على الورق: النقطة بأزرق الحبر (np_link، يبقى غامقاً على ورق الداكن)
    static CharSequence wordmark(Context c) {
        String name = c.getString(R.string.brand);
        android.text.SpannableString s = new android.text.SpannableString(name + ".");
        s.setSpan(new android.text.style.ForegroundColorSpan(c.getColor(R.color.np_link)),
                name.length(), name.length() + 1, android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    // «5 نوفمبر 2026» بتوقيت UTC، نفس npDate بالموقع
    static String date(Context c, long epochMs) {
        java.util.Calendar cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
        cal.setTimeInMillis(epochMs);
        return cal.get(java.util.Calendar.DAY_OF_MONTH) + " "
                + c.getResources().getStringArray(R.array.np_months)[cal.get(java.util.Calendar.MONTH)] + " "
                + cal.get(java.util.Calendar.YEAR);
    }

    // خط حبر رفيع (1dp) أو مزدوج (4dp، border: double)
    static View rule(Context c, boolean dbl) {
        View v = new View(c);
        if (dbl) {
            v.setBackgroundResource(R.drawable.rule_double);
            v.getBackground().mutate().setTint(NewspaperSheet.ink(c));
        } else {
            v.setBackgroundColor(NewspaperSheet.ink(c));
        }
        v.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(c, dbl ? 4 : 1)));
        return v;
    }

    // صندوق المعلومات العملية (.np-facts): إطار رفيع بلون خطوط الورق، النص بخط الجريدة
    static TextView facts(Context c) {
        TextView t = Ui.text(c, "", 16, NewspaperSheet.ink(c), false);
        Ui.display(t);
        GradientDrawable g = new GradientDrawable();
        g.setStroke(Ui.dp(c, 1), c.getColor(R.color.np_rule));
        t.setBackground(g);
        int p = Ui.dp(c, 14);
        t.setPadding(p, p, p, p);
        t.setLineSpacing(Ui.dp(c, 4), 1f);
        LinearLayout.LayoutParams lp = match();
        lp.topMargin = Ui.dp(c, 16);
        lp.bottomMargin = Ui.dp(c, 16);
        t.setLayoutParams(lp);
        return t;
    }

    private static LinearLayout row(Context c) {
        LinearLayout r = new LinearLayout(c);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(Ui.dp(c, 2), Ui.dp(c, 4), Ui.dp(c, 2), Ui.dp(c, 4));
        return r;
    }

    private static TextView small(Context c, String s) {
        TextView t = Ui.text(c, s, 12, NewspaperSheet.inkMuted(c), true);
        t.setMaxLines(1);
        t.setEllipsize(android.text.TextUtils.TruncateAt.END);
        return t;
    }

    private static LinearLayout.LayoutParams match() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }
}
