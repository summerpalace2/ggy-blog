/**
 * TypePicker.tsx — 类型选择弹窗（+ 按钮和 / 命令共用）
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { BLOCK_TYPES, type BType } from "@/app/write/types";

interface Props {
  open: boolean;
  position: { x: number; y: number };
  onSelect: (t: BType) => void;
  onClose: () => void;
  currentType?: BType;
}

export function TypePicker({ open, position, onSelect, onClose, currentType }: Props) {
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
        style={{ left: Math.min(position.x, window.innerWidth - 280), top: Math.min(position.y, window.innerHeight - 440), backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border-light)" }}>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索块类型…" className="w-full px-2 py-1.5 rounded-md border font-sans text-xs outline-none" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.map((t) => (
            <button key={t.type} onMouseDown={(e) => { e.preventDefault(); onSelect(t.type); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text)", backgroundColor: t.type === currentType ? "var(--bg-subtle)" : "transparent" }}>
              {t.type === currentType && <span style={{ color: "var(--accent)", fontSize: 10, marginRight: -4 }}>✓</span>}
              <span className="w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{t.icon}</span>
              <div className="flex-1"><div className="font-sans text-sm">{t.label}</div><div className="font-sans text-[10px]" style={{ color: "var(--text-muted)" }}>{t.desc}</div></div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
