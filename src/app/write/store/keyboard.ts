/**
 * store/keyboard.ts — 全局键盘事件处理
 * [核心职责] 处理全局快捷键（Ctrl+S保存、Ctrl+Z撤销等）、跨块选区删除、Alt+方向键移动块、类型切换快捷键
 * [Android 类比] Activity 级别的 OnKeyListener
 */

import { useCallback, useEffect } from "react";
import type { BType, Shortcuts } from "../types";
import { matchShortcut, createBlock } from "../utils";

interface KeyboardHandlerProps {
  shortcuts: Shortcuts;
  blocks: import("../types").Block[];
  undoStack: import("../types").Snapshot[];
  redoStack: import("../types").Snapshot[];
  titleHtml: string;
  category: string;
  coverImage: string;
  save: () => void;
  undo: () => void;
  redo: () => void;
  removeBlock: (id: string, index: number) => void;
  moveBlock: (id: string, direction: "up" | "down") => void;
  setBlocks: React.Dispatch<React.SetStateAction<import("../types").Block[]>>;
  setBlocksAndPush: (fn: (prev: import("../types").Block[]) => import("../types").Block[]) => void;
}

/**
 * 注册全局键盘事件监听
 */
export function useKeyboardHandlers(props: KeyboardHandlerProps) {
  const {
    shortcuts, blocks, save, undo, redo, removeBlock, moveBlock, setBlocks,
  } = props;

  return useCallback((e: KeyboardEvent) => {
    const active = document.activeElement;
    const isEditable = active instanceof HTMLTextAreaElement
      || (active instanceof HTMLElement && active.contentEditable === "true")
      || active instanceof HTMLInputElement;

    // 全局快捷键
    if (matchShortcut(e, shortcuts.save)) { e.preventDefault(); save(); return; }
    if (matchShortcut(e, shortcuts.undo)) { e.preventDefault(); undo(); return; }
    if (matchShortcut(e, shortcuts.redo)) { e.preventDefault(); redo(); return; }

    // Ctrl+A：全选编辑器内所有内容
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      const root = document.getElementById("editor-root");
      if (root && root.contains(active)) {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel) {
          const r = document.createRange();
          const first = root.querySelector("input") || root.querySelector("[contenteditable]");
          const allEditable = root.querySelectorAll("[contenteditable]");
          const lastEl = allEditable[allEditable.length - 1];
          if (first && lastEl) {
            if (first instanceof HTMLInputElement) r.setStart(first, 0);
            else r.selectNodeContents(first);
            r.collapse(true);
            sel.removeAllRanges(); sel.addRange(r);
            const endR = document.createRange();
            endR.selectNodeContents(lastEl);
            endR.collapse(false);
            sel.extend(endR.endContainer, endR.endOffset);
          }
        }
      }
      return;
    }

    // 判断是否在编辑器内
    const inEditor = !!(active as HTMLElement)?.closest("#editor-root");
    if (!inEditor) return;

    // 跨块选区Delete/Backspace
    if (e.key === "Backspace" || e.key === "Delete") {
      if (e.defaultPrevented) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        const startBlock = (r.startContainer as HTMLElement).closest?.("[data-block]") as HTMLElement | null;
        const endBlock = (r.endContainer as HTMLElement).closest?.("[data-block]") as HTMLElement | null;
        if (startBlock && endBlock && startBlock !== endBlock) {
          e.preventDefault();
          // 用 Range.deleteContents() 直接删除选区DOM节点
          r.deleteContents();
          // 删除后从DOM读取各块新内容，同步到state
          const updated = [...blocks];
          for (const el of document.querySelectorAll("#editor-root [data-block]")) {
            const bid = (el as HTMLElement).dataset.block!;
            const contentEl = el.querySelector("[contenteditable]") as HTMLElement | null;
            const idx = updated.findIndex((b) => b.id === bid);
            if (idx >= 0 && contentEl) {
              updated[idx] = { ...updated[idx], html: contentEl.innerHTML || "" };
            }
          }
          // 移除已变空的块
          const nonEmpty = updated.filter((b) => b.html.replace(/<[^>]+>/g, "").trim() || ["hr","img","code","table","embed","formula"].includes(b.type));
          setBlocks(nonEmpty.length > 0 ? nonEmpty : [createBlock("p")]);
          sel.removeAllRanges();
          setTimeout(() => {
            const first = document.querySelector("#editor-root [data-block] [contenteditable]") as HTMLElement;
            if (first) {
              const range = document.createRange();
              range.selectNodeContents(first);
              range.collapse(false);
              const s = window.getSelection();
              s?.removeAllRanges();
              s?.addRange(range);
            }
          }, 10);
          return;
        }
      }
    }

    // Delete/Backspace：非编辑态时用最近的块
    if (!isEditable && (e.key === "Backspace" || e.key === "Delete")) {
      const blockEl = (active as HTMLElement)?.closest("[data-block]") as HTMLElement;
      if (blockEl) {
        e.preventDefault();
        const bid = blockEl.dataset.block!;
        const idx = blocks.findIndex((b) => b.id === bid);
        if (idx >= 0) removeBlock(bid, idx);
        return;
      }
      // 焦点完全丢失时，用最后一个块
      if (blocks.length > 0) {
        const lastBlock = blocks[blocks.length - 1];
        const el = document.querySelector(`[data-block="${lastBlock.id}"] [contenteditable]`) as HTMLElement;
        if (el) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(range);
        }
      }
      return;
    }

    if (!isEditable) return;

    const blockId = (active as HTMLElement).closest("[data-block]")?.getAttribute("data-block");
    if (!blockId) return;

    // Alt+上下箭头移动块
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveBlock(blockId, e.key === "ArrowUp" ? "up" : "down");
      return;
    }

    // 快捷键切换块类型
    const typeShortcuts: [string, BType][] = [
      [shortcuts.h1, "h1"], [shortcuts.h2, "h2"], [shortcuts.h3, "h3"],
      [shortcuts.h4, "h4"], [shortcuts.h5, "h5"],
      [shortcuts.quote, "quote"], [shortcuts.code, "code"],
    ];
    for (const [sc, type] of typeShortcuts) {
      if (matchShortcut(e, sc)) {
        e.preventDefault();
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, type } : b)));
        active.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    }
  }, [shortcuts, blocks, save, undo, redo, removeBlock, moveBlock, setBlocks]);
}

/**
 * 挂载全局键盘事件监听
 */
export function useGlobalKeyboardListener(handler: (e: KeyboardEvent) => void) {
  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
