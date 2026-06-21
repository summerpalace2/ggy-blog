import fs from "fs";

const filePath = "D:/agent/ggy-blog/src/app/write/page.tsx";
let c = fs.readFileSync(filePath, "utf8");

// Block-level replace: remove local var/function declarations that duplicate imports
const removals = [
  { start: "let _idCounter = 0;", end: "return \"b\" + (++_idCounter).toString(36).padStart(3, \"0\");\n};" },
  { start: "/** 创建新块 */\nconst createBlock", end: "=> ({ id: generateId(), type, html });" },
  { start: "/** HTML实体转义 */\nfunction escapeHtml", end: "return s.replace(/&/g, \"&amp;\").replace(/</g, \"&lt;\").replace(/>/g, \"&gt;\").replace(/\"/g, \"&quot;\");\n}" },
];

// Simpler approach: just find and remove the inline sections
// BLOCK_TYPES (around line 396-416)
const blockTypesStart = c.indexOf("const BLOCK_TYPES: { type: BType; label: string; icon: string; desc: string }[] = [");
const blockTypesEnd = c.indexOf("];", blockTypesStart) + 2;
if (blockTypesStart > 0) {
  c = c.slice(0, blockTypesStart) + c.slice(blockTypesEnd);
}

// CALLOUT_PRESETS
const calloutStart = c.indexOf("const CALLOUT_PRESETS = {");
const calloutEnd = c.indexOf("} as const;", calloutStart) + 11;
if (calloutStart > 0) {
  c = c.slice(0, calloutStart) + c.slice(calloutEnd);
}

// TEXT_COLORS
const textColorsStart = c.indexOf("const TEXT_COLORS = [");
const textColorsEnd = c.indexOf("];", textColorsStart) + 2;
if (textColorsStart > 0) {
  c = c.slice(0, textColorsStart) + c.slice(textColorsEnd);
}

// HIGHLIGHT_COLORS
const hlStart = c.indexOf("const HIGHLIGHT_COLORS = [");
if (hlStart > 0) {
  const hlEnd = c.indexOf("];", hlStart) + 2;
  c = c.slice(0, hlStart) + c.slice(hlEnd);
}

// DEFAULT_SC and Shortcuts type (look for "const DEFAULT_SC:")
const scStart = c.indexOf("const DEFAULT_SC:");
if (scStart > 0) {
  // Find the end of the Shortcuts type definition
  const scEnd = c.indexOf("type Shortcuts = Record<string, string>;", scStart);
  // Also find the Shortcuts type
  const shortTypeStart = c.indexOf("type Shortcuts = Record<string, string>;");
  const shortTypeEnd = shortTypeStart + "type Shortcuts = Record<string, string>;".length;
  // Remove DEFAULT_SC object
  const defScEnd = c.indexOf("};", scStart) + 2;
  c = c.slice(0, scStart) + c.slice(defScEnd);
}

// generateId function (remove duplicate)
const genIdStart = c.indexOf("/** 生成唯一块ID——计数器挂在window上防热重载重置 */");
if (genIdStart > 0) {
  const genIdEnd = c.indexOf("const createBlock = (type: BType, html = \"\")", genIdStart);
  c = c.slice(0, genIdStart) + c.slice(genIdEnd);
}

// createBlock (remove duplicate - now references generateId from utils)
const cbStart = c.indexOf("const createBlock = (type: BType, html = \"\"): Block =>");
if (cbStart > 0) {
  const cbEnd = c.indexOf(");\n", cbStart) + 2;
  c = c.slice(0, cbStart) + c.slice(cbEnd);
}

// escapeHtml (remove duplicate)
const escStart = c.indexOf("/** HTML实体转义 */\nfunction escapeHtml");
if (escStart > 0) {
  const escEnd = c.indexOf("}\n", c.indexOf("return s.replace", escStart)) + 2;
  c = c.slice(0, escStart) + c.slice(escEnd);
}

// htmlToMarkdown function
const htmStart = c.indexOf("/** 将innerHTML转换为Markdown纯文本 */\nfunction htmlToMarkdown");
if (htmStart > 0) {
  // Find end of function (look for next function comment or section marker)
  const nextSection = c.indexOf("\n/**", htmStart + 50);
  const htmEnd = nextSection > 0 ? nextSection : c.indexOf("\nfunction blocksToMarkdown", htmStart);
  if (htmEnd > 0) c = c.slice(0, htmStart) + c.slice(htmEnd);
}

// blocksToMarkdown function
const btmStart = c.indexOf("/** 将Block数组转为Markdown全文（用于保存和复制） */\nfunction blocksToMarkdown");
if (btmStart > 0) {
  const btmEnd = c.indexOf("\n/**", btmStart + 50);
  if (btmEnd > 0) c = c.slice(0, btmStart) + c.slice(btmEnd);
}

// detectMarkdownShortcut
const dmsStart = c.indexOf("function detectMarkdownShortcut");
if (dmsStart > 0) {
  const dmsEnd = c.indexOf("\n/**", dmsStart + 50);
  if (dmsEnd > 0) c = c.slice(0, dmsStart) + c.slice(dmsEnd);
}

// markdownToBlocks
const mdbStart = c.indexOf("function markdownToBlocks");
if (mdbStart > 0) {
  const mdbEnd = c.indexOf("\n// ══", mdbStart + 50);
  if (mdbEnd > 0) c = c.slice(0, mdbStart) + c.slice(mdbEnd);
}

// saveShortcuts
const savStart = c.indexOf("/** 保存快捷键配置到localStorage */");
if (savStart > 0) {
  const savEnd = c.indexOf("}\n", c.indexOf("function saveShortcuts", savStart)) + 2;
  c = c.slice(0, savStart) + c.slice(savEnd);
}

// loadShortcuts
const loadStart = c.indexOf("/** 从localStorage加载快捷键配置 */");
if (loadStart > 0) {
  const loadEnd = c.indexOf("}\n", c.indexOf("function loadShortcuts", loadStart)) + 2;
  const loadEnd2 = c.indexOf("}\n", c.indexOf("catch", loadStart)) + 2;
  c = c.slice(0, loadStart) + c.slice(Math.max(loadEnd, loadEnd2));
}

// matchShortcut
const msStart = c.indexOf("/** 匹配键盘事件是否命中快捷键 */");
if (msStart > 0) {
  const msEnd = c.indexOf("}\n", c.indexOf("function matchShortcut", msStart)) + 2;
  c = c.slice(0, msStart) + c.slice(msEnd);
}

// getCursorOffset
const gcoStart = c.indexOf("/** 获取光标在contentEditable容器中的字符偏移量 */");
if (gcoStart > 0) {
  const gcoEnd = c.indexOf("}\n", c.indexOf("function getCursorOffset", gcoStart)) + 2;
  c = c.slice(0, gcoStart) + c.slice(gcoEnd);
}

// splitHtmlAtCursor
const shacStart = c.indexOf("/** 在光标位置拆分contentEditable内容，返回前半部分和后半部分的HTML */");
if (shacStart > 0) {
  const shacEnd = c.indexOf("}\n", c.indexOf("return { before: beforeDiv.innerHTML, after: afterDiv.innerHTML };", shacStart)) + 2;
  c = c.slice(0, shacStart) + c.slice(shacEnd);
}

// setCursorToEnd
const scteStart = c.indexOf("/** 将光标移到contentEditable末尾 */");
if (scteStart > 0) {
  const scteEnd = c.indexOf("}\n", c.indexOf("function setCursorToEnd", scteStart)) + 2;
  c = c.slice(0, scteStart) + c.slice(scteEnd);
}

// highlightCode
const hcStart = c.indexOf("/** 代码高亮 */");
if (hcStart > 0) {
  const hcEnd = c.indexOf("}\n", c.indexOf("function highlightCode", hcStart)) + 2;
  c = c.slice(0, hcStart) + c.slice(hcEnd);
}

// readFileAsDataUrl
const rfdStart = c.indexOf("/** 文件转dataUrl */");
if (rfdStart > 0) {
  const rfdEnd = c.indexOf("}\n", c.indexOf("function readFileAsDataUrl", rfdStart)) + 2;
  c = c.slice(0, rfdStart) + c.slice(rfdEnd);
}

// imageBlockHtml
const ibhStart = c.indexOf("/** 生成图片块HTML */");
if (ibhStart > 0) {
  const ibhEnd = c.indexOf("}\n", c.indexOf("function imageBlockHtml", ibhStart)) + 2;
  c = c.slice(0, ibhStart) + c.slice(ibhEnd);
}

// wrapCodeLines
const wclStart = c.indexOf("/** 为代码行添加行号包装 */");
if (wclStart > 0) {
  const wclEnd = c.indexOf("}\n", c.indexOf("function wrapCodeLines", wclStart)) + 2;
  c = c.slice(0, wclStart) + c.slice(wclEnd);
}

fs.writeFileSync(filePath, c);
console.log("Cleaned duplicate definitions. Lines:", c.split("\n").length);
