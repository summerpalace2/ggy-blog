import Link from "next/link";
import type { PostMeta } from "@/lib/posts";

/** 分类颜色映射（可用预设，也支持动态颜色） */
const CAT_COLORS: Record<string, string> = { tech: "var(--accent)", life: "var(--accent-warm)" };
const CAT_LABELS: Record<string, string> = { tech: "技术", life: "随笔" };

export function PostCard({ post }: { post: PostMeta }) {
  const color = CAT_COLORS[post.category] || "var(--accent)";
  const label = CAT_LABELS[post.category] || post.category;
  return (
    <Link href={`/posts/${encodeURIComponent(post.slug)}`} className="card block p-6 group">
      <div className="flex items-center gap-3 mb-3">
        <span className="cat" style={{ color }}>
          <span className="cat-dot" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>{post.date}</span>
      </div>
      <h3 className="font-sans text-lg font-semibold mb-2 group-hover:opacity-70 transition-opacity">{post.title}</h3>
      {post.description && <p className="font-sans text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{post.description}</p>}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {post.tags.map((t) => <span key={t} className="tag-badge">{t}</span>)}
        </div>
      )}
    </Link>
  );
}
