/*
  خطوة بعد البناء: تصغير مخرجات _site (CSS/JS/HTML) وضغط صور لوحة التحكم
  المرفوعة (src/assets/uploads) لتقليل حجم التحميل. يعمل على مخرجات البناء
  فقط — لا يغيّر أي ملف مصدر تحت src/ (الصورة الأصلية تبقى بالمستودع كما
  رفعها المستخدم)، والتصغير/الضغط يصير مرة وحدة أثناء npm run build.
*/
const fs = require("fs");
const path = require("path");
const CleanCSS = require("clean-css");
const { minify: minifyJs } = require("terser");
const { minify: minifyHtml } = require("html-minifier-terser");
const sharp = require("sharp");

const SITE_DIR = path.join(__dirname, "..", "_site");
const UPLOADS_DIR = path.join(SITE_DIR, "assets", "uploads");
const IMAGE_MAX_WIDTH = 1600;
const PHOTO_COPYRIGHT = "Copyright Mohamed - CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) - torilu.com";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
// نسخ webp مصغّرة بجانب كل صورة مرفوعة (الأصل يبقى كما هو للتطبيق والمشاركة والتكبير):
// <اسم>-480w.webp و<اسم>-960w.webp. main.js يبني نفس الأسماء لبطاقاته، فلا تغيّرها وحدها
const VARIANT_WIDTHS = [480, 960];
const SRC_UPLOADS_DIR = path.join(__dirname, "..", "src", "assets", "uploads");
const variantPath = (file, w) => file.replace(/\.[^./\\]+$/, `-${w}w.webp`);
// نسخة مولَّدة = اسمها بهذا الشكل وليس لها أصل بـsrc/ (صورة مرفوعة اسمها x-1200w.webp تبقى صورة عادية)
const isVariant = (file) => /-\d+w\.webp$/.test(file) && !fs.existsSync(path.join(SRC_UPLOADS_DIR, path.relative(UPLOADS_DIR, file)));
// الرابط الخام بـsrc قد يحوي % مفردة (اسم ملف مرفوع)؛ decodeURIComponent يرمي خطأ فيوقف البناء كله
const decodeSrc = (src) => {
  try {
    return decodeURIComponent(src);
  } catch {
    return src;
  }
};

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// srcset للصور المرفوعة: النسخ المصغّرة فقط (تكفي البطاقات والمعرض حتى على جوال 3x)،
// والصور العريضة (الرئيسية وصور الجريدة بعرض الورقة: sizes فيها (min-width: 1601px)) تضيف الأصل بعرضه الحقيقي
// للشاشات العريضة (عليها zoom) والكمبيوتر العالي الدقة
function uploadSrcset(src, withOriginal) {
  // مسافة أو فاصلة تقسم مرشّح srcset، و% قد تكون ترميزاً: نترك الأصل وحده لهذه الأسماء
  if (!src.startsWith("/assets/uploads/") || /[\s,%]/.test(src)) return "";
  const file = path.join(SITE_DIR, src);
  if (isVariant(file) || !VARIANT_WIDTHS.every((w) => fs.existsSync(variantPath(file, w)))) return "";
  const set = VARIANT_WIDTHS.map((w) => `${variantPath(src, w)} ${w}w`);
  const d = imgDimsCache.get(src);
  if (withOriginal && d && d.width > VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]) set.push(`${src} ${d.width}w`);
  return set.join(", ");
}

// أبعاد الصور المحلية بوسم <img> (width/height) عشان المتصفح يحجز مكانها قبل
// التحميل فما تقفز الصفحة (CLS). النسبة هي المهم؛ الـCSS (height: auto) يحدد الحجم الفعلي
const imgDimsCache = new Map();
async function addImgDims(html) {
  const tags = [...html.matchAll(/<img\b[^>]*>/g)].filter((m) => !/\swidth=/.test(m[0]) || /\ssrc="\/assets\/uploads\//.test(m[0]));
  for (const [tag] of tags) {
    const src = (tag.match(/\ssrc="(\/assets\/[^"?#]+)"/) || [])[1];
    if (!src || !IMAGE_EXTENSIONS.has(path.extname(src).toLowerCase())) continue;
    if (!imgDimsCache.has(src)) {
      const file = path.join(SITE_DIR, decodeSrc(src));
      let dims = null;
      if (fs.existsSync(file)) {
        const m = await sharp(file).metadata();
        const o = m.autoOrient || m;
        if (o.width && o.height) dims = o;
      }
      imgDimsCache.set(src, dims);
    }
    const d = imgDimsCache.get(src);
    let out = tag;
    if (d && !/\swidth=/.test(tag)) out = out.replace(/^<img\b/, `<img width="${d.width}" height="${d.height}"`);
    const set = /\ssrcset=/.test(tag) ? "" : uploadSrcset(src, tag.includes("(min-width: 1601px)"));
    if (set) out = out.replace(/^<img\b/, `<img srcset="${set}"`);
    if (out !== tag) html = html.split(tag).join(out);
  }
  // preload الصورة الرئيسية (base.njk) يطابق srcset الصورة نفسها، وإلا نزل الأصل والنسخة معاً
  return html.replace(/<link rel="preload" as="image" href="(\/assets\/uploads\/[^"]+)"(?! imagesrcset)/g, (m, src) => {
    const set = uploadSrcset(src, true);
    return set ? `${m} imagesrcset="${set}"` : m;
  });
}

async function run() {
  if (!fs.existsSync(SITE_DIR)) {
    console.error("لا يوجد مجلد _site — شغّل npm run build أولاً");
    process.exit(1);
  }

  let cssCount = 0;
  let jsCount = 0;
  let htmlCount = 0;
  let imageCount = 0;
  let imageBytesBefore = 0;
  let imageBytesAfter = 0;

  // الصور أولاً: أبعادها النهائية ونسخها المصغّرة لازم تكون جاهزة قبل كتابة srcset بالـHTML
  const isUpload = (f) => f.startsWith(UPLOADS_DIR) && IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase());
  const files = walk(SITE_DIR).filter((f) => !isVariant(f));
  files.sort((a, b) => isUpload(b) - isUpload(a));
  let variantCount = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    if (isUpload(file)) {
      const before = fs.readFileSync(file);
      let pipeline = sharp(before)
        .rotate()
        .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true });

      if (ext === ".jpg" || ext === ".jpeg") {
        pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
      } else if (ext === ".png") {
        pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
      } else if (ext === ".webp") {
        pipeline = pipeline.webp({ quality: 80 });
      }

      // صور صاحب الموقع: نُبقي الحقوق والرخصة داخل الملف (sharp يحذف الـEXIF افتراضياً)
      // نتعرّف على صورته ببداية النص فقط: الصور القديمة مكتوب بآخرها hakolah.com لا torilu.com
      const exif = before.includes("Copyright Mohamed - CC BY 4.0") ? { IFD0: { Artist: "Mohamed", Copyright: PHOTO_COPYRIGHT } } : null;
      if (exif) pipeline = pipeline.withExif(exif);
      // النسخ المصغّرة تُبنى فقط لو ناقصة أو أقدم من الصورة الأصلية بـsrc/ (البناء يبقى سريعاً)
      const srcFile = path.join(SRC_UPLOADS_DIR, path.relative(UPLOADS_DIR, file));
      const srcTime = fs.existsSync(srcFile) ? fs.statSync(srcFile).mtimeMs : Infinity;
      for (const w of VARIANT_WIDTHS) {
        const out = variantPath(file, w);
        if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= srcTime) continue;
        let v = sharp(before).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 });
        if (exif) v = v.withExif(exif);
        fs.writeFileSync(out, await v.toBuffer());
        variantCount++;
      }
      const after = await pipeline.toBuffer();
      fs.writeFileSync(file, after);
      imageCount++;
      imageBytesBefore += before.length;
      imageBytesAfter += after.length;
      continue;
    }

    if (ext === ".css") {
      const src = fs.readFileSync(file, "utf8");
      const result = new CleanCSS({}).minify(src);
      if (result.errors.length) {
        console.error(`تعذّر تصغير ${file}:`, result.errors);
        continue;
      }
      fs.writeFileSync(file, result.styles);
      cssCount++;
      continue;
    }

    if (ext === ".js") {
      const src = fs.readFileSync(file, "utf8");
      const result = await minifyJs(src, { format: { comments: false } });
      if (result.code) {
        fs.writeFileSync(file, result.code);
        jsCount++;
      }
      continue;
    }

    if (ext === ".html") {
      const src = await addImgDims(fs.readFileSync(file, "utf8"));
      const result = await minifyHtml(src, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });
      fs.writeFileSync(file, result);
      htmlCount++;
    }
  }

  const savedMb = ((imageBytesBefore - imageBytesAfter) / 1024 / 1024).toFixed(1);
  console.log(`تصغير ما بعد البناء: ${cssCount} ملف CSS، ${jsCount} ملف JS، ${htmlCount} ملف HTML`);
  if (imageCount > 0) {
    console.log(`ضغط الصور: ${imageCount} صورة، توفير ~${savedMb} ميجابايت، ${variantCount} نسخة webp مصغّرة جديدة`);
  }
}

run();
