/**
 * FormatToolbar.tsx — 格式化工具栏
 * [核心职责] 选中文字时浮现在选区上方，提供加粗/斜体/下划线/删除线/文字颜色/背景色/链接功能
 * [Android 类比] 浮动 ActionMode Toolbar，跟随选区定位
 */

"use client";

import { useState, useEffect, type FC } from "react";

interface Props {
  onInsertLink?: () => void;
}

const TEXT_COLORS = [
  { color: "var(--text)", label: "默认" }, { color: "#e74c3c", label: "红色" },
  { color: "#e67e22", label: "橙色" }, { color: "#f1c40f", label: "黄色" },
  { color: "#2ecc71", label: "绿色" }, { color: "#3498db", label: "蓝色" },
  { color: "#9b59b6", label: "紫色" },
];

const HIGHLIGHT_COLORS = [
  { bg: "transparent", label: "无背景" }, { bg: "#FFF3CD", label: "黄色" },
  { bg: "#D4EDDA", label: "绿色" }, { bg: "#D1ECF1", label: "蓝色" },
  { bg: "#F8D7DA", label: "红色" }, { bg: "#E2D9F3", label: "紫色" },
  { bg: "#FFEAA7", label: "橙色" },
];

export const FormatToolbar: FC<Props> = ({ onInsertLink }) => {
  const [position, setPosition] = useState({ x: 0, y: 0, show: false });
  const [openColor, setOpenColor] = useState(false);
  const [openHighlight, setOpenHighlight] = useState(false);

  // 监听选区变化，定位工具栏
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

  /** 执行document.execCommand并触发input事件 */
  const exec = (cmd: string, val?: string) => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    document.execCommand(cmd, false, val);
    if (range && sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
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
      {/* 文字颜色 */}
      <div className="relative">
        <button onMouseDown={(e) => { e.preventDefault(); setOpenColor(!openColor); }} className={btnClass} style={{ color: "var(--text)" }} title="文字颜色">A</button>
        {openColor && <div className="absolute top-8 left-0 flex gap-1 p-1.5 rounded-lg shadow-lg border z-[201]" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          {TEXT_COLORS.map((c) => (
            <button key={c.label} onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c.color || ""); setOpenColor(false); }}
              className="w-6 h-6 rounded border" style={{ backgroundColor: c.color, border: "2px solid var(--border)" }} title={c.label} />
          ))}
        </div>}
      </div>
      {/* 背景颜色 */}
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
};
