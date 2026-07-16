/**
 * ContentEditableArea.tsx — 通用可编辑区域组件
 * [核心职责] 封装 contentEditable div，提供防抖 onChange、图片粘贴/拖拽、链接自动识别、placeholder
 * [Android 类比] 自定义 EditText View，处理所有输入事件
 */

"use client";

import { useRef, useEffect, type FC, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import { applyPendingCursorRestoration, setCursorToOffset } from "../utils";

interface Props {
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
  flushRef?: React.RefObject<(() => string) | null>;
  blockId?: string;
}

export const ContentEditableArea: FC<Props> = ({
  html, onChange, onKeyDown, onPasteImg, onDropImg,
  className, style, placeholder, innerRef, onFocus, onBlur, spellCheck, flushRef, blockId,
}) => {
  const ref = innerRef || useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const prevHtml = useRef(html);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtml = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // 初始化：同步外部html到DOM
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
      prevHtml.current = html;
    }
  }, []);

  /** 将外部html同步到DOM（跳过内部触发的更新） */
  const syncToDom = (newHtml: string) => {
    if (!ref.current) return;
    if (newHtml !== prevHtml.current) {
      if (isInternalUpdate.current) {
        prevHtml.current = newHtml;
        return;
      }
      // [Fix] save cursor pos before DOM update, restore after
      const sel = window.getSelection();
      let offset = 0;
      if (sel && sel.rangeCount > 0 && document.activeElement === ref.current) {
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(ref.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        offset = preRange.toString().length;
      }
      console.log("[syncUp] newHtml=" + JSON.stringify(newHtml) + " prevHtml=" + JSON.stringify(prevHtml.current) + " domHtml=" + JSON.stringify(ref.current.innerHTML) + " offset=" + offset + " active=" + (document.activeElement === ref.current) + " blockId=" + blockId);
      if (ref.current.innerHTML !== newHtml) {
        ref.current.innerHTML = newHtml;
      }
      prevHtml.current = newHtml;
      if (document.activeElement === ref.current) {
        setCursorToOffset(ref.current, offset);
      }
    }
  };

  // 监听外部html变化
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
    syncToDom(html);
  }, [html]);

  /** 用户输入处理：50ms短防抖后上报（减少竞态问题） */
  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    const newHtml = (e.currentTarget as HTMLDivElement).innerHTML;
    pendingHtml.current = newHtml;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      const pending = pendingHtml.current;
      if (pending !== null && ref.current) {
        isInternalUpdate.current = true;
        prevHtml.current = pending;
        onChangeRef.current(pending);
      }
      pendingHtml.current = null;
    }, 50);
  };

  /** 失焦时立即提交未上报的内容 */
  const flushDebounce = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      const pending = pendingHtml.current;
      if (pending !== null && ref.current) {
        isInternalUpdate.current = true;
        prevHtml.current = pending;
        onChangeRef.current(pending);
      }
      pendingHtml.current = null;
    }
    // [Fix-B1] 保底同步：显式 flush 时确保 DOM→React state 同步
    if (ref.current && prevHtml.current !== ref.current.innerHTML) {
      isInternalUpdate.current = true;
      prevHtml.current = ref.current.innerHTML;
      onChangeRef.current(ref.current.innerHTML);
    }
  };

  /** 立即提交防抖内容并返回最新DOM值（供键盘事件使用） */
  const flushAndGetHtml = (): string => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      const pending = pendingHtml.current;
      if (pending !== null && ref.current) {
        isInternalUpdate.current = true;
        prevHtml.current = pending;
        onChangeRef.current(pending);
      }
      pendingHtml.current = null;
    }
    // [Fix-B1] 保底同步：显式 flush 时确保 DOM→React state 同步
    if (ref.current && prevHtml.current !== ref.current.innerHTML) {
      isInternalUpdate.current = true;
      prevHtml.current = ref.current.innerHTML;
      onChangeRef.current(ref.current.innerHTML);
    }
    return ref.current?.innerHTML || "";
  };

  // 暴露给父组件
  useEffect(() => {
    if (flushRef) flushRef.current = flushAndGetHtml;
  }, [flushRef]);

  /** 粘贴处理：图片优先，然后URL自动链接 */
  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { if (onDropImg) e.preventDefault(); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!onDropImg) return;
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) onDropImg(file);
  };

  /**
   * 焦点处理: onFocus 中恢复光标
   * 浏览器 focus() 异步重置光标 → 在 onFocus 事件中覆盖光标位置
   */
  const handleFocus = () => {
    console.log("[onFocus] blockId=" + blockId + " active=" + (document.activeElement === ref.current));
    isInternalUpdate.current = true;
    if (blockId && ref.current) {
      const applied = applyPendingCursorRestoration(blockId, ref.current);
      console.log("[onFocus] cursorRestoration applied=" + applied);
    }
    onFocus?.();
  };

  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      onInput={handleInput} onKeyDown={onKeyDown} onPaste={handlePaste}
      onDragOver={handleDragOver} onDrop={handleDrop}
      onFocus={handleFocus}
      onBlur={() => { flushDebounce(); onBlur?.(); }}
      className={className} style={style} spellCheck={spellCheck ?? false}
      data-placeholder={placeholder || ""}
      data-flush={flushAndGetHtml}
    />
  );
};

/** 强制提交防抖中的未上报内容 */
export function flushContentEditable(ref: React.RefObject<HTMLDivElement | null>) {
  if (!ref?.current) return;
  // 触发blur事件来调用flushDebounce
  ref.current.dispatchEvent(new Event('blur', { bubbles: true }));
};