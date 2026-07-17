"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Resizer } from "./Resizer";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { TagStyle } from "@codemirror/language";
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
  bash: () => javascript(),
  shell: () => javascript(),
};

// 主题定义
const THEME_DEFS: Record<string, { bg: string; header: string; border: string; text: string; textMuted: string; codeText: string }> = {
  default:  { bg: "rgba(245,245,247,1)", header: "rgba(238,238,240,1)", border: "#d1d5da", text: "#24292f", textMuted: "#6e7781", codeText: "#1f2328" },
  dark:     { bg: "#0d1117", header: "#161b22", border: "#30363d", text: "#c9d1d9", textMuted: "#8b949e", codeText: "#e6edf3" },
  monokai:  { bg: "#272822", header: "#3e3d32", border: "#49483e", text: "#f8f8f2", textMuted: "#a6a28c", codeText: "#f8f8f2" },
  dracula:  { bg: "#282a36", header: "#44475a", border: "#6272a4", text: "#f8f8f2", textMuted: "#6272a4", codeText: "#f8f8f2" },
  github:   { bg: "#f6f8fa", header: "#eaeef2", border: "#d0d7de", text: "#1f2328", textMuted: "#656d76", codeText: "#1f2328" },
  nord:     { bg: "#2e3440", header: "#3b4252", border: "#4c566a", text: "#eceff4", textMuted: "#81a1c1", codeText: "#d8dee9" },
  solarized:{ bg: "#fdf6e3", header: "#eee8d5", border: "#93a1a1", text: "#657b83", textMuted: "#93a1a1", codeText: "#586e75" },
};


// 各主题的语法高亮配色
const THEME_HIGHLIGHTS: Record<string, TagStyle[]> = {
  default: [
    { tag: t.keyword, color: "#569cd6" },
    { tag: [t.string, t.special(t.string)], color: "#ce9178" },
    { tag: t.comment, color: "#6a9955" },
    { tag: t.number, color: "#b5cea8" },
    { tag: t.variableName, color: "#9cdcfe" },
    { tag: t.function(t.variableName), color: "#dcdcaa" },
    { tag: t.typeName, color: "#4ec9b0" },
    { tag: t.propertyName, color: "#9cdcfe" },
    { tag: t.operator, color: "#d4d4d4" },
    { tag: t.punctuation, color: "#d4d4d4" },
  ],
  dark: [
    { tag: t.keyword, color: "#c0caf5" },
    { tag: [t.string, t.special(t.string)], color: "#9ece6a" },
    { tag: t.comment, color: "#565f89" },
    { tag: t.number, color: "#ff9e64" },
    { tag: t.variableName, color: "#c0caf5" },
    { tag: t.function(t.variableName), color: "#7aa2f7" },
    { tag: t.typeName, color: "#2ac3de" },
    { tag: t.propertyName, color: "#7dcfff" },
    { tag: t.operator, color: "#89ddff" },
    { tag: t.punctuation, color: "#a9b1d6" },
  ],
  monokai: [
    { tag: t.keyword, color: "#f92672" },
    { tag: [t.string, t.special(t.string)], color: "#e6db74" },
    { tag: t.comment, color: "#a6a28c" },
    { tag: t.number, color: "#ae81ff" },
    { tag: t.variableName, color: "#f8f8f2" },
    { tag: t.function(t.variableName), color: "#a6e22e" },
    { tag: t.typeName, color: "#66d9ef" },
    { tag: t.propertyName, color: "#f8f8f2" },
    { tag: t.operator, color: "#f92672" },
    { tag: t.punctuation, color: "#f8f8f2" },
  ],
  dracula: [
    { tag: t.keyword, color: "#ff79c6" },
    { tag: [t.string, t.special(t.string)], color: "#f1fa8c" },
    { tag: t.comment, color: "#6272a4" },
    { tag: t.number, color: "#bd93f9" },
    { tag: t.variableName, color: "#f8f8f2" },
    { tag: t.function(t.variableName), color: "#50fa7b" },
    { tag: t.typeName, color: "#8be9fd" },
    { tag: t.propertyName, color: "#f8f8f2" },
    { tag: t.operator, color: "#ff79c6" },
    { tag: t.punctuation, color: "#f8f8f2" },
  ],
  github: [
    { tag: t.keyword, color: "#cf222e" },
    { tag: [t.string, t.special(t.string)], color: "#0a3069" },
    { tag: t.comment, color: "#6e7781" },
    { tag: t.number, color: "#0550ae" },
    { tag: t.variableName, color: "#953800" },
    { tag: t.function(t.variableName), color: "#8250df" },
    { tag: t.typeName, color: "#953800" },
    { tag: t.propertyName, color: "#0550ae" },
    { tag: t.operator, color: "#cf222e" },
    { tag: t.punctuation, color: "#24292f" },
  ],
  nord: [
    { tag: t.keyword, color: "#81a1c1" },
    { tag: [t.string, t.special(t.string)], color: "#a3be8c" },
    { tag: t.comment, color: "#616e88" },
    { tag: t.number, color: "#b48ead" },
    { tag: t.variableName, color: "#d8dee9" },
    { tag: t.function(t.variableName), color: "#88c0d0" },
    { tag: t.typeName, color: "#8fbcbb" },
    { tag: t.propertyName, color: "#d8dee9" },
    { tag: t.operator, color: "#81a1c1" },
    { tag: t.punctuation, color: "#eceff4" },
  ],
  solarized: [
    { tag: t.keyword, color: "#859900" },
    { tag: [t.string, t.special(t.string)], color: "#2aa198" },
    { tag: t.comment, color: "#93a1a1" },
    { tag: t.number, color: "#d33682" },
    { tag: t.variableName, color: "#268bd2" },
    { tag: t.function(t.variableName), color: "#b58900" },
    { tag: t.typeName, color: "#268bd2" },
    { tag: t.propertyName, color: "#268bd2" },
    { tag: t.operator, color: "#859900" },
    { tag: t.punctuation, color: "#657b83" },
  ],
};
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onBackspaceEmptyRef = useRef(onBackspaceEmpty);

  onChangeRef.current = onChange;
  onBackspaceEmptyRef.current = onBackspaceEmpty;
  const [showScroll, setShowScroll] = useState(false);

  // 获取语言扩展
  const getLangExt = useCallback(() => {
    const fn = LANG_EXTENSIONS[lang || "javascript"];
    return fn ? fn() : javascript();
  }, [lang]);

  // 获取主题颜色
  const getThemeDef = useCallback(() => {
    return THEME_DEFS[theme] || THEME_DEFS.default;
  }, [theme]);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    const themeDef = getThemeDef();

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
        syntaxHighlighting(HighlightStyle.define(THEME_HIGHLIGHTS[theme] || THEME_HIGHLIGHTS.default)),
        getLangExt(),
        updateListener,
        backspaceKeymap,
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        EditorView.theme({
          "&": { backgroundColor: themeDef.bg, color: themeDef.codeText },
          ".cm-content": { caretColor: themeDef.codeText, fontFamily: "var(--font-mono, monospace)", fontSize: "0.9375rem", lineHeight: "1.65", padding: "12px 0" },
          ".cm-cursor": { borderLeftColor: themeDef.codeText },
          ".cm-activeLine": { backgroundColor: "rgba(128,128,128,0.08)" },
          ".cm-gutters": { backgroundColor: themeDef.header, color: themeDef.textMuted, border: "none" },
          ".cm-activeLineGutter": { backgroundColor: "rgba(128,128,128,0.08)" },
          ".cm-selectionBackground": { backgroundColor: "rgba(128,128,128,0.2)" },
          "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(128,128,128,0.3)" },
          ".cm-placeholder": { color: themeDef.textMuted, fontStyle: "italic" },
        }),
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
  }, [getLangExt, getThemeDef, theme, placeholder]);


  // ResizeObserver: track wrapper height to determine if scroll needed
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => {
      const lineH = 23;
      const maxLines = Math.floor(wrapper.clientHeight / lineH);
      const actualLines = value.split("\n").length;
      setShowScroll(actualLines > maxLines);
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [value]);

  // 同步外部 value 变化
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  const themeDef = getThemeDef();
  const lineHeightPx = 23; // 0.9375rem * 1.65 ≈ 23px
  const defaultMaxLines = 100;
  const actualLineCount = value.split("\n").length;
  const initiallyNeedsScroll = actualLineCount > defaultMaxLines;
  const maxHeight = initiallyNeedsScroll ? defaultMaxLines * lineHeightPx + 24 : undefined;

  return (
    <div
      ref={wrapperRef}
      className="cm-editor-wrapper"
      style={{
        resize: "none",
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        minHeight: "60px",
        overflow: showScroll ? "auto" : "hidden",
        position: "relative",
        backgroundColor: themeDef.bg,
      }}
    >
      <div
        ref={containerRef}
        className="cm-editor-container"
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ backgroundColor: themeDef.bg }}
      />
    </div>
  );
}
