/**
 * Dialogs.tsx — 弹窗组件集合
 * 快捷键设置 / 链接对话框 / 图片灯箱 / Markdown导入
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { markdownToBlocks } from "@/app/write/utils";
import type { Block } from "@/app/write/types";

const DEF_SC: Record<string, string> = { save:"Ctrl+S", bold:"Ctrl+B", italic:"Ctrl+I", underline:"Ctrl+U", h1:"Ctrl+Shift+1", h2:"Ctrl+Shift+2", h3:"Ctrl+Shift+3", h4:"Ctrl+Shift+4", h5:"Ctrl+Shift+5", quote:"Ctrl+Shift+Q", code:"Ctrl+Shift+K", undo:"Ctrl+Z", redo:"Ctrl+Shift+Z" };
const saveSC = (s: Record<string, string>) => localStorage.setItem("w-sc", JSON.stringify(s));

/** 快捷键设置弹窗 */
export function ShortcutModal({ open, onClose, shortcuts, setShortcuts }: {
  open: boolean; onClose: () => void; shortcuts: Record<string, string>; setShortcuts: (s: Record<string, string>) => void;
}) {
  if (!open) return null;
  const labels: Record<string, string> = { save: "保存", bold: "加粗", italic: "斜体", underline: "下划线", h1: "大标题", h2: "二级标题", h3: "三级标题", h4: "四级标题", h5: "五级标题", quote: "引用", code: "代码", undo: "撤销", redo: "重做" };
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between"><h3 className="font-sans text-sm font-bold">快捷键</h3><button onClick={onClose} className="btn-ghost text-xs">✕</button></div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {Object.entries(shortcuts).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1.5 px-2 rounded" style={{ backgroundColor: "var(--bg-subtle)" }}>
              <span className="font-sans text-xs" style={{ color: "var(--text-secondary)" }}>{labels[key] || key}</span>
              <button onClick={() => { const n = prompt(`修改快捷键：${labels[key] || key}`, value); if (n?.trim()) { const u = { ...shortcuts, [key]: n.trim() }; setShortcuts(u); saveSC(u); } }}
                className="font-mono text-xs px-2 py-0.5 rounded border cursor-pointer" style={{ color: "var(--accent)", backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>{value}</button>
            </div>
          ))}
        </div>
        <button onClick={() => { setShortcuts(DEF_SC); saveSC(DEF_SC); }} className="w-full font-sans text-xs py-1.5 rounded hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }}>恢复默认</button>
      </div>
    </div>
  );
}

/** 链接插入对话框 */
export function LinkDialog({ open, onClose, onInsert }: {
  open: boolean; onClose: () => void; onInsert: (text: string, url: string, mode: string) => void;
}) {
  const [text, setText] = useState(""); const [url, setUrl] = useState(""); const [mode, setMode] = useState("inline");
  useEffect(() => { if (open) { setText(window.getSelection()?.toString() || ""); setUrl(""); setMode("inline"); } }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-sans text-sm font-bold">插入链接</h3>
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <button onClick={() => setMode("inline")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium" style={{ backgroundColor: mode === "inline" ? "var(--bg-card)" : "transparent", color: mode === "inline" ? "var(--accent)" : "var(--text-muted)" }}>行内链接</button>
          <button onClick={() => setMode("bookmark")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium" style={{ backgroundColor: mode === "bookmark" ? "var(--bg-card)" : "transparent", color: mode === "bookmark" ? "var(--accent)" : "var(--text-muted)" }}>卡片链接</button>
          <button onClick={() => setMode("embed")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium" style={{ backgroundColor: mode === "embed" ? "var(--bg-card)" : "transparent", color: mode === "embed" ? "var(--accent)" : "var(--text-muted)" }}>嵌入预览</button>
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "inline" ? "显示文本" : "链接标题"} autoFocus className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="btn-ghost text-xs">取消</button><button onClick={() => { if (url.trim()) { onInsert(text || url, url, mode); onClose(); } }} className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white" style={{ backgroundColor: "var(--accent)" }}>插入</button></div>
      </div>
    </div>
  );
}

/** 图片灯箱 */
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (<div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 cursor-zoom-out" onClick={onClose}><img src={src} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} /></div>);
}

/** Markdown导入弹窗 */
export function ImportDialog({ open, onClose, onImport }: {
  open: boolean; onClose: () => void; onImport: (blocks: Block[]) => void;
}) {
  const [text, setText] = useState(""); const taRef = useRef<HTMLTextAreaElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setText(""); setTimeout(() => taRef.current?.focus(), 50); } }, [open]);
  if (!open) return null;
  const handleImport = () => { const t = text.trim(); if (!t) return; onImport(markdownToBlocks(t)); onClose(); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setText(r.result as string); r.readAsText(f); };
  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between"><h3 className="font-sans text-sm font-bold">导入 Markdown</h3><button onClick={onClose} className="btn-ghost text-xs">✕</button></div>
        <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴 Markdown 内容…" className="w-full h-48 px-3 py-2 rounded-lg border font-mono text-xs outline-none resize-none" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex gap-2 justify-between items-center">
          <div><input ref={fileRef} type="file" accept=".md,.markdown,.txt" onChange={handleFile} className="hidden" /><button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">📂 选择文件</button></div>
          <div className="flex gap-2"><button onClick={onClose} className="btn-ghost text-xs">取消</button><button onClick={handleImport} disabled={!text.trim()} className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "var(--accent)" }}>导入</button></div>
        </div>
      </div>
    </div>
  );
}
