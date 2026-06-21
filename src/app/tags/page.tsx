import { getAllTags, getPostsByTag } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import Link from "next/link";

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/blog" className="inline-flex items-center gap-1.5 font-sans text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>&larr; 返回首页</Link>
      <h1 className="font-sans text-2xl font-bold mb-8">标签</h1>
      {tags.length === 0 ? (
        <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>还没有标签</p>
      ) : (
        <div className="flex flex-col gap-10">
          {tags.map((tag) => {
            const posts = getPostsByTag(tag);
            return (
              <section key={tag}>
                <h2 className="font-sans text-lg font-semibold mb-4" style={{ color: "var(--accent)" }}>
                  # {tag} <span className="font-sans text-sm font-normal ml-2" style={{ color: "var(--text-muted)" }}>{posts.length} 篇</span>
                </h2>
                <div className="flex flex-col gap-4">{posts.map((p) => <PostCard key={p.slug} post={p} />)}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
