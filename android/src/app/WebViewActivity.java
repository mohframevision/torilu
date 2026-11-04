package bh.mohframevision.torilu;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.TextView;

// صفحات الموقع التي لا نظير أصلياً لها (حالياً: صفحة التواصل من "قصة توريلو")
// تُفتح بـWebView — ميزة منصّة أصلية (بلا مكتبة خارجية) تعرض نفس الصفحة
// الحقيقية داخل التطبيق نفسه (لا متصفح خارجي منفصل) بنفس السلوك 100%.
public class WebViewActivity extends Activity implements View.OnClickListener {
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_URL = "url";

    private WebView webView;

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapThemeContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_webview);

        String title = getIntent().getStringExtra(EXTRA_TITLE);
        String url = getIntent().getStringExtra(EXTRA_URL);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, new Ui.BackCallback(this));
        }
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.bg));
        ((TextView) findViewById(R.id.webviewTitle)).setText(title == null ? "" : title);
        findViewById(R.id.webviewCloseButton).setOnClickListener(this);

        ProgressBar progress = findViewById(R.id.webviewProgress);
        webView = findViewById(R.id.webview);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        webView.setWebViewClient(new LoadingClient(progress));
        // كيبورد موصول بالجوال: الأزرار توصل للصفحة فقط لو الـWebView هو المركّز
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();
        if (url != null) webView.loadUrl(url);
    }

    // كلاس علوي مسمّى (مو مجهول) — د8 يفشل على الكلاسات المجهولة بهذي البيئة.
    // يمنع تسرّب التصفح خارج نطاق الموقع: أي رابط لنفس نطاق توريلو يُفتح داخل
    // الـWebView نفسه بشكل طبيعي، وأي رابط خارجي يُفتح بمتصفح/تطبيق خارجي
    // حقيقي بدل التصفح داخل تطبيقنا
    private static class LoadingClient extends WebViewClient {
        private final ProgressBar progress;

        LoadingClient(ProgressBar progress) {
            this.progress = progress;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String host = uri.getHost();
            if ("torilu.com".equals(host) || "www.torilu.com".equals(host)) return false;
            try {
                view.getContext().startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
            return true;
        }
    }

    @Override
    public void onClick(View v) {
        if (v.getId() == R.id.webviewCloseButton) {
            finish();
            overridePendingTransition(0, 0);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
            overridePendingTransition(0, 0);
        }
    }
}
