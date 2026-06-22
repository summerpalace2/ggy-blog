/**
 * FloatingTOC.tsx — 大纲目录（左侧常驻）
 * [核心职责] 提取所有标题块，计算有序编号，IntersectionObserver高亮当前可见标题，点击跳转
 * [Android 类比] 侧边导航抽屉，显示文档结构
 */

"use client";

import { useState, useEffect, type FC } from "react";
import type { Block } from "../types";
import { htmlToMarkdown } from "../utils";

interface Props {
  blocks: Block[];
}

export const FloatingTOC: FC<Props> = ({ blocks }) => {
  const [activeId, setActiveId] = useState("");

  // IntersectionObserver: 滚动时高亮当前可见的标题
  useEffect(() => {
    const headings = document.querySelectorAll("[data-heading]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveId((entry.target as HTMLElement).closest("[data-block]")?.getAttribute("data-block") || "");
        }
      }
    }, { rootMargin: "-80px 0px -80% 0px" });
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [blocks]);

  // 提取所有标题块，计算高维有序编号
  const tocItems: { id: string; level: number; text: string }[] = [];
  const cnt = [0, 0, 0, 0, 0]; // h1~h5 计数器
  for (const b of blocks) {
    if (!["h1", "h2", "h3", "h4", "h5"].includes(b.type)) continue;
    const lv = parseInt(b.type.charAt(1)) - 1;
    // 更低级标题归零
    for (let i = lv + 1; i < 5; i++) cnt[i] = 0;
    if (b.restartNumbering) cnt[lv] = 0;
    if (b.ordered) cnt[lv]++;
    const prefix = b.ordered ? `${cnt[lv]}. ` : "";
    tocItems.push({ id: b.id, level: lv + 1, text: prefix + (htmlToMarkdown(b.html) || "无标题") });
  }

  return (
    <div className="fixed left-[max(0px,calc((100vw-1100px)/2-220px))] top-24 w-52" style={{ zIndex: 10 }}>
      <div className="text-base font-sans font-semibold mb-4" style={{ color: "var(--text)" }}>目录</div>
      <div className="space-y-2.5">
        {tocItems.length === 0 ? (
          <div className="font-sans" style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>暂无标题</div>
        ) : (
          tocItems.map((item) => (
            <a key={item.id}
              onClick={(e) => {
                e.preventDefault();
                const el = document.querySelector(`[data-block="${item.id}"]`);
                if (el) {
                  // 80px偏移防止被顶部工具栏遮挡
                  const top = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top, behavior: "smooth" });
                }
              }}
              className="block font-sans truncate transition-colors cursor-pointer hover:text-[var(--accent)] leading-relaxed"
              style={{
                fontSize: "1rem",
                paddingLeft: (item.level - 1) * 18,
                color: activeId === item.id ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: activeId === item.id ? 600 : 400,
              }}>
              {item.text || "无标题"}
            </a>
          ))
        )}
      </div>
    </div>
  );
};
