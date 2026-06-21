import fs from "fs";

const filePath = "D:/agent/ggy-blog/src/app/write/page.tsx";
let content = fs.readFileSync(filePath, "utf8");

// Find BlockView boundaries
const startMarker = "function BlockView({ block, index, onChange, onEnter, onDelete, onInsertAfter, onPasteImg, onBackspace, onDeleteDown, olNumber, allBlocks }:";
const endMarker = "\n// ═══════════════════════════════════════════════════════════════\n//  WritePage — 主页面";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx < 0) { console.log("BlockView start not found"); process.exit(1); }
if (endIdx < 0) { console.log("WritePage marker not found"); process.exit(1); }

// Extract BlockView body
const blockViewEnd = content.lastIndexOf("\n}", endIdx);
const blockViewBody = content.slice(startIdx, blockViewEnd + 2); // include \n}

// Create BlockView.tsx with needed imports
const blockViewFile = `/**
 * BlockView.tsx — 单块渲染组件
 * 包含左侧操作区、内容区、TypePicker弹窗、链接浮窗
 */
"use client";

import { useState, useRef, useEffect } from "react";
import hljs from "highlight.js";
import katex from "katex";
import { ContentEditable as ContentEditableArea } from "@/components/editor/ContentEditable";
import { TypePicker } from "@/components/editor/TypePicker";
import { ImageLightbox } from "@/components/editor/Dialogs";
import { BLOCK_TYPES, CALLOUT_PRESETS, type Block, type BType } from "@/app/write/types";
import {
  readFileAsDataUrl, imageBlockHtml, highlightCode, wrapCodeLines,
  getCursorOffset, splitHtmlAtCursor, setCursorToEnd, escapeHtml,
  detectMarkdownShortcut, htmlToMarkdown,
} from "@/app/write/utils";

${blockViewBody}
`;

fs.writeFileSync("D:/agent/ggy-blog/src/components/editor/BlockView.tsx", blockViewFile);

// Replace BlockView in page.tsx with import
const importLine = '\nimport { BlockView } from "@/components/editor/BlockView";\n';
content = content.slice(0, startIdx) + importLine + content.slice(blockViewEnd + 2);

fs.writeFileSync(filePath, content);
console.log("BlockView extracted. Lines:", content.split("\n").length);
