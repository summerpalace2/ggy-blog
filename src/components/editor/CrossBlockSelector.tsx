/**
 * CrossBlockSelector.tsx — 跨段落鼠标拖选组件 v3
 *
 * 核心思路：拖拽时临时将 contentEditable 设为 false，
 * 让浏览器原生 selection 能跨块延伸，选中效果天然精准（逐行逐字）。
 * 松手后恢复 contentEditable 状态，选中文字留在浏览器选区中支持 Ctrl+C / Delete。
 */
"use client";

import { useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function CrossBlockSelector({ children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ moved: boolean; startX: number; startY: number } | null>(null);
  const savedEditable = useRef<Map<HTMLElement, string>>(new Map());

  /** 临时禁用容器内所有 contentEditable，让浏览器能跨块选中 */
  const disableAllEditables = () => {
    const list = containerRef.current?.querySelectorAll("[contenteditable]") as NodeListOf<HTMLElement> | undefined;
    if (!list) return;
    savedEditable.current.clear();
    list.forEach((el) => {
      savedEditable.current.set(el, el.contentEditable);
      el.contentEditable = "false";
    });
  };

  /** 恢复 contentEditable 状态 */
  const restoreAllEditables = () => {
    savedEditable.current.forEach((val, el) => { el.contentEditable = val; });
    savedEditable.current.clear();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragInfo.current = { moved: false, startX: e.clientX, startY: e.clientY };

    // 找到鼠标下的文字节点作为选区起点
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return;

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragInfo.current) return;
    const dx = Math.abs(e.clientX - dragInfo.current.startX);
    const dy = Math.abs(e.clientY - dragInfo.current.startY);
    if (!dragInfo.current.moved && dx < 4 && dy < 4) return;

    if (!dragInfo.current.moved) {
      dragInfo.current.moved = true;
      disableAllEditables(); // 关键：禁用后可跨块
    }

    // 用浏览器原生 extend 延伸选区
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        sel.extend((e.target as Node) || document.body, 0);
      }
    } catch { /* 跨块可能失败，忽略 */ }

    // 用 caretRangeFromPoint 精确延伸选区
    try {
      const point = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (point) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          sel.extend(point.startContainer, point.startOffset);
        }
      }
    } catch { /* ignore */ }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragInfo.current) return;
    const moved = dragInfo.current.moved;
    dragInfo.current = null;

    // 恢复 contentEditable
    restoreAllEditables();

    if (!moved) {
      // 单击：让浏览器正常聚焦 contentEditable
      window.getSelection()?.removeAllRanges();
      return;
    }

    // 选区已由浏览器原生渲染（::selection 高亮）
    // 用户可直接 Ctrl+C 或 Delete/Backspace
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {children}
      </div>
      {/* 仅在拖动时隐藏 contentEditable 蓝光标闪烁 */}
      <style>{`
        #editor-root .cross-dragging [contenteditable] { caret-color: transparent; }
      `}</style>
    </div>
  );
}
