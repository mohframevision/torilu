package bh.mohframevision.torilu;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

// "عن توريلو" — شاشة قصيرة محايدة: تعريف، أرقام حيّة من بيانات التطبيق،
// وزرا التواصل والمشاركة. قصة هكوله القديمة (المحطات وما تعلّمته وعدّاد
// أيام الإطلاق والموسيقى) حُذفت — الصياغة النهائية يكتبها صاحب الموقع.
//
// بلا lambdas ولا كلاسات مجهولة — د8 بهذي البيئة يفشل عليها.
public class StoryActivity extends Activity implements View.OnClickListener, View.OnScrollChangeListener {

    private final List<View> pending = new ArrayList<>();
    private ScrollView scroll;
    private LinearLayout content;
    private boolean animations;
    private final List<TextView> statViews = new ArrayList<>();
    private final List<Integer> statValues = new ArrayList<>();
    private View statsBlock;

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapNightContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_story);
        Ui.edgeToEdge(this, 0, 0);
        animations = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled();

        scroll = findViewById(R.id.storyScroll);
        content = findViewById(R.id.storyContent);
        View close = findViewById(R.id.storyClose);
        close.setOnClickListener(this);
        Touch.springy(close, 0.85f);
        scroll.setOnScrollChangeListener(this);

        build();
        scroll.post(new CheckReveal(this));
    }

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    // ================= المحتوى =================
    private void build() {
        TextView title = text(getString(R.string.brand), 44, 0xFFFFFFFF, true);
        content.addView(title);
        content.addView(para(getString(R.string.story_intro), 6));

        statsBlock = buildStats();
        reveal(statsBlock, 28);

        reveal(buildHelpPanel(), 32);
        TextView sign = text(getString(R.string.story_sign), 13, 0x99FFFFFF, false);
        sign.setGravity(Gravity.CENTER);
        reveal(sign, 20);
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(null, Typeface.BOLD);
        t.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        return t;
    }

    private TextView para(String s, int topDp) {
        TextView t = text(s, 16, 0xD9FFFFFF, false);
        t.setLineSpacing(0, 1.12f);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(topDp);
        t.setLayoutParams(lp);
        return t;
    }

    // كل عنصر يضاف مخفياً ويطلع وقت يوصله التمرير
    private void reveal(View v, int topDp) {
        ViewGroup.LayoutParams base = v.getLayoutParams();
        LinearLayout.LayoutParams lp = base instanceof LinearLayout.LayoutParams
                ? (LinearLayout.LayoutParams) base
                : new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(topDp);
        v.setLayoutParams(lp);
        if (animations) {
            v.setAlpha(0f);
            v.setTranslationY(dp(36));
            pending.add(v);
        }
        content.addView(v);
    }

    private static GradientDrawable glass(float radius, int fill, int stroke, float density) {
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(radius);
        g.setColor(fill);
        g.setStroke(Math.max(1, (int) density), stroke);
        return g;
    }

    // الأرقام حيّة من بيانات التطبيق — نفس المحتوى اللي تتصفحه
    private View buildStats() {
        int items = 0, sections = 0;
        JSONObject all = MainActivity.cachedSections;
        JSONArray order = MainActivity.cachedSectionOrder;
        if (all != null && order != null) {
            for (int i = 0; i < order.length(); i++) {
                JSONObject s = all.optJSONObject(order.optString(i));
                if (!MainActivity.isBrowsable(s)) continue;
                sections++;
                items += s.optJSONArray("items").length();
            }
        }
        LinearLayout row = new LinearLayout(this);
        addStat(row, items, getString(R.string.stat_items), true);
        addStat(row, sections, getString(R.string.stat_sections), false);
        addStat(row, 2, getString(R.string.stat_langs), false);
        return row;
    }

    private void addStat(LinearLayout row, int value, String label, boolean first) {
        LinearLayout tile = new LinearLayout(this);
        tile.setOrientation(LinearLayout.VERTICAL);
        tile.setGravity(Gravity.CENTER);
        tile.setBackground(glass(dp(20), 0x1AFFFFFF, 0x33FFFFFF, getResources().getDisplayMetrics().density));
        tile.setPadding(dp(8), dp(18), dp(8), dp(18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
        if (!first) lp.setMarginStart(dp(10));
        tile.setLayoutParams(lp);
        TextView num = text(animations ? "0" : String.valueOf(value), 30, 0xFFFFFFFF, true);
        num.setGravity(Gravity.CENTER);
        num.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        TextView cap = text(label, 13, 0xB3FFFFFF, false);
        cap.setGravity(Gravity.CENTER);
        cap.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        tile.addView(num);
        tile.addView(cap);
        row.addView(tile);
        statViews.add(num);
        statValues.add(value);
    }

    private View buildHelpPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_HORIZONTAL);
        panel.setBackgroundResource(R.drawable.glass_card);
        panel.setPadding(dp(22), dp(24), dp(22), dp(24));
        TextView t = text(getString(R.string.story_help_title), 22, 0xFFFFFFFF, true);
        t.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        panel.addView(t);
        TextView p = text(getString(R.string.story_help_text), 14, 0xCCFFFFFF, false);
        p.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        p.setLineSpacing(0, 1.1f);
        LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        plp.topMargin = dp(6);
        p.setLayoutParams(plp);
        panel.addView(p);

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        blp.topMargin = dp(18);
        buttons.setLayoutParams(blp);
        buttons.addView(button(getString(R.string.story_help_suggest), "contact", true));
        buttons.addView(button(getString(R.string.story_help_share), "share", false));
        panel.addView(buttons);
        return panel;
    }

    private TextView button(String label, String tag, boolean primary) {
        TextView b = text(label, 14, primary ? 0xFF1545A2 : 0xFFFFFFFF, true);
        b.setBackgroundResource(primary ? R.drawable.btn_pill_white : R.drawable.glass_pill);
        b.setPadding(dp(20), dp(10), dp(20), dp(10));
        b.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        if (!primary) lp.setMarginStart(dp(10));
        b.setLayoutParams(lp);
        b.setClickable(true);
        b.setFocusable(true);
        b.setTag(tag);
        b.setOnClickListener(this);
        Touch.springy(b);
        return b;
    }

    // ================= التفاعل =================
    @Override
    public void onClick(View v) {
        if (v.getId() == R.id.storyClose) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.CLOSE);
            finish();
            overridePendingTransition(0, 0);
            return;
        }
        Object tag = v.getTag();
        if ("contact".equals(tag)) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.OPEN);
            Intent i = new Intent(this, WebViewActivity.class);
            i.putExtra(WebViewActivity.EXTRA_TITLE, getString(R.string.contact_title));
            i.putExtra(WebViewActivity.EXTRA_URL, Lang.siteUrl(this, "contact.html"));
            startActivity(i);
            overridePendingTransition(0, 0);
        } else if ("share".equals(tag)) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.TAP);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, getString(R.string.share_app_text) + "\n" + Lang.siteUrl(this, ""));
            try {
                startActivity(Intent.createChooser(send, getString(R.string.share_title)));
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(0, 0);
    }

    @Override
    public void onScrollChange(View v, int x, int y, int oldX, int oldY) {
        checkReveal();
    }

    private static final class CheckReveal implements Runnable {
        private final StoryActivity a;

        CheckReveal(StoryActivity a) {
            this.a = a;
        }

        @Override
        public void run() {
            a.checkReveal();
        }
    }

    // أي عنصر دخل 88% من الشاشة يطلع
    private void checkReveal() {
        if (pending.isEmpty()) return;
        // آخر الصفحة: العناصر الأخيرة ما توصل خط الـ88% أبداً — نطلّع الكل
        boolean atEnd = !scroll.canScrollVertically(1);
        int bottom = atEnd ? Integer.MAX_VALUE : scroll.getScrollY() + (int) (scroll.getHeight() * 0.88f);
        for (int i = 0; i < pending.size(); i++) {
            View v = pending.get(i);
            if (v.getTop() + content.getTop() > bottom) continue;
            pending.remove(i--);
            v.animate().alpha(1f).translationY(0f).setDuration(600).setInterpolator(new DecelerateInterpolator(2f)).start();
            if (v == statsBlock) countUp();
        }
    }

    // الأرقام تعدّ من صفر بنقرات، وتنتهي بنغمة نجاح
    private void countUp() {
        ValueAnimator a = ValueAnimator.ofFloat(0f, 1f);
        a.setDuration(1400);
        a.setInterpolator(new DecelerateInterpolator(2f));
        a.addUpdateListener(new CountUpdater(this));
        a.addListener(new CountEnd(this));
        a.start();
    }

    private long lastTick;

    private static final class CountUpdater implements ValueAnimator.AnimatorUpdateListener {
        private final StoryActivity a;

        CountUpdater(StoryActivity a) {
            this.a = a;
        }

        @Override
        public void onAnimationUpdate(ValueAnimator anim) {
            float p = (float) anim.getAnimatedValue();
            for (int i = 0; i < a.statViews.size(); i++) {
                a.statViews.get(i).setText(String.valueOf(Math.round(a.statValues.get(i) * p)));
            }
            long now = System.currentTimeMillis();
            if (p < 1f && now - a.lastTick > 75) {
                a.lastTick = now;
                SoundPlayer.play(a, SoundPlayer.TICK);
            }
        }
    }

    private static final class CountEnd extends android.animation.AnimatorListenerAdapter {
        private final StoryActivity a;

        CountEnd(StoryActivity a) {
            this.a = a;
        }

        @Override
        public void onAnimationEnd(android.animation.Animator animation) {
            SoundPlayer.play(a, SoundPlayer.SUCCESS);
        }
    }
}
