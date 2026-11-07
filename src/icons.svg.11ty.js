// ملف الأيقونات الواحد (sprite): كل أيقونة <symbol> باسمها، مصدرها src/_data/icons.js
exports.data = {
  permalink: "assets/icons.svg",
  eleventyExcludeFromCollections: true,
};

exports.render = function ({ icons }) {
  const symbols = Object.entries(icons.paths)
    .map(([name, body]) => `<symbol id="${name}" viewBox="0 -960 960 960">${body}</symbol>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`;
};
