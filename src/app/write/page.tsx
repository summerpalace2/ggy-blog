/**
 * write/page.tsx — 飞书云文档风格的块级编辑器
 *
 * [核心职责]
 * 1. 提供基于 Block 模型的富文本编辑器，每个段落/标题/列表/代码/图片等都是一个 Block
 * 2. 左侧悬停操作区：空行显示+号切换类型，有内容显示类型图标
 * 3. / 命令：在任意块内输入 / 快速打开类型选择器
 * 4. 格式化工具栏：选中文字时弹出B/I/U/S/颜色/链接
 * 5. 拖拽排序、撤销重做、Markdown导入导出、链接浮窗
 *
 * [删除规则]
 * - 标题行首Backspace：有内容→退化为正文，再按→删除块；空标题→直接删除
 * - 引用块行首Backspace：有文字→删字符，空白→删框
 * - 任何空行Backspace→直接删除整行
 * - 非空行Backspace→文字合并到上一段
 *
 * [有序列表编号规则]
 * - 连续ol块共享递增编号，遇非ol块自动重新计数
 * - 点击列表序号可手动"重新开始编号"或"继续上一组编号"
 */

"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import hljs from "highlight.js";
import katex from "katex";

// ═══════════════════════════════════════════════════════════════
//  类型定义
// ═══════════════════════════════════════════════════════════════

/** 块类型枚举：16种飞书文档块 */
type BType = "h1" | "h2" | "h3" | "h4" | "h5" | "p" | "quote" | "code" | "hr" | "ul" | "ol" | "todo" | "img" | "callout" | "table" | "toggle" | "formula" | "embed";

/** 编辑器内容块 */
interface Block {
  id: string;
  type: BType;
  html: string;                             // 富文本内容（innerHTML）
  checked?: boolean;                        // todo 复选框
  lang?: string;                            // 代码块语言
  calloutType?: "info" | "tip" | "warning" | "danger";
  collapsed?: boolean;                      // toggle 折叠
  toggleContent?: string;                   // toggle 折叠内容
  imgWidth?: number;                        // 图片宽度百分比，默认100
  restartNumbering?: boolean;               // ol块：是否重新开始编号（手动控制）
}

/** 撤销快照 */
interface Snapshot {
  blocks: Block[];
  titleHtml: string;
  category: string;
  coverImage: string;
}

// ═══════════════════════════════════════════════════════════════
//  工具函数：ID生成、HTML转义、Markdown转换
// ═══════════════════════════════════════════════════════════════


let _idCounter = 0; // SSR回退计数器
/** 生成唯一块ID——计数器挂在window上防热重载重置 */
const generateId = (): string => {
  if (typeof window !== "undefined") {
    const w = window as any;
    w.__bid = (w.__bid || 0) + 1;
    return "b" + w.__bid.toString(36);
  }
  return "b" + (++_idCounter).toString(36).padStart(3, "0");
};

/** 创建新块 */
const createBlock = (type: BType, html = ""): Block => ({ id: generateId(), type, html });

/** HTML实体转义 */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 将innerHTML转换为Markdown纯文本 */
function htmlToMarkdown(html: string): string {
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

/** 将Block数组转为Markdown全文（用于保存和复制） */
function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => {
    const text = htmlToMarkdown(block.html);
    switch (block.type) {
      case "h1": return "# " + text;
      case "h2": return "## " + text;
      case "h3": return "### " + text;
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

/**
 * 检测行首Markdown触发符（# → 标题, - → 列表, > → 引用等）
 * 用于Enter换行时自动识别下一行的块类型
 */
function detectMarkdownShortcut(trimmed: string): { type: BType; html: string } | null {
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

/**
 * 将Markdown文本解析为Block数组（用于导入/粘贴）
 * 按双换行分段，每段识别类型后创建对应Block
 */
function markdownToBlocks(raw: string): Block[] {
  /** 内联格式转换：Markdown → HTML */
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

    // ── 标题 ──
    if (firstLine.startsWith("# ")) {
      const content = firstLine.slice(2) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "");
      blocks.push(createBlock("h1", parseInline(content)));
      cursor++; continue;
    }
    if (firstLine.startsWith("## ")) {
      const content = firstLine.slice(3) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "");
      blocks.push(createBlock("h2", parseInline(content)));
      cursor++; continue;
    }
    if (firstLine.startsWith("### ")) {
      const content = firstLine.slice(4) + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "");
      blocks.push(createBlock("h3", parseInline(content)));
      cursor++; continue;
    }

    // ── 引用 ──
    if (firstLine.startsWith("> ")) {
      const content = lines.map((l) => l.startsWith("> ") ? l.slice(2) : l).join("\n");
      blocks.push(createBlock("quote", parseInline(content)));
      cursor++; continue;
    }

    // ── 代码块 ──
    if (firstLine.startsWith("```")) {
      const lang = firstLine.slice(3).trim() || undefined;
      let codeContent = "";
      cursor++;
      while (cursor < sections.length && !sections[cursor].trim().startsWith("```")) {
        codeContent += (codeContent ? "\n" : "") + sections[cursor].trimEnd();
        cursor++;
      }
      if (cursor < sections.length) cursor++; // 跳过闭合的```
      blocks.push({ id: generateId(), type: "code", html: codeContent, lang });
      continue;
    }

    // ── 待办列表：每行独立为块 ──
    if (lines.every((l) => l.startsWith("- [ ] ") || l.startsWith("- [x] "))) {
      for (const line of lines) {
        const isChecked = line.startsWith("- [x] ");
        const content = isChecked ? line.slice(6) : line.slice(6);
        blocks.push({ id: generateId(), type: "todo", html: parseInline(content), checked: isChecked });
      }
      cursor++; continue;
    }

    // ── 无序列表：以 - 开头的行独立为块，其他行视为续行追加到上一项 ──
    if (/^- /.test(firstLine)) {
      let lineIdx = 0;
      while (lineIdx < lines.length) {
        if (/^- /.test(lines[lineIdx])) {
          blocks.push(createBlock("ul", parseInline(lines[lineIdx].slice(2))));
        } else if (blocks.length > 0 && blocks[blocks.length - 1].type === "ul") {
          blocks[blocks.length - 1].html += "\n" + parseInline(lines[lineIdx]);
        }
        lineIdx++;
      }
      cursor++; continue;
    }

    // ── 有序列表：以数字.开头的行独立为块，其他行视为续行 ──
    if (/^\d+\.\s/.test(firstLine)) {
      let lineIdx = 0;
      while (lineIdx < lines.length) {
        if (/^\d+\.\s/.test(lines[lineIdx])) {
          blocks.push(createBlock("ol", parseInline(lines[lineIdx].replace(/^\d+\.\s*/, ""))));
        } else if (blocks.length > 0 && blocks[blocks.length - 1].type === "ol") {
          blocks[blocks.length - 1].html += "\n" + parseInline(lines[lineIdx]);
        }
        lineIdx++;
      }
      cursor++; continue;
    }

    // ── 表格 ──
    if (firstLine.startsWith("|") && lines.length >= 2) {
      blocks.push(createBlock("table", parseInline(section)));
      cursor++; continue;
    }

    // ── 分割线 ──
    if (firstLine === "---" || firstLine === "***" || firstLine === "___") {
      blocks.push(createBlock("hr"));
      cursor++; continue;
    }

    // ── 图片 ──
    if (firstLine.startsWith("![")) {
      const imgMatch = firstLine.match(/^!\[(.*)\]\((.*)\)/);
      if (imgMatch) {
        blocks.push(createBlock("img", imageBlockHtml(imgMatch[2], imgMatch[1])));
        cursor++; continue;
      }
    }

    // ── 公式 ──
    if (firstLine.startsWith("$$") && lines.length >= 2 && lines[lines.length - 1].trim() === "$$") {
      blocks.push(createBlock("formula", parseInline(lines.slice(1, -1).join("\n"))));
      cursor++; continue;
    }

    // ── 默认：普通段落 ──
    blocks.push(createBlock("p", parseInline(section)));
    cursor++;
  }

  return blocks.length > 0 ? blocks : [createBlock("p")];
}

// ═══════════════════════════════════════════════════════════════
//  DOM操作工具
// ═══════════════════════════════════════════════════════════════

/** 获取光标在contentEditable容器中的字符偏移量 */
function getCursorOffset(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return 0;
  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

/** 在光标位置拆分contentEditable内容，返回前半部分和后半部分的HTML */
function splitHtmlAtCursor(el: HTMLElement): { before: string; after: string } {
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

/** 将光标移到contentEditable末尾 */
function setCursorToEnd(el: HTMLElement) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const s = window.getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
}

/** 在contentEditable中按字符偏移恢复光标位置（用于块类型切换后保留光标） */
function restoreCursorByOffset(editable: HTMLElement, offset: number) {
  try {
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const len = node.textContent?.length || 0;
      if (charCount + len >= offset) {
        const r = document.createRange();
        r.setStart(node, Math.min(offset - charCount, len));
        r.collapse(true);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
        return;
      }
      charCount += len;
    }
    setCursorToEnd(editable); // 回退：光标放末尾
  } catch { setCursorToEnd(editable); }
}

/** 代码高亮 */
function highlightCode(code: string, lang?: string): string {
  if (!code.trim()) return "";
  try {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
    return hljs.highlightAuto(code).value;
  } catch { return escapeHtml(code); }
}

/** 文件转dataUrl */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** 生成图片块HTML */
function imageBlockHtml(src: string, alt: string): string {
  return `<img src="${src}" alt="${escapeHtml(alt)}" style="max-width:100%;border-radius:8px" />`;
}

/** 为代码行添加行号包装 */
function wrapCodeLines(highlighted: string, code: string): string {
  const lines = code.split("\n");
  const htmlLines = highlighted.split("\n");
  return lines.map((_, i) => `<span class="line">${htmlLines[i] || " "}</span>`).join("\n");
}

// ═══════════════════════════════════════════════════════════════
//  常量
// ═══════════════════════════════════════════════════════════════

/** 所有可用块类型的元数据 */
const BLOCK_TYPES: { type: BType; label: string; icon: string; desc: string }[] = [
  { type: "h1", label: "大标题", icon: "H1", desc: "页面大标题" },
  { type: "h2", label: "二级标题", icon: "H2", desc: "章节标题" },
  { type: "h3", label: "三级标题", icon: "H3", desc: "小节标题" },
  { type: "h4", label: "四级标题", icon: "H4", desc: "子节标题" },
  { type: "h5", label: "五级标题", icon: "H5", desc: "次级标题" },
  { type: "p", label: "正文", icon: "¶", desc: "普通段落" },
  { type: "quote", label: "引用", icon: "❝", desc: "引用块" },
  { type: "code", label: "代码块", icon: "</>", desc: "语法高亮" },
  { type: "ul", label: "无序列表", icon: "•••", desc: "项目符号列表" },
  { type: "ol", label: "有序列表", icon: "1.", desc: "编号列表" },
  { type: "todo", label: "待办清单", icon: "☑", desc: "任务列表" },
  { type: "callout", label: "提示框", icon: "💡", desc: "高亮提示" },
  { type: "table", label: "表格", icon: "⊞", desc: "插入表格" },
  { type: "hr", label: "分割线", icon: "—", desc: "水平分割线" },
  { type: "img", label: "图片", icon: "🖼", desc: "拖拽/粘贴/URL" },
  { type: "toggle", label: "折叠列表", icon: "▶", desc: "可折叠内容" },
  { type: "formula", label: "数学公式", icon: "∑", desc: "LaTeX 公式" },
  { type: "embed", label: "嵌入网页", icon: "🌐", desc: "iframe 嵌入" },
];

/** 提示框预设样式 */
const CALLOUT_PRESETS = {
  info: { icon: "💡", bg: "rgba(107,143,113,0.1)", border: "rgba(107,143,113,0.2)", label: "信息" },
  tip: { icon: "ℹ️", bg: "rgba(100,149,237,0.1)", border: "rgba(100,149,237,0.2)", label: "技巧" },
  warning: { icon: "⚠️", bg: "rgba(255,193,7,0.1)", border: "rgba(255,193,7,0.2)", label: "注意" },
  danger: { icon: "❌", bg: "rgba(220,53,69,0.1)", border: "rgba(220,53,69,0.2)", label: "危险" },
} as const;

// ═══════════════════════════════════════════════════════════════
//  快捷键
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SHORTCUTS: Record<string, string> = {
  save: "Ctrl+S", bold: "Ctrl+B", italic: "Ctrl+I", underline: "Ctrl+U",
  h1: "Ctrl+Shift+1", h2: "Ctrl+Shift+2", h3: "Ctrl+Shift+3",
  h4: "Ctrl+Shift+4", h5: "Ctrl+Shift+5",
  quote: "Ctrl+Shift+Q", code: "Ctrl+Shift+K", undo: "Ctrl+Z", redo: "Ctrl+Shift+Z",
};
type Shortcuts = typeof DEFAULT_SHORTCUTS;

/** 从localStorage加载快捷键配置 */
function loadShortcuts(): Shortcuts {
  try { const stored = localStorage.getItem("w-sc"); return stored ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) } : DEFAULT_SHORTCUTS; }
  catch { return DEFAULT_SHORTCUTS; }
}

/** 保存快捷键配置到localStorage */
function saveShortcuts(shortcuts: Shortcuts) {
  localStorage.setItem("w-sc", JSON.stringify(shortcuts));
}

/** 匹配键盘事件是否命中快捷键 */
function matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+");
  return (!!event.ctrlKey || !!event.metaKey) === parts.includes("ctrl")
    && !!event.shiftKey === parts.includes("shift")
    && !!event.altKey === parts.includes("alt")
    && event.key.toLowerCase() === parts[parts.length - 1];
}

// ═══════════════════════════════════════════════════════════════
//  ContentEditable 核心组件
// ═══════════════════════════════════════════════════════════════

/**
 * 通用contentEditable可编辑区域
 * 支持防抖onChange、图片粘贴/拖拽、链接自动识别、placeholder
 */
function ContentEditableArea({ html, onChange, onKeyDown, onPasteImg, onDropImg, className, style, placeholder, innerRef, onFocus, onBlur, spellCheck }: {
  html: string;
  onChange: (html: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPasteImg?: (file: File) => void;
  onDropImg?: (file: File) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
  onFocus?: () => void;
  onBlur?: () => void;
  spellCheck?: boolean;
}) {
  const ref = innerRef || useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const prevHtml = useRef(html);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtml = useRef<string | null>(null);

  // 初始化：同步外部html到DOM
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
      prevHtml.current = html;
    }
  }, []);

  // 外部html变化时同步到DOM（跳过内部触发的更新）
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      prevHtml.current = html;
      return;
    }
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      pendingHtml.current = null;
    }
    if (ref.current && html !== prevHtml.current) {
      ref.current.innerHTML = html;
      prevHtml.current = html;
    }
  }, [html]);

  /** 用户输入处理：300ms防抖后上报 */
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newHtml = e.currentTarget.innerHTML;
    pendingHtml.current = newHtml;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      const pending = pendingHtml.current;
      if (pending !== null && ref.current && ref.current.innerHTML === pending) {
        isInternalUpdate.current = true;
        prevHtml.current = pending;
        onChange(pending);
      }
      pendingHtml.current = null;
    }, 300);
  };

  /** 失焦时立即提交未上报的内容 */
  const flushDebounce = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      const pending = pendingHtml.current;
      if (pending !== null && ref.current && ref.current.innerHTML === pending) {
        isInternalUpdate.current = true;
        prevHtml.current = pending;
        onChange(pending);
      }
      pendingHtml.current = null;
    }
  };

  /** 粘贴处理：图片优先，然后URL自动链接 */
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (onPasteImg) {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) onPasteImg(file);
            return;
          }
        }
      }
    }
    const text = e.clipboardData?.getData("text/plain");
    if (text && /^https?:\/\/\S+$/.test(text.trim())) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        e.preventDefault();
        document.execCommand("createLink", false, text.trim());
      } else {
        e.preventDefault();
        document.execCommand("insertHTML", false, `<a href="${text.trim()}">${text.trim()}</a>`);
      }
      const active = document.activeElement;
      if (active) active.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { if (onDropImg) e.preventDefault(); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onDropImg) return;
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) onDropImg(file);
  };

  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      onInput={handleInput} onKeyDown={onKeyDown} onPaste={handlePaste}
      onDragOver={handleDragOver} onDrop={handleDrop}
      onFocus={onFocus} onBlur={() => { flushDebounce(); onBlur?.(); }}
      className={className} style={style} spellCheck={spellCheck ?? false}
      data-placeholder={placeholder || ""}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
//  格式化工具栏（选中文字时浮现）
// ═══════════════════════════════════════════════════════════════

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

/** 选中文字时浮现在选区上方的格式化工具条 */
function FormatToolbar({ onInsertLink }: { onInsertLink?: () => void }) {
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

  /** 执行document.execCommand并触发input事件 */
  const exec = (cmd: string, val?: string) => {
    // 保存选区范围
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    document.execCommand(cmd, false, val);
    // 恢复选区，让用户直观看到效果
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
}

// ═══════════════════════════════════════════════════════════════
//  类型选择弹窗（+按钮和/命令共用）
// ═══════════════════════════════════════════════════════════════

function TypePicker({ open, position, onSelect, onClose, currentType }: {
  open: boolean; position: { x: number; y: number }; onSelect: (t: BType) => void; onClose: () => void; currentType?: BType;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = query.trim()
    ? BLOCK_TYPES.filter((t) => t.label.includes(query) || t.type.includes(query) || t.desc.includes(query))
    : BLOCK_TYPES;

  return (
    <>
      <div className="fixed inset-0 z-[98]" onClick={onClose} />
      <div className="fixed z-[99] w-64 rounded-xl border shadow-lg overflow-hidden"
        style={{
          left: Math.min(position.x, window.innerWidth - 280),
          top: Math.min(position.y, window.innerHeight - 440),
          backgroundColor: "var(--bg-card)", borderColor: "var(--border)",
        }}>
        {/* 搜索框 */}
        <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border-light)" }}>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索块类型…"
            className="w-full px-2 py-1.5 rounded-md border font-sans text-xs outline-none"
            style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        </div>
        {/* 类型列表 */}
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.map((t) => (
            <button key={t.type} onMouseDown={(e) => { e.preventDefault(); onSelect(t.type); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text)", backgroundColor: t.type === currentType ? "var(--bg-subtle)" : "transparent" }}>
              {t.type === currentType && <span style={{ color: "var(--accent)", fontSize: 10, marginRight: -4 }}>✓</span>}
              <span className="w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold"
                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {t.icon}
              </span>
              <div className="flex-1">
                <div className="font-sans text-sm">{t.label}</div>
                <div className="font-sans text-[10px]" style={{ color: "var(--text-muted)" }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  大纲目录（页面左侧常驻）
// ═══════════════════════════════════════════════════════════════

function FloatingTOC({ blocks }: { blocks: Block[] }) {
  const [activeId, setActiveId] = useState("");

  // IntersectionObserver: 滚动时高亮当前可见的标题
  useEffect(() => {
    const headings = document.querySelectorAll("[data-heading]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveId((entry.target as HTMLElement).closest("[data-block]")?.getAttribute("data-block") || "");
        }
      }
    }, { rootMargin: "-80px 0px -80% 0px" });
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [blocks]);

  // 提取所有标题块（H1/H2/H3）
  const tocItems = blocks
    .filter((b) => ["h1", "h2", "h3", "h4", "h5"].includes(b.type))
    .map((b) => ({ id: b.id, level: Number(b.type[1]), text: htmlToMarkdown(b.html) || "无标题" }));

  return (
    <div className="fixed left-[max(0px,calc((100vw-1100px)/2-220px))] top-24 w-52" style={{ zIndex: 10 }}>
      <div className="text-base font-sans font-semibold mb-4" style={{ color: "var(--text)" }}>目录</div>
      <div className="space-y-2.5">
        {tocItems.length === 0 ? (
          <div className="font-sans" style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>暂无标题</div>
        ) : (
          tocItems.map((item) => (
            <a key={item.id}
              onClick={(e) => {
                e.preventDefault();
                const el = document.querySelector(`[data-block="${item.id}"]`);
                if (el) {
                  // 80px偏移防止被顶部工具栏遮挡
                  const top = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top, behavior: "smooth" });
                }
              }}
              className="block font-sans truncate transition-colors cursor-pointer hover:text-[var(--accent)] leading-relaxed"
              style={{
                fontSize: "1rem",
                paddingLeft: (item.level - 1) * 18,
                color: activeId === item.id ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: activeId === item.id ? 600 : 400,
              }}>
              {item.text || "无标题"}
            </a>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  弹窗组件：快捷键设置、链接对话框、图片灯箱、MarkDown导入
// ═══════════════════════════════════════════════════════════════

function ShortcutModal({ open, onClose, shortcuts, setShortcuts }: {
  open: boolean; onClose: () => void; shortcuts: Shortcuts; setShortcuts: (s: Shortcuts) => void;
}) {
  if (!open) return null;
  const labels: Record<string, string> = { save: "保存", bold: "加粗", italic: "斜体", underline: "下划线", h1: "大标题", h2: "二级标题", h3: "三级标题", quote: "引用", code: "代码", undo: "撤销", redo: "重做" };
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between">
          <h3 className="font-sans text-sm font-bold">快捷键</h3>
          <button onClick={onClose} className="btn-ghost text-xs">✕</button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {Object.entries(shortcuts).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1.5 px-2 rounded" style={{ backgroundColor: "var(--bg-subtle)" }}>
              <span className="font-sans text-xs" style={{ color: "var(--text-secondary)" }}>{labels[key] || key}</span>
              <button onClick={() => {
                const newVal = prompt(`修改快捷键：${labels[key] || key}`, value);
                if (newVal?.trim()) {
                  const updated = { ...shortcuts, [key]: newVal.trim() };
                  setShortcuts(updated);
                  saveShortcuts(updated);
                }
              }}
                className="font-mono text-xs px-2 py-0.5 rounded border cursor-pointer"
                style={{ color: "var(--accent)", backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
                {value}
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => { setShortcuts(DEFAULT_SHORTCUTS); saveShortcuts(DEFAULT_SHORTCUTS); }}
          className="w-full font-sans text-xs py-1.5 rounded hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }}>
          恢复默认
        </button>
      </div>
    </div>
  );
}

/** 链接插入对话框：支持行内链接/卡片链接/嵌入预览三种模式 */
function LinkDialog({ open, onClose, onInsert }: {
  open: boolean; onClose: () => void; onInsert: (text: string, url: string, mode: string) => void;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("inline");

  useEffect(() => { if (open) { setText(window.getSelection()?.toString() || ""); setUrl(""); setMode("inline"); } }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-sans text-sm font-bold">插入链接</h3>
        {/* 模式切换 */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <button onClick={() => setMode("inline")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium"
            style={{ backgroundColor: mode === "inline" ? "var(--bg-card)" : "transparent", color: mode === "inline" ? "var(--accent)" : "var(--text-muted)" }}>行内链接</button>
          <button onClick={() => setMode("bookmark")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium"
            style={{ backgroundColor: mode === "bookmark" ? "var(--bg-card)" : "transparent", color: mode === "bookmark" ? "var(--accent)" : "var(--text-muted)" }}>卡片链接</button>
          <button onClick={() => setMode("embed")} className="flex-1 px-2 py-1 rounded font-sans text-xs font-medium"
            style={{ backgroundColor: mode === "embed" ? "var(--bg-card)" : "transparent", color: mode === "embed" ? "var(--accent)" : "var(--text-muted)" }}>嵌入预览</button>
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "inline" ? "显示文本" : "链接标题"} autoFocus
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
          className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none"
          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-xs">取消</button>
          <button onClick={() => { if (url.trim()) { onInsert(text || url, url, mode); onClose(); } }}
            className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white"
            style={{ backgroundColor: "var(--accent)" }}>插入</button>
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 cursor-zoom-out" onClick={onClose}>
      <img src={src} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function ImportDialog({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (blocks: Block[]) => void }) {
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
}

// ═══════════════════════════════════════════════════════════════
//  BlockView — 单块渲染组件
// ═══════════════════════════════════════════════════════════════

/**
 * 单个Block的渲染组件
 * 包含左侧操作区（类型切换按钮）、内容区、TypePicker弹窗、链接浮窗
 */
function BlockView({ block, index, onChange, onEnter, onDelete, onInsertAfter, onPasteImg, onBackspace, onDeleteDown, olNumber, allBlocks }: {
  block: Block; index: number; onChange: (b: Block) => void; onEnter: (html: string, type?: BType, fallbackIndex?: number) => void;
  onDelete: () => void; onInsertAfter: (type: BType) => void; onPasteImg: (file: File) => void;
  onBackspace: (content: string) => void; onDeleteDown?: () => void; olNumber?: number; allBlocks?: Block[];
}) {
  // ── 状态与引用 ──
  const edRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 });
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [olMenu, setOlMenu] = useState(false);
  const plusRef = useRef<HTMLButtonElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const [gutterHovered, setGutterHovered] = useState(false);
  const [linkPopup, setLinkPopup] = useState<{ x: number; y: number; url: string; text: string } | null>(null);
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 标题降级跟踪：标题→段落后，再按Backspace直接删除而非合并
  const justDemotedRef = useRef(false);
  // 图片缩放相关
  const imgRef = useRef<HTMLImageElement>(null);
  const imgDragRef = useRef<{ startX: number; startW: number; imgLeft: number; imgWidth: number } | null>(null);
  const isComposing = useRef(false);
  const processingEnter = useRef(false);

  const isEmpty = !block.html.trim();
  const isHeading = ["h1", "h2", "h3", "h4", "h5"].includes(block.type);
  const currentTypeMeta = BLOCK_TYPES.find((t) => t.type === block.type) || BLOCK_TYPES[0];

  // ── 聚焦自动移到空块 ──
  useEffect(() => {
    if (!block.html && block.type !== "hr" && block.type !== "img") {
      const timer = setTimeout(() => {
        const el = edRef.current;
        if (el) setCursorToEnd(el);
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [block.id]);

  // 内容编辑后重置降级标记
  useEffect(() => { justDemotedRef.current = false; }, [block.html]);

  // ── 点击链接直接跳转 ──
  useEffect(() => {
    const el = edRef.current; if (!el) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a"); if (!a) return;
      const href = a.getAttribute("href"); if (!href) return;
      e.preventDefault();
      window.open(href, "_blank");
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  // ── 链接悬浮弹窗：2秒悬停出现，鼠标离开浮窗200ms后关闭 ──
  useEffect(() => {
    const el = edRef.current; if (!el) return;
    const onOver = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a"); if (!a) return;
      const href = a.getAttribute("href") || ""; if (!href) return;
      if (linkHideRef.current) { clearTimeout(linkHideRef.current); linkHideRef.current = null; }
      if (!linkTimerRef.current) {
        linkTimerRef.current = setTimeout(() => {
          setLinkPopup({ x: a.getBoundingClientRect().left, y: a.getBoundingClientRect().bottom + 4, url: href, text: a.textContent || href });
          a.style.backgroundColor = "color-mix(in srgb, var(--accent) 10%, transparent)";
          a.style.borderRadius = "2px";
          linkTimerRef.current = null;
        }, 2000);
      }
    };
    const onOut = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a"); if (!a) return;
      if (linkTimerRef.current) { clearTimeout(linkTimerRef.current); linkTimerRef.current = null; }
      a.style.backgroundColor = "";
      a.style.borderRadius = "";
    };
    el.addEventListener("mouseover", onOver);
    el.addEventListener("mouseout", onOut);
    return () => { el.removeEventListener("mouseover", onOver); el.removeEventListener("mouseout", onOut); };
  }, [block.html]);

  // 浮窗鼠标进出控制
  const onPopupEnter = () => { if (linkHideRef.current) { clearTimeout(linkHideRef.current); linkHideRef.current = null; } };
  const onPopupLeave = () => { linkHideRef.current = setTimeout(() => setLinkPopup(null), 200); };

  // ── 类型选择器 ──
  const openChangePicker = () => {
    const ref = typeRef.current || plusRef.current;
    if (ref) { const r = ref.getBoundingClientRect(); setPickerPos({ x: r.left, y: r.bottom + 4 }); }
    setShowPicker(true);
  };
  const openInsertPicker = () => {
    const ref = plusRef.current || typeRef.current;
    if (ref) { const r = ref.getBoundingClientRect(); setPickerPos({ x: r.left, y: r.bottom + 4 }); }
    setShowPicker(true);
  };
  const handlePickerSelect = (type: BType) => {
    setShowPicker(false);
    onChange({ ...block, type, html: block.html });
    setTimeout(() => edRef.current?.focus(), 10);
  };

  // 图片粘贴/拖拽处理
  const handleImageFile = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    if (block.type === "img") { onChange({ ...block, html: imageBlockHtml(dataUrl, file.name) }); }
    else { onPasteImg(file); }
  };

  // ── 键盘事件处理（核心交互逻辑）──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl+B/I/U 快捷键
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === "b") { e.preventDefault(); document.execCommand("bold", false); return; }
      if (e.key.toLowerCase() === "i") { e.preventDefault(); document.execCommand("italic", false); return; }
      if (e.key.toLowerCase() === "u") { e.preventDefault(); document.execCommand("underline", false); return; }
    }

    // / 命令：打开类型选择器
    if (e.key === "/" && !isComposing.current) {
      const el = edRef.current; if (!el) return;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        e.preventDefault();
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setPickerPos({ x: rect.left, y: rect.bottom + 8 });
        setShowPicker(true);
        return;
      }
    }

    // Enter：拆分块（代码块、折叠、公式、嵌入不支持拆分）
    const unsplittableTypes = ["code", "toggle", "formula", "embed", "quote"];
    if (e.key === "Enter" && !e.shiftKey && !unsplittableTypes.includes(block.type)) {
      if (isComposing.current || processingEnter.current) return;
      processingEnter.current = true;
      e.preventDefault();
      const el = edRef.current; if (!el) return;
      const splitResult = splitHtmlAtCursor(el);

      if (!splitResult.before && !splitResult.after) {
        // 光标在空行按Enter：列表空行→当前块退为段落，不新建块
        const exitType = ["ol", "ul", "todo"].includes(block.type) ? "p" : block.type;
        if (exitType !== block.type) {
          onChange({ ...block, type: exitType });
          // 保持焦点：类型转换后React可能重建DOM
          setTimeout(() => edRef.current?.focus(), 0);
        } else {
          onEnter("", exitType, index);
        }
      } else {
        onChange({ ...block, html: splitResult.before });
        const afterText = splitResult.after.replace(/<[^>]+>/g, "").trim();
        // 列表块末尾Enter：有内容→延续列表，空块→当前块退为段落
        if (["ol", "ul", "todo"].includes(block.type) && !afterText) {
          const isBlockEmpty = !block.html.replace(/<[^>]+>/g, "").trim();
            if (isBlockEmpty) {
              // 空列表项：原地转为段落，不新建块
              onChange({ ...block, type: "p" });
              setTimeout(() => edRef.current?.focus(), 0);
            } else {
            // 有内容的列表项末尾回车：下方新建同类型项
            onEnter("", block.type, index);
          }
        } else {
          const shortcut = detectMarkdownShortcut(afterText);
          // 列表中间截断回车：后半也保持列表类型
          const newType = shortcut ? shortcut.type : block.type;
          onEnter(splitResult.after, newType, index);
        }
      }
      setTimeout(() => { processingEnter.current = false; }, 50);
      return;
    }

    // Backspace：行首删除逻辑
    if (e.key === "Backspace" && block.type !== "hr") {
      if (isComposing.current) return;
      const edEl = edRef.current; if (!edEl) return;
      const sel = window.getSelection();
      // 有选中文字：主动执行删除，防止debounce导致文字闪现
      if (sel && !sel.isCollapsed) {
        e.preventDefault();
        document.execCommand("delete", false);
        // 立即同步状态
        if (edEl) {
          const newHtml = edEl.innerHTML;
          onChange({ ...block, html: newHtml });
        }
        return;
      }

      // 检查光标是否在行首
      let atStart = false;
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(edEl);
        preRange.setEnd(r.startContainer, r.startOffset);
        atStart = preRange.toString().length === 0;
      }

      if (atStart) {
        e.preventDefault();

        // 标题：空标题→直接删除，有内容→退化为正文
        if (["h1", "h2", "h3", "h4", "h5"].includes(block.type)) {
          if (!block.html.replace(/<[^>]+>/g, "").trim()) {
            onBackspace(edEl.innerHTML || "");
          } else {
            onChange({ ...block, type: "p" });
            justDemotedRef.current = true; // 标记：下个Backspace直接删除
          }
          return;
        }

        // 引用：有文字→正常删字符，空白→删框
        if (block.type === "quote" && block.html.replace(/<[^>]+>/g, "").trim()) {
          return; // 让浏览器正常删字符
        }

        // 标题降级后的段落：直接删除，不向上合并
        if (justDemotedRef.current) {
          justDemotedRef.current = false;
          onDelete();
          return;
        }

        // 默认：调用mergeUpward向上合并
        onBackspace(edEl.innerHTML || "");
        return;
      }
    }

    // Delete：行尾删除
    if (e.key === "Delete" && block.type !== "code" && block.type !== "hr") {
      const el = edRef.current; if (!el) return;
      const sel = window.getSelection();
      // 有选中文字：主动执行删除，防止debounce导致文字闪现
      if (sel && !sel.isCollapsed) {
        e.preventDefault();
        document.execCommand("delete", false);
        if (el) onChange({ ...block, html: el.innerHTML });
        return;
      }

      let atEnd = false;
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        const postRange = document.createRange();
        postRange.selectNodeContents(el);
        postRange.setStart(r.endContainer, r.endOffset);
        atEnd = postRange.toString().length === 0;
      }
      if (atEnd) { e.preventDefault(); onDeleteDown?.(); return; }
    }
  };

  // ═══════════════════════════════════════
  //  各类型Block渲染
  // ═══════════════════════════════════════
  const render = () => {
    // ── 分割线 ── 悬浮时高亮变色+显示删除按钮
    if (block.type === "hr") return (
      <div className="py-2 relative group/hr cursor-pointer" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onBackspace(""); } }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <div className="rounded transition-colors duration-150"
          style={{
            borderTop: "2px solid var(--border)",
            marginLeft: -48,
          }}
        />
        {/* hover或focus时高亮 */}
        <div className="absolute inset-0 rounded opacity-0 group-hover/hr:opacity-100 transition-opacity pointer-events-none"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)" }} />
        <button onClick={onDelete}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-[10px] opacity-0 group-hover/hr:opacity-100 transition-opacity hover:scale-110"
          style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          title="删除分割线">✕</button>
      </div>
    );

    // ── 代码块 ──
    if (block.type === "code") {
      const highlighted = highlightCode(block.html, block.lang);
      const linedHtml = wrapCodeLines(highlighted, block.html);
      return (
        <div className="rounded-xl overflow-hidden border line-numbers" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "var(--code-block-header)" }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f56" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ffbd2e" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#27c93f" }} />
              <span className="font-mono text-[10px] ml-2" style={{ color: "#666" }}>{block.lang || "auto"}</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={block.lang || ""} onChange={(e) => onChange({ ...block, lang: e.target.value || undefined })}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded border-0 outline-none cursor-pointer"
                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                <option value="">自动检测</option>
                {["javascript", "typescript", "python", "css", "html", "json", "bash", "markdown", "sql", "rust", "go", "java", "c", "cpp"].map((l) => (<option key={l} value={l}>{l}</option>))}
              </select>
              <button onClick={onDelete} className="font-mono text-[10px] hover:opacity-70" style={{ color: "#888" }}>删除</button>
              <button onClick={async () => { await navigator.clipboard.writeText(block.html); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }}
                className="font-mono text-[10px] hover:opacity-70" style={{ color: "#888" }}>{copyFeedback ? "已复制" : "复制"}</button>
            </div>
          </div>
          <div className="relative" style={{ minHeight: 100 }}>
            <pre className="absolute inset-0 px-4 py-3 font-mono text-sm leading-relaxed overflow-hidden pointer-events-none"
              style={{ backgroundColor: "var(--code-block-bg)", color: "var(--code-block-text)", tabSize: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <code dangerouslySetInnerHTML={{ __html: linedHtml || `<span class="line">&nbsp;</span>` }} />
            </pre>
            <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
              onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              className="relative px-4 py-3 font-mono text-sm leading-relaxed outline-none"
              style={{ color: "transparent", caretColor: "var(--accent)", backgroundColor: "transparent", tabSize: 2, whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: 100 }}
              placeholder="输入代码…" spellCheck={false} />
          </div>
        </div>
      );
    }

    // ── 图片 ──
    if (block.type === "img") {
      const imgMatch = block.html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
      const imgUrl = imgMatch?.[1] || "";
      const imgWidth = block.imgWidth ?? 100;

      const startResize = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const img = imgRef.current; if (!img) return;
        const rect = img.getBoundingClientRect();
        imgDragRef.current = { startX: e.clientX, startW: block.imgWidth ?? 100, imgLeft: rect.left, imgWidth: rect.width };
        const onMove = (ev: MouseEvent) => {
          if (!imgDragRef.current) return;
          const dx = ev.clientX - imgDragRef.current.startX;
          const newPx = imgDragRef.current.imgWidth + dx * 2;
          const containerW = (img.parentElement?.parentElement?.clientWidth || 800);
          const newPercent = Math.max(10, Math.min(100, Math.round((newPx / containerW) * 100)));
          onChange({ ...block, imgWidth: newPercent });
        };
        const onUp = () => { imgDragRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
        document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
      };

      return (
        <div className="space-y-2" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onBackspace(""); } }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
          <div className="flex items-center gap-3 py-2">
            <span className="text-lg shrink-0">🖼</span>
            <input type="text" value={imgUrl && !imgUrl.startsWith("data:") ? imgUrl : ""}
              onChange={(e) => { const url = e.target.value.trim(); if (url) onChange({ ...block, html: imageBlockHtml(url, "图片") }); }}
              onKeyDown={(e) => { if ((e.key === "Backspace" || e.key === "Delete") && !imgUrl) { e.preventDefault(); onBackspace(""); } }}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              className="flex-1 font-sans text-sm outline-none"
              style={{ backgroundColor: "transparent", color: "var(--text)", caretColor: "var(--accent)" }} placeholder="输入图片URL" />
          </div>
          {!imgUrl ? (
            <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => { e.preventDefault(); const file = e.dataTransfer?.files?.[0]; if (file && file.type.startsWith("image/")) handleImageFile(file); }}
              onPaste={async (e) => { const items = e.clipboardData?.items; if (!items) return; for (let i = 0; i < items.length; i++) { if (items[i].type.startsWith("image/")) { e.preventDefault(); const file = items[i].getAsFile(); if (file) { handleImageFile(file); } return; } } }}
              onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = () => { const file = input.files?.[0]; if (file) readFileAsDataUrl(file).then((d) => { onChange({ ...block, html: imageBlockHtml(d, file.name) }); }); }; input.click(); }}>
              <span className="text-3xl block mb-2">🖼</span>
              <span className="font-sans text-sm" style={{ color: "var(--text-secondary)" }}>点击/拖拽/粘贴上传</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative inline-block group/img" style={{ width: imgWidth + "%", maxWidth: "100%" }}>
                <img ref={imgRef} src={imgUrl} alt="预览"
                  style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  onDoubleClick={() => setLightboxSrc(imgUrl)} />
                {/* 选中边框和四角拖拽手柄 */}
                <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none"
                  style={{ border: "2px solid var(--accent)", borderRadius: 6 }} />
                {["nw", "ne", "sw", "se"].map((pos) => (
                  <div key={pos} onMouseDown={startResize}
                    className="absolute w-3 h-3 bg-white border-2 rounded-sm opacity-0 group-hover/img:opacity-100 transition-opacity cursor-nwse-resize pointer-events-auto"
                    style={{ borderColor: "var(--accent)", [pos.includes("n") ? "top" : "bottom"]: -5, [pos.includes("w") ? "left" : "right"]: -5 }} />
                ))}
                <button onClick={() => onChange({ ...block, html: "" })} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer z-10">✕</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px]" style={{ color: "var(--text-muted)" }}>{imgWidth}%</span>
              </div>
            </div>
          )}
          {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
        </div>
      );
    }

    // ── 引用 ──
    if (block.type === "quote") return (
      <div className="flex rounded-r-lg"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent-warm) 8%, transparent)", borderLeft: "4px solid var(--accent-warm)" }}>
        <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
          onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="flex-1 px-4 py-3 outline-none italic"
          style={{ color: "var(--text-secondary)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1rem", lineHeight: 1.6, minHeight: "1.6em" }}
          placeholder="引用内容…" spellCheck={false} />
      </div>
    );

    // ── 有序列表 ──
    if (block.type === "ol") {
      // 计算当前组内总项数
      let totalInGroup = 0;
      const blks = allBlocks || [];
      for (let i = index; i >= 0 && blks[i]?.type === "ol" && !(i < index && blks[i]?.restartNumbering); i--) totalInGroup++;
      for (let i = index + 1; i < blks.length && blks[i]?.type === "ol" && !blks[i]?.restartNumbering; i++) totalInGroup++;

      return (
      <div className="flex" style={{ paddingLeft: 0 }}>
        <div className="relative w-6 shrink-0 text-right pr-2 font-mono text-sm cursor-pointer select-none"
          style={{ color: "var(--text-muted)", lineHeight: 1.6 }}
          onClick={() => setOlMenu(!olMenu)} title="点击设置编号">
          {olNumber ?? 1}.
          {olMenu && (
            <div className="absolute left-0 top-6 z-50 w-44 rounded-lg border shadow-lg py-1"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="px-3 py-1.5 font-sans text-xs" style={{ color: "var(--text-muted)" }}>
                第 {olNumber ?? 1} 项，共 {totalInGroup} 项
              </div>
              <div className="mx-2 my-0.5" style={{ borderTop: "1px solid var(--border-light)" }} />
              <button className="w-full px-3 py-1.5 text-left font-sans text-xs hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text)" }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOlMenu(false); onChange({ ...block, restartNumbering: !block.restartNumbering }); }}>
                {block.restartNumbering ? "继续上一组编号" : "重新开始编号"}
              </button>
            </div>
          )}
        </div>
        <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
          onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full py-0.5 outline-none"
          style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1rem", lineHeight: 1.6, minHeight: "1.6em" }}
          placeholder="1. 第一项" spellCheck={false} />
      </div>
    ); }

    // ── 无序列表 ──
    if (block.type === "ul") return (
      <div className="flex" style={{ paddingLeft: 0 }}>
        <div className="w-6 shrink-0 text-right pr-2 font-mono text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>•</div>
        <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
          onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full py-0.5 outline-none"
          style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1rem", lineHeight: 1.6, minHeight: "1.6em" }}
          placeholder="- 列表项" spellCheck={false} />
      </div>
    );

    // ── 待办列表 ──
    if (block.type === "todo") {
      const toggleChecked = () => onChange({ ...block, checked: !block.checked });
      return (
        <div className="flex items-start gap-3 py-1">
          <button onClick={toggleChecked} className="shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer"
            style={{ borderColor: block.checked ? "var(--accent)" : "var(--border)", backgroundColor: block.checked ? "var(--accent)" : "var(--bg-card)" }}>
            {block.checked && <span className="text-white text-[10px] font-bold">✓</span>}
          </button>
          <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
            onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            className="flex-1 outline-none"
            style={{ color: block.checked ? "var(--text-muted)" : "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1rem", lineHeight: 1.6, minHeight: "1.6em", textDecoration: block.checked ? "line-through" : "none" }}
            placeholder="待办事项…" spellCheck={false} />
        </div>
      );
    }

    // ── 提示框 ──
    if (block.type === "callout") {
      const preset = CALLOUT_PRESETS[block.calloutType || "info"];
      return (
        <div className="flex rounded-xl p-4" style={{ backgroundColor: preset.bg, border: `1px solid ${preset.border}` }}>
          <span className="text-xl mr-3 shrink-0 cursor-pointer" title={`${preset.label} — 点击切换`} onClick={() => {
            const types = Object.keys(CALLOUT_PRESETS) as Array<keyof typeof CALLOUT_PRESETS>;
            const idx = types.indexOf(block.calloutType || "info");
            onChange({ ...block, calloutType: types[(idx + 1) % types.length] });
          }}>{preset.icon}</span>
          <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
            onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            className="flex-1 outline-none"
            style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1rem", lineHeight: 1.6, minHeight: "1.6em" }}
            placeholder="提示内容…" spellCheck={false} />
        </div>
      );
    }

    // ── 表格 ──
    if (block.type === "table") {
      const rows = block.html.split("\n").filter((l) => l.trim().startsWith("|"));
      const parsed = rows.map((r) => r.split("|").filter((c, i, a) => i > 0 && i < a.length - 1).map((c) => c.trim()));
      const headerRow = parsed.length > 0 ? parsed[0] : [];
      const hasSep = parsed.length > 1 && parsed[1].every((c) => /^[-:]+$/.test(c));
      const dataRows = hasSep ? parsed.slice(2) : parsed.slice(1);
      const aligns = hasSep ? (parsed[1] || []).map((c) => c.startsWith(":") && c.endsWith(":") ? "center" as const : c.endsWith(":") ? "right" as const : "left" as const) : [];

      const tableToMarkdown = () => {
        const tb = document.querySelector(`[data-table="${block.id}"] tbody`);
        const th = document.querySelector(`[data-table="${block.id}"] thead`);
        if (!tb || !th) return;
        const headers = Array.from(th.querySelectorAll("th")).map((t: any) => t.textContent?.trim() || "");
        const rows = Array.from(tb.querySelectorAll("tr")).map((tr: any) => Array.from(tr.querySelectorAll("td")).map((td: any) => td.textContent?.trim() || ""));
        let md = "| " + headers.join(" | ") + " |\n|";
        headers.forEach((_, i) => { const a = aligns[i] || "left"; md += a === "center" ? " :---: " : a === "right" ? " ---: " : " --- "; md += "|"; });
        rows.forEach((r: any) => { md += "\n| " + r.join(" | ") + " |"; });
        onChange({ ...block, html: escapeHtml(md) });
      };

      return (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }} data-table={block.id}>
            <table className="w-full border-collapse font-sans text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-subtle)" }}>
                  {headerRow.map((cell, ci) => (
                    <th key={ci} contentEditable suppressContentEditableWarning onInput={tableToMarkdown} onBlur={tableToMarkdown}
                      className="px-3 py-2 text-left font-semibold border-b outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text)", textAlign: aligns[ci] || "left" }}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? "transparent" : "var(--bg-subtle)" }}>
                    {row.map((cell, ci) => (
                      <td key={ci} contentEditable suppressContentEditableWarning onInput={tableToMarkdown} onBlur={tableToMarkdown}
                        className="px-3 py-2 border-b outline-none"
                        style={{ borderColor: "var(--border-light)", color: "var(--text)", textAlign: aligns[ci] || "left" }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => onDelete()} className="font-sans text-[10px]" style={{ color: "var(--text-muted)" }}>删除表格</button>
        </div>
      );
    }

    // ── 折叠列表 ──
    if (block.type === "toggle") {
      const toggle = () => onChange({ ...block, collapsed: !block.collapsed });
      return (
        <div className="flex items-start gap-2 py-0.5">
          <button onClick={toggle} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-subtle)] transition-transform shrink-0 mt-0.5"
            style={{ transform: block.collapsed ? "rotate(-90deg)" : "rotate(0deg)", color: "var(--text-secondary)" }}>▶</button>
          <div className="flex-1 min-w-0">
            <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
              onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              className="w-full outline-none"
              style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1rem", lineHeight: 1.6, minHeight: "1.6em" }}
              placeholder="折叠标题…" spellCheck={false} />
            <div className="overflow-hidden" style={{ maxHeight: block.collapsed ? 0 : 2000, opacity: block.collapsed ? 0 : 1, transition: "max-height 0.3s ease, opacity 0.3s ease" }}>
              <div className="ml-4 mt-1 pl-4 border-l-2" style={{ borderColor: "var(--border-light)" }}>
                <ContentEditableArea html={block.toggleContent || ""} onChange={(html) => onChange({ ...block, toggleContent: html })}
                  onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                  className="w-full outline-none"
                  style={{ color: "var(--text-secondary)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "0.9rem", lineHeight: 1.6, minHeight: "1.6em" }}
                  placeholder="折叠内容…" spellCheck={false} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── 数学公式 ──
    if (block.type === "formula") {
      let rendered = "";
      try { rendered = katex.renderToString(block.html || " ", { throwOnError: false, displayMode: true }); }
      catch { rendered = escapeHtml(block.html); }
      return (
        <div className="flex items-start gap-3 py-3">
          <span className="text-lg shrink-0">∑</span>
          <div className="flex-1 min-w-0">
            <ContentEditableArea html={block.html} onChange={(html) => onChange({ ...block, html })}
              onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              className="w-full outline-none font-mono text-sm"
              style={{ color: "var(--text)", caretColor: "var(--accent)", lineHeight: 1.6, minHeight: "1.6em" }}
              placeholder="输入 LaTeX 公式" spellCheck={false} />
            <div className="py-3 flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: rendered }} />
          </div>
        </div>
      );
    }

    // ── 嵌入网页 ──
    if (block.type === "embed") {
      const url = block.html.trim();
      return (
        <div className="space-y-2" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onBackspace(""); } }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
          <div className="flex items-center gap-3 py-2">
            <span className="text-lg shrink-0">🌐</span>
            <input type="text" value={url} onChange={(e) => onChange({ ...block, html: e.target.value })}
              onKeyDown={(e) => { if ((e.key === "Backspace" || e.key === "Delete") && !url) { e.preventDefault(); onBackspace(""); } }}
              placeholder="输入网页URL…" className="flex-1 font-sans text-sm outline-none"
              style={{ backgroundColor: "transparent", color: "var(--text)" }}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
          </div>
          {url && <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}><iframe src={url} className="w-full" style={{ height: 400, border: "none" }} sandbox="allow-scripts allow-same-origin" /></div>}
        </div>
      );
    }

    // ── 标题 / 正文 ──
    const headingStyle: React.CSSProperties = {};
    if (block.type === "h1") { headingStyle.fontSize = "2rem"; headingStyle.fontWeight = 700; headingStyle.lineHeight = 1.2; }
    if (block.type === "h2") { headingStyle.fontSize = "1.5rem"; headingStyle.fontWeight = 600; headingStyle.lineHeight = 1.25; }
    if (block.type === "h3") { headingStyle.fontSize = "1.2rem"; headingStyle.fontWeight = 600; headingStyle.lineHeight = 1.3; }
    if (block.type === "h4") { headingStyle.fontSize = "1.1rem"; headingStyle.fontWeight = 600; headingStyle.lineHeight = 1.35; }
    if (block.type === "h5") { headingStyle.fontSize = "1rem"; headingStyle.fontWeight = 600; headingStyle.lineHeight = 1.4; }
    const placeholderText = block.type === "h1" ? "页面大标题…" : block.type === "h2" ? "二级标题…" : block.type === "h3" ? "三级标题…" : block.type === "h4" ? "四级标题…" : block.type === "h5" ? "五级标题…" : "";

    return (
      <ContentEditableArea html={block.html} innerRef={edRef} onChange={(html) => onChange({ ...block, html })}
        onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleImageFile}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full outline-none"
        style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1rem", lineHeight: 1.6, minHeight: "1.6em", ...headingStyle }}
        placeholder={placeholderText} spellCheck={false} />
    );
  };

  // ═══════════════════════════════════════
  //  BlockView JSX
  // ═══════════════════════════════════════
  return (
    <div className="group relative" data-block={block.id} {...(isHeading ? { "data-heading": "true" } as Record<string, string> : {})}>
      <div className="flex" style={{ minHeight: block.type === "hr" ? 20 : block.type === "code" ? 0 : 32 }}>
        {/* 左侧操作区 */}
        <div className="w-14 shrink-0 pt-1 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer rounded-lg"
          onMouseEnter={() => setGutterHovered(true)} onMouseLeave={() => setGutterHovered(false)}>
          {isEmpty ? (
            <button ref={plusRef} onMouseDown={(e) => { e.preventDefault(); openInsertPicker(); }}
              className="w-10 h-10 flex items-center justify-center rounded-full text-2xl font-bold hover:scale-110 hover:bg-[var(--bg-subtle)] transition-transform"
              style={{ color: "var(--accent)", lineHeight: 1 }} title="选择块类型">+</button>
          ) : (
            <button ref={typeRef} onMouseDown={(e) => { e.preventDefault(); openChangePicker(); }}
              className="w-10 h-10 flex items-center justify-center rounded text-base font-bold hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text-muted)", fontFamily: "'SF Mono', monospace", lineHeight: 1 }}
              title={`${currentTypeMeta.label} — 点击切换`}>{currentTypeMeta.icon}</button>
          )}
        </div>

        {/* 内容区 — 悬浮左侧按钮时显示左侧细线高亮 */}
        <div className="flex-1 min-w-0 rounded-r-lg"
          style={{ paddingLeft: 4, borderLeft: gutterHovered ? "2px solid var(--accent)" : "2px solid transparent", transition: "border-color 0.15s ease" }}>
          {render()}
        </div>
      </div>

      {/* TypePicker弹窗 */}
      <TypePicker open={showPicker} position={pickerPos} currentType={block.type} onSelect={handlePickerSelect} onClose={() => setShowPicker(false)} />

      {/* 链接悬浮浮窗 */}
      {linkPopup && (
        <div className="fixed z-[150] flex items-center gap-0.5 px-2 py-1 rounded-lg shadow-lg border"
          style={{ left: linkPopup.x, top: linkPopup.y, backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          onMouseEnter={onPopupEnter} onMouseLeave={onPopupLeave}>
          <span className="font-sans text-[10px] px-1 truncate max-w-[200px]" style={{ color: "var(--text-muted)" }}>{linkPopup.text}</span>
          <a href={linkPopup.url} target="_blank" rel="noopener" className="px-2 py-0.5 rounded font-sans text-[10px] font-medium cursor-pointer hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--accent)" }}>打开</a>
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(linkPopup.url); setLinkPopup(null); }}
            className="px-2 py-0.5 rounded font-sans text-[10px] hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-secondary)" }}>复制</button>
          <button onClick={(e) => { e.stopPropagation(); const a = edRef.current?.querySelector("a[href]"); if (a) { const txt = a.textContent || ""; a.replaceWith(document.createTextNode(txt)); const el = edRef.current; if (el) el.dispatchEvent(new Event("input", { bubbles: true })); } setLinkPopup(null); }}
            className="px-2 py-0.5 rounded font-sans text-[10px] hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-secondary)" }}>移除</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  WritePage — 主页面
// ═══════════════════════════════════════════════════════════════

export default function WritePage() {
  const router = useRouter();

  // ── 核心状态 ──
  const [titleHtml, setTitleHtml] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([createBlock("p")]);
  const [category, setCategory] = useState("tech");
  const [categories, setCategories] = useState<string[]>(["tech", "life"]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [coverImage, setCoverImage] = useState("");

  // ── 撤销/重做 ──
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  // ── UI状态 ──
  const [shortcuts, setShortcuts] = useState<Shortcuts>(DEFAULT_SHORTCUTS);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // ── 初始化 ──
  useEffect(() => { setShortcuts(loadShortcuts()); }, []);
  useEffect(() => { fetch("/api/categories").then(r => r.json()).then(d => { if (d.categories?.length) setCategories(d.categories); }).catch(() => { }); }, []);

  // ── 草稿自动保存 ──
  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem("w-draft", JSON.stringify({ titleHtml, blocks, category, coverImage })); } catch { }
    }, 2000);
    return () => clearTimeout(timer);
  }, [titleHtml, blocks, category, coverImage]);

  // ── 草稿恢复 ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem("w-draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.titleHtml || (draft.blocks && draft.blocks.length > 2)) {
          if (confirm("检测到未发布的草稿，是否恢复？")) {
            setTitleHtml(draft.titleHtml || "");
            setBlocks(draft.blocks || [createBlock("p")]);
            setCategory(draft.category || "tech");
            setCoverImage(draft.coverImage || "");
          } else {
            localStorage.removeItem("w-draft");
          }
        }
      }
    } catch { }
  }, []);

  // ── 撤销快照 ──
  const pushSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-49), { blocks: JSON.parse(JSON.stringify(blocks)), titleHtml, category, coverImage }]);
    setRedoStack([]);
  }, [blocks, titleHtml, category, coverImage]);

  // ═══════════════════════════════════════
  //  块操作函数
  // ═══════════════════════════════════════

  /** 在指定位置后插入新块 */
  const insertAfter = (index: number, type: BType = "p", html = "") => {
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
  };

  /** 在光标位置拆分块（Enter触发），index用于快速连续Enter的兜底定位 */
  const splitBlock = (id: string, afterHtml: string, blockType?: BType, fallbackIndex?: number) => {
    const inheritTypes = ["ol", "ul", "todo"];
    const newType: BType = inheritTypes.includes(blockType || "") ? (blockType || "p") : "p";
    const newBlock = createBlock(newType, afterHtml);
    if (newType === "ol") newBlock.restartNumbering = false;
    pushSnapshot();
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
        const el = document.querySelector(`[data-block="${newBlock.id}"] [contenteditable]`) as HTMLElement;
        if (el) setCursorToEnd(el);
      }, 20);
      return updated;
    });
  };

  /** 删除指定块 */
  const removeBlock = (id: string, index: number) => {
    pushSnapshot();
    setBlocks((prev) => {
      if (prev.length <= 1) return prev;
      const updated = prev.filter((b) => b.id !== id);
      setTimeout(() => {
        const focusIndex = Math.min(index, updated.length - 1);
        const targetId = updated[focusIndex]?.id;
        const el = targetId ? document.querySelector(`[data-block="${targetId}"] [contenteditable]`) as HTMLElement : null;
        if (el) setCursorToEnd(el);
      }, 10);
      return updated;
    });
  };

  /**
   * 向上合并（Backspace行首触发）
   * - 空行：删除当前块
   * - 非空行：内容合并到上一块
   */
  const mergeUpward = (id: string, index: number, content: string) => {
    pushSnapshot();
    setBlocks((prev) => {
      // 全部检查移到setBlocks内，用最新的prev而非闭包里的旧值
      let realIndex = prev.findIndex((b) => b.id === id);
      // id未命中时用传入的index兜底
      if (realIndex < 0 && index >= 0 && index < prev.length && prev[index]?.id === id) {
        realIndex = index;
      }
      if (realIndex < 0) return prev;

      const currentBlock = prev[realIndex];
      const previousBlock = prev[realIndex - 1];
      const updated = [...prev];
      const isEmptyContent = !content.replace(/<[^>]+>/g, "").trim();

      // 空行删除
      if (isEmptyContent && !["code", "hr", "img", "table"].includes(currentBlock.type)) {
        if (prev.length <= 1) return prev; // 保留最后一个块
        if (["ol", "ul", "todo"].includes(currentBlock.type)) {
          // 列表空行：第一次转段落，第二次删
          updated[realIndex] = { ...currentBlock, type: "p", html: "" };
          setTimeout(() => {
            const el = document.querySelector(`[data-block="${currentBlock.id}"] [contenteditable]`) as HTMLElement;
            if (el) setCursorToEnd(el);
          }, 10);
          return updated;
        }
        updated.splice(realIndex, 1);
        // 聚焦到上方块而非下方块
        const focusIndex = Math.max(0, realIndex - 1);
        const targetId = updated[focusIndex]?.id;
        setTimeout(() => {
          const el = targetId ? document.querySelector(`[data-block="${targetId}"] [contenteditable]`) as HTMLElement : null;
          if (el) setCursorToEnd(el);
        }, 0);
        return updated;
      }

      // 第一行非空：不合并
      if (realIndex <= 0) return prev;

      // 上一块是不可合并类型：直接删除当前块
      if (["code", "hr", "img", "table"].includes(previousBlock.type)) {
        updated.splice(realIndex, 1);
        return updated;
      }

      // 内容合并到上一块然后删除当前块
      if (content) {
        updated[realIndex - 1] = { ...previousBlock, html: previousBlock.html + content };
      }
      updated.splice(realIndex, 1);
      setTimeout(() => {
        const el = document.querySelector(`[data-block="${previousBlock.id}"] [contenteditable]`) as HTMLElement;
        if (el) setCursorToEnd(el);
      }, 10);
      return updated;
    });
  };

  /** 向下合并（Delete行尾触发） */
  const mergeDownward = (id: string, index: number) => {
    pushSnapshot();
    setBlocks((prev) => {
      // 全部检查移到setBlocks内，用最新的prev而非闭包里的旧blocks
      const realIndex = prev.findIndex((b) => b.id === id);
      if (realIndex < 0 || realIndex >= prev.length - 1) return prev;

      const currentBlock = prev[realIndex];
      const nextBlock = prev[realIndex + 1];
      const updated = [...prev];

      if (["code", "hr", "img", "table"].includes(nextBlock.type)) {
        updated.splice(realIndex + 1, 1);
        return updated;
      }
      if (nextBlock.html) {
        updated[realIndex] = { ...currentBlock, html: currentBlock.html + nextBlock.html };
      }
      updated.splice(realIndex + 1, 1);
      setTimeout(() => {
        const el = document.querySelector(`[data-block="${currentBlock.id}"] [contenteditable]`) as HTMLElement;
        if (el) setCursorToEnd(el);
      }, 10);
      return updated;
    });
  };

  // ═══════════════════════════════════════
  //  撤销/重做
  // ═══════════════════════════════════════
  const undo = () => {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    setRedoStack((p) => [...p, { blocks: JSON.parse(JSON.stringify(blocks)), titleHtml, category, coverImage }]);
    setUndoStack((p) => p.slice(0, -1));
    setBlocks(prevSnapshot.blocks);
    setTitleHtml(prevSnapshot.titleHtml);
    setCategory(prevSnapshot.category);
    setCoverImage(prevSnapshot.coverImage || "");
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    setUndoStack((p) => [...p, { blocks: JSON.parse(JSON.stringify(blocks)), titleHtml, category, coverImage }]);
    setRedoStack((p) => p.slice(0, -1));
    setBlocks(nextSnapshot.blocks);
    setTitleHtml(nextSnapshot.titleHtml);
    setCategory(nextSnapshot.category);
    setCoverImage(nextSnapshot.coverImage || "");
  };

  // ═══════════════════════════════════════
  //  全局键盘事件
  // ═══════════════════════════════════════
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isEditable = active instanceof HTMLTextAreaElement
        || (active instanceof HTMLElement && active.contentEditable === "true")
        || active instanceof HTMLInputElement;

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
            // 从标题input开始，跨所有块
            const first = root.querySelector("input") || root.querySelector("[contenteditable]");
            const allEditable = root.querySelectorAll("[contenteditable]");
            const lastEl = allEditable[allEditable.length - 1];
            if (first && lastEl) {
              if (first instanceof HTMLInputElement) r.setStart(first, 0);
              else r.selectNodeContents(first);
              r.collapse(true);
              sel.removeAllRanges(); sel.addRange(r);
              // extend到最后一个contentEditable末尾
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

      // 跨块选区Delete/Backspace：Range.deleteContents() 直接操作DOM
      if (e.key === "Backspace" || e.key === "Delete") {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          const startBlock = (r.startContainer as HTMLElement).closest?.("[data-block]") as HTMLElement | null;
          const endBlock = (r.endContainer as HTMLElement).closest?.("[data-block]") as HTMLElement | null;
          if (startBlock && endBlock && startBlock !== endBlock) {
            e.preventDefault();
            pushSnapshot();
            // 用 Range.deleteContents() 直接删除选区DOM节点（不依赖contentEditable）
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
              if (first) setCursorToEnd(first);
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
          if (el) setCursorToEnd(el);
        }
        return;
      }

      if (!isEditable) return;

      const blockId = (active as HTMLElement).closest("[data-block]")?.getAttribute("data-block");
      if (!blockId) return;

      // Alt+上下箭头移动块
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const index = blocks.findIndex((b) => b.id === blockId);
        if (index < 0) return;
        if (e.key === "ArrowUp" && index > 0) {
          pushSnapshot();
          const updated = [...blocks];
          const [moved] = updated.splice(index, 1);
          updated.splice(index - 1, 0, moved);
          setBlocks(updated);
        }
        if (e.key === "ArrowDown" && index < blocks.length - 1) {
          pushSnapshot();
          const updated = [...blocks];
          const [moved] = updated.splice(index, 1);
          updated.splice(index + 1, 0, moved);
          setBlocks(updated);
        }
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
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, blocks, undoStack, redoStack, titleHtml, category, coverImage]);

  // ═══════════════════════════════════════
  //  保存文章
  // ═══════════════════════════════════════
  const save = async () => {
    const titleText = htmlToMarkdown(titleHtml).trim();
    if (!titleText) { setMessage("请输入标题"); return; }
    const content = blocksToMarkdown(blocks);
    if (!content.trim()) { setMessage("请输入内容"); return; }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleText, content, category, tags: [], description: "" }),
      });
      if (response.ok) {
        localStorage.removeItem("w-draft");
        router.push("/blog");
      } else {
        const data = await response.json();
        setMessage(data.error || "保存失败");
      }
    } catch { setMessage("网络错误"); }
    finally { setSaving(false); }
  };

  // ═══════════════════════════════════════
  //  链接插入（支持行内/卡片/嵌入三种模式）
  // ═══════════════════════════════════════
  const insertLink = (text: string, url: string, mode: string) => {
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

  // ═══════════════════════════════════════
  //  辅助
  // ═══════════════════════════════════════
  const titleText = htmlToMarkdown(titleHtml).trim();
  const mdLength = useMemo(() => blocksToMarkdown(blocks).length, [blocks]);

  const pickCover = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) setCoverImage(await readFileAsDataUrl(file));
    };
    input.click();
  };

  // ═══════════════════════════════════════
  //  JSX
  // ═══════════════════════════════════════
  return (
    <div id="editor-root" className="max-w-[900px] mx-auto px-8 py-12" style={{ userSelect: "text", scrollBehavior: "auto" }}>
      {/* 全局样式 */}
      <style>{`
        [contenteditable]:empty:not(:focus):before{content:attr(data-placeholder);color:var(--text-muted);opacity:0.5;pointer-events:none}
        .drag-target{border-top:2px solid var(--accent)}
        [contenteditable] strong,[contenteditable] b{font-weight:700}
        [contenteditable] em,[contenteditable] i{font-style:italic}
        [contenteditable] code{font-family:var(--font-mono);font-size:0.88em;padding:0.15em 0.4em;border-radius:4px;background:var(--code-bg);border:1px solid var(--code-border);color:var(--inline-code-color)}
        [contenteditable] a{color:var(--accent);text-decoration:underline;cursor:pointer}
        .line-numbers pre{counter-reset:line;padding-left:3.5rem!important}
        .line-numbers pre code>span.line::before{counter-increment:line;content:counter(line);display:inline-block;width:2rem;margin-left:-3.5rem;margin-right:1.5rem;text-align:right;color:var(--line-number-color);user-select:none}
        ::selection{background:rgba(51,112,255,0.2);color:inherit}
      `}</style>

      {/* 顶部工具栏 */}
      <div className="flex justify-between mb-8">
        <h1 className="font-sans text-xl font-bold" style={{ color: "var(--text)" }}>写文章</h1>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={undoStack.length === 0} className="btn-ghost text-xs" style={{ opacity: undoStack.length === 0 ? 0.3 : 1 }}>↩</button>
          <button onClick={redo} disabled={redoStack.length === 0} className="btn-ghost text-xs" style={{ opacity: redoStack.length === 0 ? 0.3 : 1 }}>↪</button>
          <button onClick={() => setShowShortcuts(true)} className="btn-ghost text-xs">⌨</button>
          <button onClick={() => setImportOpen(true)} className="btn-ghost text-xs">📥 导入</button>
          <button onClick={() => router.push("/blog")} className="btn-ghost text-xs">取消</button>
          <button onClick={async () => { await navigator.clipboard.writeText(blocksToMarkdown(blocks)); setMessage("已复制"); setTimeout(() => setMessage(""), 2000); }} className="btn-ghost text-xs">📋 复制</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg font-sans text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "var(--accent)" }}>{saving ? "…" : "发布"}</button>
        </div>
      </div>

      {message && <div className="mb-4 px-4 py-2 rounded-lg font-sans text-xs" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>{message}</div>}

      {/* 封面图 — 标题上方全宽 */}
      <div className="mb-6">
        {coverImage && <div className="relative mb-3 -mx-8"><img src={coverImage} alt="封面" className="w-full" /><button onClick={() => setCoverImage("")} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">✕</button></div>}
        <button onClick={pickCover} className="btn-ghost text-xs">🖼 {coverImage ? "更换封面" : "添加封面图"}</button>
      </div>

      {/* 标题输入 */}
      <div className="mb-6">
        <input type="text" value={htmlToMarkdown(titleHtml)}
          onChange={(e) => setTitleHtml(e.target.value)} placeholder="文章标题"
          className="w-full outline-none font-sans text-4xl font-bold pb-2 border-b-2 border-[var(--border)]"
          style={{ color: "var(--text)", caretColor: "var(--accent)", lineHeight: 1.3, backgroundColor: "transparent" }} />
      </div>

      {/* 分类选择 */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>分类：</span>
        <div className="flex gap-2 flex-wrap items-center">
          {categories.map((cat) => (
            editingCategory === cat ? (
              <input key={cat} autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const name = newCategoryName.trim();
                    if (name && name !== cat) {
                      fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldName: cat, newName: name }) })
                        .then(() => { setCategories((p) => p.map((c) => c === cat ? name : c)); if (category === cat) setCategory(name); });
                    }
                    setEditingCategory(null); setNewCategoryName("");
                  }
                  if (e.key === "Escape") { setEditingCategory(null); setNewCategoryName(""); }
                }}
                onBlur={() => { setEditingCategory(null); setNewCategoryName(""); }}
                className="px-2 py-1 rounded font-sans text-xs outline-none border"
                style={{ backgroundColor: "var(--bg)", borderColor: "var(--accent)", color: "var(--text)", width: 100 }} />
            ) : (
              <span key={cat} className="relative group/cat">
                <button onClick={() => setCategory(cat)} className="px-3 py-1 rounded-full font-sans text-xs font-medium cursor-pointer"
                  style={{ backgroundColor: category === cat ? "var(--accent)" : "var(--bg-subtle)", color: category === cat ? "white" : "var(--text-secondary)" }}>
                  {cat === "tech" ? "🖥 技术" : cat === "life" ? "🌟 生活" : cat}
                </button>
                <span className="hidden group-hover/cat:inline-flex ml-1 gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setNewCategoryName(cat); }}
                    className="text-[10px] px-1 rounded hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }} title="编辑">✎</button>
                  {categories.length > 1 && <button onClick={(e) => { e.stopPropagation(); if (confirm(`删除分类「${cat}」及其所有文章？`)) { fetch("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cat }) }).then(() => { setCategories((p) => p.filter((c) => c !== cat)); if (category === cat) setCategory(categories[0] === cat ? categories[1] : categories[0]); }); } }}
                    className="text-[10px] px-1 rounded hover:bg-[var(--bg-subtle)]" style={{ color: "var(--text-muted)" }} title="删除">✕</button>}
                </span>
              </span>
            )
          ))}
          {addingCategory ? (
            <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = newCategoryName.trim();
                  if (name && !categories.includes(name)) {
                    fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
                    setCategories((p) => [...p, name]); setCategory(name);
                  }
                  setAddingCategory(false); setNewCategoryName("");
                }
                if (e.key === "Escape") { setAddingCategory(false); setNewCategoryName(""); }
              }}
              onBlur={() => { setAddingCategory(false); setNewCategoryName(""); }}
              placeholder="新分类名" className="px-2 py-1 rounded font-sans text-xs outline-none border"
              style={{ backgroundColor: "var(--bg)", borderColor: "var(--accent)", color: "var(--text)", width: 100 }} />
          ) : (
            <button onClick={() => { setAddingCategory(true); setNewCategoryName(""); }} className="px-2 py-1 rounded-full font-sans text-xs border border-dashed cursor-pointer hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>+ 新增</button>
          )}
        </div>
      </div>

      {/* 块列表 */}
      <div className="space-y-0" style={{ userSelect: "text" }}>
        {blocks.map((block, index) => {
          // 动态计算有序列表编号：连续ol块共享递增编号
          let olNumber: number | undefined;
          if (block.type === "ol") {
            olNumber = 1;
            // 当前块标记了重新开始编号，不向前追溯
            if (!block.restartNumbering) {
              for (let i = index - 1; i >= 0; i--) {
                if (blocks[i].type !== "ol" || blocks[i].restartNumbering) break;
                olNumber++;
              }
            }
          }

          return (
            <div key={block.id}>
              <BlockView block={block} index={index}
                onChange={(b) => { pushSnapshot(); setBlocks((prev) => prev.map((bl) => (bl.id === b.id ? b : bl))); }}
                onEnter={(html, type) => splitBlock(block.id, html, type, index)}
                onDelete={() => removeBlock(block.id, index)}
                onInsertAfter={(type) => insertAfter(index, type)}
                onPasteImg={(file) => {
                  const newBlock = createBlock("img", "");
                  const updated = [...blocks];
                  updated.splice(index + 1, 0, newBlock);
                  setBlocks(updated);
                  setTimeout(() => readFileAsDataUrl(file).then((d) => {
                    setBlocks((prev) => prev.map((b) => b.id === newBlock.id ? { ...b, html: imageBlockHtml(d, file.name) } : b));
                  }), 50);
                }}
                onBackspace={(content) => mergeUpward(block.id, index, content)}
                onDeleteDown={() => mergeDownward(block.id, index)}
                olNumber={olNumber}
                allBlocks={blocks}
              />
              {/* 块间空白：双击在此处新增段落 */}
              <div className="h-3 cursor-text group/gap" onDoubleClick={() => insertAfter(index)} title="双击新增段落">
                <div className="h-full w-full rounded opacity-0 group-hover/gap:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: "var(--border)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部空白：双击新增段落 */}
      <div className="h-24 cursor-text rounded-lg flex items-center justify-center group/bottom mt-1"
        onDoubleClick={() => insertAfter(blocks.length - 1)}
        style={{ border: "2px dashed transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
        <span className="font-sans text-xs opacity-0 group-hover/bottom:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }}>双击此处新增段落</span>
      </div>

      {/* 底部状态 */}
      <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex items-center justify-between font-sans text-xs" style={{ color: "var(--text-muted)" }}>
          <span>{blocks.length} 个块 · {mdLength} 字符</span>
          <span>{titleText ? titleText.substring(0, 30) : "未命名"}</span>
        </div>
      </div>

      {/* 浮动组件 */}
      <FormatToolbar onInsertLink={() => setLinkOpen(true)} />
      <ShortcutModal open={showShortcuts} onClose={() => setShowShortcuts(false)} shortcuts={shortcuts} setShortcuts={setShortcuts} />
      <LinkDialog open={linkOpen} onClose={() => setLinkOpen(false)} onInsert={insertLink} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={(newBlocks) => { pushSnapshot(); setBlocks(newBlocks); }} />
      <FloatingTOC blocks={blocks} />
    </div>
  );
}
