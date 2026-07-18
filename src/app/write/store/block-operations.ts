/**
 * store/block-operations.ts ? ?????
 * [????] ???????????????????????????
 * [Android ??] Adapter ? CRUD ??
 */

"use client";

import { flushSync } from "react-dom";
import type { Block, BType } from "../types";
import { createBlock, requestCursorRestoration, setCursorToOffset, setCursorToStart, setCursorToEnd } from "../utils";


/**
 * ??????????
 * @param index - ???????
 * @param type - ??????? "p"
 * @param html - ??????? ""
 * @param blocks - ????????????DOM?
 * @param setBlocks - ??????
 */
export function insertAfter(
  index: number, type: BType = "p", html: string,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  const newBlock = createBlock(type, html);
  if (type === "ol") newBlock.restartNumbering = false;
  // [Fix flushSync] ??????,??????? React ???? stale closure
  flushSync(() => {
    setBlocks((prev) => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newBlock);
      return updated;
    });
  });
  // DOM ?????,????
  requestCursorRestoration(newBlock.id, "start"); // [Fix] cursor at start of new block after Enter split
  const el = document.querySelector(`[data-block="${newBlock.id}"] [contenteditable]`) as HTMLElement;
  if (el) el.focus();
}

/**
 * ?????????Enter???
 * @param id - ????ID
 * @param afterHtml - ??????
 * @param blockType - ???????????
 * @param fallbackIndex - ??Enter?????
 * @param blocks - ?????
 * @param setBlocks - ??????
 * @param keepOrdered - ??????ordered?????????/??Enter????????
 */
export function splitBlock(
  id: string, afterHtml: string, blockType: BType | undefined, fallbackIndex: number | undefined,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void, keepOrdered?: boolean,
) {
  const inheritTypes = ["ol", "ul", "todo"];
  // keepOrdered????????????+ordered
  const newType: BType = keepOrdered ? (blockType || "p") : (inheritTypes.includes(blockType || "") ? (blockType || "p") : "p");
  const newBlock = createBlock(newType, afterHtml);
  if (newType === "ol") newBlock.restartNumbering = false;
  if (keepOrdered) newBlock.ordered = true;
  pushSnapshot(); // [Fix-B8] restore: snapshot before split for undo history
  // [Fix flushSync] ??????
  flushSync(() => {
    setBlocks((prev) => {
      let index = prev.findIndex((b) => b.id === id);
      // ????Enter???????state??fallbackIndex??
      if (index < 0 && fallbackIndex !== undefined && fallbackIndex >= 0 && fallbackIndex < prev.length) {
        index = fallbackIndex;
      }
      if (index < 0) return prev;
      const updated = [...prev];
      updated.splice(index + 1, 0, newBlock);
      return updated;
    });
  });
  // DOM ?????,?? onFocus ????
  requestCursorRestoration(newBlock.id, "start"); // [Fix] cursor at start of new block after Enter split
  const el = document.querySelector(`[data-block="${newBlock.id}"] [contenteditable]`) as HTMLElement;
  if (el) el.focus();
}

/**
 * ?????
 * @param id - ??????ID
 * @param index - ????
 * @param blocks - ?????
 * @param setBlocks - ??????
 */
export function removeBlock(
  id: string, index: number,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  let targetId: string | undefined;
  // [Fix flushSync] ??????
  flushSync(() => {
    setBlocks((prev) => {
      if (prev.length <= 1) {
        // ???????????????????
        return [createBlock("p", "")];
      }
      const updated = prev.filter((b) => b.id !== id);
      const focusIndex = Math.min(index, updated.length - 1);
      targetId = updated[focusIndex]?.id;
      return updated;
    });
  });
  // DOM ?????,????
  if (targetId) {
    const el = document.querySelector(`[data-block="${targetId}"] [contenteditable]`) as HTMLElement;
    if (el) { el.focus(); setTimeout(() => setCursorToEnd(el), 0); }
  }
}

/**
 * ?????Backspace?????
 * - ?????????
 * - ??????????????????????=?????
 */
export function mergeUpward(
  id: string, index: number, content: string,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  if (!blocks || blocks.length === 0) { return; }
  pushSnapshot();
  const focusTargetArr: { blockId: string; type: "end" | "offset" | "start" | "html"; offset?: number; html?: string }[] = [];
  flushSync(() => {
    setBlocks((prev) => {
      let realIndex = prev.findIndex((b) => b.id === id);
      if (realIndex < 0) realIndex = index >= 0 && index < prev.length ? index : -1;
      if (realIndex < 0) return prev;

      const currentBlock = prev[realIndex];
      if (!currentBlock) return prev;

      const updated = [...prev];
      const isEmptyContent = !content.replace(/<[^>]+>/g, "").trim();

      // [Fix] 当前块为空 + 前一块是特殊块 -> 删前特殊块（hr/img/table/code），当前块保留
      if (isEmptyContent && realIndex > 0 && ["hr", "img", "table", "code"].includes(prev[realIndex - 1].type)) {
        updated.splice(realIndex - 1, 1);
        const newIdx = realIndex - 1;
        focusTargetArr[0] = { blockId: currentBlock.id, type: "start" };
        return updated;
      }

      // [修复] 当前块内容为空 -> 删块；聚焦前一有内容块，若无则找后一块
      if (isEmptyContent && !["code", "hr", "img", "table"].includes(currentBlock.type)) {
        // [Fix-B16] 唯一空列表块退为段落
        if (prev.length <= 1) {
          if (["ol", "ul", "todo"].includes(currentBlock.type)) {
            updated[0] = { ...currentBlock, type: "p" } as Block;
            return updated;
          }
          return prev;
        }
        updated.splice(realIndex, 1);
        let fi = realIndex - 1;
        while (fi >= 0 && !updated[fi]?.html.replace(/<[^>]+>/g, "").trim()) fi--;
        if (fi < 0) fi = Math.min(realIndex, updated.length - 1);
        focusTargetArr[0] = { blockId: updated[fi]?.id || "", type: "end" };
        return updated;
      }

      // 为首块
      if (realIndex <= 0) {
        if (!isEmptyContent) return prev;
        if (prev.length <= 1) return prev;
        updated.splice(0, 1);
        focusTargetArr[0] = { blockId: updated[0]?.id || "", type: "end" };
        return updated;
      }

      const previousBlock = prev[realIndex - 1];

      // [Fix] 前一块是特殊块(hr/img/table/code) → 删前一特殊块，当前块补位（而非删当前块）
      if (["hr", "img", "table", "code"].includes(previousBlock.type)) {
        updated.splice(realIndex - 1, 1);
        // 当前块被提前一位
        const newIdx = realIndex - 1;
        if (newIdx >= 0 && newIdx < updated.length) {
          const curAfter = updated[newIdx];
          // 若当前块有文本内容，拼接到当前块（光标在行首，前面是hr/img已被删）
          if (content && curAfter.type === "p") {
            updated[newIdx] = { ...curAfter, html: curAfter.html + content } as Block;
          }
          focusTargetArr[0] = { blockId: curAfter.id, type: "start" };
        }
        return updated;
      }

      // 正常合并: 前一块非空时拼接内容; 前一块为空时删空块
      // [Fix-B2] 空块不合并: 删空块,当前块上移
      // [Fix-BS] 使用 React state 而非 DOM 读取，避免陈旧内容
      const prevHtml = previousBlock.html;
      const strippedPrevHtml = !prevHtml.replace(/<[^>]+>/g, "").trim() ? "" : prevHtml;
      // [Fix] 前一块为空: 删空块，当前块上移，光标在当前块行首
      if (!strippedPrevHtml) {
        updated.splice(realIndex - 1, 1);
        focusTargetArr[0] = { blockId: currentBlock.id, type: "start" };
        return updated;
      }

      const mergedHtml = strippedPrevHtml + content;
      updated[realIndex - 1] = { ...previousBlock, html: mergedHtml } as Block;
      updated.splice(realIndex, 1);
      // [Fix-B15] offset 使用 stripped 文本长度，不含 <br>
      focusTargetArr[0] = { blockId: previousBlock.id, type: "offset", offset: strippedPrevHtml.replace(/<[^>]+>/g, "").length };
      focusTargetArr[1] = { blockId: previousBlock.id, type: "html", html: mergedHtml };
      return updated;
    });
  });
  // [Fix-ALT] Force DOM sync so useEffect(html) race can't leave DOM stale
  const htmlT = focusTargetArr[1];
  if (htmlT && htmlT.html !== undefined) {
    const tEl = document.querySelector(`[data-block="${htmlT.blockId}"] [contenteditable]`) as HTMLElement;
    if (tEl) {
      if (tEl.innerHTML !== htmlT.html) { tEl.innerHTML = htmlT.html; }
    }
  }
  const ft = focusTargetArr[0];
  if (ft && ft.blockId) {
    const el = document.querySelector(`[data-block="${ft.blockId}"] [contenteditable]`) as HTMLElement;
    if (el) {
      el.focus();
      // [Fix] Direct cursor set with setTimeout to ensure DOM is ready
      // Cancel stale cursor-set timer to avoid apply after DOM changed
      const _cursorEl = el;
      const _cursorFt = ft;
      const _cursorBlockId = ft.blockId;
      setTimeout(() => {
        if (!_cursorEl.isConnected) { return; }
        if (ft.type === "start") setCursorToStart(_cursorEl);
        else if (ft.type === "end") setCursorToEnd(_cursorEl);
        else if (ft.type === "offset" && ft.offset !== undefined) { setCursorToOffset(_cursorEl, ft.offset); }
      }, 0);
    }
  }
}

/**
 * ?????Delete?????
 */
export function mergeDownward(
  id: string, index: number,
  blocks: Block[], setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  let focusBlockId: string | undefined;
  let focusOffset = 0; // [Fix-B9]
  // [Fix flushSync] ??????
  flushSync(() => {
    setBlocks((prev) => {
      const realIndex = prev.findIndex((b) => b.id === id);
      if (realIndex < 0 || realIndex >= prev.length - 1) return prev;

      const currentBlock = prev[realIndex];
      const nextBlock = prev[realIndex + 1];
      const updated = [...prev];

      // ??????????+?????????????????
      // [Fix-BS] 使用 React state 而非 DOM 读取
      const nextHtml = nextBlock.html;
      const currentHtml = currentBlock.html;
      const currentTextLen = currentHtml.replace(/<[^>]+>/g, "").length; // [Fix-B9]


      updated[realIndex + 1] = { ...nextBlock, html: currentHtml + nextHtml };

      updated.splice(realIndex, 1);
      focusBlockId = nextBlock.id;
      focusOffset = currentTextLen; // [Fix-B9] 光标偏移=原当前块文本长度
      return updated;
    });
  });
  // DOM ?????,????
  if (focusBlockId) {
    const el = document.querySelector(`[data-block="${focusBlockId}"] [contenteditable]`) as HTMLElement;
    if (el) { el.focus(); setTimeout(() => setCursorToStart(el), 0); }
  }
}

/**
 * ??????Alt+?????
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
