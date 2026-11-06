package bh.mohframevision.torilu;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Layout;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

// «عن توريلو»: صفحة أولى من جريدة تصل مطويّة؛ بالضغط تنفتح (FoldView) ثم تُكتب الفقرات
// بالحبر واحدة واحدة باتجاه القراءة — بضغطة على الورقة أو حين يصلها التمرير — مع نغمة
// هادئة تعلو مع كل فقرة. الورقة «تتنفّس» بميل خفيف وتسكن أثناء القراءة. زر موسيقى هادئة
// (Music) يشغّل ويوقف، ولا يعمل إن كانت الأصوات مطفأة. النصوص هي story_* نفسها بلا تغيير.
//
// بلا lambdas ولا كلاسات مجهولة — د8 بهذي البيئة يفشل عليها.
public class StoryActivity extends Activity implements View.OnClickListener,
        View.OnScrollChangeListener, ValueAnimator.AnimatorUpdateListener {

    private ScrollView scroll;
    private FoldView fold;
    private TextView music, hint;
    private InkText[] items;
    private int next;
    private boolean reduced;
    private ValueAnimator breath;
    private final Runnable resumeBreath = new ResumeBreath(this);
    private final Runnable watchOpen = new WatchOpen(this);

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapThemeContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_story);
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.bg));
        reduced = FoldView.reducedMotion(this);

        scroll = findViewById(R.id.storyScroll);
        scroll.setOnScrollChangeListener(this);
        music = findViewById(R.id.storyMusic);
        LinearLayout content = findViewById(R.id.storyContent);

        NewspaperSheet sheet = buildSheet();
        content.addView(sheet, 0, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        sheet.setOnClickListener(this);
        fold = FoldView.wrap(this, scroll, sheet, getString(R.string.story_headline));

        // الشاشات الضيقة: الزرّان فوق بعض بدل أن يلتف نص أحدهما
        if (getResources().getConfiguration().screenWidthDp < 360) {
            ((LinearLayout) findViewById(R.id.storyActions)).setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) findViewById(R.id.storyShare).getLayoutParams();
            lp.setMarginStart(0);
            lp.topMargin = Ui.dp(this, 10);
        }

        int[] ids = {R.id.storyClose, R.id.storySuggest, R.id.storyShare, R.id.storyMusic};
        for (int id : ids) {
            View v = findViewById(id);
            v.setOnClickListener(this);
            Touch.springy(v);
        }

        if (reduced) {
            for (InkText t : items) t.setInk(1f);
            next = items.length;
            hint.setVisibility(View.GONE);
        } else {
            scroll.post(watchOpen);
        }
    }

    // الورقة: ترويسة «عن توريلو»، العنوان، المقدمة، خط مزدوج، الفقرات، التوقيع، وتلميح المتابعة
    private NewspaperSheet buildSheet() {
        NewspaperSheet sheet = new NewspaperSheet(this);
        int ink = NewspaperSheet.ink(this);
        sheet.addView(Masthead.build(this, getString(R.string.story_title), "", ""));

        TextView head = Ui.text(this, getString(R.string.story_headline), 32, ink, true);
        Ui.display(head);
        head.setLineSpacing(0, 0.8f); // Amiri أسطره عالية
        sheet.addView(head);

        TextView deck = Ui.text(this, getString(R.string.story_deck), 18, NewspaperSheet.inkMuted(this), false);
        deck.setLineSpacing(Ui.dp(this, 2), 1f);
        deck.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 16));
        sheet.addView(deck);
        sheet.addView(Masthead.rule(this, true));

        Typeface serif = null;
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            try {
                serif = getResources().getFont(R.font.amiri);
            } catch (Exception ignored) {
            }
        }
        String[] paras = getString(R.string.story_body).split("\n\\s*\n");
        items = new InkText[paras.length + 1];
        for (int i = 0; i < paras.length; i++) {
            InkText p = new InkText(this);
            p.setText(paras[i].trim());
            p.setTextSize(17);
            p.setTextColor(ink);
            if (serif != null) p.setTypeface(serif);
            p.setLineSpacing(0, 0.96f);
            p.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            if (android.os.Build.VERSION.SDK_INT >= 26) p.setJustificationMode(Layout.JUSTIFICATION_MODE_INTER_WORD);
            p.setPadding(0, Ui.dp(this, i == 0 ? 18 : 12), 0, 0);
            sheet.addView(p);
            items[i] = p;
            if (i == 0) {
                hint = Ui.text(this, getString(R.string.story_tap_next), 13, NewspaperSheet.inkMuted(this), true);
                hint.setGravity(Gravity.CENTER);
                hint.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
                hint.setPadding(0, Ui.dp(this, 14), 0, 0);
                hint.setAlpha(0f);
                sheet.addView(hint, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            }
        }
        InkText sign = new InkText(this);
        sign.setText(getString(R.string.story_sign));
        sign.setTextSize(20);
        sign.setTextColor(ink);
        Ui.display(sign);
        sign.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_END);
        sign.setPadding(0, Ui.dp(this, 20), 0, 0);
        sheet.addView(sign);
        items[paras.length] = sign;
        return sheet;
    }

    // ===== الحبر =====

    private void reveal(int delay) {
        if (next >= items.length) return;
        int k = next++;
        InkText t = items[k];
        ValueAnimator a = ValueAnimator.ofFloat(0f, 1f);
        a.setDuration(Math.min(2600, 380L * Math.max(2, t.getLineCount())));
        a.setStartDelay(delay);
        a.setInterpolator(new DecelerateInterpolator(1.4f));
        // نغمة تعلو مع كل فقرة؛ التوقيع ينتهي بنغمة أعلى
        a.addUpdateListener(new InkAnim(t, k == items.length - 1 ? SoundPlayer.note(5) : SoundPlayer.note(k)));
        a.start();
        if (next >= items.length) hideHint();
    }

    private void hideHint() {
        hint.animate().cancel();
        hint.setVisibility(View.GONE); // لا يترك فراغاً بين الفقرات
    }

    private boolean isOpen() {
        return fold.isOpen();
    }

    // يكتب كل فقرة وصلها التمرير ولم تُكتب بعد، متتابعة
    private void revealVisible() {
        if (!isOpen() || next == 0) return;
        int[] at = new int[2];
        scroll.getLocationOnScreen(at);
        int limit = at[1] + (int) (scroll.getHeight() * 0.82f);
        int delay = 0;
        int[] p = new int[2];
        while (next < items.length) {
            items[next].getLocationOnScreen(p);
            if (p[1] + Ui.dp(this, 24) > limit) break;
            hideHint();
            reveal(delay);
            delay += 280;
        }
    }

    void onOpened() {
        if (next == 0) reveal(350);
        if (next < items.length && hint.getVisibility() == View.VISIBLE) hint.animate().alpha(1f).setStartDelay(1600).setDuration(500).start();
        startBreath();
    }

    // ===== التنفّس: ميل ±0.3° على 6 ثوانٍ، يسكن أثناء القراءة =====

    private void startBreath() {
        if (reduced || breath != null) return;
        breath = ValueAnimator.ofFloat(-0.3f, 0.3f);
        breath.setDuration(3000);
        breath.setRepeatMode(ValueAnimator.REVERSE);
        breath.setRepeatCount(ValueAnimator.INFINITE);
        breath.setInterpolator(new android.view.animation.AccelerateDecelerateInterpolator());
        breath.addUpdateListener(this);
        breath.start();
    }

    private void holdBreath() {
        if (breath == null) return;
        breath.pause();
        fold.animate().rotation(0f).setDuration(250).start();
        scroll.removeCallbacks(resumeBreath);
        scroll.postDelayed(resumeBreath, 6000);
    }

    @Override
    public void onAnimationUpdate(ValueAnimator a) {
        fold.setRotation(isOpen() ? (Float) a.getAnimatedValue() : 0f);
    }

    @Override
    public void onScrollChange(View v, int x, int y, int ox, int oy) {
        holdBreath();
        revealVisible();
    }

    // ===== الموسيقى =====

    private void showMusic() {
        boolean on = Music.isPlaying();
        music.setText(on ? R.string.story_music_stop : R.string.story_music_play);
        music.setBackgroundResource(on ? R.drawable.btn_pill_primary : R.drawable.btn_pill_secondary);
        music.setTextColor(getColor(on ? R.color.white : R.color.text));
    }

    @Override
    protected void onResume() {
        super.onResume();
        showMusic();
    }

    @Override
    protected void onPause() {
        Music.stop();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        scroll.removeCallbacks(watchOpen);
        scroll.removeCallbacks(resumeBreath);
        if (breath != null) breath.cancel();
        super.onDestroy();
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (v instanceof NewspaperSheet) {
            holdBreath();
            if (next > 0 && next < items.length) {
                hideHint();
                reveal(0);
            }
        } else if (id == R.id.storyMusic) {
            if (!Music.isPlaying() && !Prefs.isSoundEnabled(this)) {
                Toast.makeText(this, R.string.story_music_needs_sound, Toast.LENGTH_SHORT).show();
                return;
            }
            Touch.haptic(v, Touch.TAP);
            Music.toggle(this);
            showMusic();
        } else if (id == R.id.storyClose) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.CLOSE);
            finish();
            overridePendingTransition(0, 0);
        } else if (id == R.id.storySuggest) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.OPEN);
            Intent i = new Intent(this, WebViewActivity.class);
            i.putExtra(WebViewActivity.EXTRA_TITLE, getString(R.string.contact_title));
            i.putExtra(WebViewActivity.EXTRA_URL, Lang.siteUrl(this, "contact.html"));
            startActivity(i);
            overridePendingTransition(0, 0);
        } else if (id == R.id.storyShare) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.SHARE);
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

    // ===== كلاسات مسمّاة (بدل lambdas) =====

    // ينتظر انفتاح الجريدة (FoldView لا يُبلغ)، ثم يبدأ الكتابة
    private static final class WatchOpen implements Runnable {
        private final StoryActivity a;

        WatchOpen(StoryActivity a) {
            this.a = a;
        }

        @Override
        public void run() {
            if (a.isFinishing() || a.isDestroyed()) return;
            if (a.fold.isOpen()) a.onOpened();
            else a.scroll.postDelayed(this, 200);
        }
    }

    private static final class ResumeBreath implements Runnable {
        private final StoryActivity a;

        ResumeBreath(StoryActivity a) {
            this.a = a;
        }

        @Override
        public void run() {
            if (a.breath != null && !a.isFinishing()) a.breath.resume();
        }
    }

    private static final class InkAnim implements ValueAnimator.AnimatorUpdateListener {
        private final InkText t;
        private final int sound;
        private boolean played;

        InkAnim(InkText t, int sound) {
            this.t = t;
            this.sound = sound;
        }

        @Override
        public void onAnimationUpdate(ValueAnimator a) {
            if (!played) {
                played = true;
                SoundPlayer.play(t.getContext(), sound);
            }
            t.setInk((Float) a.getAnimatedValue());
        }
    }

    // نص يظهر حبره سطراً سطراً باتجاه القراءة (يمين←يسار بالعربية): قناع تدرّج DST_IN
    // فوق كل سطر. قبل الكتابة يحجز مكانه فارغاً، وقارئ الشاشة يقرأه دائماً.
    static final class InkText extends TextView {
        private float ink;
        private final Paint mask = new Paint();

        InkText(Context c) {
            super(c);
            mask.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_IN));
        }

        void setInk(float v) {
            ink = v;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas c) {
            if (ink >= 1f) {
                super.onDraw(c);
                return;
            }
            Layout l = getLayout();
            if (ink <= 0f || l == null) return;
            int w = getWidth();
            int save = c.saveLayer(0, 0, w, getHeight(), null);
            super.onDraw(c);
            int n = l.getLineCount();
            float band = w * 0.45f;
            boolean rtl = getLayoutDirection() == LAYOUT_DIRECTION_RTL;
            float top0 = getTotalPaddingTop();
            float span = n + 0.8f; // الأسطر تتداخل قليلاً
            for (int i = 0; i < n; i++) {
                float lp = Math.max(0f, Math.min(1f, (ink * span - i) / 1.8f));
                if (lp >= 1f) continue;
                float edge = -band + lp * (w + band);
                float x0 = rtl ? w - edge : edge;
                float x1 = rtl ? x0 - band : x0 + band;
                mask.setShader(new LinearGradient(x0, 0, x1, 0, Color.BLACK, Color.TRANSPARENT, Shader.TileMode.CLAMP));
                float t = i == 0 ? 0 : top0 + l.getLineTop(i);
                float b = i == n - 1 ? getHeight() : top0 + l.getLineBottom(i);
                c.drawRect(0, t, w, b, mask);
            }
            c.restoreToCount(save);
        }
    }
}
