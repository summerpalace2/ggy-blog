const fs = require("fs");
let c = fs.readFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", "utf8");
c = c.replace(
  " * [ ] 后续: 行内代码高亮",
  " * [x] Phase 9: 图片灯箱 + 复制块链接 + 空行自动合并 (v6)\n * [ ] 后续: 行内代码高亮"
);
fs.writeFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", c, "utf8");
console.log("Done:", c.split("\n").length, "lines");
