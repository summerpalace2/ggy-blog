/**
 * utils.ts — 块编辑器工具函数
 * 包含ID生成、HTML/Markdown互转、DOM操作、快捷键
 */
"use client";

import type { Block, BType } from "./types";

// ── ID生成 ──

/** 生成唯一块ID——基于时间戳+随机数，确保Fast Refresh下不重复 */
export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return "b" + ts + rand;
}

/** 创建新块 */
export function createBlock(type: BType, html = ""): Block {
  return { id: generateId(), type, html };
}

// ── HTML转义 ──

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Markdown转换 ──

export function htmlToMarkdown(html: string): string {
  let out = html;
  out = out.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  out = out.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  out = out.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  out = out.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  out = out.replace(/<u>(.*?)<\/u>/gi, "$1");
  out = out.replace(/<s>(.*?)<\/s>/gi, "~~$1~~");
  out = out.replace(/<strike>(.*?)<\/strike>/gi, "~~$1~~");
  out = out.replace(/<del>(.*?)<\/del>/gi, "~~$1~~");
  out = out.replace(/<a\s+href="(.*?)">(.*?)<\/a>/gi, "[$2]($1)");
  out = out.replace(/<code>(.*?)<\/code>/gi, "`$1`");
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/div>/gi, "\n");
  out = out.replace(/<\/p>/gi, "\n\n");
  out = out.replace(/<[^>]+>/g, "");
  out = out.replace(/&nbsp;/g, " ");
  out = out.replace(/&amp;/g, "&");
  out = out.replace(/&lt;/g, "<");
  out = out.replace(/&gt;/g, ">");
  out = out.replace(/&quot;/g, '"');
  return out.trim();
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => {
    const text = htmlToMarkdown(block.html);
    switch (block.type) {
      case "h1": return "# " + text;
      case "h2": return "## " + text;
      case "h3": return "### " + text;
      case "h4": return "#### " + text;
      case "h5": return "##### " + text;
      case "hr": return "---";
      case "code": return "```" + (block.lang || "") + "\n" + (block.html || "") + "\n```";
      case "quote": return "> " + text;
      case "ul": return text.split("\n").filter(Boolean).map((line) => "- " + line).join("\n");
      case "ol": return text.split("\n").filter(Boolean).map((line, i) => (i + 1) + ". " + line).join("\n");
      case "todo": return text.split("\n").filter(Boolean).map((line) => (block.checked ? "- [x] " : "- [ ] ") + line).join("\n");
      case "img": {
        const imgMatch = block.html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
        if (imgMatch) { const alt = (block.html.match(/alt="([^"]*)"/i) || [])[1] || ""; return "![" + alt + "](" + imgMatch[1] + ")"; }
        return block.html;
      }
      case "callout": return "> **" + (text || "提示") + "**\n> ";
      case "toggle": {
        const innerContent = block.toggleContent ? htmlToMarkdown(block.toggleContent) : "";
        return "> " + text + (innerContent ? "\n>\n> " + innerContent.replace(/\n/g, "\n> ") : "");
      }
      case "formula": return "$$\n" + (block.html || "") + "\n$$";
      case "embed": return block.html;
      case "table": return text;
      default: return text;
    }
  }).join("\n\n");
}

export function detectMarkdownShortcut(trimmed: string): { type: BType; html: string } | null {
  const shortcutMap: Record<string, BType> = { "##": "h2", "###": "h3", ">": "quote", "-": "ul", "---": "hr", "```": "code", "[]": "todo", "[ ]": "todo", ">>": "toggle", "$$": "formula" };
  if (shortcutMap[trimmed] !== undefined) return { type: shortcutMap[trimmed], html: "" };
  if (/^\d+\.\s*$/.test(trimmed)) return { type: "ol", html: "" };
  if (trimmed.startsWith("## ") && trimmed.length > 3) return { type: "h2", html: escapeHtml(trimmed.slice(3)) };
  if (trimmed.startsWith("### ") && trimmed.length > 4) return { type: "h3", html: escapeHtml(trimmed.slice(4)) };
  if (trimmed.startsWith("> ") && trimmed.length > 2) return { type: "quote", html: escapeHtml(trimmed.slice(2)) };
  if (trimmed.startsWith("- ") && trimmed.length > 2) return { type: "ul", html: escapeHtml(trimmed.slice(2)) };
  if ((trimmed.startsWith("[ ] ") || trimmed.startsWith("[] ")) && trimmed.length > 3) return { type: "todo", html: escapeHtml(trimmed.slice(4)) };
  if (/^\d+\.\s/.test(trimmed)) return { type: "ol", html: escapeHtml(trimmed.replace(/^\d+\.\s*/, "")) };
  if (/^\|.+\|.*\|/.test(trimmed)) return { type: "table", html: escapeHtml(trimmed) };
  return null;
}

export function markdownToBlocks(raw: string): Block[] {
  const parseInline = (text: string) => {
    let html = escapeHtml(text);
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`(.+?)`/g, "<code>$1</code>");
    html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");
    return html;
  };
  const blocks: Block[] = [];
  const sections = raw.replace(/\r\n/g, "\n").split(/\n\n+/);
  let cursor = 0;
  while (cursor < sections.length) {
    const section = sections[cursor].trim();
    if (!section) { cursor++; continue; }
    const lines = section.split("\n");
    const firstLine = lines[0];
    if (firstLine.startsWith("# ")) { blocks.push(createBlock("h1", parseInline(firstLine.slice(2) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "")))); cursor++; continue; }
    if (firstLine.startsWith("## ")) { blocks.push(createBlock("h2", parseInline(firstLine.slice(3) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "")))); cursor++; continue; }
    if (firstLine.startsWith("### ")) { blocks.push(createBlock("h3", parseInline(firstLine.slice(4) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "")))); cursor++; continue; }
    if (firstLine.startsWith("#### ")) { blocks.push(createBlock("h4", parseInline(firstLine.slice(5) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "")))); cursor++; continue; }
    if (firstLine.startsWith("##### ")) { blocks.push(createBlock("h5", parseInline(firstLine.slice(6) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "")))); cursor++; continue; }
    if (firstLine.startsWith("> ")) { blocks.push(createBlock("quote", parseInline(lines.map((l) => l.startsWith("> ") ? l.slice(2) : l).join("\n")))); cursor++; continue; }
    if (firstLine.startsWith("```")) { const lang = firstLine.slice(3).trim() || undefined; let code = ""; cursor++; while (cursor < sections.length && !sections[cursor].trim().startsWith("```")) { code += (code ? "\n" : "") + sections[cursor].trimEnd(); cursor++; } if (cursor < sections.length) cursor++; blocks.push({ id: generateId(), type: "code", html: code, lang }); continue; }
    if (lines.every((l) => l.startsWith("- [ ] ") || l.startsWith("- [x] "))) { for (const line of lines) { const c = line.startsWith("- [x] "); blocks.push({ id: generateId(), type: "todo", html: parseInline(c ? line.slice(6) : line.slice(6)), checked: c }); } cursor++; continue; }
    if (/^- /.test(firstLine)) { let j = 0; while (j < lines.length) { if (/^- /.test(lines[j])) { blocks.push(createBlock("ul", parseInline(lines[j].slice(2)))); } else if (blocks.length > 0 && blocks[blocks.length - 1].type === "ul") { blocks[blocks.length - 1].html += "\n" + parseInline(lines[j]); } j++; } cursor++; continue; }
    if (/^\d+\.\s/.test(firstLine)) { let j = 0; while (j < lines.length) { if (/^\d+\.\s/.test(lines[j])) { blocks.push(createBlock("ol", parseInline(lines[j].replace(/^\d+\.\s*/, "")))); } else if (blocks.length > 0 && blocks[blocks.length - 1].type === "ol") { blocks[blocks.length - 1].html += "\n" + parseInline(lines[j]); } j++; } cursor++; continue; }
    if (firstLine.startsWith("|") && lines.length >= 2) { blocks.push(createBlock("table", parseInline(section))); cursor++; continue; }
    if (firstLine === "---" || firstLine === "***" || firstLine === "___") { blocks.push(createBlock("hr")); cursor++; continue; }
    if (firstLine.startsWith("![")) { const m = firstLine.match(/^!\[(.*)\]\((.*)\)/); if (m) { blocks.push(createBlock("img", imageBlockHtml(m[2], m[1]))); cursor++; continue; } }
    if (firstLine.startsWith("$$") && lines.length >= 2 && lines[lines.length - 1].trim() === "$$") { blocks.push(createBlock("formula", parseInline(lines.slice(1, -1).join("\n")))); cursor++; continue; }
    blocks.push(createBlock("p", parseInline(section))); cursor++;
  }
  return blocks.length > 0 ? blocks : [createBlock("p")];
}

// ── DOM操作 ──

export function getCursorOffset(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return 0;
  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

export function splitHtmlAtCursor(el: HTMLElement): { before: string; after: string } {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return { before: "", after: "" };
  const range = sel.getRangeAt(0);
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const beforeDiv = document.createElement("div");
  beforeDiv.appendChild(beforeRange.cloneContents());
  const afterRange = document.createRange();
  afterRange.selectNodeContents(el);
  afterRange.setStart(range.startContainer, range.startOffset);
  const afterDiv = document.createElement("div");
  afterDiv.appendChild(afterRange.cloneContents());
  return { before: beforeDiv.innerHTML, after: afterDiv.innerHTML };
}

export function setCursorToEnd(el: HTMLElement) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const s = window.getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
}

export function setCursorToStart(el: HTMLElement) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(true);
  const s = window.getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
}

export function setCursorToOffset(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let charCount = 0;
  let found = false;
  function traverse(node: Node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (charCount + len >= offset) {
        range.setStart(node, offset - charCount);
        range.collapse(true);
        found = true;
        return;
      }
      charCount += len;
    } else {
      for (const child of Array.from(node.childNodes)) {
        traverse(child);
        if (found) return;
      }
    }
  }
  traverse(el);
  if (!found) { range.selectNodeContents(el); range.collapse(false); }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function highlightCode(code: string, lang?: string): string {
  if (!code.trim()) return "";
  try {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
    return hljs.highlightAuto(code).value;
  } catch { return escapeHtml(code); }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function imageBlockHtml(src: string, alt: string): string {
  return `<img src="${src}" alt="${escapeHtml(alt)}" style="max-width:100%;border-radius:8px" />`;
}

export function wrapCodeLines(highlighted: string, code: string): string {
  const lines = code.split("\n");
  const htmlLines = highlighted.split("\n");
  return lines.map((_, i) => `<span class="line">${htmlLines[i] || " "}</span>`).join("\n");
}

// ── 快捷键 ──

import hljs from "highlight.js";
import { DEFAULT_SHORTCUTS, type Shortcuts } from "./types";

export function loadShortcuts(): Shortcuts {
  try { const s = localStorage.getItem("w-sc"); return s ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(s) } : DEFAULT_SHORTCUTS; }
  catch { return DEFAULT_SHORTCUTS; }
}

export function saveShortcuts(shortcuts: Shortcuts) {
  localStorage.setItem("w-sc", JSON.stringify(shortcuts));
}

export function matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+");
  return (!!event.ctrlKey || !!event.metaKey) === parts.includes("ctrl")
    && !!event.shiftKey === parts.includes("shift")
    && !!event.altKey === parts.includes("alt")
    && event.key.toLowerCase() === parts[parts.length - 1];
}

// ── Cursor Restoration (用于可靠的跨块光标恢复) ──

export type CursorPosition = 'start' | 'end' | 'offset';

let _pendingCursor: { blockId: string; type: CursorPosition; offset?: number } | null = null;

/**
 * 请求光标恢复。实际恢复在 ContentEditableArea 的 onFocus 中执行。
 * 原理: focus() 是异步的，会重置光标到位置 0。
 *       用 onFocus 事件覆盖可确保光标在浏览器完成 focus 处理后设置。
 */
export function requestCursorRestoration(blockId: string, type: CursorPosition, offset?: number): void {
  _pendingCursor = { blockId, type, offset };
  console.log("[requestCursor] blockId=" + blockId + " type=" + type + " offset=" + offset);
}

/**
 * 应用待处理的光标恢复。在 ContentEditableArea 的 onFocus 中调用。
 * 返回 true 表示已应用 pending 恢复。
 */
export function applyPendingCursorRestoration(blockId: string, el: HTMLElement): boolean {
  if (_pendingCursor && _pendingCursor.blockId === blockId) {
    const { type, offset } = _pendingCursor;
    _pendingCursor = null;
    if (type === 'start') {
      setCursorToStart(el);
    } else if (type === 'end') {
      setCursorToEnd(el);
    } else if (type === 'offset' && offset !== undefined) {
      setCursorToOffset(el, offset);
    }
    return true;
  }
  return false;
}

export function clearPendingCursorRestoration(): void {
  _pendingCursor = null;
}