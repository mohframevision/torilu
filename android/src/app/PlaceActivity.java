package bh.mohframevision.torilu;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import org.json.JSONArray;
import org.json.JSONObject;

/* صفحة المكان ورقة جريدة مثل place-newspaper.njk بالموقع: ترويسة (المنطقة، البحرين · القسم ·
   التاريخ)، اسم المكان عنواناً كبيراً بخط الجريدة، الوصف مقدمة، سطر توقيع فيه الزر الأساسي
   (الخريطة، أو الاتصال بلا خريطة) والمفضلة والمشاركة، ثم صورة الجريدة بتعليقها، وصندوق
   «معلومات المكان»، والنبذة، والمنيو قائمة أسعار بنقاط، ورابط الإبلاغ. الورقة تفتح مطويّة
   (FoldView). العنصر يوصل كاملاً بالـIntent (يتحمّل موت العملية). */
public class PlaceActivity extends Activity implements View.OnClickListener, View.OnLongClickListener {
    static final String EXTRA_ITEM = "item";
    static final String EXTRA_SECTION = "section";
    private static final int MENU_PREVIEW = 8;

    private JSONObject item;
    private String section;
    private TextView favBtn;
    private java.util.Set<String> areas;

    static Intent intent(Context c, JSONObject item, String section) {
        Intent i = new Intent(c, PlaceActivity.class);
        i.putExtra(EXTRA_ITEM, item.toString());
        i.putExtra(EXTRA_SECTION, section);
        return i;
    }

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapThemeContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            item = new JSONObject(getIntent().getStringExtra(EXTRA_ITEM));
        } catch (Exception e) {
            finish();
            return;
        }
        section = getIntent().getStringExtra(EXTRA_SECTION);

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setLayoutDirection(View.LAYOUT_DIRECTION_LOCALE);
        page.setBackgroundColor(getColor(R.color.bg));
        page.addView(topBar(this, this));
        ScrollView scroll = new ScrollView(this);
        LinearLayout col = column(this);
        scroll.addView(col);
        page.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        NewspaperSheet sheet = new NewspaperSheet(this);
        col.addView(sheet, match(this, 8));
        buildSheet(sheet);
        setContentView(page);
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.bg));
        FoldView.wrap(this, scroll, sheet, Lang.title(this, item));
    }

    // ===== أدوات الورقة (مشتركة مع صفحة المقال) =====

    // شريط علوي هادئ: الرجوع فقط (المشاركة والمفضلة في سطر التوقيع على الورقة)
    static View topBar(Activity a, View.OnClickListener l) {
        LinearLayout bar = new LinearLayout(a);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        int p = Ui.dp(a, 8);
        bar.setPadding(p, p, p, 0);
        ImageView b = new ImageView(a);
        b.setImageResource(R.drawable.ic_arrow_back);
        b.setColorFilter(a.getColor(R.color.text));
        int q = Ui.dp(a, 12);
        b.setPadding(q, q, q, q);
        b.setBackgroundResource(R.drawable.row_bg);
        b.setContentDescription(a.getString(R.string.back));
        b.setTag("back");
        b.setOnClickListener(l);
        bar.addView(b, new LinearLayout.LayoutParams(Ui.dp(a, 48), Ui.dp(a, 48)));
        return bar;
    }

    static LinearLayout column(Context c) {
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setLayoutDirection(View.LAYOUT_DIRECTION_LOCALE);
        col.setPadding(Ui.dp(c, 10), 0, Ui.dp(c, 10), Ui.dp(c, 32));
        col.setClipToPadding(false);
        return col;
    }

    static LinearLayout.LayoutParams match(Context c, int topDp) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = Ui.dp(c, topDp);
        return lp;
    }

    // خط الجريدة (Amiri) بوزن عادي أو عريض
    static void serif(TextView t, boolean bold) {
        t.setIncludeFontPadding(false); // Amiri طويل الصعود والنزول: بدونه تتباعد الأسطر كثيراً
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            try {
                t.setTypeface(Typeface.create(t.getResources().getFont(R.font.amiri), bold ? Typeface.BOLD : Typeface.NORMAL));
                return;
            } catch (Exception ignored) {
            }
        }
        t.setTypeface(Typeface.SERIF, bold ? Typeface.BOLD : Typeface.NORMAL);
    }

    static TextView centered(Context c, CharSequence s, float sp, int color) {
        TextView t = Ui.text(c, s, sp, color, false);
        t.setGravity(Gravity.CENTER_HORIZONTAL);
        t.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        return t;
    }

    // زر حبة على الورق: الأساسي ممتلئ بأزرق الحبر ونصه أبيض، والثانوي شفاف بخط ورقي رفيع
    static TextView pill(Context c, CharSequence label, int icon, boolean primary) {
        int ink = NewspaperSheet.ink(c);
        TextView t = Ui.text(c, label, 13.5f, primary ? 0xFFFFFFFF : ink, true);
        t.setMaxLines(1);
        t.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(Ui.dp(c, 40));
        if (primary) g.setColor(c.getColor(R.color.np_link));
        else g.setStroke(Ui.dp(c, 1), c.getColor(R.color.np_rule));
        GradientDrawable mask = new GradientDrawable();
        mask.setCornerRadius(Ui.dp(c, 40));
        mask.setColor(0xFF000000);
        t.setBackground(new RippleDrawable(ColorStateList.valueOf(primary ? 0x40FFFFFF : 0x22000000), g, mask));
        boolean empty = label == null || label.length() == 0;
        int h = Ui.dp(c, empty ? 11 : 14);
        t.setPadding(h, Ui.dp(c, 8), h, Ui.dp(c, 8));
        t.setMinHeight(Ui.dp(c, 40));
        if (icon != 0) {
            Drawable d = c.getDrawable(icon).mutate();
            int s = Ui.dp(c, 17);
            d.setBounds(0, 0, s, s);
            d.setTint(primary ? 0xFFFFFFFF : ink);
            t.setCompoundDrawablesRelative(d, null, null, null);
            if (!empty) t.setCompoundDrawablePadding(Ui.dp(c, 6));
        }
        Touch.springy(t);
        return t;
    }

    // سطر التوقيع (np-byline): خط حبر فوقه وتحته. يرجع الصف، والإطار هو أبوه
    static LinearLayout byline(Context c, LinearLayout sheet) {
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.addView(Masthead.rule(c, false));
        LinearLayout row = new LinearLayout(c);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, Ui.dp(c, 6), 0, Ui.dp(c, 6));
        box.addView(row);
        box.addView(Masthead.rule(c, false));
        sheet.addView(box, match(c, 16));
        return row;
    }

    // ===== الورقة =====
    private void buildSheet(NewspaperSheet s) {
        int ink = NewspaperSheet.ink(this), muted = NewspaperSheet.inkMuted(this);
        JSONObject sec = MainActivity.cachedSections == null ? null : MainActivity.cachedSections.optJSONObject(section);
        String secTitle = sec == null ? "" : MainActivity.shortTitle(Lang.title(this, sec));
        String area = area();
        String where = area.isEmpty() ? getString(R.string.np_bahrain) : getString(R.string.pa_area_bahrain, Lang.tag(this, area));
        long added = item.optLong("addedAt", 0);
        s.addView(Masthead.build(this, where, secTitle, added > 0 ? Masthead.date(this, added) : ""));

        String kick = item.optBoolean("verified") ? getString(R.string.pa_verified) : "";
        if (item.optBoolean("liked")) kick = kick.isEmpty() ? getString(R.string.pa_liked) : kick + "     " + getString(R.string.pa_liked);
        if (!kick.isEmpty()) {
            TextView k = centered(this, kick, 12.5f, getColor(R.color.np_link));
            k.setTypeface(null, Typeface.BOLD);
            s.addView(k, match(this, 0));
        }
        TextView title = centered(this, Lang.title(this, item), 34, ink);
        serif(title, true);
        title.setLineSpacing(0, 0.95f);
        s.addView(title, match(this, kick.isEmpty() ? 4 : 8));
        String desc = Lang.desc(this, item);
        if (!desc.isEmpty()) {
            TextView d = centered(this, desc, 18, muted);
            serif(d, false);
            d.setLineSpacing(0, 0.92f);
            s.addView(d, match(this, 12));
        }

        // الهدف الأول لزائر صفحة مكان أن يذهب إليه — الخريطة الزر الأساسي، والاتصال بلا خريطة
        LinearLayout row = byline(this, s);
        String maps = mapsUrl(), phone = firstPhone();
        TextView primary = null;
        if (!maps.isEmpty()) {
            primary = pill(this, getString(R.string.pa_map), R.drawable.ic_location_on, true);
            primary.setTag("url:" + maps);
        } else if (!phone.isEmpty()) {
            primary = pill(this, getString(R.string.btn_call), R.drawable.ic_call, true);
            primary.setTag("tel:" + phone);
        }
        if (primary != null) {
            primary.setOnClickListener(this);
            row.addView(primary);
        }
        row.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        favBtn = pill(this, "", R.drawable.ic_favorite_outline, false);
        favBtn.setTag("fav");
        favBtn.setOnClickListener(this);
        row.addView(favBtn);
        applyFav();
        // الشاشة الضيقة: المشاركة أيقونة فقط، فلا يخرج السطر عن الورقة
        boolean narrow = getResources().getConfiguration().screenWidthDp < 360;
        TextView share = pill(this, narrow ? "" : getString(R.string.pa_share_place), R.drawable.ic_share, false);
        share.setContentDescription(getString(R.string.pa_share_place));
        share.setTag("share");
        share.setOnClickListener(this);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sp.setMarginStart(Ui.dp(this, 8));
        row.addView(share, sp);

        // على الجوال كما بالموقع: الصورة أولاً، ثم المعلومات قبل النص الطويل والمنيو
        String image = item.optString("image", "");
        if (!image.isEmpty() && !"null".equals(image)) s.addView(photo(this, image, Lang.title(this, item), item.optString("imageCredit", "")));
        buildFacts(s, area);
        String html = Lang.content(this, item);
        if (!html.isEmpty()) s.addView(ArticleActivity.body(this, flattenTables(html), false), match(this, 18));
        buildMenu(s, html);

        View dbl = Masthead.rule(this, true);
        ((LinearLayout.LayoutParams) dbl.getLayoutParams()).topMargin = Ui.dp(this, 24);
        s.addView(dbl);
        TextView report = Ui.text(this, getString(R.string.pa_report), 13.5f, getColor(R.color.np_link), false);
        report.setPadding(0, Ui.dp(this, 12), 0, Ui.dp(this, 4));
        report.setTag("report");
        report.setOnClickListener(this);
        s.addView(report);
    }

    // صورة الجريدة: بعرض الورقة بلا زوايا، وتحتها تعليق بالاسم والإسناد وخط حبر رفيع
    static View photo(Context c, String path, String title, String credit) {
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        ImageView img = new ImageView(c);
        img.setScaleType(ImageView.ScaleType.CENTER_CROP);
        img.setBackgroundColor(c.getColor(R.color.np_back));
        img.setContentDescription(title);
        box.addView(img, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(c, 220)));
        TextView cap = Ui.text(c, credit.isEmpty() ? title : title + " — " + Ui.ltr(credit), 13, NewspaperSheet.inkMuted(c), false);
        serif(cap, false);
        cap.setPadding(0, Ui.dp(c, 6), 0, Ui.dp(c, 6));
        box.addView(cap);
        View r = new View(c);
        r.setBackgroundColor(NewspaperSheet.ink(c));
        box.addView(r, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(c, 1)));
        box.setLayoutParams(match(c, 18));
        String url = path.startsWith("http") ? path : ToriluApi.ORIGIN + path.replaceFirst("^/", "");
        new ImageLoad(img, url, c.getResources().getDisplayMetrics().widthPixels).start();
        return box;
    }

    // تحميل الصورة من الموقع بخيط منفصل، مصغّرة لعرض الشاشة. بلا اتصال: تبقى مساحة بلون ظهر الورق.
    // ponytail: بلا ذاكرة مؤقتة للصور — تُحمّل كل فتح؛ تُضاف لو كثرت الصور
    private static final class ImageLoad extends Thread {
        private final WeakReference<ImageView> ref;
        private final String url;
        private final int maxW;

        ImageLoad(ImageView v, String url, int maxW) {
            super("torilu-photo");
            ref = new WeakReference<>(v);
            this.url = url;
            this.maxW = Math.max(320, maxW);
        }

        @Override
        public void run() {
            Bitmap bmp;
            try {
                byte[] data = read(url);
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(data, 0, data.length, o);
                int sample = 1;
                while (o.outWidth / (sample * 2) >= maxW) sample *= 2;
                o = new BitmapFactory.Options();
                o.inSampleSize = sample;
                bmp = BitmapFactory.decodeByteArray(data, 0, data.length, o);
            } catch (Throwable ignored) {
                return;
            }
            ImageView v = ref.get();
            if (v != null && bmp != null) v.post(new ShowPhoto(v, bmp));
        }

        private static byte[] read(String u) throws Exception {
            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            try (InputStream in = c.getInputStream()) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return out.toByteArray();
            } finally {
                c.disconnect();
            }
        }
    }

    // الارتفاع حسب نسبة الصورة (حتى 420dp) — FoldView يعيد القياس مع الورقة
    private static final class ShowPhoto implements Runnable {
        private final ImageView v;
        private final Bitmap b;

        ShowPhoto(ImageView v, Bitmap b) {
            this.v = v;
            this.b = b;
        }

        @Override
        public void run() {
            int w = v.getWidth();
            if (w > 0 && b.getWidth() > 0) {
                ViewGroup.LayoutParams lp = v.getLayoutParams();
                lp.height = Math.min(Ui.dp(v.getContext(), 420), w * b.getHeight() / b.getWidth());
                v.setLayoutParams(lp);
            }
            v.setBackground(null);
            v.setImageBitmap(b);
        }
    }

    // ===== «معلومات المكان» (np-facts): خط مزدوج وعنوان، ثم أسطر مسطّرة: تسمية صغيرة وقيمة بخط الجريدة =====
    private void buildFacts(LinearLayout s, String area) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.addView(Masthead.rule(this, true));
        TextView h = Ui.text(this, getString(R.string.pa_facts), 20, NewspaperSheet.ink(this), false);
        serif(h, true);
        h.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 6));
        box.addView(h);
        int before = box.getChildCount();

        String hours = Lang.hours(this, item);
        if (!hours.isEmpty()) fact(box, R.string.pa_hours, hours, null);
        StringBuilder kinds = new StringBuilder();
        JSONArray tags = item.optJSONArray("tags");
        int n = 0;
        for (int i = 0; tags != null && i < tags.length() && n < 4; i++) {
            String t = tags.optString(i);
            if (t.isEmpty() || isArea(t) || t.contains("$")) continue; // $ = مستوى السعر المحسوب
            if (n++ > 0) kinds.append(getString(R.string.pa_list_sep));
            kinds.append(Lang.tag(this, t));
        }
        if (kinds.length() > 0) fact(box, R.string.pa_type, kinds, null);
        if (!area.isEmpty()) fact(box, R.string.pa_area, Lang.tag(this, area), null);
        JSONObject links = item.optJSONObject("links");
        String phones = links == null ? "" : links.optString("phone", "");
        for (String p : phones.split(",")) {
            p = p.trim();
            if (!p.isEmpty()) fact(box, R.string.pa_phone, Ui.ltr(p), "tel:" + p);
        }
        String maps = mapsUrl();
        if (!maps.isEmpty()) fact(box, R.string.pa_location, getString(R.string.pa_google_maps), "url:" + maps);
        if (links != null) {
            String menu = links.optString("menu", "");
            if (!menu.isEmpty()) fact(box, R.string.place_menu_link, getString(R.string.pa_visit), "url:" + menu);
            String ig = links.optString("instagram", "");
            if (!ig.isEmpty()) {
                String handle = ig.replaceFirst("^https?://(?:www\\.)?instagram\\.com/([^/?]+).*$", "$1");
                fact(box, R.string.pa_instagram, Ui.ltr(handle.equals(ig) ? ig : "@" + handle), "url:" + ig);
            }
            String web = links.optString("website", "");
            if (!web.isEmpty()) fact(box, R.string.pa_website, getString(R.string.pa_visit), "url:" + web);
        }
        JSONObject meat = item.optJSONObject("meatSource");
        if (meat != null) {
            String text = Lang.en(this) && !meat.optString("text_en", "").isEmpty() ? meat.optString("text_en") : meat.optString("text", "");
            if (!text.isEmpty()) {
                String checked = meat.optString("checked", "");
                fact(box, R.string.place_meat, text + (checked.isEmpty() ? "" : "\n" + getString(R.string.place_checked, Ui.ltr(checked))), null);
            }
        }
        if (box.getChildCount() > before) s.addView(box, match(this, 20));
    }

    private void fact(LinearLayout box, int label, CharSequence value, String tag) {
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.VERTICAL);
        View r = new View(this);
        r.setBackgroundColor(getColor(R.color.np_rule));
        f.addView(r, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 1)));
        TextView dt = Ui.text(this, getString(label), 12, NewspaperSheet.inkMuted(this), true);
        dt.setPadding(0, Ui.dp(this, 8), 0, 0);
        f.addView(dt);
        TextView dd = Ui.text(this, value, 17, tag == null ? NewspaperSheet.ink(this) : getColor(R.color.np_link), false);
        serif(dd, false);
        dd.setPadding(0, Ui.dp(this, 2), 0, Ui.dp(this, 8));
        f.addView(dd);
        if (tag != null) {
            f.setTag(tag);
            f.setOnClickListener(this);
            f.setBackgroundResource(R.drawable.row_bg);
            if (tag.startsWith("tel:")) {
                f.setOnLongClickListener(this);
                f.setContentDescription(getString(label) + " " + value + ". " + getString(R.string.place_copy_hint));
            }
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = Ui.dp(this, 4);
        box.addView(f, lp);
    }

    // Html.fromHtml يتجاهل الجداول فتلتصق خلاياها ببعض — كل صف سطر، والخلايا بفاصل
    static String flattenTables(String html) {
        return html.replaceAll("(?i)</t[dh]>\\s*<t[dh][^>]*>", " · ")
                .replaceAll("(?i)<tr[^>]*>", "<br>")
                .replaceAll("(?i)</?(table|thead|tbody|tr|td|th)[^>]*>", "");
    }

    // ===== المنيو: قائمة أسعار جريدة — الاسم ثم نقاط حتى السعر (np-menu) =====
    private void buildMenu(LinearLayout s, String html) {
        JSONArray menu = item.optJSONArray("menuItems");
        if (menu == null || menu.length() == 0) return;
        if (html.toLowerCase(java.util.Locale.ROOT).contains("<table")) return; // كتبه صاحب الموقع جدولاً بنفسه
        View rule = Masthead.rule(this, false);
        ((LinearLayout.LayoutParams) rule.getLayoutParams()).topMargin = Ui.dp(this, 22);
        s.addView(rule);
        TextView h = Ui.text(this, getString(R.string.pa_menu_title), 21, NewspaperSheet.ink(this), false);
        serif(h, true);
        h.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 6));
        s.addView(h);
        int n = Math.min(MENU_PREVIEW, menu.length());
        for (int i = 0; i < n; i++) s.addView(menuRow(this, menu.optJSONObject(i)));
        if (menu.length() > n) {
            TextView all = pill(this, getString(R.string.place_menu_all, menu.length()), R.drawable.ic_menu_book, false);
            all.setTag("menu");
            all.setOnClickListener(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.topMargin = Ui.dp(this, 12);
            lp.gravity = Gravity.CENTER_HORIZONTAL;
            s.addView(all, lp);
        }
    }

    static View menuRow(Context c, JSONObject m) {
        LinearLayout row = new LinearLayout(c);
        row.setGravity(Gravity.BOTTOM);
        row.setBaselineAligned(false);
        row.setPadding(0, Ui.dp(c, 3), 0, Ui.dp(c, 3));
        String name = m == null ? "" : (Lang.en(c) && !m.optString("name_en", "").isEmpty() ? m.optString("name_en") : m.optString("name", ""));
        Leader n = new Leader(c);
        n.setText(name);
        n.setTextSize(16.5f);
        n.setTextColor(NewspaperSheet.ink(c));
        serif(n, false);
        row.addView(n, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        // الأسعار نص لاتيني «0.900 / 1.700 BD» يُقرأ من اليسار، فلا ينقلب بالعربي
        TextView p = Ui.text(c, Ui.ltr(m == null ? "" : m.optString("price", "")), 15, NewspaperSheet.ink(c), true);
        p.setFontFeatureSettings("tnum");
        p.setTextDirection(View.TEXT_DIRECTION_LTR);
        p.setGravity(Gravity.LEFT);
        p.setMaxWidth(c.getResources().getDisplayMetrics().widthPixels / 2);
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pl.setMarginStart(Ui.dp(c, 6));
        row.addView(p, pl);
        return row;
    }

    // اسم الصنف وبعده خط نقاط حتى السعر (border-bottom: 2px dotted) في المساحة الباقية من آخر سطر
    private static final class Leader extends TextView {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float gap;

        Leader(Context c) {
            super(c);
            gap = Ui.dp(c, 6);
            p.setColor(c.getColor(R.color.np_rule));
            float d = Ui.dp(c, 2);
            p.setStrokeWidth(d);
            p.setPathEffect(new DashPathEffect(new float[]{d, d * 1.5f}, 0));
        }

        @Override
        protected void onDraw(Canvas c) {
            super.onDraw(c);
            android.text.Layout l = getLayout();
            if (l == null || l.getLineCount() == 0) return;
            int last = l.getLineCount() - 1;
            float y = getTotalPaddingTop() + l.getLineBaseline(last);
            float from, to;
            if (l.getParagraphDirection(last) == android.text.Layout.DIR_RIGHT_TO_LEFT) {
                from = getPaddingLeft();
                to = getPaddingLeft() + l.getLineLeft(last) - gap;
            } else {
                from = getPaddingLeft() + l.getLineRight(last) + gap;
                to = getWidth() - getPaddingRight();
            }
            if (to - from >= Ui.dp(getContext(), 12)) c.drawLine(from, y, to, y, p);
        }
    }

    // ===== بيانات =====
    // المنطقة = أول تصنيف موجود بقائمة مناطق البحرين (areas.js)، كما بالموقع
    private String area() {
        JSONArray tags = item.optJSONArray("tags");
        for (int i = 0; tags != null && i < tags.length(); i++) if (isArea(tags.optString(i))) return tags.optString(i);
        return "";
    }

    private boolean isArea(String t) {
        if (areas == null) areas = new java.util.HashSet<>(java.util.Arrays.asList(getResources().getStringArray(R.array.pa_areas)));
        return areas.contains(t);
    }

    private String firstPhone() {
        JSONObject links = item.optJSONObject("links");
        return links == null ? "" : links.optString("phone", "").split(",")[0].trim();
    }

    private String mapsUrl() {
        JSONObject links = item.optJSONObject("links");
        String m = links == null ? "" : links.optString("maps", "");
        return m.isEmpty() ? item.optString("mapsUrl", "") : m;
    }

    private void applyFav() {
        boolean on = Prefs.isFavorite(this, section, item.optString("id", ""));
        Drawable d = getDrawable(on ? R.drawable.ic_favorite_fill : R.drawable.ic_favorite_outline).mutate();
        int sz = Ui.dp(this, 17);
        d.setBounds(0, 0, sz, sz);
        d.setTint(on ? 0xFFB3261E : NewspaperSheet.ink(this));
        favBtn.setCompoundDrawablesRelative(d, null, null, null);
        favBtn.setContentDescription(getString(on ? R.string.pa_fav_remove : R.string.pa_fav_add));
    }

    @Override
    public void onClick(View v) {
        String tag = (String) v.getTag();
        if ("back".equals(tag)) {
            SoundPlayer.play(this, SoundPlayer.CLOSE);
            finish();
            overridePendingTransition(R.anim.stay, R.anim.place_out);
        } else if ("share".equals(tag)) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.SHARE);
            ItemAdapter.share(this, item, section);
        } else if ("fav".equals(tag)) {
            String id = item.optString("id", "");
            Prefs.toggleFavorite(this, section, id);
            boolean on = Prefs.isFavorite(this, section, id);
            Touch.feedback(v, on ? Touch.TOGGLE_ON : Touch.TOGGLE_OFF, on ? SoundPlayer.FAV_ON : SoundPlayer.FAV_OFF);
            applyFav();
        } else if ("menu".equals(tag)) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.OPEN);
            startActivity(MenuActivity.intent(this, item));
            overridePendingTransition(0, 0);
        } else if ("report".equals(tag)) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.TAP);
            String q;
            try {
                q = "contact.html?report=" + URLEncoder.encode(Lang.title(this, item), "UTF-8") + "&section=" + section;
            } catch (Exception e) {
                q = "contact.html";
            }
            Intent i = new Intent(this, WebViewActivity.class);
            i.putExtra(WebViewActivity.EXTRA_TITLE, getString(R.string.brand));
            i.putExtra(WebViewActivity.EXTRA_URL, Lang.siteUrl(this, q));
            startActivity(i);
        } else if (tag != null) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.TAP);
            LinkButtons.handleClick(this, tag);
        }
    }

    // ضغطة طويلة على الرقم = نسخ (نفس زر النسخ بالموقع)
    @Override
    public boolean onLongClick(View v) {
        String number = ((String) v.getTag()).substring(4);
        ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        cm.setPrimaryClip(ClipData.newPlainText("phone", number));
        Touch.haptic(v, Touch.CONFIRM);
        SoundPlayer.play(this, SoundPlayer.COPY);
        Toast.makeText(this, R.string.copied, Toast.LENGTH_SHORT).show();
        return true;
    }

    @Override
    public void onBackPressed() {
        SoundPlayer.play(this, SoundPlayer.CLOSE);
        super.onBackPressed();
        overridePendingTransition(R.anim.stay, R.anim.place_out);
    }
}
