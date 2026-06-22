/**
 * write/page.tsx — 飞书云文档风格的块级编辑器（瘦身后）
 *
 * [核心职责] 组装层：状态声明 + 布局 + 子组件挂载
 * 所有业务逻辑已下沉到 store/ 和 components/ 目录
 *
 * [Android 类比] MainActivity：只负责初始化、布局组装、生命周期管理
 */

"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// ── 类型与工具 ──
import type { Block, BType, Shortcuts, Snapshot } from "./types";
import {
  htmlToMarkdown, blocksToMarkdown, matchShortcut, createBlock,
  readFileAsDataUrl, escapeHtml, loadShortcuts, saveShortcuts,
} from "./utils";

// ── 组件 ──
import { ContentEditableArea } from "./components/ContentEditableArea";
import { FormatToolbar } from "./components/FormatToolbar";
import { TypePicker } from "./components/TypePicker";
import { FloatingTOC } from "./components/FloatingTOC";
import { BlockView } from "./components/block-view/BlockView";
import { ShortcutModal } from "./components/dialogs/ShortcutModal";
import { LinkDialog } from "./components/dialogs/LinkDialog";
import { ImportDialog } from "./components/dialogs/ImportDialog";

// ── Store ──
import { useEditorState } from "./store/editor-state";
import {
  insertAfter, splitBlock, removeBlock, mergeUpward, mergeDownward,
} from "./store/block-operations";
import { undo, redo } from "./store/undo-redo";
import { useKeyboardHandlers, useGlobalKeyboardListener } from "./store/keyboard";
import { calculateOlNumber } from "./store/ol-numbering";
import { createSaveHandler } from "./store/save";
import { createLinkHandler } from "./store/link-handler";
import { handlePasteImage, handleDropImage, createPickCover } from "./store/image-handler";

// ═══════════════════════════════════════════════════════════════
//  WritePage — 主页面（组装层）
// ═══════════════════════════════════════════════════════════════

export default function WritePage() {
  const router = useRouter();

  // ── 核心状态（从 store 提取）──
  const editorState = useEditorState([createBlock("p")]);
  const {
    blocks, setBlocks, titleHtml, setTitleHtml, category, setCategory,
    categories, setCategories, coverImage, setCoverImage,
    saving, setSaving, message, setMessage,
    undoStack, redoStack, setUndoStack, setRedoStack,
    editingCategory, setEditingCategory, newCategoryName, setNewCategoryName,
    addingCategory, setAddingCategory, pushSnapshot, restoreDraft,
  } = editorState;

  // ── 快捷键状态 ──
  const [shortcuts, setShortcuts] = useState<Shortcuts>(loadShortcuts());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // ── 权限守卫 ──
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "admin") router.push("/blog");
  }, [status, session, router]);

  // ── 初始化 ──
  useEffect(() => { fetch("/api/categories").then(r => r.json()).then(d => { if (d.categories?.length) setCategories(d.categories); }).catch(() => { }); }, []);
  useEffect(() => {
    if (restoreDraft()) {
      // 草稿已恢复，不弹确认（已在 useEditorState 中恢复）
    }
  }, []);

  // ── 撤销/重做（从 store 提取）──
  const handleUndo = useCallback(() => {
    undo(
      undoStack, redoStack, blocks, titleHtml, category, coverImage,
      setUndoStack, setRedoStack, setBlocks, setTitleHtml, setCategory, setCoverImage,
    );
  }, [undoStack, redoStack, blocks, titleHtml, category, coverImage]);

  const handleRedo = useCallback(() => {
    redo(
      undoStack, redoStack, blocks, titleHtml, category, coverImage,
      setUndoStack, setRedoStack, setBlocks, setTitleHtml, setCategory, setCoverImage,
    );
  }, [undoStack, redoStack, blocks, titleHtml, category, coverImage]);

  // ── 块操作包装函数（绑定 pushSnapshot）──
  const handleInsertAfter = useCallback((index: number, type: BType, html: string) => {
    insertAfter(index, type, html, blocks, setBlocks, pushSnapshot);
  }, [blocks, setBlocks, pushSnapshot]);

  const handleSplitBlock = useCallback((id: string, afterHtml: string, type?: BType, fallbackIndex?: number) => {
    splitBlock(id, afterHtml, type, fallbackIndex, blocks, setBlocks, pushSnapshot);
  }, [blocks, setBlocks, pushSnapshot]);

  const handleRemoveBlock = useCallback((id: string, index: number) => {
    removeBlock(id, index, blocks, setBlocks, pushSnapshot);
  }, [blocks, setBlocks, pushSnapshot]);

  const handleMergeUpward = useCallback((id: string, index: number, content: string) => {
    mergeUpward(id, index, content, blocks, setBlocks, pushSnapshot);
  }, [blocks, setBlocks, pushSnapshot]);

  const handleMergeDownward = useCallback((id: string, index: number) => {
    mergeDownward(id, index, blocks, setBlocks, pushSnapshot);
  }, [blocks, setBlocks, pushSnapshot]);

  // ── 保存（从 store 提取）──
  const handleSave = createSaveHandler(
    blocks, titleHtml, category, setMessage, setSaving, router,
    () => localStorage.removeItem("w-draft"),
  );

  // ── 链接插入（从 store 提取）──
  const handleInsertLink = createLinkHandler(blocks, handleInsertAfter);

  // ── 键盘事件（从 store 提取）──
  const keyboardHandler = useKeyboardHandlers({
    shortcuts, blocks, undoStack, redoStack, titleHtml, category, coverImage,
    save: handleSave, undo: handleUndo, redo: handleRedo,
    removeBlock: handleRemoveBlock,
    moveBlock: (id, dir) => {
      pushSnapshot();
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx < 0) return prev;
        const targetIdx = dir === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const updated = [...prev];
        const [moved] = updated.splice(idx, 1);
        updated.splice(targetIdx, 0, moved);
        return updated;
      });
    },
    setBlocks,
    setBlocksAndPush: (fn) => { pushSnapshot(); setBlocks(fn); },
  });
  useGlobalKeyboardListener(keyboardHandler);

  // ── 辅助 ──
  const titleText = htmlToMarkdown(titleHtml).trim();
  const mdLength = useMemo(() => blocksToMarkdown(blocks).length, [blocks]);
  const handlePickCover = createPickCover(setCoverImage);

  // ── 权限守卫渲染 ──
  if (status !== "authenticated" || session?.user?.role !== "admin") {
    return <div className="max-w-3xl mx-auto px-6 py-20"><p className="font-sans" style={{ color: "var(--text-muted)" }}>加载中…</p></div>;
  }

  // ── JSX 组装 ──
  return (
    <div id="editor-root" className="max-w-[900px] mx-auto px-8 py-12" style={{ userSelect: "text", scrollBehavior: "auto" }}>
      {/* 全局样式 */}
      <style>{`
        [contenteditable]:empty:not(:focus):before{content:attr(data-placeholder);color:var(--text-muted);opacity:0.5;pointer-events:none}
        .drag-target{border-top:2px solid var(--accent)}
        [contenteditable] strong,[contenteditable] b{font-weight:700}
        [contenteditable] em,[contenteditable] i{font-style:italic}
        [contenteditable] code{font-family:var(--font-mono);font-size:0.88em;padding:0.15em 0.4em;border-radius:4px;background:var(--code-bg);border:1px solid var(--code-border);color:var(--inline-code-color)}
        [contenteditable] a{color:var(--accent);text-decoration:underline;cursor:pointer}
        .line-numbers pre{counter-reset:line;padding-left:3.5rem!important}
        .line-numbers pre code>span.line::before{counter-increment:line;content:counter(line);display:inline-block;width:2rem;margin-left:-3.5rem;margin-right:1.5rem;text-align:right;color:var(--line-number-color);user-select:none}
        ::selection{background:rgba(51,112,255,0.2);color:inherit}
      `}</style>

      {/* 顶部工具栏 */}
      <div className="flex justify-between mb-8">
        <h1 className="font-sans text-xl font-bold" style={{ color: "var(--text)" }}>写文章</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleUndo} disabled={undoStack.length === 0} className="btn-ghost text-xs" style={{ opacity: undoStack.length === 0 ? 0.3 : 1 }}>↩</button>
          <button onClick={handleRedo} disabled={redoStack.length === 0} className="btn-ghost text-xs" style={{ opacity: redoStack.length === 0 ? 0.3 : 1 }}>↪</button>
          <button onClick={() => setShowShortcuts(true)} className="btn-ghost text-xs">⌨</button>
          <button onClick={() => setImportOpen(true)} className="btn-ghost text-xs">📥 导入</button>
          <button onClick={() => router.push("/blog")} className="btn-ghost text-xs">取消</button>
          <button onClick={async () => { await navigator.clipboard.writeText(blocksToMarkdown(blocks)); setMessage("已复制"); setTimeout(() => setMessage(""), 2000); }} className="btn-ghost text-xs">📋 复制</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg font-sans text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "var(--accent)" }}>{saving ? "…" : "发布"}</button>
        </div>
      </div>

      {message && <div className="mb-4 px-4 py-2 rounded-lg font-sans text-xs" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>{message}</div>}

      {/* 封面图 */}
      <div className="mb-6">
        {coverImage && <div className="relative mb-3 -mx-8"><img src={coverImage} alt="封面" className="w-full" /><button onClick={() => setCoverImage("")} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">✕</button></div>}
        <button onClick={handlePickCover} className="btn-ghost text-xs">🖼 {coverImage ? "更换封面" : "添加封面图"}</button>
      </div>

      {/* 标题输入 */}
      <div className="mb-6">
        <input type="text" value={htmlToMarkdown(titleHtml)}
          onChange={(e) => setTitleHtml(e.target.value)} placeholder="文章标题"
          className="w-full outline-none font-sans text-4xl font-bold pb-2 border-b-2 border-[var(--border)]"
          style={{ color: "var(--text)", caretColor: "var(--accent)", lineHeight: 1.3, backgroundColor: "transparent" }} />
      </div>

      {/* 分类选择 */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>分类：</span>
        <div className="flex gap-2 flex-wrap items-center">
          {categories.map((cat) => (
            editingCategory === cat ? (
              <input key={cat} autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const name = newCategoryName.trim();
                    if (name && name !== cat) {
                      fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldName: cat, newName: name }) })
                        .then(() => { setCategories((p) => p.map((c) => c === cat ? name : c)); if (category === cat) setCategory(name); });
                    }
                    setEditingCategory(null); setNewCategoryName("");
                  }
                  if (e.key === "Escape") { setEditingCategory(null); setNewCategoryName(""); }
                }}
                onBlur={() => { setEditingCategory(null); setNewCategoryName(""); }}
                className="px-2 py-1 rounded font-sans text-xs outline-none border"
                style={{ backgroundColor: "var(--bg)", borderColor: "var(--accent)", color: "var(--text)", width: 100 }} />
            ) : (
              <span key={cat} className="relative group/cat">
                <button onClick={() => setCategory(cat)} className="px-3 py-1 rounded-full font-sans text-xs font-medium cursor-pointer"
                  style={{ backgroundColor: category === cat ? "var(--accent)" : "var(--bg-subtle)", color: category === cat ? "white" : "var(--text-secondary)" }}>
                  {cat === "tech" ? "🖥 技术" : cat === "life" ? "🌟 生活" : cat}
                </button>
                <span className="hidden group-hover/cat:inline-flex ml-1 gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setNewCategoryName(cat); }}
                    className="text-[10px] px-1 rounded hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }} title="编辑">✎</button>
                  {categories.length > 1 && <button onClick={(e) => { e.stopPropagation(); if (confirm(`删除分类「${cat}」及其所有文章？`)) { fetch("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cat }) }).then(() => { setCategories((p) => p.filter((c) => c !== cat)); if (category === cat) setCategory(categories[0] === cat ? categories[1] : categories[0]); }); } }}
                    className="text-[10px] px-1 rounded hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }} title="删除">✕</button>}
                </span>
              </span>
            )
          ))}
          {addingCategory ? (
            <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = newCategoryName.trim();
                  if (name && !categories.includes(name)) {
                    fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
                    setCategories((p) => [...p, name]); setCategory(name);
                  }
                  setAddingCategory(false); setNewCategoryName("");
                }
                if (e.key === "Escape") { setAddingCategory(false); setNewCategoryName(""); }
              }}
              onBlur={() => { setAddingCategory(false); setNewCategoryName(""); }}
              placeholder="新分类名" className="px-2 py-1 rounded font-sans text-xs outline-none border"
              style={{ backgroundColor: "var(--bg)", borderColor: "var(--accent)", color: "var(--text)", width: 100 }} />
          ) : (
            <button onClick={() => { setAddingCategory(true); setNewCategoryName(""); }} className="px-2 py-1 rounded-full font-sans text-xs border border-dashed cursor-pointer hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>+ 新增</button>
          )}
        </div>
      </div>

      {/* 块列表 */}
      <div className="space-y-0" style={{ userSelect: "text" }}>
        {blocks.map((block, index) => {
          // 有序列表编号计算
          const olNumber = calculateOlNumber(index, blocks);

          return (
            <div key={block.id}>
              <BlockView block={block} index={index}
                onChange={(b) => { pushSnapshot(); setBlocks((prev) => prev.map((bl) => (bl.id === b.id ? b : bl))); }}
                onEnter={(html, type) => handleSplitBlock(block.id, html, type, index)}
                onDelete={() => handleRemoveBlock(block.id, index)}
                _onInsertAfter={(type) => handleInsertAfter(index, type, "")}
                onPasteImg={async (file) => handlePasteImage(file, index, blocks, setBlocks)}
                onDropImg={async (file) => handleDropImage(file, index, block, setBlocks, pushSnapshot)}
                onBackspace={(content) => handleMergeUpward(block.id, index, content)}
                onDeleteDown={() => handleMergeDownward(block.id, index)}
                olNumber={olNumber}
                allBlocks={blocks}
              />
              {/* 块间空白：双击新增段落 */}
              <div className="h-3 cursor-text group/gap" onDoubleClick={() => handleInsertAfter(index, "p", "")} title="双击新增段落">
                <div className="h-full w-full rounded opacity-0 group-hover/gap:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: "var(--border)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部空白 */}
      <div className="h-24 cursor-text rounded-lg flex items-center justify-center group/bottom mt-1"
        onDoubleClick={() => handleInsertAfter(blocks.length - 1, "p", "")}
        style={{ border: "2px dashed transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
        <span className="font-sans text-xs opacity-0 group-hover/bottom:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }}>双击此处新增段落</span>
      </div>

      {/* 底部状态 */}
      <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex items-center justify-between font-sans text-xs" style={{ color: "var(--text-muted)" }}>
          <span>{blocks.length} 个块 · {mdLength} 字符</span>
          <span>{titleText ? titleText.substring(0, 30) : "未命名"}</span>
        </div>
      </div>

      {/* 浮动组件 */}
      <FormatToolbar onInsertLink={() => setLinkOpen(true)} />
      <ShortcutModal open={showShortcuts} onClose={() => setShowShortcuts(false)} shortcuts={shortcuts} setShortcuts={setShortcuts} />
      <LinkDialog open={linkOpen} onClose={() => setLinkOpen(false)} onInsert={handleInsertLink} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={(newBlocks) => { pushSnapshot(); setBlocks(newBlocks); }} />
      <FloatingTOC blocks={blocks} />
    </div>
  );
}
