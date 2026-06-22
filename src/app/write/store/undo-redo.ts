/**
 * store/undo-redo.ts — 撤销/重做逻辑
 * [核心职责] 从快照栈恢复状态，将当前状态压入反向栈
 */

import type { Block, Snapshot } from "../types";

/**
 * 执行撤销操作
 * @param undoStack - 撤销栈
 * @param redoStack - 重做栈
 * @param blocks - 当前块列表
 * @param titleHtml - 当前标题
 * @param category - 当前分类
 * @param coverImage - 当前封面
 * @returns 新的状态 tuple
 */
export function undo(
  undoStack: Snapshot[], redoStack: Snapshot[],
  blocks: Block[], titleHtml: string, category: string, coverImage: string,
  setUndoStack: React.Dispatch<React.SetStateAction<Snapshot[]>>,
  setRedoStack: React.Dispatch<React.SetStateAction<Snapshot[]>>,
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  setTitleHtml: React.Dispatch<React.SetStateAction<string>>,
  setCategory: React.Dispatch<React.SetStateAction<string>>,
  setCoverImage: React.Dispatch<React.SetStateAction<string>>,
) {
  if (undoStack.length === 0) return;
  const prevSnapshot = undoStack[undoStack.length - 1];
  setRedoStack((p) => [...p, { blocks: JSON.parse(JSON.stringify(blocks)), titleHtml, category, coverImage }]);
  setUndoStack((p) => p.slice(0, -1));
  setBlocks(prevSnapshot.blocks);
  setTitleHtml(prevSnapshot.titleHtml);
  setCategory(prevSnapshot.category);
  setCoverImage(prevSnapshot.coverImage || "");
}

/**
 * 执行重做操作
 */
export function redo(
  undoStack: Snapshot[], redoStack: Snapshot[],
  blocks: Block[], titleHtml: string, category: string, coverImage: string,
  setUndoStack: React.Dispatch<React.SetStateAction<Snapshot[]>>,
  setRedoStack: React.Dispatch<React.SetStateAction<Snapshot[]>>,
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  setTitleHtml: React.Dispatch<React.SetStateAction<string>>,
  setCategory: React.Dispatch<React.SetStateAction<string>>,
  setCoverImage: React.Dispatch<React.SetStateAction<string>>,
) {
  if (redoStack.length === 0) return;
  const nextSnapshot = redoStack[redoStack.length - 1];
  setUndoStack((p) => [...p, { blocks: JSON.parse(JSON.stringify(blocks)), titleHtml, category, coverImage }]);
  setRedoStack((p) => p.slice(0, -1));
  setBlocks(nextSnapshot.blocks);
  setTitleHtml(nextSnapshot.titleHtml);
  setCategory(nextSnapshot.category);
  setCoverImage(nextSnapshot.coverImage || "");
}
