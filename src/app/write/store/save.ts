/**
 * store/save.ts — 文章保存逻辑
 * [核心职责] 将编辑器内容转换为Markdown，调用API保存到数据库
 */

import { useRouter } from "next/navigation";
import type { Block } from "../types";
import { blocksToMarkdown, htmlToMarkdown } from "../utils";

/**
 * 创建保存函数
 * @param blocks - 当前块列表
 * @param titleHtml - 标题HTML
 * @param category - 分类
 * @param setMessage - 消息状态setter
 * @param setSaving - 保存中状态setter
 * @param router - Next.js路由器
 * @param onSuccess - 保存成功回调
 */
export function createSaveHandler(
  blocks: Block[], titleHtml: string, category: string,
  setMessage: React.Dispatch<React.SetStateAction<string>>,
  setSaving: React.Dispatch<React.SetStateAction<boolean>>,
  router: ReturnType<typeof useRouter>,
  onSuccess?: () => void,
) {
  return async function save() {
    const titleText = htmlToMarkdown(titleHtml).trim();
    if (!titleText) { setMessage("请输入标题"); return; }
    const content = blocksToMarkdown(blocks);
    if (!content.trim()) { setMessage("请输入内容"); return; }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleText, content, category, tags: [], description: "" }),
      });
      if (response.ok) {
        localStorage.removeItem("w-draft");
        onSuccess?.();
        router.push("/blog");
      } else {
        const data = await response.json();
        setMessage(data.error || "保存失败");
      }
    } catch { setMessage("网络错误"); }
    finally { setSaving(false); }
  };
}
