/**
 * store/editor-state.ts — 编辑器状态管理
 * [核心职责] 提供编辑器状态的useState hook，包含blocks/title/category/coverImage及草稿自动保存
 * [Android 类比] ViewModel，持有UI状态并提供变更入口
 */

"use client";

import { useState, useEffect, useRef } from "react";
import type { Block, BType, Snapshot } from "../types";
import { createBlock } from "../utils";

/** 编辑器状态接口 */
export interface EditorState {
  blocks: Block[];
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  titleHtml: string;
  setTitleHtml: React.Dispatch<React.SetStateAction<string>>;
  category: string;
  setCategory: React.Dispatch<React.SetStateAction<string>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  coverImage: string;
  setCoverImage: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  undoStack: Snapshot[];
  setUndoStack: React.Dispatch<React.SetStateAction<Snapshot[]>>;
  redoStack: Snapshot[];
  setRedoStack: React.Dispatch<React.SetStateAction<Snapshot[]>>;
  editingCategory: string | null;
  setEditingCategory: React.Dispatch<React.SetStateAction<string | null>>;
  newCategoryName: string;
  setNewCategoryName: React.Dispatch<React.SetStateAction<string>>;
  addingCategory: boolean;
  setAddingCategory: React.Dispatch<React.SetStateAction<boolean>>;
  pushSnapshot: () => void;
  restoreDraft: () => boolean;
}

/**
 * 创建编辑器状态钩子
 * @param initialBlocks - 初始块列表
 */
export function useEditorState(initialBlocks: Block[]): EditorState {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [titleHtml, setTitleHtml] = useState("");
  const [category, setCategory] = useState("tech");
  const [categories, setCategories] = useState<string[]>(["tech", "life"]);
  const [coverImage, setCoverImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 撤销/重做栈
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  // 分类编辑状态
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // 防抖草稿保存
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try { localStorage.setItem("w-draft", JSON.stringify({ titleHtml, blocks, category, coverImage })); } catch { }
    }, 2000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [titleHtml, blocks, category, coverImage]);

  /** 压入撤销快照 */
  const pushSnapshot = () => {
    setUndoStack((prev) => [...prev.slice(-49), { blocks: JSON.parse(JSON.stringify(blocks)), titleHtml, category, coverImage }]);
    setRedoStack([]);
  };

  /** 恢复草稿，返回是否成功 */
  const restoreDraft = (): boolean => {
    try {
      const raw = localStorage.getItem("w-draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.titleHtml || (draft.blocks && draft.blocks.length > 2)) {
          setTitleHtml(draft.titleHtml || "");
          setBlocks(draft.blocks || [createBlock("p")]);
          setCategory(draft.category || "tech");
          setCoverImage(draft.coverImage || "");
          return true;
        }
      }
    } catch { }
    return false;
  };

  return {
    blocks, setBlocks, titleHtml, setTitleHtml, category, setCategory,
    categories, setCategories, coverImage, setCoverImage,
    saving, setSaving, message, setMessage,
    undoStack, redoStack, setUndoStack, setRedoStack,
    editingCategory, setEditingCategory, newCategoryName, setNewCategoryName,
    addingCategory, setAddingCategory,
    pushSnapshot, restoreDraft,
  };
}
