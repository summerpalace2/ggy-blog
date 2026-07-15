/**
 * store/block-operations.ts — 块操作逻辑
 * [核心职责] 提供块的增删改查操作：插入、删除、拆分、合并、上移下移
 * [Android 类比] Adapter 的 CRUD 方法
 */

"use client";

import type { Block, BType } from "../types";
import { createBlock, generateId, setCursorToEnd, setCursorToStart } from "../utils";

/**
 * 在指定位置后插入新块
 * @param index - 插入位置的索引
 * @param type - 新块类型，默认 "p"
 * @param html - 新块内容，默认 ""
 * @param blocks - 当前块列表（用于查找新块DOM）
 * @param setBlocks - 状态更新函数
 */
export function insertAfter(
  index: number, type: BType = "p", html: string,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  const newBlock = createBlock(type, html);
  if (type === "ol") newBlock.restartNumbering = false;
  setBlocks((prev) => {
    const updated = [...prev];
    updated.splice(index + 1, 0, newBlock);
    return updated;
  });
  setTimeout(() => {
    const el = document.querySelector(`[data-block="${newBlock.id}"] [contenteditable]`) as HTMLElement;
    if (el) setCursorToEnd(el);
  }, 30);
}

/**
 * 在光标位置拆分块（Enter触发）
 * @param id - 当前块的ID
 * @param afterHtml - 后半部分内容
 * @param blockType - 新块类型，继承列表类型
 * @param fallbackIndex - 快速Enter的兜底索引
 * @param blocks - 当前块列表
 * @param setBlocks - 状态更新函数
 * @param keepOrdered - 新块是否保持ordered属性（用于有序标题/段落Enter后仍生成有序块）
 */
export function splitBlock(
  id: string, afterHtml: string, blockType: BType | undefined, fallbackIndex: number | undefined,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void, keepOrdered?: boolean,
) {
  const inheritTypes = ["ol", "ul", "todo"];
  // keepOrdered时不降级类型，保持原类型+ordered
  const newType: BType = keepOrdered ? (blockType || "p") : (inheritTypes.includes(blockType || "") ? (blockType || "p") : "p");
  const newBlock = createBlock(newType, afterHtml);
  if (newType === "ol") newBlock.restartNumbering = false;
  if (keepOrdered) newBlock.ordered = true;
  // pushSnapshot() removed here - onChange caller already pushed one snapshot
  setBlocks((prev) => {
    let index = prev.findIndex((b) => b.id === id);
        // 快速连续Enter时块可能尚未入state，用fallbackIndex兜底
        if (index < 0 && fallbackIndex !== undefined && fallbackIndex >= 0 && fallbackIndex < prev.length) {
          index = fallbackIndex;
        }
        if (index < 0) return prev;
        const updated = [...prev];
        updated.splice(index + 1, 0, newBlock);
        setTimeout(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-block="${newBlock.id}"] [contenteditable]`) as HTMLElement;
            if (el) setCursorToEnd(el);
          });
        }, 20);
        return updated;
  });
}

/**
 * 删除指定块
 * @param id - 要删除的块ID
 * @param index - 块的索引
 * @param blocks - 当前块列表
 * @param setBlocks - 状态更新函数
 */
export function removeBlock(
  id: string, index: number,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  setBlocks((prev) => {
    if (prev.length <= 1) {
      // 最后一个块：转为空段落，防止编辑器空白
      return [createBlock("p", "")];
    }
    const updated = prev.filter((b) => b.id !== id);
    setTimeout(() => {
      const focusIndex = Math.min(index, updated.length - 1);
      const targetId = updated[focusIndex]?.id;
      const el = targetId ? document.querySelector(`[data-block="${targetId}"] [contenteditable]`) as HTMLElement : null;
      if (el) setCursorToEnd(el);
    }, 10);
    return updated;
  });
}

/**
 * 向上合并（Backspace行首触发）
 * - 空内容：删除当前块
 * - 非空内容：文字合并到上一块（文字守恒：删除块=移动文字）
 */
export function mergeUpward(
  id: string, index: number, content: string,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  setBlocks((prev) => {
    let realIndex = prev.findIndex((b) => b.id === id);
    // id未命中时用传入的index兜底
    if (realIndex < 0 && index >= 0 && index < prev.length && prev[index]?.id === id) {
      realIndex = index;
    }
    if (realIndex < 0) return prev;

    const currentBlock = prev[realIndex];
    const previousBlock = prev[realIndex - 1];
    const updated = [...prev];
    // 判断内容是否为空（纯文本判断，不依赖HTML标签）
    const isEmptyContent = !content.trim();

    // 空内容：删除当前块
    if (isEmptyContent && !["code", "hr", "img", "table"].includes(currentBlock.type)) {
      if (prev.length <= 1) return prev; // 保留最后一个块
      if (["ol", "ul", "todo"].includes(currentBlock.type)) {
        // 列表空块：先转段落（给第二次Backspace的机会）
        updated[realIndex] = { ...currentBlock, type: "p", html: "" };
        setTimeout(() => {
          const el = document.querySelector(`[data-block="${currentBlock.id}"] [contenteditable]`) as HTMLElement;
          if (el) setCursorToEnd(el);
        }, 10);
        return updated;
      }
      updated.splice(realIndex, 1);
      // 聚焦到上方块
      const focusIndex = Math.max(0, realIndex - 1);
      const targetId = updated[focusIndex]?.id;
      setTimeout(() => {
        const el = targetId ? document.querySelector(`[data-block="${targetId}"] [contenteditable]`) as HTMLElement : null;
        if (el) setCursorToEnd(el);
      }, 0);
      return updated;
    }

    // 没有上一块：不合并
    if (realIndex <= 0) return prev;

    // 上一块是不可合并类型：直接删除当前块
    if (["code", "hr", "img", "table"].includes(previousBlock.type)) {
      updated.splice(realIndex, 1);
      return updated;
    }

    // 文字守恒：把当前块文字追加到上一块，然后删除当前块
    // 从DOM读取上一块最新内容（防止防抖导致state滞后）
    const prevEl = document.querySelector(`[data-block="${previousBlock.id}"] [contenteditable]`) as HTMLElement;
    const prevHtml = prevEl?.innerHTML || previousBlock.html;
    updated[realIndex - 1] = { ...previousBlock, html: prevHtml + content };
    updated.splice(realIndex, 1);
    setTimeout(() => {
      const el = document.querySelector(`[data-block="${previousBlock.id}"] [contenteditable]`) as HTMLElement;
      if (el) setCursorToEnd(el);
    }, 10);
    return updated;
  });
}

/**
 * 向下合并（Delete行尾触发）
 */
export function mergeDownward(
  id: string, index: number,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  setBlocks((prev) => {
    const realIndex = prev.findIndex((b) => b.id === id);
    if (realIndex < 0 || realIndex >= prev.length - 1) return prev;

    const currentBlock = prev[realIndex];
    const nextBlock = prev[realIndex + 1];
    const updated = [...prev];

    // 文字守恒：当前块文字+下一块文字→存入下一块，删除当前块
    const nextEl = document.querySelector(`[data-block="${nextBlock.id}"] [contenteditable]`) as HTMLElement;
    const nextHtml = nextEl?.innerHTML || nextBlock.html;
    const currentEl = document.querySelector(`[data-block="${currentBlock.id}"] [contenteditable]`) as HTMLElement;
    const currentHtml = currentEl?.innerHTML || currentBlock.html;
    if (nextHtml) {
      updated[realIndex + 1] = { ...nextBlock, html: currentHtml + nextHtml };
    }
    updated.splice(realIndex, 1);
    setTimeout(() => {
      const el = document.querySelector(`[data-block="${nextBlock.id}"] [contenteditable]`) as HTMLElement;
      if (el) setCursorToEnd(el);
    }, 10);
    return updated;
  });
}

/**
 * 移动块位置（Alt+上下箭头）
 */
export function moveBlock(
  id: string, direction: "up" | "down",
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  setBlocks((prev) => {
    const index = prev.findIndex((b) => b.id === id);
    if (index < 0) return prev;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= prev.length) return prev;
    const updated = [...prev];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    return updated;
  });
}
