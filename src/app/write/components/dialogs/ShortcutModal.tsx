/**
 * dialogs/ShortcutModal.tsx — 快捷键设置弹窗
 * [核心职责] 显示/编辑/重置快捷键配置，保存到localStorage
 */

"use client";

import { type FC } from "react";
import { DEFAULT_SHORTCUTS, type Shortcuts } from "../../types";
import { saveShortcuts } from "../../utils";

interface Props {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcuts;
  setShortcuts: (s: Shortcuts) => void;
}

export const ShortcutModal: FC<Props> = ({ open, onClose, shortcuts, setShortcuts }) => {
  if (!open) return null;

  const labels: Record<string, string> = {
    save: "保存", bold: "加粗", italic: "斜体", underline: "下划线",
    h1: "大标题", h2: "二级标题", h3: "三级标题", quote: "引用", code: "代码",
    undo: "撤销", redo: "重做",
  };

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
};
