package bh.mohframevision.torilu;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

// «عن توريلو»: صفحة جريدة قصيرة (القصة من CLAUDE.md وabout.md وسجل git، بلا أرقام
// ولا تواريخ مؤلَّفة)، وزرّا الاقتراح والمشاركة. التخطيط كله في activity_story.xml.
//
// بلا lambdas ولا كلاسات مجهولة — د8 بهذي البيئة يفشل عليها.
public class StoryActivity extends Activity implements View.OnClickListener {

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapThemeContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_story);
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.bg));

        ((TextView) findViewById(R.id.storyMark)).setText(MainActivity.wordmark(this));
        Ui.display((TextView) findViewById(R.id.storyHeadline));
        Ui.display((TextView) findViewById(R.id.storySign));
        int[] ids = {R.id.storyClose, R.id.storySuggest, R.id.storyShare};
        for (int id : ids) {
            View v = findViewById(id);
            v.setOnClickListener(this);
            Touch.springy(v);
        }
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.storyClose) {
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
}
