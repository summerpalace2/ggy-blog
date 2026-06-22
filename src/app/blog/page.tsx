import { getAllPosts, getAllCategories, getPostsByCategory } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CAT_LABELS: Record<string, string> = { tech: "技术", life: "随笔" };

export default async function BlogPage() {
  try {
    const posts = await getAllPosts();
    const categories = await getAllCategories();
    const counts: Record<string, number> = {};
    for (const cat of categories) { counts[cat] = (await getPostsByCategory(cat)).length; }

    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <section className="mb-16 text-center">
          <h1 className="font-sans text-4xl font-bold mb-3">GGY 的博客</h1>
          <p className="font-sans text-base" style={{ color: "var(--text-secondary)" }}>用思考丈量世界</p>
          <div className="mt-6 flex items-center justify-center gap-4 text-sm font-sans" style={{ color: "var(--text-muted)" }}>
            <span>{posts.length} 篇文章</span>
            {categories.map((cat) => (
              <Link key={cat} href={`/category/${encodeURIComponent(cat)}`} className="hover:underline">{counts[cat]} 篇{CAT_LABELS[cat] || cat}</Link>
            ))}
          </div>
        </section>

        {categories.length > 1 && (
          <section className="mb-10">
            <h2 className="font-sans text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>分类</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Link key={cat} href={`/category/${encodeURIComponent(cat)}`} className="font-sans px-3 py-1 rounded-full text-sm transition-all hover:opacity-70"
                  style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                  {CAT_LABELS[cat] || cat} ({counts[cat]})
                </Link>
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
              {posts.map((p, i) => <PostCard key={`${p.slug}-${i}`} post={p} />)}
            </div>
          )}
        </section>
      </div>
    );
  } catch (e: any) {
    return <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-sans text-2xl font-bold mb-4">数据库连接失败</h1>
      <pre className="font-mono text-xs bg-red-50 p-4 rounded" style={{ color: "red" }}>{e?.message || String(e)}</pre>
    </div>;
  }
}
