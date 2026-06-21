const fs = require("fs");
const c = fs.readFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", "utf8");
let out = c;

// 1. Image lightbox trigger on image preview
out = out.replace(
  /(\{srcUrl && \(\s*\n\s*<div className="relative">\s*\n\s*)<img/,
  '$1<button onClick={() => setLightboxSrc(srcUrl)} className="absolute inset-0 z-10 cursor-zoom-in" title="点击放大" />\n              <img'
);

// 2. Lightbox render in BlockView
out = out.replace(
  /(\{focused && <FormatToolbar onInsertLink=\{onFormatLink\} \/>\})\n\n(\s*\{)/,
  '$1\n      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}\n\n$2'
);

// 3. Copy block link button after "+" button
out = out.replace(
  /(\+)\n( {10}<\/button>\n {8}<\/div>)/,
  '$1\n          </button>\n          <button onClick={() => { const u = window.location.origin + window.location.pathname + "#block-" + block.id; navigator.clipboard.writeText(u); }} title="复制块链接" className="w-5 h-5 flex items-center justify-center rounded text-[9px] transition-all opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }}>🔗</button>$2'
);

// 4. Empty block auto-merge
out = out.replace(
  /(const n = \[\.\.\.prev\];\n\s*)(n\.splice\(idx \+ 1, 0, mk\(type, html\)\);\n\s*return n)/,
  '$1const prevB = n[idx];\n      if (prevB && prevB.type === "p" && !prevB.html && type === "p" && !html) return n;\n      $2'
);

// 5. Bottom + button auto-merge
out = out.replace(
  /(pushSnapshot\(\);)\n(\s*setBlocks\(\(p\) => \[\.\.\.p, mk\(type\)\]\);)/,
  '$1\n$2'.replace('[...p, mk(type)]', '(p => { const l = p[p.length-1]; if (l && l.type === "p" && !l.html && type === "p") return p; return [...p, mk(type)]; })')
);

fs.writeFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", out, "utf8");
console.log("Patch done:", out.split("\n").length, "lines");
