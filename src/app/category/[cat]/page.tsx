import { notFound } from "next/navigation";
import { getPostsByCategory } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import Link from "next/link";

interface Props { params: Promise<{ cat: string }>; }

export default async function CategoryPage({ params }: Props) {
  const { cat } = await params;
  const decoded = decodeURIComponent(cat);
  const posts = await getPostsByCategory(decoded);
  if (posts.length === 0) notFound();

  const CAT_LABELS: Record<string, string> = { tech: "技术", life: "随笔" };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/category" className="inline-flex items-center gap-1.5 font-sans text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>&larr; 所有分类</Link>
      <h1 className="font-sans text-2xl font-bold mb-2">{CAT_LABELS[decoded] || decoded}</h1>
      <p className="font-sans text-sm mb-8" style={{ color: "var(--text-muted)" }}>{posts.length} 篇文章</p>
      <div className="flex flex-col gap-5">{posts.map((p) => <PostCard key={p.slug} post={p} />)}</div>
    </div>
  );
}
