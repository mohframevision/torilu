package bh.mohframevision.torilu;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Layout;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.method.LinkMovementMethod;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

/* المقال ورقة جريدة مثل article-newspaper.njk بالموقع: ترويسة (البحرين · التاريخ · مقالات)،
   التصنيف بالأزرق، عنوان كبير بخط الجريدة، مقدمة، سطر «بقلم توريلو» ومعه المشاركة بين خطّين،
   خط مزدوج، ثم النص بخط الجريدة مضبوط الطرفين وكلمته الأولى كبيرة، وعلامة نهاية. الورقة
   تفتح مطويّة (FoldView). contentHtml يُعرض بـHtml.fromHtml الأصلي (عناوين/فقرات/روابط/قوائم). */
public class ArticleActivity extends Activity implements View.OnClickListener {
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_CONTENT = "content";
    static final String EXTRA_DETAIL_URL = "detailUrl";
    static final String EXTRA_DECK = "deck";
    static final String EXTRA_ADDED = "addedAt";
    static final String EXTRA_TAG = "tag";

    private String title;
    private String detailUrl;

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapThemeContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent in = getIntent();
        title = in.getStringExtra(EXTRA_TITLE);
        if (title == null) title = "";
        detailUrl = in.getStringExtra(EXTRA_DETAIL_URL);
        String tag = in.getStringExtra(EXTRA_TAG);
        String deck = in.getStringExtra(EXTRA_DECK);
        String html = in.getStringExtra(EXTRA_CONTENT);
        long added = in.getLongExtra(EXTRA_ADDED, 0);
        int ink = NewspaperSheet.ink(this);

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setLayoutDirection(View.LAYOUT_DIRECTION_LOCALE);
        page.setBackgroundColor(getColor(R.color.bg));
        page.addView(PlaceActivity.topBar(this, this));
        ScrollView scroll = new ScrollView(this);
        LinearLayout col = PlaceActivity.column(this);
        scroll.addView(col);
        page.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        NewspaperSheet s = new NewspaperSheet(this);
        col.addView(s, PlaceActivity.match(this, 8));
        // التاريخ فقط من addedAt؛ بلا تاريخ لا يُكتب شيء مكانه
        s.addView(Masthead.build(this, getString(R.string.np_bahrain), added > 0 ? Masthead.date(this, added) : "",
                getString(R.string.pa_articles)));

        // التصنيف (التاريخ في الترويسة فلا يتكرر فوق العنوان، كما بالموقع)
        String kick = tag == null || tag.isEmpty() ? getString(R.string.home_article_badge) : tag;
        TextView k = PlaceActivity.centered(this, kick, 12.5f, getColor(R.color.np_link));
        k.setTypeface(null, Typeface.BOLD);
        s.addView(k, PlaceActivity.match(this, 0));
        TextView t = PlaceActivity.centered(this, title, 34, ink);
        PlaceActivity.serif(t, true);
        t.setLineSpacing(0, 0.95f);
        s.addView(t, PlaceActivity.match(this, 6));
        if (deck != null && !deck.isEmpty()) {
            TextView d = PlaceActivity.centered(this, deck, 18, NewspaperSheet.inkMuted(this));
            PlaceActivity.serif(d, false);
            d.setLineSpacing(0, 0.92f);
            s.addView(d, PlaceActivity.match(this, 10));
        }

        // «بقلم توريلو» والمشاركة بين خطّين (np-byline)
        LinearLayout row = PlaceActivity.byline(this, s);
        SpannableStringBuilder by = new SpannableStringBuilder(getString(R.string.pa_by) + " ");
        int st = by.length();
        by.append(getString(R.string.brand));
        by.setSpan(new ForegroundColorSpan(ink), st, by.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        by.setSpan(new RelativeSizeSpan(1.2f), st, by.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        TextView byText = Ui.text(this, by, 14, NewspaperSheet.inkMuted(this), false);
        PlaceActivity.serif(byText, true);
        row.addView(byText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView share = PlaceActivity.pill(this, getString(R.string.pa_share_article), R.drawable.ic_share, false);
        share.setTag("share");
        share.setOnClickListener(this);
        row.addView(share);

        View dbl = Masthead.rule(this, true);
        ((LinearLayout.LayoutParams) dbl.getLayoutParams()).topMargin = Ui.dp(this, 14);
        s.addView(dbl);
        JSONObject item = findItem(detailUrl);
        String image = item == null ? "" : item.optString("image", "");
        if (!image.isEmpty() && !"null".equals(image)) s.addView(PlaceActivity.photo(this, image, title, item.optString("imageCredit", "")));
        if (html != null && !html.isEmpty()) s.addView(body(this, html, true), PlaceActivity.match(this, 16));

        setContentView(page);
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.bg));
        FoldView.wrap(this, scroll, s, title);
    }

    // العنصر نفسه من البيانات المحمّلة (للصورة وإسنادها)، بمطابقة رابط المقال
    private static JSONObject findItem(String path) {
        JSONObject all = MainActivity.cachedSections;
        if (all == null || path == null || path.isEmpty()) return null;
        java.util.Iterator<String> keys = all.keys();
        while (keys.hasNext()) {
            JSONObject sec = all.optJSONObject(keys.next());
            JSONArray items = sec == null ? null : sec.optJSONArray("items");
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it != null && (path.equals(it.optString("detailUrl")) || path.equals(it.optString("detailUrlEn")))) return it;
            }
        }
        return null;
    }

    // نص الجريدة: Amiri، مضبوط الطرفين (API 26+)، روابط بأزرق الحبر، وعلامة نهاية مربعة.
    // firstWord: الكلمة الأولى أكبر وبالأزرق (np-first) — بديل الحرف الكبير يحفظ وصل الحروف
    static TextView body(Context c, String html, boolean firstWord) {
        int link = c.getColor(R.color.np_link);
        if (firstWord) {
            String hex = String.format("#%06X", link & 0xFFFFFF);
            html = html.replaceFirst("<p>([^\\s<]+)", "<p><big><b><font color=\"" + hex + "\">$1</font></b></big>");
        }
        SpannableStringBuilder b = new SpannableStringBuilder(Ui.html(c, html));
        while (b.length() > 0 && Character.isWhitespace(b.charAt(b.length() - 1))) b.delete(b.length() - 1, b.length());
        if (b.length() > 0) {
            int s = b.length();
            b.append(" ■");
            b.setSpan(new ForegroundColorSpan(link), s, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            b.setSpan(new RelativeSizeSpan(0.6f), s, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        TextView t = Ui.text(c, b, 17, NewspaperSheet.ink(c), false);
        PlaceActivity.serif(t, false);
        t.setLineSpacing(0, 1.1f);
        t.setLinkTextColor(link);
        t.setMovementMethod(LinkMovementMethod.getInstance());
        t.setGravity(Gravity.START);
        // ضبط الطرفين يُخرج أول سطر من بنود القوائم عن الهامش (BulletSpan)، فلا يُضبط النص الذي فيه قوائم
        if (android.os.Build.VERSION.SDK_INT >= 26 && b.getSpans(0, b.length(), android.text.style.BulletSpan.class).length == 0)
            t.setJustificationMode(Layout.JUSTIFICATION_MODE_INTER_WORD);
        return t;
    }

    @Override
    public void onBackPressed() {
        SoundPlayer.play(this, SoundPlayer.CLOSE);
        super.onBackPressed();
        overridePendingTransition(0, 0);
    }

    @Override
    public void onClick(View v) {
        Object tag = v.getTag();
        if ("back".equals(tag)) {
            SoundPlayer.play(this, SoundPlayer.CLOSE);
            finish();
            overridePendingTransition(0, 0);
        } else if ("share".equals(tag)) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.SHARE);
            share();
        }
    }

    // نفس buildShareText/buildShareUrl بالموقع: العنوان + لاحقة عربية ثابتة + رابط المقال الفعلي
    private void share() {
        String url = Lang.siteUrl(this, detailUrl == null ? "" : detailUrl);
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, title + getString(R.string.share_suffix) + "\n" + url);
        try {
            startActivity(Intent.createChooser(send, getString(R.string.share_title)));
        } catch (Exception ignored) {
        }
    }
}
