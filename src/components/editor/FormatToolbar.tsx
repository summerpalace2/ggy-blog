/**
 * FormatToolbar.tsx — 选中文字浮现的格式工具条
 * B/I/U/S/文字颜色/背景颜色/清除格式/插入链接
 */
"use client";

import { useState, useEffect } from "react";
import { TEXT_COLORS, HIGHLIGHT_COLORS } from "@/app/write/types";

interface Props {
  onInsertLink?: () => void;
}

export function FormatToolbar({ onInsertLink }: Props) {
  const [position, setPosition] = useState({ x: 0, y: 0, show: false });
  const [openColor, setOpenColor] = useState(false);
  const [openHighlight, setOpenHighlight] = useState(false);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPosition((p) => ({ ...p, show: false }));
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setPosition({ x: rect.left + rect.width / 2 - 160, y: rect.top - 44, show: true });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  if (!position.show) return null;

  const btnClass = "px-2 py-1 rounded text-xs font-sans font-medium transition-colors hover:bg-[var(--bg-subtle)]";

  const exec = (cmd: string, val?: string) => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    document.execCommand(cmd, false, val);
    if (range && sel) { sel.removeAllRanges(); sel.addRange(range); }
    const el = document.activeElement;
    if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <div className="fixed z-[200] flex items-center gap-0.5 px-1 py-1 rounded-lg shadow-lg border"
      style={{ left: position.x, top: position.y, backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
      <button onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} className={btnClass} style={{ color: "var(--text)", fontWeight: 700 }} title="加粗">B</button>
      <button onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} className={btnClass} style={{ color: "var(--text)", fontStyle: "italic" }} title="斜体">I</button>
      <button onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} className={btnClass} style={{ color: "var(--text)", textDecoration: "underline" }} title="下划线">U</button>
      <button onMouseDown={(e) => { e.preventDefault(); exec("strikeThrough"); }} className={btnClass} style={{ color: "var(--text)", textDecoration: "line-through" }} title="删除线">S</button>
      <div className="w-px h-4 mx-1" style={{ backgroundColor: "var(--border)" }} />
      <div className="relative">
        <button onMouseDown={(e) => { e.preventDefault(); setOpenColor(!openColor); }} className={btnClass} style={{ color: "var(--text)" }} title="文字颜色">A</button>
        {openColor && <div className="absolute top-8 left-0 flex gap-1 p-1.5 rounded-lg shadow-lg border z-[201]" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          {TEXT_COLORS.map((c) => (
            <button key={c.label} onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c.color || ""); setOpenColor(false); }}
              className="w-6 h-6 rounded border" style={{ backgroundColor: c.color, border: "2px solid var(--border)" }} title={c.label} />
          ))}
        </div>}
      </div>
      <div className="relative">
        <button onMouseDown={(e) => { e.preventDefault(); setOpenHighlight(!openHighlight); }} className={btnClass} title="背景颜色">
          <span style={{ background: "#FFF3CD", padding: "0 2px", borderRadius: 2 }}>A</span>
        </button>
        {openHighlight && <div className="absolute top-8 left-0 flex gap-1 p-1.5 rounded-lg shadow-lg border z-[201]" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          {HIGHLIGHT_COLORS.map((c) => (
            <button key={c.label} onMouseDown={(e) => { e.preventDefault(); exec("backColor", c.bg || "transparent"); setOpenHighlight(false); }}
              className="w-6 h-6 rounded border" style={{ backgroundColor: c.bg || "transparent", border: "2px solid var(--border)" }} title={c.label} />
          ))}
        </div>}
      </div>
      <button onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }} className={btnClass} style={{ color: "var(--text-secondary)" }} title="清除格式">✕</button>
      <div className="w-px h-4 mx-1" style={{ backgroundColor: "var(--border)" }} />
      <button onMouseDown={(e) => { e.preventDefault(); onInsertLink?.(); }} className={btnClass} style={{ color: "var(--accent)" }} title="插入链接">🔗</button>
    </div>
  );
}
