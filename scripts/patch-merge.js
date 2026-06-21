const fs = require("fs");
let c = fs.readFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", "utf8");

// Auto-merge in insertAfter
c = c.replace(
  'const n = [...prev];\n      n.splice(idx + 1, 0, mk(type, html));\n      return n;\n    });\n    setTimeout(() => {',
  'const n = [...prev];\n      const prevBlock = n[idx];\n      if (prevBlock && prevBlock.type === "p" && !prevBlock.html && type === "p" && !html) return n;\n      n.splice(idx + 1, 0, mk(type, html));\n      return n;\n    });\n    setTimeout(() => {'
);

// Auto-merge in bottom + button
c = c.replace(
  'setBlocks((p) => [...p, mk(type)]);',
  'setBlocks((p) => { const l = p[p.length - 1]; if (l && l.type === "p" && !l.html && type === "p") return p; return [...p, mk(type)]; });'
);

fs.writeFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", c, "utf8");
console.log("Merge patch applied:", c.split("\n").length, "lines");
