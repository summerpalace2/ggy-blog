/**
 * store/link-handler.ts — 链接插入逻辑
 * [核心职责] 处理三种链接模式：行内链接/卡片链接/嵌入预览
 */

import type { Block, BType } from "../types";
import { escapeHtml, createBlock } from "../utils";

/**
 * 创建链接插入处理器
 */
export function createLinkHandler(
  blocks: Block[],
  insertAfter: (index: number, type: BType, html: string) => void,
) {
  return function insertLink(text: string, url: string, mode: string) {
    if (mode === "bookmark") {
      const active = document.activeElement;
      const blockId = (active as HTMLElement)?.closest("[data-block]")?.getAttribute("data-block");
      if (blockId) {
        const index = blocks.findIndex((b) => b.id === blockId);
        if (index >= 0) {
          const cardHtml = `<div style="display:flex;align-items:center;gap:12px;padding:4px 0"><span style="font-size:1.5rem">🔗</span><div><div style="font-weight:600;margin-bottom:2px">${escapeHtml(text || url)}</div><div style="font-size:0.85rem;color:var(--text-muted)">${escapeHtml(url)}</div></div></div>`;
          insertAfter(index, "callout", cardHtml);
          return;
        }
      }
    }
    if (mode === "embed") {
      const active = document.activeElement;
      const blockId = (active as HTMLElement)?.closest("[data-block]")?.getAttribute("data-block");
      if (blockId) {
        const index = blocks.findIndex((b) => b.id === blockId);
        if (index >= 0) { insertAfter(index, "embed", url); return; }
      }
    }
    // 行内链接
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString()) {
      document.execCommand("createLink", false, url);
    } else {
      const el = document.activeElement;
      if (el && (el as HTMLElement).contentEditable === "true") {
        document.execCommand("insertHTML", false, `<a href="${url}">${escapeHtml(text)}</a>`);
      }
    }
    const el = document.activeElement;
    if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
  };
}
