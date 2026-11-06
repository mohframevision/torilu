package bh.mohframevision.torilu;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

// الرئيسية بشكل «د» (نفس ترتيب الموقع): سؤال كبير وبحث، الأقسام، «مكان الأسبوع»
// كخبر رئيسي، «جديد في توريلو»، و«محتار؟» بزر أزرق واحد. قائمة القسم نفسها
// صارت SectionActivity. هنا الجلب الوحيد للبيانات، ومنه cachedSections لباقي الشاشات.
// بلا كلاسات مجهولة ولا lambdas — d8 بهذي البيئة يفشل عليها.
public class MainActivity extends Activity implements View.OnClickListener, ToriluApi.Callback {
    private View loadingView;
    private View errorView;
    private TextView errorText;
    private View homeScroll;
    private LinearLayout homeSections;
    private String createdLang;
    // كل بطاقة بالرئيسية تحمل رقمها هنا (tag "item:i")
    private final List<JSONObject> shownItems = new ArrayList<>();
    private final List<String> shownSlugs = new ArrayList<>();

    private JSONObject sections;
    private JSONArray sectionOrder;
    private long lastFetchTime;
    private boolean deepLinkHandled;
    private static final long STALE_AFTER_MS = 30 * 60 * 1000;
    private static final int NEW_COUNT = 6;

    static JSONObject cachedSections;
    static JSONObject cachedTagsEn;
    static JSONArray cachedSectionOrder;

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(Prefs.wrapThemeContext(newBase));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        Ui.edgeToEdge(this, getColor(R.color.bg), getColor(R.color.surface));
        createdLang = Prefs.getLang(this);
        loadingView = findViewById(R.id.loadingView);
        errorView = findViewById(R.id.errorView);
        errorText = findViewById(R.id.errorText);
        homeScroll = findViewById(R.id.homeScroll);
        homeSections = findViewById(R.id.homeSections);
        findViewById(R.id.retryButton).setOnClickListener(this);
        findViewById(R.id.settingsButton).setOnClickListener(this);
        View pill = findViewById(R.id.searchPill);
        pill.setOnClickListener(this);
        Touch.springy(pill, 0.97f);
        BottomNav.attach(this, findViewById(R.id.bottomNav), BottomNav.HOME);
        TextView mark = findViewById(R.id.homeWordmark);
        mark.setText(wordmark(this));
        Ui.display(mark);
        Ui.display((TextView) findViewById(R.id.homeHero));
        SoundPlayer.warmUp();
        loadData();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!Prefs.getLang(this).equals(createdLang)) {
            recreate();
            return;
        }
        dateline();
        if (sections != null && System.currentTimeMillis() - lastFetchTime > STALE_AFTER_MS) loadData();
    }

    // سطر التاريخ مثل الجريدة: «الأربعاء 5 نوفمبر 2026 · دليل أماكن البحرين»
    private void dateline() {
        java.util.Locale locale = new java.util.Locale(Prefs.getLang(this));
        String date = new java.text.SimpleDateFormat("EEEE d MMMM yyyy", locale).format(new java.util.Date());
        ((TextView) findViewById(R.id.homeDate)).setText(date + "  ·  " + getString(R.string.home_tagline));
    }

    // «توريلو.» — الاسم بلون النص والنقطة بأزرق الحبر (.logo-dot)
    static CharSequence wordmark(Context c) {
        String name = c.getString(R.string.brand);
        android.text.SpannableString s = new android.text.SpannableString(name + ".");
        s.setSpan(new android.text.style.ForegroundColorSpan(c.getColor(R.color.brand_accent)),
                name.length(), name.length() + 1, android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    private void loadData() {
        // تحديث بالخلفية: المعروض يبقى، وفشله ما يمسحه
        if (sections == null) {
            loadingView.setVisibility(View.VISIBLE);
            errorView.setVisibility(View.GONE);
        }
        ToriluApi.fetch(this, this);
    }

    @Override
    public void onSuccess(JSONObject data, boolean fromCache) {
        lastFetchTime = System.currentTimeMillis();
        JSONObject newSections = data.optJSONObject("sections");
        JSONArray newOrder = data.optJSONArray("sectionOrder");
        if (newSections == null || newOrder == null) {
            if (sections == null) onError(getString(R.string.no_content));
            return;
        }
        sections = newSections;
        sectionOrder = newOrder;
        cachedSections = sections;
        cachedSectionOrder = sectionOrder;
        cachedTagsEn = data.optJSONObject("tagsEn");
        findViewById(R.id.offlineNote).setVisibility(fromCache ? View.VISIBLE : View.GONE);
        buildHome();
        loadingView.setVisibility(View.GONE);
        errorView.setVisibility(View.GONE);
        homeScroll.setVisibility(View.VISIBLE);
        if (!deepLinkHandled) {
            deepLinkHandled = true;
            handleDeepLink();
        }
    }

    @Override
    public void onError(String message) {
        if (sections != null) return;
        errorText.setText(message);
        loadingView.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);
    }

    // رابط توريلو (مثلاً من الواتساب) يفتح القسم أو العنصر المطلوب فوق الرئيسية
    private void handleDeepLink() {
        Uri data = getIntent().getData();
        if (data == null || data.getPath() == null) return;
        String path = data.getPath();
        String rel = path.replaceFirst("^/", "");
        if (rel.startsWith("en/")) rel = rel.substring(3);
        if (rel.isEmpty() || !rel.endsWith(".html")) return;
        if (rel.contains("/")) {
            String[] parts = rel.split("/", 2);
            JSONObject sec = sections.optJSONObject(parts[0]);
            JSONArray items = sec == null ? null : sec.optJSONArray("items");
            String slug = parts[1].substring(0, parts[1].length() - 5);
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                // الرابط الإنجليزي قد يحمل اسماً غير المعرّف (detailUrlEn)
                if (item != null && (slug.equals(item.optString("id", ""))
                        || rel.equals(item.optString("detailUrl", ""))
                        || rel.equals(item.optString("detailUrlEn", "")))) {
                    ItemAdapter.open(this, item, parts[0]);
                    return;
                }
            }
            return;
        }
        String slug = rel.substring(0, rel.length() - 5);
        if (isBrowsable(sections.optJSONObject(slug))) {
            startActivity(SectionActivity.intent(this, slug, data.getQueryParameter("q")));
            overridePendingTransition(0, 0);
        }
    }

    static boolean isBrowsable(JSONObject section) {
        JSONArray items = section == null ? null : section.optJSONArray("items");
        return items != null && items.length() > 0;
    }

    // قسم أماكن = عناصره لها إحداثيات (مطاعم، كافيهات، متاجر...) — بعكس الروابط
    // والمقالات. يتقدّم بشبكة الأقسام
    static boolean isPlaceSection(JSONObject section) {
        JSONArray items = section == null ? null : section.optJSONArray("items");
        for (int i = 0; items != null && i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && item.has("lat") && !item.isNull("lat")) return true;
        }
        return false;
    }

    // ترتيب الموقع، مع تقديم أقسام الأماكن (السؤال الأول: وين آكل/أروح؟)
    static List<String> orderedSlugs() {
        List<String> places = new ArrayList<>();
        List<String> others = new ArrayList<>();
        for (int i = 0; cachedSectionOrder != null && i < cachedSectionOrder.length(); i++) {
            String slug = cachedSectionOrder.optString(i);
            JSONObject sec = cachedSections.optJSONObject(slug);
            if (!isBrowsable(sec)) continue;
            if (isPlaceSection(sec)) places.add(slug);
            else others.add(slug);
        }
        places.addAll(others);
        return places;
    }

    private void buildHome() {
        homeSections.removeAllViews();
        shownItems.clear();
        shownSlugs.clear();
        homeSections.addView(Ui.head(this, getString(R.string.home_sections)));
        buildGrid();
        buildLead();
        buildTime();
        buildNew();
        buildPick();
    }

    // ---- مربعات الأقسام: 3 بكل صف ----
    private void buildGrid() {
        LinearLayout grid = new LinearLayout(this);
        grid.setOrientation(LinearLayout.VERTICAL);
        homeSections.addView(grid);
        List<String> slugs = orderedSlugs();
        LinearLayout row = null;
        for (int i = 0; i < slugs.size(); i++) {
            if (i % 3 == 0) {
                row = new LinearLayout(this);
                LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                if (i > 0) rlp.topMargin = dp(10);
                grid.addView(row, rlp);
            }
            row.addView(tile(slugs.get(i)), tileParams(i % 3));
        }
        // صف ناقص: فراغات بنفس العرض عشان المربعات ما تتمدد
        if (row != null) for (int i = slugs.size() % 3; i > 0 && i < 3; i++) row.addView(new View(this), tileParams(i));
    }

    private LinearLayout.LayoutParams tileParams(int col) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
        if (col > 0) lp.setMarginStart(dp(10));
        return lp;
    }

    // مربع هادئ: أيقونة خطية بالأزرق بلا مربع ملوّن خلفها، والاسم تحتها
    private View tile(String slug) {
        JSONObject sec = sections.optJSONObject(slug);
        LinearLayout t = new LinearLayout(this);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setGravity(Gravity.CENTER_HORIZONTAL);
        t.setBackgroundResource(R.drawable.tile_bg);
        t.setPadding(dp(6), dp(16), dp(6), dp(14));
        t.setTag("sec:" + slug);
        t.setOnClickListener(this);
        t.setContentDescription(Lang.title(this, sec));
        Touch.springy(t, 0.94f);
        android.widget.ImageView icon = new android.widget.ImageView(this);
        icon.setImageResource(Icons.section(slug));
        icon.setColorFilter(getColor(R.color.brand_accent));
        icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        t.addView(icon, new LinearLayout.LayoutParams(dp(28), dp(28)));
        TextView label = Ui.text(this, shortTitle(Lang.title(this, sec)), 13.5f, getColor(R.color.text), true);
        label.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        label.setMaxLines(2);
        label.setPadding(0, dp(8), 0, 0);
        t.addView(label, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return t;
    }

    // "مطاعم البحرين" → "مطاعم": كلمة "البحرين" مكررة بكل مربع وتضيّق المكان
    static String shortTitle(String title) {
        return title.replace(" البحرين", "").replace(" in Bahrain", "").replace("Bahrain ", "");
    }

    // ---- «مكان الأسبوع»: نفس اختيار الموقع (home.js) — «مميز» أولاً، وإلا مكان
    // بمنيو كامل (10 أصناف فأكثر)، وإلا أي مكان له وصف وساعات؛ يتبدّل كل اثنين (منتصف ليل UTC = 3 فجراً بتوقيت البحرين)، مثل home.js بالموقع ----
    private void buildLead() {
        List<JSONObject> pool = new ArrayList<>();
        List<String> poolSlugs = new ArrayList<>();
        List<JSONObject> featured = new ArrayList<>();
        List<String> featuredSlugs = new ArrayList<>();
        List<JSONObject> withMenu = new ArrayList<>();
        List<String> withMenuSlugs = new ArrayList<>();
        for (String slug : new String[]{"restaurants", "cafes", "bakeries"}) {
            JSONObject sec = sections.optJSONObject(slug);
            JSONArray items = sec == null ? null : sec.optJSONArray("items");
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null || item.optString("desc", "").isEmpty() || item.optString("hours", "").isEmpty()) continue;
                pool.add(item);
                poolSlugs.add(slug);
                if (item.optBoolean("featured")) {
                    featured.add(item);
                    featuredSlugs.add(slug);
                }
                JSONArray menu = item.optJSONArray("menuItems");
                if (menu != null && menu.length() >= 10) {
                    withMenu.add(item);
                    withMenuSlugs.add(slug);
                }
            }
        }
        List<JSONObject> choices = !featured.isEmpty() ? featured : !withMenu.isEmpty() ? withMenu : pool;
        List<String> choiceSlugs = !featured.isEmpty() ? featuredSlugs : !withMenu.isEmpty() ? withMenuSlugs : poolSlugs;
        if (choices.isEmpty()) return;
        int week = (int) Math.floor((System.currentTimeMillis() / 86400000.0 + 3) / 7);
        int pick = week % choices.size();
        JSONObject lead = choices.get(pick);
        String slug = choiceSlugs.get(pick);

        homeSections.addView(Ui.head(this, getString(R.string.home_lead)));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundResource(R.drawable.card_bg);
        card.setElevation(dp(2));
        card.setClipToOutline(true);
        // نقاط الحبر على أزرق ناعم فوق الخبر (.d-lead-art)
        HalftoneView art = new HalftoneView(this);
        art.setBackgroundColor(getColor(R.color.tonal));
        card.addView(art, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(160)));
        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.setPadding(dp(22), dp(20), dp(22), dp(20));
        text.addView(Ui.kicker(this, kickerOf(lead, slug, null)));
        TextView title = Ui.text(this, Lang.title(this, lead), 30, getColor(R.color.text), false);
        Ui.display(title);
        title.setPadding(0, dp(4), 0, 0);
        text.addView(title);
        TextView desc = Ui.text(this, Lang.desc(this, lead), 14.5f, getColor(R.color.text_muted), false);
        desc.setMaxLines(3);
        desc.setEllipsize(android.text.TextUtils.TruncateAt.END);
        desc.setPadding(0, dp(4), 0, 0);
        text.addView(desc);
        JSONArray menu = lead.optJSONArray("menuItems");
        if (menu != null && menu.length() > 0) {
            TextView m = Ui.text(this, getString(R.string.home_menu_count, menu.length()), 14, getColor(R.color.brand_accent), true);
            m.setPadding(0, dp(10), 0, 0);
            text.addView(m);
        }
        addMeta(text, lead);
        card.addView(text);
        tagCard(card, lead, slug);
        homeSections.addView(card);
    }

    // ---- صف حسب وقت اليوم (للصباح/للغداء/للعصر/للعشاء والسهر): نفس home.js بالموقع —
    // نفس الأقسام والتصنيفات، ترتيب يتبدّل كل يوم ببذرة التاريخ (mulberry32)، فرع واحد
    // لكل محل، 6 بطاقات، وبلا تكرار مكان الأسبوع ----
    private void buildTime() {
        int h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        int title;
        String[] secs;
        String[] tags;
        if (h >= 5 && h < 11) {
            title = R.string.home_morning;
            secs = new String[]{"bakeries", "cafes", "restaurants"};
            tags = new String[]{"إفطار", "معجنات", "كرك", "قهوة مختصة"};
        } else if (h >= 11 && h < 16) {
            title = R.string.home_noon;
            secs = new String[]{"restaurants"};
            tags = new String[]{"مشاوي", "بحريني", "مندي", "لبناني", "مأكولات بحرية", "عراقي", "تركي", "كبسة"};
        } else if (h >= 16 && h < 20) {
            title = R.string.home_evening;
            secs = new String[]{"cafes", "bakeries"};
            tags = new String[0];
        } else {
            title = R.string.home_night;
            secs = new String[]{"restaurants", "bakeries"};
            tags = new String[]{"شاورما", "برجر", "سندويشات", "وجبات سريعة", "مشاوي", "حلويات", "آيسكريم"};
        }
        List<String> tagList = java.util.Arrays.asList(tags);
        List<JSONObject> pool = new ArrayList<>();
        List<String> poolSlugs = new ArrayList<>();
        for (String slug : secs) {
            JSONObject sec = sections.optJSONObject(slug);
            JSONArray items = sec == null ? null : sec.optJSONArray("items");
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null || shownItems.contains(item)) continue;
                // التصنيفات تقيّد المطاعم فقط (المخبز والكافيه يناسبان أي وقت بقسمهما)
                if (tagList.isEmpty() || !"restaurants".equals(slug) || hasAny(item.optJSONArray("tags"), tagList)) {
                    pool.add(item);
                    poolSlugs.add(slug);
                }
            }
        }
        // ترتيب يومي ثابت: نفس اليوم = نفس الترتيب
        java.util.Calendar d = java.util.Calendar.getInstance();
        int[] seed = {d.get(java.util.Calendar.YEAR) * 1000 + d.get(java.util.Calendar.MONTH) * 40 + d.get(java.util.Calendar.DAY_OF_MONTH)};
        for (int i = pool.size() - 1; i > 0; i--) {
            int j = (int) Math.floor(mulberry(seed) * (i + 1));
            java.util.Collections.swap(pool, i, j);
            java.util.Collections.swap(poolSlugs, i, j);
        }
        List<String> brands = new ArrayList<>();
        List<View> cards = new ArrayList<>();
        for (int i = 0; i < pool.size() && cards.size() < NEW_COUNT; i++) {
            String brand = shopKey(pool.get(i));
            if (brands.contains(brand)) continue;
            brands.add(brand);
            cards.add(card(pool.get(i), poolSlugs.get(i), null));
        }
        if (cards.isEmpty()) return;
        homeSections.addView(Ui.head(this, getString(title)));
        for (View c : cards) homeSections.addView(c);
    }

    private static boolean hasAny(JSONArray tags, List<String> wanted) {
        for (int i = 0; tags != null && i < tags.length(); i++) if (wanted.contains(tags.optString(i))) return true;
        return false;
    }

    // mulberry32 بنفس حساب home.js (Math.imul = ضرب int بجافا)
    static double mulberry(int[] s) {
        s[0] += 0x6d2b79f5;
        int x = (s[0] ^ (s[0] >>> 15)) * (1 | s[0]);
        x = (x + (x ^ (x >>> 7)) * (61 | x)) ^ x;
        return ((x ^ (x >>> 14)) & 0xffffffffL) / 4294967296.0;
    }

    // ---- «جديد في توريلو»: أحدث ما أضيف (addedAt)، بلا المخفي، وبلا تكرار مكان الأسبوع ----
    private void buildNew() {
        List<JSONObject> newItems = new ArrayList<>();
        List<String> newSlugs = new ArrayList<>();
        for (String slug : orderedSlugs()) {
            JSONArray items = sections.optJSONObject(slug).optJSONArray("items");
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null || item.optLong("addedAt", 0) <= 0 || item.optBoolean("hideFromNewest") || shownItems.contains(item)) continue;
                // إدراج مرتّب تنازلياً بالتاريخ (بلا Comparator: يكسر d8 هنا)
                long date = item.optLong("addedAt");
                int at = newItems.size();
                while (at > 0 && newItems.get(at - 1).optLong("addedAt") < date) at--;
                newItems.add(at, item);
                newSlugs.add(at, slug);
            }
        }
        if (newItems.isEmpty()) return;
        homeSections.addView(Ui.head(this, getString(R.string.home_new)));
        // محل واحد لكل بطاقة: القائمة مرتّبة من الأحدث، فأول فرع يظهر هو الأحدث ويمثّل
        // المحل، وفروعه الباقية تُتخطّى ونكمل بما بعدها حتى نصل NEW_COUNT
        List<String> shops = new ArrayList<>();
        for (int i = 0; i < newItems.size() && shops.size() < NEW_COUNT; i++) {
            String key = shopKey(newItems.get(i));
            if (shops.contains(key)) continue;
            shops.add(key);
            String slug = newSlugs.get(i);
            String badge = getString("guides".equals(slug) ? R.string.home_article_badge : R.string.home_new_badge);
            homeSections.addView(card(newItems.get(i), slug, badge));
        }
    }

    // «نفس المحل»: app-data.json لا يحمل حقل سلسلة أو علامة، والفروع تُكتب «الاسم - الفرع»
    // («Kojo Restaurant - Juffair»، «Yummies - فرع الساية»، «المطعم اللبناني - الرفاع»).
    // المفتاح ما قبل أول شَرطة محاطة بمسافتين في العنوان العربي (title) لا المترجم: الإنجليزي
    // يكتب أحياناً «–» بدل «-». عنوان بلا شرطة = محل بفرع واحد
    static String shopKey(JSONObject item) {
        return item.optString("title").split("\\s+[-\u2013\u2014]\\s+")[0].trim();
    }

    // بطاقة «د» (.d-card): سطر أزرق صغير، الاسم بخط الجريدة، الوصف، والساعات
    private View card(JSONObject item, String slug, String badge) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setBackgroundResource(R.drawable.card_bg);
        c.setElevation(dp(2));
        c.setPadding(dp(22), dp(18), dp(22), dp(18));
        c.addView(Ui.kicker(this, kickerOf(item, slug, badge)));
        TextView title = Ui.text(this, Lang.title(this, item), 22, getColor(R.color.text), false);
        Ui.display(title);
        title.setMaxLines(2);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        title.setPadding(0, dp(2), 0, 0);
        c.addView(title);
        String d = Lang.desc(this, item);
        if (!d.isEmpty()) {
            TextView desc = Ui.text(this, d, 14, getColor(R.color.text_muted), false);
            desc.setMaxLines(2);
            desc.setEllipsize(android.text.TextUtils.TruncateAt.END);
            c.addView(desc);
        }
        addMeta(c, item);
        tagCard(c, item, slug);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(14);
        c.setLayoutParams(lp);
        return c;
    }

    // «مطاعم · برجر»: الشارة (جديد/مقال) أو القسم، ثم النوع (أول تصنيف)
    private String kickerOf(JSONObject item, String slug, String badge) {
        String first = badge != null ? badge : shortTitle(Lang.title(this, sections.optJSONObject(slug)));
        JSONArray tags = item.optJSONArray("tags");
        String type = tags == null || tags.length() == 0 ? "" : Lang.tag(this, tags.optString(0));
        return type.isEmpty() ? first : first + " · " + type;
    }

    private void addMeta(LinearLayout box, JSONObject item) {
        String hours = Lang.hours(this, item);
        if (hours.isEmpty()) return;
        TextView h = Ui.text(this, hours, 12.5f, getColor(R.color.text_muted), false);
        h.setCompoundDrawablesRelativeWithIntrinsicBounds(R.drawable.ic_schedule_small, 0, 0, 0);
        h.setCompoundDrawableTintList(android.content.res.ColorStateList.valueOf(getColor(R.color.text_muted)));
        h.setCompoundDrawablePadding(dp(4));
        h.setMaxLines(1);
        h.setEllipsize(android.text.TextUtils.TruncateAt.END);
        h.setPadding(0, dp(8), 0, 0);
        box.addView(h);
    }

    private void tagCard(View card, JSONObject item, String slug) {
        card.setTag("item:" + shownItems.size());
        shownItems.add(item);
        shownSlugs.add(slug);
        card.setOnClickListener(this);
        Touch.springy(card, 0.98f);
    }

    // ---- «محتار؟» بين خطين مثل ركن في جريدة، وزر أزرق واحد ----
    private void buildPick() {
        LinearLayout box = Ui.head(this, getString(R.string.home_pick_title));
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        TextView h = (TextView) box.getChildAt(1);
        h.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        h.setPadding(0, dp(24), 0, 0);
        h.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView d = Ui.text(this, getString(R.string.home_pick_desc), 14.5f, getColor(R.color.text_muted), false);
        d.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        box.addView(d, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView go = Ui.text(this, getString(R.string.picker_go), 15, getColor(R.color.white), true);
        go.setBackgroundResource(R.drawable.btn_pill_primary);
        go.setPadding(dp(28), dp(12), dp(28), dp(12));
        go.setCompoundDrawablePadding(dp(8));
        LinkButtons.setStartIcon(go, R.drawable.ic_casino_small, getColor(R.color.white));
        go.setTag("picker");
        go.setOnClickListener(this);
        Touch.springy(go);
        LinearLayout.LayoutParams glp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        glp.topMargin = dp(18);
        glp.bottomMargin = dp(28);
        box.addView(go, glp);
        View rule = new View(this);
        rule.setBackgroundColor(getColor(R.color.ink_rule));
        box.addView(rule, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        homeSections.addView(box);
    }

    // نص البحث لكل عنصر باللغتين: الاسم والوصف + التصنيفات + الكلمات المفتاحية
    // + أسماء أصناف المنيو — نفس نطاق بحث الموقع. يُحسب مرة
    // ويُخزَّن بالعنصر نفسه بدل إعادة بنائه مع كل حرف
    static String searchText(JSONObject item) {
        String cached = item.optString("_search", "");
        if (!cached.isEmpty()) return cached;
        StringBuilder sb = new StringBuilder();
        for (String k : new String[]{"title", "desc", "title_en", "desc_en", "keywords"}) sb.append(item.optString(k, "")).append(' ');
        JSONArray tags = item.optJSONArray("tags");
        for (int i = 0; tags != null && i < tags.length(); i++) {
            String t = tags.optString(i);
            sb.append(t).append(' ');
            if (cachedTagsEn != null) sb.append(cachedTagsEn.optString(t, "")).append(' ');
        }
        JSONArray menu = item.optJSONArray("menuItems");
        for (int i = 0; menu != null && i < menu.length(); i++) {
            JSONObject m = menu.optJSONObject(i);
            if (m != null) sb.append(m.optString("name", "")).append(' ').append(m.optString("name_en", "")).append(' ');
        }
        String out = sb.toString();
        try {
            item.put("_search", out);
        } catch (Exception ignored) {
        }
        return out;
    }

    private int dp(float v) {
        return Ui.dp(this, v);
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.retryButton) {
            loadData();
            return;
        }
        if (id == R.id.settingsButton) {
            Touch.haptic(v, Touch.TAP);
            SettingsPanel.show(this);
            return;
        }
        if (id == R.id.searchPill) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.OPEN);
            startActivity(new android.content.Intent(this, SearchActivity.class));
            overridePendingTransition(0, 0);
            return;
        }
        Object tag = v.getTag();
        if (!(tag instanceof String)) return;
        String value = (String) tag;
        if (value.startsWith("sec:")) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.OPEN);
            startActivity(SectionActivity.intent(this, value.substring(4), null));
            overridePendingTransition(0, 0);
        } else if (value.startsWith("item:")) {
            int i = Integer.parseInt(value.substring(5));
            Touch.feedback(v, Touch.TAP, SoundPlayer.OPEN);
            ItemAdapter.open(this, shownItems.get(i), shownSlugs.get(i), v);
        } else if ("picker".equals(value)) {
            Touch.feedback(v, Touch.CONFIRM, SoundPlayer.OPEN);
            startActivity(new android.content.Intent(this, PickerActivity.class));
            overridePendingTransition(0, 0);
        } else if (value.startsWith("url:") || value.startsWith("tel:")) {
            Touch.feedback(v, Touch.TAP, SoundPlayer.TAP);
            LinkButtons.handleClick(this, value);
        }
    }
}
