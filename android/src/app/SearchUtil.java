package bh.mohframevision.torilu;

import java.util.regex.Pattern;

// منفذ بالضبط من levenshtein()/fuzzyIncludes() بـmain.js — نفس التسامح
// بالأخطاء الإملائية (مسافة تحرير ≤1 لكلمة قصيرة، ≤2 لكلمة أطول) — مع
// تطبيع عربي إضافي (تشكيل، همزات، تاء مربوطة) غير موجود بالموقع، عشان
// "مطعم" يطابق "مطعـٌم" و"أحمد" يطابق "احمد" و"مكتبه" يطابق "مكتبة"
class SearchUtil {
    // U+064B-U+065F تشكيل، U+0670 ألف خنجرية، U+0640 تطويل
    private static final Pattern DIACRITICS = Pattern.compile("[\\u064B-\\u065F\\u0670\\u0640]");

    static String normalizeArabic(String s) {
        if (s == null) return "";
        String out = DIACRITICS.matcher(s).replaceAll("");
        out = out.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
                .replace('ة', 'ه').replace('ى', 'ي');
        return out;
    }
    static int levenshtein(String a, String b) {
        int m = a.length();
        int n = b.length();
        if (m == 0) return n;
        if (n == 0) return m;

        int[] prevRow = new int[n + 1];
        for (int j = 0; j <= n; j++) prevRow[j] = j;

        for (int i = 1; i <= m; i++) {
            int[] currRow = new int[n + 1];
            currRow[0] = i;
            for (int j = 1; j <= n; j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1)) {
                    currRow[j] = prevRow[j - 1];
                } else {
                    currRow[j] = 1 + Math.min(prevRow[j], Math.min(currRow[j - 1], prevRow[j - 1]));
                }
            }
            prevRow = currRow;
        }
        return prevRow[n];
    }

    // نص البحث المطبّع وكلماته (بلا تكرار) يُحسب مرة لكل نص ويُعاد استخدامه
    // مع كل حرف — كان يُطبَّع ويُقسَّم من جديد مع كل ضغطة، وأسماء أصناف المنيو
    // (آلاف الكلمات) جعلت الحرف الواحد يأخذ عشرات الملّي ثانية
    private static final class Prepared {
        final String norm;
        final String[] words;

        Prepared(String raw) {
            norm = normalizeArabic(raw.toLowerCase());
            java.util.LinkedHashSet<String> set = new java.util.LinkedHashSet<>();
            for (String w : norm.trim().split("\\s+")) if (!w.isEmpty()) set.add(w);
            words = set.toArray(new String[0]);
        }
    }

    private static final java.util.Map<String, Prepared> PREPARED = new java.util.HashMap<>();

    private static synchronized Prepared prepared(String haystack) {
        Prepared p = PREPARED.get(haystack);
        if (p == null) {
            // سقف بسيط: لو تجمّع كثير (تحديثات بيانات متكررة) نبدأ من جديد
            if (PREPARED.size() > 20000) PREPARED.clear();
            p = new Prepared(haystack);
            PREPARED.put(haystack, p);
        }
        return p;
    }

    /* قاموس المرادفات واللهجة (searchSynonyms بـapp-data.json، نفس src/_data/search.js
       الذي يستعمله بحث الموقع): أي كلمة بمجموعة توصل لنتائج باقي المجموعة.
       منفذ من expand() بـsrc/js/search.js */
    private static String[][] synGroups = new String[0][];
    private static String lastQuery;
    private static String[] lastSyns = new String[0];

    static synchronized void setSynonyms(org.json.JSONArray groups) {
        java.util.List<String[]> out = new java.util.ArrayList<>();
        for (int i = 0; groups != null && i < groups.length(); i++) {
            org.json.JSONArray g = groups.optJSONArray(i);
            if (g == null) continue;
            String[] terms = new String[g.length()];
            for (int j = 0; j < terms.length; j++) terms[j] = normalizeArabic(g.optString(j, "").trim().toLowerCase());
            out.add(terms);
        }
        synGroups = out.toArray(new String[0][]);
        lastQuery = null;
    }

    // مرادفات البحث (بلا البحث نفسه)، تُحسب مرة لكل نص بحث لا لكل عنصر
    private static synchronized String[] synonymsOf(String q) {
        if (q.equals(lastQuery)) return lastSyns;
        String[] words = q.split("\\s+");
        java.util.LinkedHashSet<String> set = new java.util.LinkedHashSet<>();
        for (String[] g : synGroups) {
            boolean hit = false;
            for (String term : g) {
                if (term.equals(q)) hit = true;
                for (int k = 0; !hit && k < words.length; k++) {
                    String w = words[k];
                    hit = w.equals(term) || (w.length() > 4 && Math.abs(w.length() - term.length()) <= 1 && levenshtein(w, term) <= 1);
                }
                if (hit) break;
            }
            if (hit) for (String term : g) if (!term.isEmpty() && !term.equals(q)) set.add(term);
        }
        lastQuery = q;
        lastSyns = set.toArray(new String[0]);
        return lastSyns;
    }

    static boolean fuzzyIncludes(String haystack, String query) {
        String q = normalizeArabic(query == null ? "" : query.trim().toLowerCase());
        if (q.isEmpty()) return true;
        Prepared hay = prepared(haystack == null ? "" : haystack);
        if (hay.norm.contains(q)) return true;
        // المرادف يُطابَق حرفياً فقط، بلا تقريب إملائي (مثل الموقع: «ورشه» كانت تطابق «ورده»)
        for (String syn : synonymsOf(q)) if (hay.norm.contains(syn)) return true;

        String[] qWords = q.split("\\s+");
        for (String qw : qWords) {
            if (qw.isEmpty()) continue;
            boolean matched = false;
            int maxDist = qw.length() <= 4 ? 1 : 2;
            for (String hw : hay.words) {
                // فرق الطول وحده أكبر من المسموح = مستحيل يتطابق، بلا حساب المسافة
                if (hw.contains(qw) || (Math.abs(hw.length() - qw.length()) <= maxDist && levenshtein(hw, qw) <= maxDist)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) return false;
        }
        return true;
    }
}
