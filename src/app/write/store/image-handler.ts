/**
 * store/image-handler.ts — 图片处理逻辑
 * [核心职责] 处理图片粘贴、拖拽、封面图选择
 */

import type { Block } from "../types";
import { createBlock, imageBlockHtml, readFileAsDataUrl } from "../utils";

/**
 * 处理图片粘贴：在当前块后插入新图片块
 */
export async function handlePasteImage(
  file: File, index: number, blocks: Block[],
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
) {
  const newBlock = createBlock("img", "");
  const updated = [...blocks];
  updated.splice(index + 1, 0, newBlock);
  setBlocks(updated);
  setTimeout(() => readFileAsDataUrl(file).then((d) => {
    setBlocks((prev) => prev.map((b) => b.id === newBlock.id ? { ...b, html: imageBlockHtml(d, file.name) } : b));
  }), 50);
}

/**
 * 处理图片拖拽：如果当前块有内容则设为侧栏图片，否则插入新图片块
 */
export async function handleDropImage(
  file: File, index: number, block: Block,
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>,
  pushSnapshot: () => void,
) {
  pushSnapshot();
  const dataUrl = await readFileAsDataUrl(file);
  if (block.html.trim()) {
    setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, sideImage: dataUrl, sideImgWidth: b.sideImgWidth ?? 50 } : b));
  } else {
    const newBlock = createBlock("img", imageBlockHtml(dataUrl, file.name));
    setBlocks((prev) => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newBlock);
      return updated;
    });
  }
}

/**
 * 处理封面图选择
 */
export function createPickCover(setCoverImage: React.Dispatch<React.SetStateAction<string>>) {
  return () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) setCoverImage(await readFileAsDataUrl(file));
    };
    input.click();
  };
}
