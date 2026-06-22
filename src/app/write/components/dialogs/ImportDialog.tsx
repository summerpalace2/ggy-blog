/**
 * dialogs/ImportDialog.tsx — Markdown导入对话框
 * [核心职责] 支持文本粘贴或文件选择导入Markdown，解析为Block数组
 */

"use client";

import { useState, useRef, useEffect, type FC } from "react";
import { markdownToBlocks } from "../../utils";
import type { Block } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (blocks: Block[]) => void;
}

export const ImportDialog: FC<Props> = ({ open, onClose, onImport }) => {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setText(""); setTimeout(() => textareaRef.current?.focus(), 50); } }, [open]);
  if (!open) return null;

  const handleImport = () => { const t = text.trim(); if (!t) return; onImport(markdownToBlocks(t)); onClose(); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(reader.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between">
          <h3 className="font-sans text-sm font-bold">导入 Markdown</h3>
          <button onClick={onClose} className="btn-ghost text-xs">✕</button>
        </div>
        <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴 Markdown 内容…"
          className="w-full h-48 px-3 py-2 rounded-lg border font-mono text-xs outline-none resize-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex gap-2 justify-between items-center">
          <div>
            <input ref={fileRef} type="file" accept=".md,.markdown,.txt" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">📂 选择文件</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-xs">取消</button>
            <button onClick={handleImport} disabled={!text.trim()}
              className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)" }}>导入</button>
          </div>
        </div>
      </div>
    </div>
  );
};
