/* نسخة كل ملف CSS/JS ثابت مأخوذة من محتواه (مثل icons.js): رابطه لا يتغيّر إلا إن تغيّر الملف نفسه،
   فيبقى مخزَّناً عند الزائر بين عمليات النشر. الملفات المولَّدة (data.js وtheme.css وmenus.js)
   تبقى على buildVersion لأن محتواها يتغيّر مع كل دفعة أماكن. الاستعمال: assetV["js/main.js"] */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

module.exports = () => {
  const out = {};
  for (const dir of ["css", "js"]) {
    for (const name of fs.readdirSync(path.join(__dirname, "..", dir))) {
      const file = path.join(__dirname, "..", dir, name);
      if (!fs.statSync(file).isFile()) continue;
      out[dir + "/" + name] = crypto
        .createHash("sha1")
        .update(fs.readFileSync(file))
        .digest("hex")
        .slice(0, 10);
    }
  }
  return out;
};
