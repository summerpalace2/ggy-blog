import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts } from "@/lib/posts";
import { PostBody } from "@/components/PostBody";
import Link from "next/link";
import type { Metadata } from "next";

interface Props { params: Promise<{ slug: string }>; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return { title: post.meta.title + " - GGY 的博客", description: post.meta.description };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const idx = allPosts.findIndex((p) => p.slug === post.meta.slug);
  const prev = idx > 0 ? allPosts[idx - 1] : null;
  const next = idx < allPosts.length - 1 ? allPosts[idx + 1] : null;
  const related = allPosts.filter((p) => p.slug !== post.meta.slug && p.tags.some((t) => post.meta.tags.includes(t))).slice(0, 4);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/blog" className="inline-flex items-center gap-1.5 font-sans text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
        &larr; 返回首页
      </Link>

      <article>
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="cat" style={{ color: post.meta.category === "tech" ? "var(--accent)" : post.meta.category === "life" ? "var(--accent-warm)" : "var(--accent)" }}>
              <span className="cat-dot" style={{ backgroundColor: post.meta.category === "tech" ? "var(--accent)" : post.meta.category === "life" ? "var(--accent-warm)" : "var(--accent)" }} />
              {post.meta.category === "tech" ? "技术" : post.meta.category === "life" ? "随笔" : post.meta.category}
            </span>
            <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>{post.meta.date}</span>
          </div>
          <h1 className="font-sans text-3xl font-bold mb-4 leading-tight">{post.meta.title}</h1>
          {post.meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.meta.tags.map((t: string) => (
                <Link key={t} href={`/tags/${encodeURIComponent(t)}`} className="tag-badge">{t}</Link>
              ))}
            </div>
          )}
        </header>
        <PostBody content={post.content} />
      </article>

      {related.length > 0 && (
        <div className="mt-12 pt-10 border-t" style={{ borderColor: "var(--border-light)" }}>
          <h2 className="font-sans text-lg font-semibold mb-6">相关文章</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {related.map((p) => (
              <Link key={p.slug} href={`/posts/${encodeURIComponent(p.slug)}`} className="card p-5 group">
                <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>{p.date}</span>
                <h3 className="font-sans text-sm font-medium mt-1 group-hover:opacity-70">{p.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 pt-8 border-t flex justify-between gap-6" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex-1 min-w-0">
          {prev ? <Link href={`/posts/${encodeURIComponent(prev.slug)}`} className="block group"><p className="font-sans text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>&larr; 上一篇</p><p className="font-sans text-sm font-medium truncate group-hover:opacity-70">{prev.title}</p></Link> : <p className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>已是第一篇</p>}
        </div>
        <div className="flex-1 min-w-0 text-right">
          {next ? <Link href={`/posts/${encodeURIComponent(next.slug)}`} className="block group"><p className="font-sans text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>下一篇 &rarr;</p><p className="font-sans text-sm font-medium truncate group-hover:opacity-70">{next.title}</p></Link> : <p className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>已是最后一篇</p>}
        </div>
      </div>
    </div>
  );
}
