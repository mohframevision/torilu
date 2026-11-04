package bh.mohframevision.torilu;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.util.AttributeSet;
import android.view.View;

// دائرة نقاط الطباعة (halftone) بلون الحبر — .halftone بالموقع: شبكة نقاط
// داخل دائرة، كثيفة عند نقطة الضوء (40%، 40%) وتخفت نحو الحافة. رسم بالكود
// بلا صور. القطر = 62% من أصغر بُعدي المساحة (نفس .d-lead-art .halftone).
public class HalftoneView extends View {
    private final Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);

    public HalftoneView(Context context) {
        this(context, null);
    }

    public HalftoneView(Context context, AttributeSet attrs) {
        super(context, attrs);
        dot.setColor(context.getColor(R.color.brand_accent));
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float w = getWidth();
        float h = getHeight();
        float r = Math.min(w, h) * 0.31f;
        float cx = w / 2f;
        float cy = h / 2f;
        float lx = cx - r * 0.2f;
        float ly = cy - r * 0.2f;
        float step = getResources().getDisplayMetrics().density * 6f;
        int alpha = dot.getAlpha();
        for (float y = cy - r; y <= cy + r; y += step) {
            for (float x = cx - r; x <= cx + r; x += step) {
                float dx = x - cx;
                float dy = y - cy;
                if (dx * dx + dy * dy > r * r) continue;
                // قناع radial-gradient: أسود حتى 35% من نصف القطر ثم يتلاشى عند 72%
                float d = (float) Math.hypot(x - lx, y - ly) / (r * 1.2f);
                float a = d <= 0.35f ? 1f : Math.max(0f, 1f - (d - 0.35f) / 0.37f);
                if (a <= 0.02f) continue;
                dot.setAlpha(Math.round(alpha * a));
                canvas.drawCircle(x, y, step * 0.23f, dot);
            }
        }
        dot.setAlpha(alpha);
    }
}
