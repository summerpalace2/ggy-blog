/**
 * store/ol-numbering.ts — 有序列表编号计算
 * [核心职责] 根据"二维度法则"计算每个有序列表块的编号
 *   - 高维（标题+ordered）：同父标题下同级ordered标题互编，遇更高级标题断
 *   - 低维（ol/正文+ordered）：仅当前标题节内编号，遇任意标题断
 */

import type { Block } from "../types";

/**
 * 计算指定索引处的有序列表编号
 * @param index - 当前块在blocks数组中的索引
 * @param blocks - 所有块列表
 * @returns 编号数字，undefined表示从头开始编号
 */
export function calculateOlNumber(index: number, blocks: Block[]): number | undefined {
  const block = blocks[index];
  if (!block || (block.type !== "ol" && !block.ordered)) return undefined;

  let olNumber = 1;
  const currentIsHeading = ["h1", "h2", "h3", "h4", "h5"].includes(block.type);
  const currentLevel = currentIsHeading ? parseInt(block.type.charAt(1)) : 0;

  if (block.restartNumbering) {
    // 如果前一个块也有 restartNumbering，当前块不应返回 1，而是继续编号
    if (index > 0 && blocks[index - 1].restartNumbering) {
      // 继续编号，不返回 1
    } else {
      return olNumber;
    }
  }

  for (let i = index - 1; i >= 0; i--) {
    const t = blocks[i].type;
    const otherIsHeading = ["h1", "h2", "h3", "h4", "h5"].includes(t);
    const otherLevel = otherIsHeading ? parseInt(t.charAt(1)) : 0;

    if (currentIsHeading) {
      // 高维：只计同级ordered标题，遇高级标题断，无ordered同级标题跳过
      if (otherIsHeading) {
        if (otherLevel < currentLevel) break;
        if (otherLevel === currentLevel && blocks[i].ordered) { olNumber++; continue; }
        continue;
      }
    } else {
      // 低维：遇任意标题断
      if (otherIsHeading) break;
      const isOl = blocks[i].type === "ol" || blocks[i].ordered;
      if (!isOl) continue;
      if (blocks[i].restartNumbering) { olNumber++; break; }
      olNumber++;
    }
  }

  return olNumber;
}
