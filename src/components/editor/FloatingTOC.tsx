/**
 * FloatingTOC.tsx — 页面左侧常驻大纲目录
 */
"use client";

import { useState, useEffect } from "react";
import { htmlToMarkdown } from "@/app/write/utils";
import type { Block } from "@/app/write/types";

interface Props { blocks: Block[]; }

export function FloatingTOC({ blocks }: Props) {
  const [activeId, setActiveId] = useState("");

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

  const tocItems = blocks
    .filter((b) => ["h1", "h2", "h3", "h4", "h5"].includes(b.type))
    .map((b) => ({ id: b.id, level: Number(b.type[1]), text: htmlToMarkdown(b.html) || "无标题" }));

  return (
    <div className="fixed left-[max(0px,calc((100vw-1100px)/2-220px))] top-24 w-52" style={{ zIndex: 10 }}>
      <div className="text-base font-sans font-semibold mb-4" style={{ color: "var(--text)" }}>目录</div>
      <div className="space-y-2.5">
        {tocItems.length === 0 ? (
          <div className="font-sans" style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>暂无标题</div>
        ) : (
          tocItems.map((item) => (
            <a key={item.id} onClick={(e) => {
              e.preventDefault();
              const el = document.querySelector(`[data-block="${item.id}"]`);
              if (el) { const top = el.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top, behavior: "smooth" }); }
            }}
              className="block font-sans truncate transition-colors cursor-pointer hover:text-[var(--accent)] leading-relaxed"
              style={{ fontSize: "1rem", paddingLeft: (item.level - 1) * 18, color: activeId === item.id ? "var(--accent)" : "var(--text-secondary)", fontWeight: activeId === item.id ? 600 : 400 }}>
              {item.text || "无标题"}
            </a>
          ))
        )}
      </div>
    </div>
  );
}
