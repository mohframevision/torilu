package bh.mohframevision.torilu;

import android.app.Activity;
import android.content.Intent;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

// شريط التنقّل السفلي الثابت (5 عناصر)، مشترك بين كل الشاشات —
// بدونه، فتح "اختار لي" أو "المفضلة" كان يحسّ المستخدم إنه طلع من التطبيق
// كلياً (لا بار، شاشة سوداء فاضية أسفلها). MainActivity نفسها تبني نسختها
// الخاصة (فيها سلوك إضافي: نقرة "الرئيسية" وهي نشطة أصلاً تصفّر الفلاتر) —
// هذا الكلاس لباقي الشاشات (Picker/Favorites) اللي التنقّل فيها أبسط: نقرة
// على التبويب الحالي نفسه بلا أثر، وأي تبويب ثاني ينتقل ويُنهي هذي الشاشة
// (يمنع تكدّس شاشات فوق بعض عند التنقّل بين التبويبات أكثر من مرة).
class BottomNav implements View.OnClickListener {
    static final String HOME = "home";
    static final String PICKER = "picker";
    static final String FAVORITES = "favorites";
    static final String SEARCH = "search";

    private final Activity activity;
    private final String active;

    static void attach(Activity activity, LinearLayout container, String active) {
        new BottomNav(activity, active).build(container);
    }

    private BottomNav(Activity activity, String active) {
        this.activity = activity;
        this.active = active;
    }

    private void build(LinearLayout container) {
        container.removeAllViews();
        // شريط بلون السطح وخط حبر رفيع فوقه، بلا ظل (.bottom-nav بالموقع)
        container.setBackgroundResource(R.drawable.nav_bar_bg);
        container.setElevation(0);
        addTab(container, R.drawable.ic_home, activity.getString(R.string.nav_home), HOME);
        addTab(container, R.drawable.ic_search, activity.getString(R.string.nav_search), SEARCH);
        // «اختار لي» تبويب عادي بالنرد كما بالموقع، لا دائرة مرفوعة
        addTab(container, R.drawable.ic_casino, activity.getString(R.string.picker_title), PICKER);
        addTab(container, R.drawable.ic_favorite_fill, activity.getString(R.string.nav_favorites), FAVORITES);
    }

    private void addTab(LinearLayout container, int iconRes, String label, String tag) {
        View tab = LayoutInflater.from(activity).inflate(R.layout.nav_tab_icon, container, false);
        boolean on = tag.equals(active);
        // النشط بأزرق الحبر (أيقونة واسم) بلا حبة خلفه — نفس الموقع
        int color = on ? activity.getColor(R.color.brand_accent) : activity.getColor(R.color.text_muted);
        ImageView iconView = tab.findViewById(R.id.tabIcon);
        iconView.setImageResource(iconRes);
        iconView.setColorFilter(color);
        tab.setSelected(on);
        tab.setContentDescription(label);
        TextView labelView = tab.findViewById(R.id.tabLabel);
        labelView.setText(label);
        labelView.setTextColor(color);
        if (on) labelView.setTypeface(labelView.getTypeface(), android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) tab.getLayoutParams();
        lp.width = 0;
        lp.weight = 1;
        tab.setLayoutParams(lp);
        tab.setTag(tag);
        tab.setOnClickListener(this);
        Touch.springy(tab, 0.9f);
        container.addView(tab);
    }

    @Override
    public void onClick(View v) {
        String tag = (String) v.getTag();
        // الرئيسية "نشطة" بشاشة القسم أيضاً، وضغطها هناك يرجّع للرئيسية
        if (tag.equals(active) && (!HOME.equals(tag) || activity instanceof MainActivity)) return;
        Touch.feedback(v, PICKER.equals(tag) ? Touch.CONFIRM : Touch.TAP, PICKER.equals(tag) ? SoundPlayer.OPEN : SoundPlayer.TAP);
        // الرئيسية تحت كل شي بالمكدّس: الرجوع لها = إغلاق الشاشة الحالية
        if (HOME.equals(tag)) {
            activity.finish();
            activity.overridePendingTransition(0, 0);
            return;
        }
        Intent next;
        if (SEARCH.equals(tag)) next = new Intent(activity, SearchActivity.class);
        else if (PICKER.equals(tag)) next = new Intent(activity, PickerActivity.class);
        else next = new Intent(activity, FavoritesActivity.class);
        activity.startActivity(next);
        // تبويب يحل محل تبويب (مكدّس ضحل) — إلا الرئيسية نفسها، تبقى بالأسفل
        if (!(activity instanceof MainActivity)) activity.finish();
        activity.overridePendingTransition(0, 0);
    }
}
