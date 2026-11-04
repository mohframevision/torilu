package bh.mohframevision.torilu;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.Html;
import android.text.method.LinkMovementMethod;
import android.view.View;
import android.widget.TextView;

// عارض مقالات أصلي لأقسام "أدلة"/"أماكن" (hasDetailPages) — يعرض
// contentHtml (نفس HTML المولَّد من الماركداون بالموقع، بلا تغليف الصفحة)
// عبر Html.fromHtml الأصلي بأندرويد بدل WebView (لا حاجة لمحرك متصفح كامل
// لعنوان/فقرات/روابط/قوائم فقط — أقصى ما بمحتوى المقالات الحالي). هذا
// بالضبط ما كان ناقصاً واللي خلّى القسمين مخفيين مؤقتاً بالتطبيق.
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
        setContentView(R.layout.activity_article);
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.bg));

        title = getIntent().getStringExtra(EXTRA_TITLE);
        String contentHtml = getIntent().getStringExtra(EXTRA_CONTENT);
        detailUrl = getIntent().getStringExtra(EXTRA_DETAIL_URL);

        // الرأس يحمل الشعار «توريلو.» — العنوان نفسه كبير تحته، فلا نكرره
        ((TextView) findViewById(R.id.articleHeaderTitle)).setText(MainActivity.wordmark(this));
        TextView titleView = findViewById(R.id.articleTitle);
        titleView.setText(title == null ? "" : title);
        Ui.display(titleView);
        ((TextView) findViewById(R.id.articleKicker)).setText(kicker());
        String deck = getIntent().getStringExtra(EXTRA_DECK);
        if (deck != null && !deck.isEmpty()) {
            TextView deckView = findViewById(R.id.articleDeck);
            deckView.setText(deck);
            deckView.setVisibility(View.VISIBLE);
        }

        TextView body = findViewById(R.id.articleBody);
        if (contentHtml != null && !contentHtml.isEmpty()) {
            body.setText(Ui.html(this, contentHtml));
            body.setMovementMethod(LinkMovementMethod.getInstance());
        }

        findViewById(R.id.articleCloseButton).setOnClickListener(this);
        findViewById(R.id.articleShareButton).setOnClickListener(this);
    }

    // سطر الجريدة كالموقع: «عن توريلو · 5 نوفمبر 2026» (التاريخ بتوقيت UTC مثل isoDate)
    private String kicker() {
        String tag = getIntent().getStringExtra(EXTRA_TAG);
        long added = getIntent().getLongExtra(EXTRA_ADDED, 0);
        String date = "";
        if (added > 0) {
            java.util.Calendar cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
            cal.setTimeInMillis(added);
            date = cal.get(java.util.Calendar.DAY_OF_MONTH) + " "
                    + getResources().getStringArray(R.array.np_months)[cal.get(java.util.Calendar.MONTH)] + " "
                    + cal.get(java.util.Calendar.YEAR);
        }
        if (tag == null || tag.isEmpty()) return date.isEmpty() ? getString(R.string.home_article_badge) : date;
        return date.isEmpty() ? tag : tag + " · " + date;
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(0, 0);
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.articleCloseButton) {
            finish();
            overridePendingTransition(0, 0);
        } else if (id == R.id.articleShareButton) {
            SoundPlayer.playClick(this);
            share();
        }
    }

    // نفس buildShareText/buildShareUrl بالموقع: العنوان + لاحقة عربية ثابتة +
    // رابط المقال الفعلي (detailUrl موجود دوماً هنا)
    private void share() {
        String url = Lang.siteUrl(this, detailUrl == null ? "" : detailUrl);
        String text = (title == null ? "" : title) + getString(R.string.share_suffix) + "\n" + url;
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        try {
            startActivity(Intent.createChooser(send, getString(R.string.share_title)));
        } catch (Exception ignored) {
        }
    }
}
