/**
 * types.ts — 块编辑器的类型定义和常量
 */

/** 块类型枚举：16种飞书文档块 */
export type BType = "h1" | "h2" | "h3" | "h4" | "h5" | "p" | "quote" | "code" | "hr" | "ul" | "ol" | "todo" | "img" | "callout" | "table" | "toggle" | "formula" | "embed";

/** 编辑器内容块 */
export interface Block {
  id: string;
  type: BType;
  html: string;
  checked?: boolean;
  lang?: string;
  calloutType?: "info" | "tip" | "warning" | "danger";
  collapsed?: boolean;
  toggleContent?: string;
  imgWidth?: number;
  restartNumbering?: boolean;
  sideImage?: string;
  sideImgWidth?: number;
  ordered?: boolean;
  formulaDisplay?: boolean;
}

/** 撤销快照 */
export interface Snapshot {
  blocks: Block[];
  titleHtml: string;
  category: string;
  coverImage: string;
}

/** 所有可用块类型的元数据 */
export const BLOCK_TYPES: { type: BType; label: string; icon: string; desc: string }[] = [
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

/** 提示框预设 */
export const CALLOUT_PRESETS = {
  info: { icon: "💡", bg: "rgba(107,143,113,0.1)", border: "rgba(107,143,113,0.2)", label: "信息" },
  tip: { icon: "ℹ️", bg: "rgba(100,149,237,0.1)", border: "rgba(100,149,237,0.2)", label: "技巧" },
  warning: { icon: "⚠️", bg: "rgba(255,193,7,0.1)", border: "rgba(255,193,7,0.2)", label: "注意" },
  danger: { icon: "❌", bg: "rgba(220,53,69,0.1)", border: "rgba(220,53,69,0.2)", label: "危险" },
} as const;

/** 快捷键配置类型 */
export const DEFAULT_SHORTCUTS = {
  save: "Ctrl+S", bold: "Ctrl+B", italic: "Ctrl+I", underline: "Ctrl+U",
  h1: "Ctrl+Shift+1", h2: "Ctrl+Shift+2", h3: "Ctrl+Shift+3",
  h4: "Ctrl+Shift+4", h5: "Ctrl+Shift+5",
  quote: "Ctrl+Shift+Q", code: "Ctrl+Shift+K", undo: "Ctrl+Z", redo: "Ctrl+Shift+Z",
} as const;
export type Shortcuts = typeof DEFAULT_SHORTCUTS;

/** 文字颜色预设 */
export const TEXT_COLORS = [
  { color: "var(--text)", label: "默认" }, { color: "#e74c3c", label: "红色" },
  { color: "#e67e22", label: "橙色" }, { color: "#f1c40f", label: "黄色" },
  { color: "#2ecc71", label: "绿色" }, { color: "#3498db", label: "蓝色" },
  { color: "#9b59b6", label: "紫色" },
];

/** 背景颜色预设 */
export const HIGHLIGHT_COLORS = [
  { bg: "transparent", label: "无背景" }, { bg: "#FFF3CD", label: "黄色" },
  { bg: "#D4EDDA", label: "绿色" }, { bg: "#D1ECF1", label: "蓝色" },
  { bg: "#F8D7DA", label: "红色" }, { bg: "#E2D9F3", label: "紫色" },
  { bg: "#FFEAA7", label: "橙色" },
];
