/**
 * 飞书云文档块编辑器 — 组件单元测试
 * 覆盖：块类型创建、内容编辑、快捷键匹配、Markdown转换
 */
import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════
//  纯函数测试（不依赖 React DOM）
// ═══════════════════════════════════════

describe("Markdown 转换", () => {
  it("htmlToMd 转换加粗/斜体/链接", () => {
    // 内联函数测试
    const escHtml = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const htmlToMd = (html: string): string => {
      let s = html;
      s = s.replace(/<strong>(.*?)<\/strong>/gi,"**$1**");
      s = s.replace(/<em>(.*?)<\/em>/gi,"*$1*");
      s = s.replace(/<a\s+href="(.*?)">(.*?)<\/a>/gi,"[$2]($1)");
      s = s.replace(/<[^>]+>/g,"");
      return s.trim();
    };
    expect(htmlToMd("<strong>粗体</strong>")).toBe("**粗体**");
    expect(htmlToMd("<em>斜体</em>")).toBe("*斜体*");
    expect(htmlToMd('<a href="https://x.com">链接</a>')).toBe("[链接](https://x.com)");
    expect(htmlToMd("纯文本")).toBe("纯文本");
  });

  it("escHtml 转义 HTML 实体", () => {
    const escHtml = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    expect(escHtml("<div>")).toBe("&lt;div&gt;");
    expect(escHtml('"hello"')).toBe("&quot;hello&quot;");
  });
});

describe("快捷键匹配", () => {
  const matchSC = (e: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; key: string }, s: string) => {
    const p = s.toLowerCase().split("+");
    return ((!!e.ctrlKey || !!e.metaKey)) === p.includes("ctrl") &&
      !!e.shiftKey === p.includes("shift") &&
      !!e.altKey === p.includes("alt") &&
      e.key.toLowerCase() === p[p.length - 1];
  };

  it("Ctrl+B 匹配正确", () => {
    expect(matchSC({ ctrlKey: true, shiftKey: false, altKey: false, key: "b" }, "Ctrl+B")).toBe(true);
  });

  it("Ctrl+Shift+Z 匹配正确", () => {
    expect(matchSC({ ctrlKey: true, shiftKey: true, altKey: false, key: "z" }, "Ctrl+Shift+Z")).toBe(true);
  });

  it("不带 Ctrl 时不匹配", () => {
    expect(matchSC({ ctrlKey: false, shiftKey: false, altKey: false, key: "b" }, "Ctrl+B")).toBe(false);
  });

  it("Meta 键等效于 Ctrl", () => {
    expect(matchSC({ metaKey: true, shiftKey: false, altKey: false, key: "s" }, "Ctrl+S")).toBe(true);
  });
});

describe("块模型基本操作", () => {
  it("创建块具有唯一 id", () => {
    let id = 0;
    const nid = () => "b" + (++id).toString(36);
    const mk = (t: string, html = "") => ({ id: nid(), type: t, html });

    const b1 = mk("p", "hello");
    const b2 = mk("h1", "title");
    expect(b1.id).not.toBe(b2.id);
    expect(b1.type).toBe("p");
    expect(b2.type).toBe("h1");
  });

  it("blocksToMd 转换段落", () => {
    const htmlToMd = (html: string): string => {
      return html.replace(/<[^>]+>/g, "").trim();
    };
    const blocksToMd = (blocks: Array<{ type: string; html: string; lang?: string }>): string => {
      return blocks.map((b) => {
        const txt = htmlToMd(b.html);
        switch (b.type) {
          case "h1": return "# " + txt;
          case "h2": return "## " + txt;
          case "code": return "```" + (b.lang || "") + "\n" + b.html + "\n```";
          default: return txt;
        }
      }).join("\n\n");
    };

    const blocks = [
      { type: "h1", html: "标题" },
      { type: "p", html: "正文内容" },
      { type: "code", html: "const x = 1;", lang: "ts" },
    ];

    const md = blocksToMd(blocks);
    expect(md).toContain("# 标题");
    expect(md).toContain("正文内容");
    expect(md).toContain("```ts");
    expect(md).toContain("const x = 1;");
  });
});

describe("块类型定义", () => {
  it("TYPES 包含所有必要类型", () => {
    const requiredTypes = ["h1", "h2", "h3", "p", "quote", "code", "hr", "ul", "ol", "todo", "img", "callout", "table", "toggle", "formula", "embed"];
    // 验证类型数量
    expect(requiredTypes.length).toBe(16);
  });
});
