const fs = require("fs");
let c = fs.readFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", "utf8");

// ═══ Fix 1: Backspace chain deletion ═══
// Change onDelete in BlockView to take index, and remove function to auto-focus prev block

// 1a. Update BlockView props to accept onDelete with signature change
// onDelete: () => void  →  it stays the same since we handle focus in the parent

// 1b. Update remove function in WritePage to focus previous block after deletion
c = c.replace(
  '/** 删除块 */\n  const remove = (id: string) => {\n    pushSnapshot();\n    setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== id) : prev));\n  };',
  '/** 删除块，删除后自动聚焦前一个块（支持连续 Backspace 删除） */\n  const remove = (id: string, idx: number) => {\n    pushSnapshot();\n    setBlocks((prev) => {\n      if (prev.length <= 1) return prev;\n      const nb = prev.filter((b) => b.id !== id);\n      setTimeout(() => {\n        const ti = Math.min(idx, nb.length - 1);\n        const all = document.querySelectorAll("[data-block] [contenteditable]");\n        const t = all[ti] as HTMLElement;\n        if (t) { t.focus(); setCursorToEnd(t); }\n      }, 10);\n      return nb;\n    });\n  };'
);

// 1c. Update the onDelete call in WritePage's BlockView usage
c = c.replace(
  'onDelete={() => remove(b.id)}',
  'onDelete={() => remove(b.id, i)}'
);

// 1d. Also update the split function so new blocks get the right index for deletion
// (The split function already works because blocks get re-rendered with new indices)

// ═══ Feature: Markdown import ═══
// Add mdToBlocks function before blocksToMd
const mdImportCode = `/**
 * 将 Markdown 字符串解析为 Block 数组（blocksToMd 的逆操作）
 * 按空行分割，识别各块的类型
 */
function mdToBlocks(md: string): Block[] {
  const sections = md.split(/\n\n+/).filter((s) => s.trim());
  return sections.map((sec) => {
    const lines = sec.trim().split("\n");
    const first = lines[0];
    // 代码块
    if (first.startsWith("\`\`\`")) {
      const lang = first.slice(3).trim();
      const endIdx = lines.findIndex((l, i) => i > 0 && l.startsWith("\`\`\`"));
      const code = endIdx > 0 ? lines.slice(1, endIdx).join("\n") : lines.slice(1).join("\n");
      return mk("code", escHtml(code), lang || undefined);
    }
    // 标题
    if (first.startsWith("# ")) return mk("h1", escHtml(first.slice(2)));
    if (first.startsWith("## ")) return mk("h2", escHtml(first.slice(3)));
    if (first.startsWith("### ")) return mk("h3", escHtml(first.slice(4)));
    // 引用
    if (first.startsWith("> ")) return mk("quote", escHtml(lines.map((l) => l.replace(/^> ?/, "")).join("<br>")));
    // 待办
    if (lines.every((l) => /^- \[[ x]\] /.test(l)))
      return mk("todo", escHtml(lines.map((l) => l.replace(/^- \[[ x]\] /, "")).join("<br>")));
    // 无序列表
    if (lines.every((l) => /^- /.test(l)))
      return mk("ul", escHtml(lines.map((l) => l.replace(/^- /, "")).join("<br>")));
    // 有序列表
    if (lines.every((l) => /^\d+\. /.test(l)))
      return mk("ol", escHtml(lines.map((l) => l.replace(/^\d+\. /, "")).join("<br>")));
    // 分割线
    if (first === "---") return mk("hr");
    // 图片
    if (/^!\[/.test(first)) return mk("img", escHtml(first));
    // 表格
    if (lines.length > 1 && lines.every((l) => l.startsWith("|")))
      return mk("table", escHtml(sec));
    // 默认：正文
    return mk("p", escHtml(sec.replace(/\n/g, "<br>")));
  });
}

`;

// Insert mdToBlocks before blocksToMd
c = c.replace(
  '/**\n * 将块数组转为 Markdown 字符串',
  mdImportCode + '/**\n * 将块数组转为 Markdown 字符串'
);

// Add mk function overload for lang parameter
// mk currently is: const mk = (t: BType, html = ""): Block => ({ id: nid(), type: t, html });
// Change to support optional lang
c = c.replace(
  'const mk = (t: BType, html = ""): Block => ({ id: nid(), type: t, html });',
  'const mk = (t: BType, html = "", lang?: string): Block => ({ id: nid(), type: t, html, ...(lang ? { lang } : {}) });'
);

// Add import dialog modal
const importModalCode = `
// ══════════════════════════════════════════════════
//  Markdown 导入弹窗
// ══════════════════════════════════════════════════

function ImportDialog({ open, onClose, onImport }: {
  open: boolean; onClose: () => void; onImport: (blocks: Block[]) => void;
}) {
  const [text, setText] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-sans text-sm font-bold">导入 Markdown</h3>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="粘贴 Markdown 内容…" autoFocus
          className="w-full h-48 px-3 py-2 rounded-lg border font-mono text-xs outline-none resize-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex gap-2 justify-between">
          <div className="flex gap-2">
            <input type="file" accept=".md,.txt,.markdown"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) { const t = await f.text(); setText(t); }
              }}
              className="font-sans text-xs" style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-xs">取消</button>
            <button onClick={() => { if (text.trim()) { onImport(mdToBlocks(text)); onClose(); } }}
              className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white"
              style={{ backgroundColor: "var(--accent)" }}>导入</button>
          </div>
        </div>
      </div>
    </div>
  );
}

`;

// Insert before TypePicker section
const typePickerMarker = "//  类型选择浮层";
c = c.replace(typePickerMarker, importModalCode + typePickerMarker);

// Add import state and button to WritePage
// Find the showSC state and add showImport
c = c.replace(
  "const [showSC, setShowSC] = useState(false);",
  "const [showSC, setShowSC] = useState(false);\n  const [showImport, setShowImport] = useState(false);"
);

// Add Import button in toolbar
c = c.replace(
  '<button onClick={() => setShowSC(true)} className="btn-ghost text-xs">',
  '<button onClick={() => setShowImport(true)} className="btn-ghost text-xs" style={{ color: "var(--accent)" }}>\n            导入\n          </button>\n          <button onClick={() => setShowSC(true)} className="btn-ghost text-xs">'
);

// Add import handler and dialog render
// Find ShortcutModal render, add ImportDialog before it
c = c.replace(
  '<ShortcutModal\n        open={showSC}',
  '<ImportDialog open={showImport} onClose={() => setShowImport(false)}\n        onImport={(newBlocks) => { pushSnapshot(); setBlocks(newBlocks); }} />\n      <ShortcutModal\n        open={showSC}'
);

fs.writeFileSync("D:\\agent\\ggy-blog\\src\\app\\write\\page.tsx", c, "utf8");
console.log("V7 patch applied:", c.split("\n").length, "lines");
