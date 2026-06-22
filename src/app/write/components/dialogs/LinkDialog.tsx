/**
 * dialogs/LinkDialog.tsx — 链接插入对话框
 * [核心职责] 支持行内链接/卡片链接/嵌入预览三种模式插入链接
 */

"use client";

import { useState, useEffect, type FC } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string, url: string, mode: string) => void;
}

export const LinkDialog: FC<Props> = ({ open, onClose, onInsert }) => {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("inline");

  useEffect(() => { if (open) { setText(window.getSelection()?.toString() || ""); setUrl(""); setMode("inline"); } }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-sans text-sm font-bold">插入链接</h3>
        {/* 模式切换 */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <button onClick={() => setMode("inline")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium"
            style={{ backgroundColor: mode === "inline" ? "var(--bg-card)" : "transparent", color: mode === "inline" ? "var(--accent)" : "var(--text-muted)" }}>行内链接</button>
          <button onClick={() => setMode("bookmark")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium"
            style={{ backgroundColor: mode === "bookmark" ? "var(--bg-card)" : "transparent", color: mode === "bookmark" ? "var(--accent)" : "var(--text-muted)" }}>卡片链接</button>
          <button onClick={() => setMode("embed")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium"
            style={{ backgroundColor: mode === "embed" ? "var(--bg-card)" : "transparent", color: mode === "embed" ? "var(--accent)" : "var(--text-muted)" }}>嵌入预览</button>
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "inline" ? "显示文本" : "链接标题"} autoFocus
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-xs">取消</button>
          <button onClick={() => { if (url.trim()) { onInsert(text || url, url, mode); onClose(); } }}
            className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white"
            style={{ backgroundColor: "var(--accent)" }}>插入</button>
        </div>
      </div>
    </div>
  );
};
