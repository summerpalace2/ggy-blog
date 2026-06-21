import { notFound } from "next/navigation";
import { getAllTags, getPostsByTag } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import Link from "next/link";

interface Props { params: Promise<{ tag: string }>; }

export function generateStaticParams() {
  return getAllTags().map((t) => ({ tag: encodeURIComponent(t) }));
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);
  if (posts.length === 0) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/tags" className="inline-flex items-center gap-1.5 font-sans text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>&larr; 所有标签</Link>
      <h1 className="font-sans text-2xl font-bold mb-2"># {decoded}</h1>
      <p className="font-sans text-sm mb-8" style={{ color: "var(--text-muted)" }}>{posts.length} 篇文章</p>
      <div className="flex flex-col gap-5">{posts.map((p) => <PostCard key={p.slug} post={p} />)}</div>
    </div>
  );
}
