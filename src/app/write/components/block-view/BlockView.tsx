/**
 * block-view/BlockView.tsx — 单个块的渲染组件
 * [核心职责] 渲染单个Block，包含左侧操作区、内容区、TypePicker弹窗、链接浮窗、有序列表菜单
 * [Android 类比] ListView 的 ViewHolder，负责单个列表项的渲染和交互
 */

"use client";

import { useState, useRef, useEffect, type FC } from "react";
import type { Block, BType } from "../../types";
import {
  ContentEditableArea, flushContentEditable,
} from "../ContentEditableArea";
import { TypePicker } from "../TypePicker";
import {
  highlightCode, readFileAsDataUrl, imageBlockHtml, escapeHtml,
  setCursorToEnd, setCursorToOffset, setCursorToStart,
} from "../../utils";
import { requestCursorRestoration } from "../../utils";
import { CALLOUT_PRESETS, BLOCK_TYPES } from "../../types";
import { CodeMirrorBlock } from "../code-block/CodeMirrorBlock";


// ── 代码块语言颜色映射 ──
const LANG_COLORS: Record<string, string> = {
  javascript: "#f7df1e", typescript: "#3178c6", python: "#3776ab",
  css: "#264de4", html: "#e34f26", json: "#888888",
  bash: "#4eaa25", markdown: "#083fa1", sql: "#e38c00",
  rust: "#dea584", go: "#00add8", java: "#ed8b00",
  c: "#a8b9cc", cpp: "#00599c", kotlin: "#7f52ff",
  ruby: "#cc342d", php: "#777bb4", swift: "#fa7343",
  default: "#666666",
};

const LANG_OPTIONS = [
  "javascript", "typescript", "python", "css", "html", "json",
  "bash", "markdown", "sql", "rust", "go", "java", "c", "cpp",
  "kotlin", "ruby", "php", "swift",
];

const CODE_THEMES = [
  { id: "default", label: "默认" },
  { id: "dark", label: "Dark" },
  { id: "monokai", label: "Monokai" },
  { id: "dracula", label: "Dracula" },
  { id: "github", label: "GitHub" },
  { id: "nord", label: "Nord" },
  { id: "solarized", label: "Solarized" },
] as const;


// ── 代码块主题定义（背景/边框/文字颜色） ──
const CODE_THEME_DEFS: Record<string, { bg: string; header: string; border: string; text: string; textMuted: string; codeText: string }> = {
  default:  { bg: "rgba(245,245,247,1)", header: "rgba(238,238,240,1)", border: "#d1d5da", text: "#24292f", textMuted: "#6e7781", codeText: "#1f2328" },
  dark:     { bg: "#1a1b26", header: "#24283b", border: "#414868", text: "#c0caf5", textMuted: "#7f88b3", codeText: "#c0caf5" },
  monokai:  { bg: "#272822", header: "#3e3d32", border: "#49483e", text: "#f8f8f2", textMuted: "#a6a28c", codeText: "#f8f8f2" },
  dracula:  { bg: "#282a36", header: "#44475a", border: "#6272a4", text: "#f8f8f2", textMuted: "#6272a4", codeText: "#f8f8f2" },
  github:   { bg: "#f6f8fa", header: "#eaeef2", border: "#d0d7de", text: "#1f2328", textMuted: "#656d76", codeText: "#1f2328" },
  nord:     { bg: "#2e3440", header: "#3b4252", border: "#4c566a", text: "#eceff4", textMuted: "#81a1c1", codeText: "#d8dee9" },
  solarized:{ bg: "#fdf6e3", header: "#eee8d5", border: "#93a1a1", text: "#657b83", textMuted: "#93a1a1", codeText: "#586e75" },
};


interface Props {
  block: Block;
  index: number;
  onChange: (b: Block) => void;
  onEnter: (html: string, type?: BType, fallbackIndex?: number, keepOrdered?: boolean) => void;
  onDelete: () => void;
  _onInsertAfter?: (type: BType) => void;
  onPasteImg: (file: File) => void;
  onDropImg: (file: File) => void;
  onBackspace: (content: string) => void;
  onDeletePrevSpecial: () => void;
  onDeleteDown?: () => void;
  olNumber?: number;
  allBlocks?: Block[];
}

export const BlockView: FC<Props> = ({
  block, index, onChange, onEnter, onDelete, _onInsertAfter: _,
  onPasteImg, onDropImg, onBackspace, onDeleteDown, olNumber, allBlocks, onDeletePrevSpecial,
}) => {
  // ── 状态与引用 ──
  const edRef = useRef<HTMLDivElement>(null);
  const flushRef = useRef<(() => string) | null>(null);
  const listDemotingRef = useRef(false); // [Fix] BS锁
  


  const _focused = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 });
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [sideImgError, setSideImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [block.html]);
  useEffect(() => { setSideImgError(false); }, [block.sideImage]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [olMenu, setOlMenu] = useState(false);
  const [tableHoverCol, setTableHoverCol] = useState(-1);
  const [tableHoverRow, setTableHoverRow] = useState(-1);
  useEffect(() => {
    if (!olMenu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".ol-popup")) setOlMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [olMenu]);
  const plusRef = useRef<HTMLButtonElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const [gutterHovered, setGutterHovered] = useState(false);
    const [linkPopup, setLinkPopup] = useState<{ x: number; y: number; url: string; text: string } | null>(null);
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 图片缩放相关
  const imgRef = useRef<HTMLImageElement>(null);
  const imgDragRef = useRef<{ startX: number; startW: number; imgLeft: number; imgWidth: number } | null>(null);
  const sideImgRef = useRef<HTMLImageElement>(null);
  const sideImgDragRef = useRef<{ startX: number; startW: number; imgWidth: number } | null>(null);
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
          setLinkPopup({ x: a.getBoundingClientRect().left, y: a.getBoundingClientRect().top - 4, url: href, text: a.textContent || href });
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
    // 有序列表作为覆盖层：标题/正文选中ol→叠加ordered，非标题→切换为ol
    if (type === "ol") {
      if (["h1", "h2", "h3", "h4", "h5", "p"].includes(block.type)) {
        onChange({ ...block, ordered: !block.ordered });
      } else {
        onChange({ ...block, type: "ol", html: block.html });
      }
    } else {
      onChange({ ...block, type, html: block.html, ordered: undefined });
    }
            // [Fix] onFocus restores cursor
            requestCursorRestoration(block.id, "start");
            const el = edRef.current;
            if (el) el.focus();
  };

  // 图片粘贴/拖拽处理
  const handleImageFile = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    if (block.type === "img") { onChange({ ...block, html: imageBlockHtml(dataUrl, file.name) }); }
    else { onPasteImg(file); }
  };

  const handleDropFile = async (file: File) => {
    if (block.type === "img") { onChange({ ...block, html: imageBlockHtml(await readFileAsDataUrl(file), file.name) }); }
    else { onDropImg(file); }
  };

  // ── 键盘事件处理（核心交互逻辑）──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // [Fix] 非 Backspace 按键清除降级标记（用后即焚，消除 useEffect 竞态）
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
    if (e.key === "Enter" && !e.shiftKey) {
      // 双栏布局（有sideImage）的文本块：Enter只换行，不拆分
      if (block.sideImage) {
        e.preventDefault();
        document.execCommand("insertLineBreak");
        return;
      }
      if (unsplittableTypes.includes(block.type)) {
        // 公式块：Enter插入换行，不拆分
        if (block.type === "formula") { e.preventDefault(); document.execCommand("insertLineBreak"); }
        return;
      }
      if (isComposing.current || processingEnter.current) return;
      processingEnter.current = true;
      flushRef.current?.(); // [Fix-B] flush debounce to prevent split race
      e.preventDefault();
      const el = edRef.current; if (!el) return;
      const splitResult = splitHtmlAtCursor(el);

      if (!splitResult.before && !splitResult.after) {
        // 光标在行首/行尾按Enter
        // 区分：块本身为空 vs 块有内容但光标在行首/尾
        const isBlockEmpty = !block.html.replace(/<[^>]+>/g, "").trim();
        if (block.ordered) {
          if (isBlockEmpty) {
            // 有序覆盖层空块→脱ordered
            onChange({ ...block, ordered: undefined });
          } else {
            // 有序覆盖层有内容→延续下一个有序块
            onEnter("", block.type as BType, index, true);
          }
            // [Fix] onFocus restores cursor
            requestCursorRestoration(block.id, "start");
            const el = edRef.current;
            if (el) el.focus();
        } else if (block.type === "ol") {
          // 有序列表空块→退为段落（退出有序列表）
          // 有序列表有内容→延续下一个有序项
          if (isBlockEmpty) {
            onChange({ ...block, type: "p" });
          } else {
            onEnter("", "ol", index, false);
          }
            // [Fix] onFocus restores cursor
            requestCursorRestoration(block.id, "start");
            const el = edRef.current;
            if (el) el.focus();
        } else {
          // 其他列表（ul/todo）空行→退为段落
          const exitType = ["ul", "todo"].includes(block.type) ? "p" : block.type;
          if (exitType !== block.type) {
            onChange({ ...block, type: exitType });
            // [Fix] onFocus restores cursor
            requestCursorRestoration(block.id, "start");
            const el = edRef.current;
            if (el) el.focus();
          } else {
            onEnter("", exitType, index, false);
          }
        }
      } else {
        // Enter拆分：直接使用 splitResult.before（光标前内容）更新当前块
        onChange({ ...block, html: splitResult.before });
        // [Fix-E] 强制DOM同步：防止debounce在React重渲染前将旧内容回写
        if (edRef.current) edRef.current.innerHTML = splitResult.before;
        const afterText = splitResult.after.replace(/<[^>]+>/g, "").trim();
        // 列表块末尾Enter：有内容→延续列表，空块→当前块退为段落
        // 有序覆盖层（ordered标题/段落）也按同样逻辑处理
        const isOrderedBlock = block.type === "ol" || block.ordered;
        if (isOrderedBlock && !afterText) {
          const isBlockEmpty = !block.html.replace(/<[^>]+>/g, "").trim();
          if (isBlockEmpty) {
            // 有序块空行：脱ordered，退为普通块
            if (block.ordered) {
              onChange({ ...block, ordered: undefined });
            } else {
              onChange({ ...block, type: "p" });
            }
            // [Fix] onFocus restores cursor
            requestCursorRestoration(block.id, "start");
            const el = edRef.current;
            if (el) el.focus();
          } else {
            // 有序块有内容：新生成的块转为ol类型以继承编号
            onEnter("", "ol", index, false);
          }
        } else if (["ol", "ul", "todo"].includes(block.type) && !afterText) {
          // 普通列表块（非ordered覆盖层）
          onEnter("", block.type, index, false);
        } else {
          // 非空行Enter拆分：检查当前块是否为有序覆盖层
          const shortcut = !["ol", "ul", "todo"].includes(block.type) ? detectMarkdownShortcut(afterText) : null;
          const baseType = shortcut ? shortcut.type : block.type;
          let newType: BType;
          let keepOrdered = false;
          // 有序覆盖层Enter：保持同类型+ordered，编号继续
          if (block.ordered) {
            newType = baseType;
            keepOrdered = true;
          } else {
            newType = baseType;
          }
          onEnter(splitResult.after, newType, index, keepOrdered);
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
        // 克隆内容后去除 HTML 标签和空白，只看可见文本
        const preDivPre = document.createElement("div");
        preDivPre.appendChild(preRange.cloneContents());
        const visText = preDivPre.innerHTML.replace(/<[^>]+>/g, "").replace(/\s/g, "").replace(/[​﻿]/g, "");
        atStart = visText.length === 0;
      }

      if (!atStart) {
      }
      if (atStart) {
        e.preventDefault();
        // 有序覆盖层：先脱ordered
        if (block.ordered && block.html.replace(/<[^>]+>/g, "").trim()) {
          onChange({ ...block, ordered: undefined, restartNumbering: undefined });
            // [Fix] onFocus restores cursor
            requestCursorRestoration(block.id, "start");
            const el = edRef.current;
            if (el) el.focus();
          return;
        }

        // 标题：空标题→直接删除，有内容→退化为正文段落
        if (["h1", "h2", "h3", "h4", "h5"].includes(block.type)) {
          if (!block.html.replace(/<[^>]+>/g, "").trim()) {
            onDelete();
          } else {
            onChange({ ...block, type: "p" as const, html: block.html });
            requestCursorRestoration(block.id, "start");
          }
          return;
        }

        // 引用：有文字→正常删字符，空白→删框
        if (block.type === "quote" && block.html.replace(/<[^>]+>/g, "").trim()) {
          return;
        }

                // 有序/无序/待办列表：第一次BS退为段落，第二次BS合并到上一块
                // [Fix] 降级进行中，吞掉BS等恢复完再处理
        // [Diag] 确认listHandler是否到达
        if (listDemotingRef.current) { e.preventDefault(); return; }
if (["ol", "ul", "todo"].includes(block.type)) {
          flushRef.current?.();
          const _blkId = block.id;
          const _savedOffset = (() => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && edEl) {
              const r = sel.getRangeAt(0);
              const pr = document.createRange();
              pr.selectNodeContents(edEl);
              pr.setEnd(r.startContainer, r.startOffset);
              return pr.toString().length;
            }
            return 0;
          })();
          listDemotingRef.current = true;
          onChange({ ...block, type: "p" as const, html: edEl.innerHTML });
          let _att = 0;
          const _tryRestore = () => {
            _att++;
            const el = document.querySelector(`[data-block="${_blkId}"] [contenteditable]`) as HTMLElement | null;
            if (el && el.isConnected) {
              el.focus();
              setCursorToOffset(el, _savedOffset);
              requestAnimationFrame(() => {
                if (document.activeElement === el) {
                  listDemotingRef.current = false;
                } else if (_att < 50) {
                  setTimeout(_tryRestore, 8);
                } else {
                  listDemotingRef.current = false;
                }
              });
              return;
            }
            if (_att < 50) { setTimeout(_tryRestore, 8); }
          };
          _tryRestore();
          return;
        }


        // 默认：合并到上一块（段落直接合并，无需两步）；可见内容为空则走删除路径
        flushRef.current?.();
        const _v0 = edEl.innerHTML.replace(/<[^>]+>/g, "").trim();
        onBackspace(_v0 ? edEl.innerHTML : "");
        return;
      }
    }

    // Delete：行尾删除
    if (e.key === "Delete" && block.type !== "code" && block.type !== "hr") {
      const el = edRef.current; if (!el) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        e.preventDefault();
        document.execCommand("delete", false);
        if (el) onChange({ ...block, html: el.innerHTML });
        return;
      }

      let atEnd = false;
      let atStart = false;
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        // 检查是否在行尾
        const postRange = document.createRange();
        postRange.selectNodeContents(el);
        postRange.setStart(r.endContainer, r.endOffset);
        atEnd = postRange.toString().length === 0;
        // 检查是否在行首
        const preRange = document.createRange();
        preRange.selectNodeContents(el);
        preRange.setEnd(r.startContainer, r.startOffset);
        atStart = preRange.toString().length === 0;
      }
      // Delete在行首：等同于Backspace行首，合并到上一块
      if (atStart && !atEnd) {
        e.preventDefault();
        flushRef.current?.();
        onBackspace(el.innerText || "");
        return;
      }
      if (atEnd) { e.preventDefault(); onDeleteDown?.(); return; }
    }
  };

  // ═══════════════════════════════════════
  //  各类型Block渲染
  // ═══════════════════════════════════════
  const renderBlockContent = () => {
    // ── 分割线 ──
    if (block.type === "hr") return (
      <div className="py-2 relative group/hr cursor-pointer" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onDelete(); } }}
        onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}>
        <div className="rounded transition-colors duration-150"
          style={{ borderTop: "2px solid var(--border)", marginLeft: -48 }} />
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
      const themeDef = CODE_THEME_DEFS[block.codeTheme || "default"] || CODE_THEME_DEFS.default;
      const langColor = LANG_COLORS[block.lang || "default"] || LANG_COLORS.default;
      const rawCode = block.text !== undefined ? block.text : block.html.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
      return (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: themeDef.border, backgroundColor: themeDef.bg }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: themeDef.header, borderLeft: `3px solid ${langColor}` }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f56" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ffbd2e" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#27c93f" }} />
              <span className="font-mono text-sm ml-2 font-bold" style={{ color: langColor }}>{(block.lang || "auto").toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={block.lang || ""} onChange={(e) => onChange({ ...block, lang: e.target.value || undefined })}
                className="font-mono text-sm px-1.5 py-0.5 rounded border-0 outline-none cursor-pointer font-medium"
                style={{ backgroundColor: "transparent", color: themeDef.text }}>
                <option value="" style={{ color: themeDef.text, backgroundColor: themeDef.header }}>自动检测</option>
                {LANG_OPTIONS.map((l) => (<option key={l} value={l} style={{ color: themeDef.text, backgroundColor: themeDef.header }}>{l}</option>))}
              </select>
              <select value={block.codeTheme || "default"} onChange={(e) => onChange({ ...block, codeTheme: e.target.value })}
                className="font-mono text-sm px-1.5 py-0.5 rounded border-0 outline-none cursor-pointer font-medium"
                style={{ backgroundColor: "transparent", color: themeDef.text }}>
                {CODE_THEMES.map((t) => (<option key={t.id} value={t.id} style={{ color: themeDef.text, backgroundColor: themeDef.header }}>{t.label}</option>))}
              </select>
              <button onClick={onDelete} className="font-mono text-sm hover:opacity-70" style={{ color: themeDef.textMuted }}>删除</button>
              <button onClick={async () => { await navigator.clipboard.writeText(rawCode); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }}
                className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--bg-subtle)] transition-colors" style={{ color: themeDef.textMuted }} title={copyFeedback ? "已复制" : "复制"}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="5" width="9" height="9" rx="1" />
                    <path d="M3 11V3h8" />
                  </svg>
                </button>
            </div>
          </div>
          <CodeMirrorBlock
            value={rawCode}
            lang={block.lang}
            theme={block.codeTheme || "default"}
            onChange={(val) => onChange({ ...block, text: val, html: escapeHtml(val) })}
            onBackspaceEmpty={onDelete}
            onFocus={() => _focused[1](true)}
            onBlur={() => _focused[1](false)}
          />
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
          onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onDelete(); } }}
          onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}>
          {!imgUrl ? (
            <>
              <div className="flex items-center gap-3 py-2">
                <span className="text-lg shrink-0">🖼</span>
                <input type="text" value={imgUrl && !imgUrl.startsWith("data:") ? imgUrl : ""}
                  onChange={(e) => { const url = e.target.value.trim(); if (url) onChange({ ...block, html: imageBlockHtml(url, "图片") }); }}
                  onKeyDown={(e) => { if ((e.key === "Backspace" || e.key === "Delete") && !imgUrl) { e.preventDefault(); onDelete(); } }}
                  onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
                  className="flex-1 font-sans text-sm outline-none"
                  style={{ backgroundColor: "transparent", color: "var(--text)", caretColor: "var(--accent)" }} placeholder="输入图片URL" />
              </div>
              <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => { e.preventDefault(); const file = e.dataTransfer?.files?.[0]; if (file && file.type.startsWith("image/")) handleImageFile(file); }}
                onPaste={async (e) => { const items = e.clipboardData?.items; if (!items) return; for (let i = 0; i < items.length; i++) { if (items[i].type.startsWith("image/")) { e.preventDefault(); const file = items[i].getAsFile(); if (file) { handleImageFile(file); } return; } } }}
                onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = () => { const file = input.files?.[0]; if (file) readFileAsDataUrl(file).then((d) => { onChange({ ...block, html: imageBlockHtml(d, file.name) }); }); }; input.click(); }}>
                <span className="text-3xl block mb-2">🖼</span>
                <span className="font-sans text-sm" style={{ color: "var(--text-secondary)" }}>点击/拖拽/粘贴上传</span>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="relative inline-block group/img" style={{ width: imgWidth + "%", maxWidth: "100%" }}>
                {imgError ? (
                  <div className="rounded flex items-center justify-center" style={{ backgroundColor: "var(--bg-subtle)", minHeight: 120 }}>
                    <span className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>🖼 加载失败</span>
                  </div>
                ) : (
                  <img ref={imgRef} src={imgUrl} alt="预览"
                    style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }}
                    onError={() => setImgError(true)}
                    onDoubleClick={() => setLightboxSrc(imgUrl)} />
                )}
                <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none"
                  style={{ border: "2px solid var(--accent)", borderRadius: 6 }} />
                {["nw", "ne", "sw", "se"].map((pos) => (
                  <div key={pos} onMouseDown={startResize}
                    className="absolute w-3 h-3 bg-white border-2 rounded-sm opacity-0 group-hover/img:opacity-100 transition-opacity cursor-nwse-resize pointer-events-auto"
                    style={{ borderColor: "var(--accent)", [pos.includes("n") ? "top" : "bottom"]: -5, [pos.includes("w") ? "left" : "right"]: -5 }} />
                ))}
                <button onClick={() => onDelete()} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer z-10">✕</button>
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
        <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                        blockId={block.id}
          onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
          onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
          className="flex-1 px-4 py-3 outline-none italic"
          style={{ color: "var(--text-secondary)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em" }}
          placeholder="引用内容…" spellCheck={false} />
      </div>
    );

    // ── 有序列表 ──
    if (block.type === "ol") {
      const blks = allBlocks || [];
      let totalInGroup = 0;
      if (blks.length) {
        let scopeStart = 0, scopeEnd = blks.length;
        for (let i = index - 1; i >= 0; i--) {
          if (["h1", "h2", "h3", "h4", "h5"].includes(blks[i]?.type || "")) { scopeStart = i + 1; break; }
        }
        for (let i = scopeStart; i < blks.length; i++) {
          if (["h1", "h2", "h3", "h4", "h5"].includes(blks[i]?.type || "") && i > index) { scopeEnd = i; break; }
        }
        for (let i = scopeStart; i < scopeEnd; i++) {
          if (blks[i]?.type === "ol" || blks[i]?.ordered) totalInGroup++;
        }
      }

      return (
        <div className="flex" style={{ paddingLeft: 0 }}>
          <div className="relative w-6 shrink-0 text-right pr-2 font-mono text-sm cursor-pointer select-none"
            style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
            onClick={() => setOlMenu(!olMenu)} title="点击设置编号">
            {olNumber ?? 1}.
            {olMenu && (
              <div className="ol-popup absolute left-0 bottom-full mb-1 z-50 w-44 rounded-lg border shadow-lg py-1"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                onClick={(e) => e.stopPropagation()}>
                <div className="px-3 py-1.5 font-sans text-xs" style={{ color: "var(--text-muted)" }}>
                  第 {olNumber ?? 1} 项，共 {totalInGroup} 项
                </div>
                <div className="mx-2 my-0.5" style={{ borderTop: "1px solid var(--border-light)" }} />
                <button className="w-full px-3 py-1.5 text-left font-sans text-xs hover:bg-[var(--bg-subtle)] flex items-center gap-2" style={{ color: "var(--text)" }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOlMenu(false); onChange({ ...block, restartNumbering: false }); }}>
                  <span className="text-[10px]" style={{ color: block.restartNumbering ? "transparent" : "var(--accent)" }}>✓</span>
                  跟随上一组编号
                </button>
                <button className="w-full px-3 py-1.5 text-left font-sans text-xs hover:bg-[var(--bg-subtle)] flex items-center gap-2" style={{ color: "var(--text)" }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOlMenu(false); onChange({ ...block, restartNumbering: true }); }}>
                  <span className="text-[10px]" style={{ color: block.restartNumbering ? "var(--accent)" : "transparent" }}>✓</span>
                  重新开始编号
                </button>
              </div>
            )}
          </div>
          <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                          blockId={block.id}
            onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
            onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
            className="w-full py-0.5 outline-none"
            style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em" }}
            placeholder="1. 第一项" spellCheck={false} />
        </div>
      );
    }

    // ── 无序列表 ──
    if (block.type === "ul") return (
      <div className="flex" style={{ paddingLeft: 0 }}>
        <div className="w-6 shrink-0 text-right pr-2 font-mono text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>•</div>
        <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                        blockId={block.id}
          onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
          onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
          className="w-full py-0.5 outline-none"
          style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em" }}
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
          <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                          blockId={block.id}
            onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
            onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
            className="flex-1 outline-none"
            style={{ color: block.checked ? "var(--text-muted)" : "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em", textDecoration: block.checked ? "line-through" : "none" }}
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
          <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                          blockId={block.id}
            onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
            onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
            className="flex-1 outline-none"
            style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em" }}
            placeholder="提示内容…" spellCheck={false} />
        </div>
      );
    }

    // ── 表格 ──
    if (block.type === "table") {
      //  Parse markdown table into data model
      const parseTable = (): { headers: string[]; aligns: string[]; rows: string[][]; colCount: number } => {
        const mdLines = block.html.split("\n").filter(l => l.trim().startsWith("|"));
        const cells = mdLines.map(r => r.split("|").filter((c, i, a) => i > 0 && i < a.length - 1).map(c => c.trim()));
        const headers = cells[0] || [];
        const hasSep = cells.length > 1 && cells[1].every(c => /^[-:]+$/.test(c));
        const aligns = hasSep ? cells[1].map(c => c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left") : headers.map(() => "left");
        const dataRows = hasSep ? cells.slice(2) : cells.slice(1);
        return { headers, aligns, rows: dataRows, colCount: headers.length };
      };

      const tableData = parseTable();
      const { headers, aligns, rows, colCount } = tableData;

      //  Sync DOM edits → markdown
      const syncToMarkdown = () => {
        const container = document.querySelector(`[data-table="${block.id}"]`);
        if (!container) return;
        const ths = container.querySelectorAll("thead th[data-cell]");
        const headerTexts = Array.from(ths).map((t: any) => t.textContent?.trim() || "");
        const bodyRows = container.querySelectorAll("tbody tr[data-row]");
        const rowTexts = Array.from(bodyRows).map((tr: any) =>
          Array.from(tr.querySelectorAll("td[data-cell]")).map((td: any) => td.textContent?.trim() || "")
        );
        const headerStr = "| " + headerTexts.join(" | ") + " |";
        const sepRow = "|" + headerTexts.map((_, i) => {
          const a = aligns[i] || "left";
          return a === "center" ? " :---: " : a === "right" ? " ---: " : " --- ";
        }).join("|") + "|";
        const dataStr = rowTexts.map(r => "| " + r.join(" | ") + " |").join("\n");
        const md = dataStr ? [headerStr, sepRow, dataStr].join("\n") : [headerStr, sepRow].join("\n");
        onChange({ ...block, html: escapeHtml(md) });
      };

      //  Add row at position
      const addRowAt = (pos: number) => {
        const newRows = [...rows];
        newRows.splice(pos, 0, Array(colCount).fill(""));
        const headerStr = "| " + headers.join(" | ") + " |";
        const sepRow = "|" + headers.map((_, i) => {
          const a = aligns[i] || "left";
          return a === "center" ? " :---: " : a === "right" ? " ---: " : " --- ";
        }).join("|") + "|";
        const dataStr = newRows.map(r => "| " + r.join(" | ") + " |").join("\n");
        onChange({ ...block, html: escapeHtml([headerStr, sepRow, dataStr].join("\n")) });
      };

      //  Delete row
      const deleteRowAt = (pos: number) => {
        if (rows.length <= 1) { onDelete(); return; }
        const newRows = [...rows];
        newRows.splice(pos, 1);
        const headerStr = "| " + headers.join(" | ") + " |";
        const sepRow = "|" + headers.map((_, i) => {
          const a = aligns[i] || "left";
          return a === "center" ? " :---: " : a === "right" ? " ---: " : " --- ";
        }).join("|") + "|";
        const dataStr = newRows.map(r => "| " + r.join(" | ") + " |").join("\n");
        onChange({ ...block, html: escapeHtml([headerStr, sepRow, dataStr].join("\n")) });
      };

      //  Add column at position
      const addColAt = (pos: number) => {
        const newHeaders = [...headers];
        newHeaders.splice(pos, 0, "");
        const newAligns = [...aligns];
        newAligns.splice(pos, 0, "left");
        const newRows = rows.map(r => {
          const nr = [...r];
          nr.splice(pos, 0, "");
          return nr;
        });
        const headerStr = "| " + newHeaders.join(" | ") + " |";
        const sepRow = "|" + newAligns.map(a => a === "center" ? " :---: " : a === "right" ? " ---: " : " --- ").join("|") + "|";
        const dataStr = newRows.map(r => "| " + r.join(" | ") + " |").join("\n");
        onChange({ ...block, html: escapeHtml([headerStr, sepRow, dataStr].join("\n")) });
      };

      //  Delete column
      const deleteColAt = (pos: number) => {
        if (colCount <= 1) return;
        const newHeaders = [...headers];
        newHeaders.splice(pos, 1);
        const newAligns = [...aligns];
        newAligns.splice(pos, 1);
        const newRows = rows.map(r => {
          const nr = [...r];
          nr.splice(pos, 1);
          return nr;
        });
        const headerStr = "| " + newHeaders.join(" | ") + " |";
        const sepRow = "|" + newAligns.map(a => a === "center" ? " :---: " : a === "right" ? " ---: " : " --- ").join("|") + "|";
        const dataStr = newRows.map(r => "| " + r.join(" | ") + " |").join("\n");
        onChange({ ...block, html: escapeHtml([headerStr, sepRow, dataStr].join("\n")) });
      };

      const effectiveRows = rows.length > 0 ? rows : [Array(colCount).fill("")];

      const colAlign = (i: number) => (aligns[i] || "left") as "left" | "center" | "right";

      return (
        <div className="space-y-2" onMouseLeave={() => { setTableHoverCol(-1); setTableHoverRow(-1); }}>
          <div className="relative rounded-lg border" style={{ borderColor: "var(--border)" }} data-table={block.id}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-sans text-sm">
                <colgroup>
                  <col style={{ width: 32 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ width: 32 }} className="!p-0 !border-0"></th>
                    {headers.map((cell, ci) => (
                      <th key={ci} data-cell contentEditable suppressContentEditableWarning
                        onInput={syncToMarkdown} onBlur={syncToMarkdown}
                        className="px-3 py-2 text-left font-semibold border-b outline-none relative"
                        style={{ borderColor: "var(--border)", color: "var(--text)", backgroundColor: "var(--bg-subtle)", textAlign: colAlign(ci) }}>
                        {cell}
                        {tableHoverCol === ci && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-0.5 z-20">
                            <button onClick={() => addColAt(ci)} title="左侧添加列"
                              className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: "var(--accent)", color: "white" }}>+</button>
                            {colCount > 1 && (
                              <button onClick={() => deleteColAt(ci)} title="删除列"
                                className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                                style={{ backgroundColor: "var(--text-muted)", color: "white" }}>×</button>
                            )}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {effectiveRows.map((row, ri) => (
                    <tr key={ri} data-row
                      onMouseEnter={() => setTableHoverRow(ri)}
                      onMouseLeave={() => setTableHoverRow(-1)}
                      style={{ backgroundColor: ri % 2 === 0 ? "transparent" : "var(--bg-subtle)" }}>
                      <td className="!p-0 !border-0 relative" style={{ width: 32 }}>
                        {tableHoverRow === ri && (
                          <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 z-20">
                            <button onClick={() => addRowAt(ri)} title="上方添加行"
                              className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: "var(--accent)", color: "white" }}>+</button>
                            {rows.length > 1 && (
                              <button onClick={() => deleteRowAt(ri)} title="删除行"
                                className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                                style={{ backgroundColor: "var(--text-muted)", color: "white" }}>×</button>
                            )}
                          </div>
                        )}
                      </td>
                      {row.map((cell, ci) => (
                        <td key={ci} data-cell contentEditable suppressContentEditableWarning
                          onInput={syncToMarkdown} onBlur={syncToMarkdown}
                          className="px-3 py-2 border-b outline-none"
                          style={{ borderColor: "var(--border-light)", color: "var(--text)", textAlign: colAlign(ci) }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 底部操作栏 */}
            <div className="flex items-center justify-between px-2 py-1.5 border-t"
              style={{ borderColor: "var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
              <button onClick={() => addRowAt(effectiveRows.length)}
                className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
                style={{ color: "var(--text-muted)" }}>+ 添加行</button>
              <div className="flex items-center gap-2">
                <button onClick={() => addColAt(colCount)}
                  className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
                  style={{ color: "var(--text-muted)" }}>+ 添加列</button>
                <button onClick={() => onDelete()}
                  className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
                  style={{ color: "var(--text-muted)" }}>删除表格</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (block.type === "toggle") {
      const toggle = () => onChange({ ...block, collapsed: !block.collapsed });
      return (
        <div className="flex items-start gap-2 py-0.5">
          <button onClick={toggle} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-subtle)] transition-transform shrink-0 mt-0.5"
            style={{ transform: block.collapsed ? "rotate(-90deg)" : "rotate(0deg)", color: "var(--text-secondary)" }}>▶</button>
          <div className="flex-1 min-w-0">
            <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                            blockId={block.id}
              onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
              onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
              className="w-full outline-none"
              style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em" }}
              placeholder="折叠标题…" spellCheck={false} />
            <div className="overflow-hidden" style={{ maxHeight: block.collapsed ? 0 : 2000, opacity: block.collapsed ? 0 : 1, transition: "max-height 0.3s ease, opacity 0.3s ease" }}>
              <div className="ml-4 mt-1 pl-4 border-l-2" style={{ borderColor: "var(--border-light)" }}>
                <ContentEditableArea html={block.toggleContent || ""} onChange={(html) => onChange({ ...block, toggleContent: html })}
                  onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
                  onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
                  className="w-full outline-none"
                  style={{ color: "var(--text-secondary)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "0.9rem", lineHeight: 1.2, minHeight: "1em" }}
                  placeholder="折叠内容…" spellCheck={false} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── 数学公式 ──
    if (block.type === "formula") {
      const displayMode = block.formulaDisplay !== false;
      let rendered = "";
      try {
        const katex = require("katex");
        rendered = katex.renderToString(block.html.trim() || "\\ ", { throwOnError: false, displayMode });
      } catch { rendered = escapeHtml(block.html); }
      return (
        <div className="py-3" tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Delete") {
              if (!block.html.trim()) { e.preventDefault(); onDelete(); }
            }
          }}
          onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg shrink-0">∑</span>
            <ContentEditableArea html={block.html} onChange={(html) => onChange({ ...block, html })}
              onPasteImg={handleImageFile} onDropImg={handleDropFile}
              onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
              className="flex-1 outline-none font-mono text-sm"
              style={{ color: "var(--text)", caretColor: "var(--accent)", lineHeight: 1.2, minHeight: "1em" }}
              placeholder="输入 LaTeX 公式，如: E = mc^2" spellCheck={false} />
            <button onClick={() => onChange({ ...block, formulaDisplay: !displayMode })}
              className="shrink-0 px-1.5 py-0.5 rounded font-mono text-[10px] hover:bg-[var(--bg-subtle)] cursor-pointer"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              title={displayMode ? "切换为行内公式" : "切换为块级公式"}>
              {displayMode ? "块" : "行"}
            </button>
          </div>
          <div className="flex justify-center overflow-x-auto py-3" style={{ minHeight: 30 }}
            dangerouslySetInnerHTML={{ __html: rendered }} />
        </div>
      );
    }

    // ── 嵌入网页 ──
    if (block.type === "embed") {
      const url = block.html.trim();
      return (
        <div className="space-y-2" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onDelete(); } }}
          onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}>
          <div className="flex items-center gap-3 py-2">
            <span className="text-lg shrink-0">🌐</span>
            <input type="text" value={url} onChange={(e) => onChange({ ...block, html: e.target.value })}
              onKeyDown={(e) => { if ((e.key === "Backspace" || e.key === "Delete") && !url) { e.preventDefault(); onDelete(); } }}
              placeholder="输入网页URL…" className="flex-1 font-sans text-sm outline-none"
              style={{ backgroundColor: "transparent", color: "var(--text)" }}
              onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)} />
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

    // ordered 覆盖层渲染
    if (block.ordered) {
      return (
        <div className="flex" style={{ paddingLeft: 0 }}>
          <div className="relative w-6 shrink-0 text-right pr-2 font-mono text-sm cursor-pointer select-none"
            style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
            onClick={() => setOlMenu(!olMenu)} title="点击设置编号">
            {olNumber ?? 1}.
            {olMenu && (
              <div className="ol-popup absolute left-0 bottom-full mb-1 z-50 w-44 rounded-lg border shadow-lg py-1"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                onClick={(e) => e.stopPropagation()}>
                <div className="px-3 py-1.5 font-sans text-xs" style={{ color: "var(--text-muted)" }}>
                  第 {olNumber ?? 1} 项
                </div>
                <div className="mx-2 my-0.5" style={{ borderTop: "1px solid var(--border-light)" }} />
                <button className="w-full px-3 py-1.5 text-left font-sans text-xs hover:bg-[var(--bg-subtle)] flex items-center gap-2" style={{ color: "var(--text)" }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOlMenu(false); onChange({ ...block, restartNumbering: false }); }}>
                  <span className="text-[10px]" style={{ color: block.restartNumbering ? "transparent" : "var(--accent)" }}>✓</span>
                  跟随上一组编号
                </button>
                <button className="w-full px-3 py-1.5 text-left font-sans text-xs hover:bg-[var(--bg-subtle)] flex items-center gap-2" style={{ color: "var(--text)" }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOlMenu(false); onChange({ ...block, restartNumbering: true }); }}>
                  <span className="text-[10px]" style={{ color: block.restartNumbering ? "var(--accent)" : "transparent" }}>✓</span>
                  重新开始编号
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex gap-4 items-start">
              <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                              blockId={block.id}
                onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
                onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
                className="flex-1 min-w-0 outline-none"
                style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em", ...headingStyle }}
                placeholder={placeholderText} spellCheck={false} />
              {block.sideImage && (
                <div className="relative shrink-0 group/sideimg" style={{ width: (block.sideImgWidth ?? 50) + "%", maxWidth: "100%" }}>
                  {sideImgError ? (
                    <div className="rounded flex items-center justify-center" style={{ backgroundColor: "var(--bg-subtle)", minHeight: 80 }}>
                      <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>🖼 加载失败</span>
                    </div>
                  ) : (
                    <img ref={sideImgRef} src={block.sideImage} alt="侧栏图片"
                      style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }}
                      onError={() => setSideImgError(true)}
                      onDoubleClick={() => { const w = window.open(""); if (w) w.document.write(`<img src="${block.sideImage}" style="max-width:100%">`); }} />
                  )}
                  {["nw", "ne", "sw", "se"].map((pos) => (
                    <div key={pos} onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const img = sideImgRef.current; if (!img) return;
                      sideImgDragRef.current = { startX: e.clientX, startW: block.sideImgWidth ?? 50, imgWidth: img.offsetWidth };
                      const onMove = (ev: MouseEvent) => {
                        if (!sideImgDragRef.current) return;
                        const dx = ev.clientX - sideImgDragRef.current.startX;
                        const containerW = img.parentElement?.parentElement?.clientWidth || 800;
                        const newPercent = Math.max(10, Math.min(100, sideImgDragRef.current.startW + (dx / containerW) * 100));
                        onChange({ ...block, sideImgWidth: Math.round(newPercent) });
                      };
                      const onUp = () => { sideImgDragRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
                    }}
                      className="absolute w-3 h-3 bg-white border-2 rounded-sm opacity-0 group-hover/sideimg:opacity-100 transition-opacity cursor-nwse-resize pointer-events-auto z-10"
                      style={{ borderColor: "var(--accent)", [pos.includes("n") ? "top" : "bottom"]: -5, [pos.includes("w") ? "left" : "right"]: -5 }} />
                  ))}
                  <button onClick={() => onChange({ ...block, sideImage: undefined, sideImgWidth: undefined })} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/sideimg:opacity-100 transition-opacity cursor-pointer z-10">✕</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 非 ordered 的标题/正文
    return (
      <div className="flex gap-4 items-start">
        <ContentEditableArea html={block.html} innerRef={edRef} flushRef={flushRef} onChange={(html) => onChange({ ...block, html })}
                        blockId={block.id}
          onKeyDown={handleKeyDown} onPasteImg={handleImageFile} onDropImg={handleDropFile}
          onFocus={() => _focused[1](true)} onBlur={() => _focused[1](false)}
          className="flex-1 min-w-0 outline-none"
          style={{ color: "var(--text)", caretColor: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "1.0625rem", lineHeight: 1.2, minHeight: "1em", ...headingStyle }}
          placeholder={placeholderText} spellCheck={false} />
        {block.sideImage && (
          <div className="relative shrink-0 group/sideimg" style={{ width: (block.sideImgWidth ?? 50) + "%", maxWidth: "100%" }}>
            <img ref={sideImgRef} src={block.sideImage} alt="侧栏图片"
              style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }}
              onDoubleClick={() => { const w = window.open(""); if (w) w.document.write(`<img src="${block.sideImage}" style="max-width:100%">`); }} />
            {["nw", "ne", "sw", "se"].map((pos) => (
              <div key={pos} onMouseDown={(e) => {
                e.preventDefault(); e.stopPropagation();
                const img = sideImgRef.current; if (!img) return;
                sideImgDragRef.current = { startX: e.clientX, startW: block.sideImgWidth ?? 50, imgWidth: img.offsetWidth };
                const onMove = (ev: MouseEvent) => {
                  if (!sideImgDragRef.current) return;
                  const dx = ev.clientX - sideImgDragRef.current.startX;
                  const containerW = img.parentElement?.parentElement?.clientWidth || 800;
                  const newPercent = Math.max(10, Math.min(100, sideImgDragRef.current.startW + (dx / containerW) * 100));
                  onChange({ ...block, sideImgWidth: Math.round(newPercent) });
                };
                const onUp = () => { sideImgDragRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
              }}
                className="absolute w-3 h-3 bg-white border-2 rounded-sm opacity-0 group-hover/sideimg:opacity-100 transition-opacity cursor-nwse-resize pointer-events-auto z-10"
                style={{ borderColor: "var(--accent)", [pos.includes("n") ? "top" : "bottom"]: -5, [pos.includes("w") ? "left" : "right"]: -5 }} />
            ))}
            <button onClick={() => onChange({ ...block, sideImage: undefined, sideImgWidth: undefined })} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/sideimg:opacity-100 transition-opacity cursor-pointer z-10">✕</button>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════
  //  BlockView 主 JSX
  // ═══════════════════════════════════════
  return (
    <div className="group relative" data-block={block.id} {...(isHeading ? { "data-heading": "true" } as Record<string, string> : {})}>
      <div className="flex items-start" style={{ minHeight: block.type === "hr" ? 16 : block.type === "code" ? 0 : 24 }}>
        {/* 左侧操作区 */}
        <div className="w-14 shrink-0 pt-0.5 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer rounded-lg relative"
          onMouseEnter={() => setGutterHovered(true)} onMouseLeave={() => setGutterHovered(false)}
          >
          {isEmpty ? (
            <button ref={plusRef} onMouseDown={(e) => { e.preventDefault(); openInsertPicker(); }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-xl font-bold hover:scale-110 hover:bg-[var(--bg-subtle)] transition-transform group/plus relative"
              style={{ color: "var(--accent)", lineHeight: 1 }}>
              +
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md font-sans text-[11px] whitespace-nowrap opacity-0 group-hover/plus:opacity-100 transition-opacity pointer-events-none z-50"
                style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>选择块类型</span>
            </button>
          ) : (
            <button ref={typeRef} onMouseDown={(e) => { e.preventDefault(); openChangePicker(); }}
              className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold hover:bg-[var(--bg-subtle)] group/type relative"
              style={{ color: "var(--text-muted)", fontFamily: "'SF Mono', monospace", lineHeight: 1 }}>
              {currentTypeMeta.icon}
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md font-sans text-[11px] whitespace-nowrap opacity-0 group-hover/type:opacity-100 transition-opacity pointer-events-none z-50"
                style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>
                {currentTypeMeta.label}{block.ordered ? " · 编号" : ""}
              </span>
            </button>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0 rounded-r-lg"
          style={{ paddingLeft: 4, backgroundColor: gutterHovered ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "transparent", transition: "background-color 0.15s ease" }}>
          {renderBlockContent()}
        </div>
      </div>

      {/* TypePicker弹窗 */}
      <TypePicker open={showPicker} position={pickerPos} currentType={block.type} ordered={block.ordered} onSelect={handlePickerSelect} onClose={() => setShowPicker(false)} />

      {/* 链接悬浮浮窗 */}
      {linkPopup && (
        <div className="fixed z-[150] flex items-center gap-0.5 px-2 py-1 rounded-lg shadow-lg border"
          style={{ left: linkPopup.x, bottom: window.innerHeight - linkPopup.y, backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
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
};

// ── 辅助函数（从page.tsx提取的DOM操作） ──

/** 在光标位置拆分contentEditable内容 */
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

/** 检测行首Markdown触发符 */
function detectMarkdownShortcut(trimmed: string): { type: BType; html: string } | null {
  const { escapeHtml: escHtml } = require("../../utils");
  const shortcutMap: Record<string, BType> = { "##": "h2", "###": "h3", ">": "quote", "-": "ul", "---": "hr", "```": "code", "[]": "todo", "[ ]": "todo", ">>": "toggle", "$$": "formula" };
  if (shortcutMap[trimmed] !== undefined) return { type: shortcutMap[trimmed], html: "" };
  if (/^\d+\.\s*$/.test(trimmed)) return { type: "ol", html: "" };
  if (trimmed.startsWith("## ") && trimmed.length > 3) return { type: "h2", html: escHtml(trimmed.slice(3)) };
  if (trimmed.startsWith("### ") && trimmed.length > 4) return { type: "h3", html: escHtml(trimmed.slice(4)) };
  if (trimmed.startsWith("> ") && trimmed.length > 2) return { type: "quote", html: escHtml(trimmed.slice(2)) };
  if (trimmed.startsWith("- ") && trimmed.length > 2) return { type: "ul", html: escHtml(trimmed.slice(2)) };
  if ((trimmed.startsWith("[ ] ") || trimmed.startsWith("[] ")) && trimmed.length > 3) return { type: "todo", html: escHtml(trimmed.slice(4)) };
  if (/^\d+\.\s/.test(trimmed)) return { type: "ol", html: escHtml(trimmed.replace(/^\d+\.\s*/, "")) };
  if (/^\|.+\|.*\|/.test(trimmed)) return { type: "table", html: escHtml(trimmed) };
  return null;
}

/** 为代码行添加行号包装 */
function wrapCodeLines(highlighted: string, code: string): string {
  const lines = code.split("\n");
  const htmlLines = highlighted.split("\n");
  return lines.map((_, i) => `<span class="line">${htmlLines[i] || " "}</span>`).join("\n");
}

/** 图片灯箱组件（内联，避免额外文件） */
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
