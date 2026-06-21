import fs from "fs";

const filePath = "D:/agent/ggy-blog/src/app/write/page.tsx";
let content = fs.readFileSync(filePath, "utf8");

// 替换整个组件区块为导入语句
const start = content.indexOf("const TEXT_COLORS");
const end = content.indexOf("function BlockView");

const imports = `
// ══ 组件导入（从 components/editor 抽取，减少主文件行数） ══
import { FormatToolbar } from "@/components/editor/FormatToolbar";
import { FloatingTOC } from "@/components/editor/FloatingTOC";
import { TypePicker } from "@/components/editor/TypePicker";
import { ShortcutModal, LinkDialog, ImageLightbox, ImportDialog } from "@/components/editor/Dialogs";
`;

content = content.slice(0, start) + imports + content.slice(end);
fs.writeFileSync(filePath, content);

console.log("Done. Lines:", content.split("\n").length);
