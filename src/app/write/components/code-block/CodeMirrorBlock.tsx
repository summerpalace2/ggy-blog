"use client";

import { useRef, useEffect, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { php } from "@codemirror/lang-php";
import { sass } from "@codemirror/lang-sass";
import { vue } from "@codemirror/lang-vue";
import { angular } from "@codemirror/lang-angular";
import { oneDark } from "@codemirror/theme-one-dark";

// 语言映射
const LANG_EXTENSIONS: Record<string, () => ReturnType<typeof javascript>> = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  python: () => python(),
  css: () => css(),
  scss: () => sass(),
  less: () => sass(),
  html: () => html(),
  json: () => json(),
  java: () => java(),
  c: () => cpp(),
  cpp: () => cpp(),
  rust: () => rust(),
  sql: () => sql(),
  markdown: () => markdown(),
  xml: () => xml(),
  yaml: () => yaml(),
  php: () => php(),
  vue: () => vue(),
  angular: () => angular(),
  kotlin: () => java(), // fallback
  go: () => cpp(), // fallback
  ruby: () => python(), // fallback
  swift: () => java(), // fallback
  bash: () => shell(),
  shell: () => shell(),
};

// 主题定义
const THEME_DEFS: Record<string, { bg: string; header: string; border: string; text: string; textMuted: string }> = {
  default:  { bg: "#1e1e1e", header: "#2d2d2d", border: "#333", text: "#ccc", textMuted: "#888" },
  dark:     { bg: "#0d1117", header: "#161b22", border: "#30363d", text: "#c9d1d9", textMuted: "#8b949e" },
  monokai:  { bg: "#272822", header: "#3e3d32", border: "#49483e", text: "#f8f8f2", textMuted: "#a6a28c" },
  dracula:  { bg: "#282a36", header: "#44475a", border: "#6272a4", text: "#f8f8f2", textMuted: "#6272a4" },
  github:   { bg: "#f6f8fa", header: "#eaeef2", border: "#d0d7de", text: "#1f2328", textMuted: "#656d76" },
  nord:     { bg: "#2e3440", header: "#3b4252", border: "#4c566a", text: "#eceff4", textMuted: "#81a1c1" },
  solarized:{ bg: "#fdf6e3", header: "#eee8d5", border: "#93a1a1", text: "#657b83", textMuted: "#93a1a1" },
};

function shell() {
  // Simple shell language support
  return javascript();
}

interface CodeMirrorBlockProps {
  value: string;
  lang?: string;
  theme?: string;
  onChange: (value: string) => void;
  onBackspaceEmpty?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}

export function CodeMirrorBlock({ value, lang, theme = "default", onChange, onBackspaceEmpty, onFocus, onBlur, placeholder }: CodeMirrorBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onBackspaceEmptyRef = useRef(onBackspaceEmpty);

  onChangeRef.current = onChange;
  onBackspaceEmptyRef.current = onBackspaceEmpty;

  // 获取语言扩展
  const getLangExt = useCallback(() => {
    const fn = LANG_EXTENSIONS[lang || "javascript"];
    return fn ? fn() : javascript();
  }, [lang]);

  // 获取主题
  const getTheme = useCallback(() => {
    return oneDark;
  }, []);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    const themeDef = THEME_DEFS[theme] || THEME_DEFS.default;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newVal = update.state.doc.toString();
        onChangeRef.current(newVal);
      }
    });

    const backspaceKeymap = keymap.of([{
      key: "Backspace",
      run: (view) => {
        if (view.state.doc.length === 0) {
          onBackspaceEmptyRef.current?.();
          return true;
        }
        return false;
      },
    }]);

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        getLangExt(),
        getTheme(),
        updateListener,
        backspaceKeymap,
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        EditorView.theme({
          "&": { backgroundColor: themeDef.bg, color: themeDef.text },
          ".cm-content": { caretColor: themeDef.text, fontFamily: "var(--font-mono, monospace)", fontSize: "0.875rem", lineHeight: "1.65", padding: "12px 0" },
          ".cm-cursor": { borderLeftColor: themeDef.text },
          ".cm-activeLine": { backgroundColor: "rgba(128,128,128,0.1)" },
          ".cm-gutters": { backgroundColor: themeDef.bg, color: themeDef.textMuted, border: "none" },
          ".cm-activeLineGutter": { backgroundColor: "rgba(128,128,128,0.1)" },
          ".cm-selectionBackground": { backgroundColor: "rgba(128,128,128,0.2)" },
          "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(128,128,128,0.3)" },
          ".cm-placeholder": { color: themeDef.textMuted, fontStyle: "italic" },
        }),
// placeholder removed for now
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [getLangExt, getTheme, theme, placeholder]);

  // 同步外部 value 变化
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="cm-editor-container"
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ backgroundColor: (THEME_DEFS[theme] || THEME_DEFS.default).bg }}
    />
  );
}
