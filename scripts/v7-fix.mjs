import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('D:\\\\agent\\\\ggy-blog\\\\src\\\\app\\\\write\\\\page.tsx', 'utf8');
const BT3 = '\x60\x60\x60'; // `

// ===== Fix 1: useMemo =====
c = c.replace(
  'import { useState, useRef, useEffect, useCallback } from \"react\";',
  'import { useState, useRef, useEffect, useCallback, useMemo } from \"react\";'
);

// ===== Fix 2: FloatingTOC =====
c = c.replace(
  'document.querySelectorAll(\"[data-block][data-heading]\");',
  'document.querySelectorAll(\"[data-heading]\");'
);
c = c.replace(
  '(e.target as HTMLElement).dataset.block',
  '(e.target as HTMLElement).closest(\"[data-block]\")?.getAttribute(\"data-block\")'
);

// ===== Fix 3: Backspace chain =====
c = c.replace(
  '/** 删除块 */\n  const remove = (id: string) => {\n    pushSnapshot();\n    setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== id) : prev));\n  };',
  '/** 删除块（飞书风格：删后自动聚焦前一个块，支持连续 Backspace） */\n  const remove = (id: string, idx: number) => {\n    pushSnapshot();\n    setBlocks((prev) => {\n      if (prev.length <= 1) return prev;\n      const nb = prev.filter((b) => b.id !== id);\n      setTimeout(() => {\n        const ti = Math.min(idx, nb.length - 1);\n        const all = document.querySelectorAll(\"[data-block] [contenteditable]\");\n        const t = all[ti] as HTMLElement;\n        if (t) { t.focus(); setCursorToEnd(t); }\n      }, 10);\n      return nb;\n    });\n  };'
);

c = c.replace(
  'onDelete={() => remove(b.id)}',
  'onDelete={() => remove(b.id, i)}'
);

// ===== Fix 4: mk lang =====
c = c.replace(
  'const mk = (t: BType, html = \"\"): Block => ({ id: nid(), type: t, html });',
  'const mk = (t: BType, html = \"\", lang?: string): Block => ({ id: nid(), type: t, html, ...(lang ? { lang } : {}) });'
);

// ===== Feature: mdToBlocks =====
const mdToBlocksCode = 
/**
 * 将 Markdown 字符串解析为 Block 数组（blocksToMd 的逆操作）
 * 按空行分割，识别各块的类型（标题/代码/引用/列表/表格等）
 */
function mdToBlocks(md: string): Block[] {
  const sections = md.split(/\\n\\n+/).filter((s) => s.trim());
  return sections.map((sec) => {
    const lines = sec.trim().split(\"\\n\");
    const first = lines[0];
    // 代码块
    if (first.startsWith(\"\")) {
      const lang = first.slice(3).trim();
      const endIdx = lines.findIndex((l, i) => i > 0 && l.startsWith(\"\"));
      const code = endIdx > 0 ? lines.slice(1, endIdx).join(\"\\n\") : lines.slice(1).join(\"\\n\");
      return mk(\"code\", escHtml(code), lang || undefined);
    }
    // 标题
    if (first.startsWith(\"# \")) return mk(\"h1\", escHtml(first.slice(2)));
    if (first.startsWith(\"## \")) return mk(\"h2\", escHtml(first.slice(3)));
    if (first.startsWith(\"### \")) return mk(\"h3\", escHtml(first.slice(4)));
    // 引用
    if (first.startsWith(\"> \")) return mk(\"quote\", escHtml(lines.map((l) => l.replace(/^> ?/, \"\")).join(\"<br>\")));
    // 待办
    if (lines.every((l) => /^- \\[[ x]\\] /.test(l)))
      return mk(\"todo\", escHtml(lines.map((l) => l.replace(/^- \\[[ x]\\] /, \"\")).join(\"<br>\")));
    // 无序列表
    if (lines.every((l) => /^- /.test(l)))
      return mk(\"ul\", escHtml(lines.map((l) => l.replace(/^- /, \"\")).join(\"<br>\")));
    // 有序列表
    if (lines.every((l) => /^\\d+\\. /.test(l)))
      return mk(\"ol\", escHtml(lines.map((l) => l.replace(/^\\d+\\. /, \"\")).join(\"<br>\")));
    // 分割线
    if (first === \"---\") return mk(\"hr\");
    // 图片
    if (/^!\\[/.test(first)) return mk(\"img\", escHtml(first));
    // 表格
    if (lines.length > 1 && lines.every((l) => l.startsWith(\"|\")))
      return mk(\"table\", escHtml(sec));
    // 默认：正文
    return mk(\"p\", escHtml(sec.replace(/\\n/g, \"<br>\")));
  });
}
;

c = c.replace(
  '/**\n * 将块数组转为 Markdown 字符串',
  mdToBlocksCode + '/**\n * 将块数组转为 Markdown 字符串'
);

// ===== Feature: ImportDialog =====
const importDialogCode = 
// ══════════════════════════════════════════════════
//  Markdown 导入弹窗
// ══════════════════════════════════════════════════

/** 导入弹窗：粘贴 Markdown 或选择 .md 文件，转为 Block 数组 */
function ImportDialog({ open, onClose, onImport }: {
  open: boolean; onClose: () => void; onImport: (blocks: Block[]) => void;
}) {
  const [text, setText] = useState(\"\");
  if (!open) return null;
  return (
    <div className=\"fixed inset-0 z-[300] flex items-center justify-center\" onClick={onClose}>
      <div className=\"absolute inset-0 bg-black/30\" />
      <div className=\"relative w-full max-w-lg card p-5 space-y-3\" onClick={(e) => e.stopPropagation()}>
        <h3 className=\"font-sans text-sm font-bold\">导入 Markdown</h3>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder=\"粘贴 Markdown 内容…\" autoFocus
          className=\"w-full h-48 px-3 py-2 rounded-lg border font-mono text-xs outline-none resize-none\"
          style={{ backgroundColor: \"var(--bg)\", borderColor: \"var(--border)\", color: \"var(--text)\" }} />
        <div className=\"flex gap-2 justify-between\">
          <input type=\"file\" accept=\".md,.txt,.markdown\"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) { const t = await f.text(); setText(t); }
            }}
            className=\"font-sans text-xs\" style={{ color: \"var(--text-muted)\" }} />
          <div className=\"flex gap-2\">
            <button onClick={onClose} className=\"btn-ghost text-xs\">取消</button>
            <button onClick={() => { if (text.trim()) { onImport(mdToBlocks(text)); onClose(); } }}
              className=\"px-4 py-2 rounded-lg font-sans text-sm font-medium text-white\"
              style={{ backgroundColor: \"var(--accent)\" }}>导入</button>
          </div>
        </div>
      </div>
    </div>
  );
}
;

// Insert before TypePicker
c = c.replace('//  类型选择浮层', importDialogCode + '//  类型选择浮层');

// State
c = c.replace(
  'const [showSC, setShowSC] = useState(false);',
  'const [showSC, setShowSC] = useState(false);\n  const [showImport, setShowImport] = useState(false);'
);

// Import button
c = c.replace(
  '<button onClick={() => setShowSC(true)} className=\"btn-ghost text-xs\">',
  '<button onClick={() => setShowImport(true)} className=\"btn-ghost text-xs\" style={{ color: \"var(--accent)\" }}>导入</button>\n          <button onClick={() => setShowSC(true)} className=\"btn-ghost text-xs\">'
);

// Dialog render
c = c.replace(
  '<ShortcutModal\n        open={showSC}',
  '<ImportDialog open={showImport} onClose={() => setShowImport(false)}\n        onImport={(newBlocks) => { pushSnapshot(); setBlocks(newBlocks); }} />\n      <ShortcutModal\n        open={showSC}'
);

// ===== V6 features =====
// Lightbox
c = c.replace('//  类型选择浮层', 
// ══════════════════════════════════════════════════
//  图片灯箱
// ══════════════════════════════════════════════════

/** 点击图片放大预览，ESC/点击遮罩关闭 */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === \"Escape\") onClose(); };
    window.addEventListener(\"keydown\", h);
    return () => window.removeEventListener(\"keydown\", h);
  }, [onClose]);
  return (
    <div className=\"fixed inset-0 z-[400] flex items-center justify-center bg-black/80 cursor-zoom-out\" onClick={onClose}>
      <img src={src} className=\"max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl\" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

//  类型选择浮层);

c = c.replace(
  'const [tableCols, setTableCols] = useState(3);',
  'const [tableCols, setTableCols] = useState(3);\n  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);'
);

c = c.replace(
  'srcUrl && (\n            <div className=\"relative\">\n              <img',
  'srcUrl && (\n            <div className=\"relative\">\n              <button onClick={() => setLightboxSrc(srcUrl)} className=\"absolute inset-0 z-10 cursor-zoom-in\" title=\"点击放大\" />\n              <img'
);

c = c.replace(
  '{focused && <FormatToolbar onInsertLink={onFormatLink} />}\n\n      {/* 类型选择器 */}',
  '{focused && <FormatToolbar onInsertLink={onFormatLink} />}\n      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}\n\n      {/* 类型选择器 */}'
);

// Copy link
c = c.replace(
  '            +\n          </button>\n        </div>\n\n        {/* 右侧：块内容 */}',
  '            +\n          </button>\n          <button onClick={() => { const u = window.location.origin + window.location.pathname + \"#block-\" + block.id; navigator.clipboard.writeText(u); }} title=\"复制块链接\" className=\"w-5 h-5 flex items-center justify-center rounded text-[9px] transition-all opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-subtle)]\" style={{ color: \"var(--text-muted)\" }}>🔗</button>\n        </div>\n\n        {/* 右侧：块内容 */}'
);

// Auto-merge
c = c.replace(
  'const n = [...prev];\n      n.splice(idx + 1, 0, mk(type, html));\n      return n;\n    });\n    setTimeout(() => {',
  'const n = [...prev];\n      const prevBlock = n[idx];\n      if (prevBlock && prevBlock.type === \"p\" && !prevBlock.html && type === \"p\" && !html) return n;\n      n.splice(idx + 1, 0, mk(type, html));\n      return n;\n    });\n    setTimeout(() => {'
);

c = c.replace(
  'setBlocks((p) => [...p, mk(type)]);',
  'setBlocks((p) => { const l = p[p.length - 1]; if (l && l.type === \"p\" && !l.html && type === \"p\") return p; return [...p, mk(type)]; });'
);

writeFileSync('D:\\\\agent\\\\ggy-blog\\\\src\\\\app\\\\write\\\\page.tsx', c, 'utf8');
console.log('V7 done:', c.split('\\n').length, 'lines');
