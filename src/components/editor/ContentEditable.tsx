/**
 * ContentEditable.tsx — 通用contentEditable可编辑区域
 * 支持防抖onChange、图片粘贴/拖拽、URL自动链接识别、placeholder
 */
"use client";

import { useRef, useEffect } from "react";

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
}

export function ContentEditable({ html, onChange, onKeyDown, onPasteImg, onDropImg, className, style, placeholder, innerRef, onFocus, onBlur, spellCheck }: Props) {
  const ref = innerRef || useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const prevHtml = useRef(html);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtml = useRef<string | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
      prevHtml.current = html;
    }
  }, []);

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
