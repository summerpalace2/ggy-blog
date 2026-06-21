import { getAllPosts, getAllTags, getAllCategories, getPostsByCategory } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import Link from "next/link";

const CAT_LABELS: Record<string, string> = { tech: "技术", life: "随笔" };

export default function BlogPage() {
  const posts = getAllPosts();
  const tags = getAllTags();
  const categories = getAllCategories();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <section className="mb-16 text-center">
        <h1 className="font-sans text-4xl font-bold mb-3">GGY 的博客</h1>
        <p className="font-sans text-base" style={{ color: "var(--text-secondary)" }}>用思考丈量世界</p>
        <div className="mt-6 flex items-center justify-center gap-4 text-sm font-sans" style={{ color: "var(--text-muted)" }}>
          <span>{posts.length} 篇文章</span>
          {categories.map((cat) => {
            const count = getPostsByCategory(cat).length;
            return <span key={cat}>{count} 篇{CAT_LABELS[cat] || cat}</span>;
          })}
        </div>
      </section>

      {categories.length > 1 && (
        <section className="mb-10">
          <h2 className="font-sans text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>分类</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span key={cat} className="font-sans px-3 py-1 rounded-full text-sm"
                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                {CAT_LABELS[cat] || cat} ({getPostsByCategory(cat).length})
              </span>
            ))}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section className="mb-12">
          <h2 className="font-sans text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>标签</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link key={t} href={`/tags/${encodeURIComponent(t)}`}
                className="font-sans px-3 py-1 rounded-full text-sm transition-all hover:opacity-70"
                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>{t}</Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-sans text-sm font-semibold mb-6 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>全部文章</h2>
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-sans text-base" style={{ color: "var(--text-muted)" }}>还没有文章</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {posts.map((p) => <PostCard key={p.slug} post={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
