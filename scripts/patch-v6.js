const fs = require("fs");
let c = fs.readFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", "utf8");

// === Fix 1: useMemo import ===
c = c.replace(
  'import { useState, useRef, useEffect, useCallback } from "react";',
  'import { useState, useRef, useEffect, useCallback, useMemo } from "react";'
);

// === Fix 2: FloatingTOC selector ===
c = c.replace(
  'document.querySelectorAll("[data-block][data-heading]");',
  'document.querySelectorAll("[data-heading]");'
);
c = c.replace(
  '(e.target as HTMLElement).dataset.block',
  '(e.target as HTMLElement).closest("[data-block]")?.getAttribute("data-block")'
);

// === Feature 1: ImageLightbox component (before TypePicker section) ===
const typePickerHeader = "//  类型选择浮层（带搜索 + Esc 关闭）";
const imageLightboxCode = `/**
 * 图片灯箱 — 点击放大预览，ESC/点击遮罩关闭
 */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 cursor-zoom-out" onClick={onClose}>
      <img src={src} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ══════════════════════════════════════════════════
`;
c = c.replace("// ══════\n" + typePickerHeader, imageLightboxCode + typePickerHeader);
// Actually need to match the full separator line too
c = c.replace(typePickerHeader, imageLightboxCode + typePickerHeader);

// === Feature 2: lightboxSrc state in BlockView ===
c = c.replace(
  'const [tableCols, setTableCols] = useState(3);',
  'const [tableCols, setTableCols] = useState(3);\n  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);'
);

// === Feature 3: Lightbox trigger on image (use a unique anchor) ===
// The image block has: srcUrl && (\n            <div className="relative">\n              <img
// Replace: insert clickable overlay before <img
const imgAnchor = 'srcUrl && (\n            <div className="relative">\n              <img';
c = c.replace(imgAnchor, 'srcUrl && (\n            <div className="relative">\n              <button onClick={() => setLightboxSrc(srcUrl)} className="absolute inset-0 z-10 cursor-zoom-in" title="点击放大" />\n              <img');

// === Feature 4: Render lightbox in BlockView return ===
const formatToolbarAnchor = '{focused && <FormatToolbar onInsertLink={onFormatLink} />}\n\n      {/* 类型选择器 */}';
c = c.replace(formatToolbarAnchor, '{focused && <FormatToolbar onInsertLink={onFormatLink} />}\n      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}\n\n      {/* 类型选择器 */}');

// === Feature 5: Copy block link (use unique anchor in left sidebar) ===
// The "+" button end is: the last button before </div> then {/* 右侧：块内容 */}
const copyLinkBtn = `            +
          </button>
        </div>

        {/* 右侧：块内容 */}`;
const copyLinkReplacement = `            +
          </button>
          <button onClick={() => { const u = window.location.origin + window.location.pathname + "#block-" + block.id; navigator.clipboard.writeText(u); }} title="复制块链接" className="w-5 h-5 flex items-center justify-center rounded text-[9px] transition-all opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }}>🔗</button>
        </div>

        {/* 右侧：块内容 */}`;
c = c.replace(copyLinkBtn, copyLinkReplacement);

// === Feature 6: Empty block auto-merge ===
c = c.replace(
  'const n = [...prev];\n      n.splice(idx + 1, 0, mk(type, html));\n      return n;\n    });\n    // 聚焦新块',
  'const n = [...prev];\n      const prevBlock = n[idx];\n      if (prevBlock && prevBlock.type === "p" && !prevBlock.html && type === "p" && !html) return n;\n      n.splice(idx + 1, 0, mk(type, html));\n      return n;\n    });\n    // 聚焦新块'
);

fs.writeFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", c, "utf8");
console.log("V6 patch applied:", c.split("\n").length, "lines");
