import { getAllCategories, getPostsByCategory } from "@/lib/posts";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CAT_LABELS: Record<string, string> = { tech: "技术", life: "随笔" };
const CAT_COLORS: Record<string, string> = { tech: "var(--accent)", life: "var(--accent-warm)" };

export default async function CategoriesPage() {
  const cats = await getAllCategories();
  const counts: Record<string, number> = {};
  for (const cat of cats) { counts[cat] = (await getPostsByCategory(cat)).length; }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/blog" className="inline-flex items-center gap-1.5 font-sans text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>&larr; 返回首页</Link>
      <h1 className="font-sans text-2xl font-bold mb-8">分类</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cats.map((cat) => {
          const color = CAT_COLORS[cat] || "var(--accent)";
          return (
            <Link key={cat} href={`/category/${encodeURIComponent(cat)}`} className="card p-6 group">
              <span className="cat mb-2" style={{ color }}>
                <span className="cat-dot" style={{ backgroundColor: color }} />
                {CAT_LABELS[cat] || cat}
              </span>
              <p className="font-sans text-sm mt-2" style={{ color: "var(--text-muted)" }}>{counts[cat]} 篇文章</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
