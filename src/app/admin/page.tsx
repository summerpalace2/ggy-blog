"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Comment {
  id: number; content: string; created_at: string; username: string; post_slug: string;
}
interface Post {
  slug: string; title: string; date: string; category: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadComments = async () => {
    const res = await fetch("/api/admin/comments");
    if (res.ok) setComments(await res.json());
  };
  const loadPosts = async () => {
    const res = await fetch("/api/admin/posts");
    if (res.ok) setPosts(await res.json());
  };

  useEffect(() => { if (session?.user?.role === "admin") { loadComments(); loadPosts(); } }, [session]);

  const delComment = async (id: number) => {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    loadComments();
  };

  const delPost = async (slug: string, category: string, title: string) => {
    if (!confirm(`确定删除文章「${title}」？此操作不可恢复。`)) return;
    await fetch(`/api/admin/posts?slug=${encodeURIComponent(slug)}&category=${encodeURIComponent(category)}`, { method: "DELETE" });
    loadPosts();
  };

  if (status === "loading") return <div className="max-w-3xl mx-auto px-6 py-12"><p>加载中…</p></div>;
  if (session?.user?.role !== "admin") return <div className="max-w-3xl mx-auto px-6 py-12"><p>无权限访问</p></div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-sans text-2xl font-bold mb-8">管理面板</h1>
      <div className="flex gap-4 mb-8">
        <Link href="/write" className="px-4 py-2 rounded-lg font-sans text-sm" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>写新文章</Link>
      </div>

      <h2 className="font-sans text-lg font-semibold mb-4">文章管理 ({posts.length})</h2>
      {posts.length === 0 ? (
        <p className="font-sans text-sm mb-10" style={{ color: "var(--text-muted)" }}>暂无文章</p>
      ) : (
        <div className="space-y-2 mb-10">
          {posts.map((p) => (
            <div key={`${p.category}-${p.slug}`} className="card p-3 flex items-center justify-between">
              <div>
                <Link href={`/posts/${encodeURIComponent(p.slug)}`} className="font-sans text-sm hover:underline">{p.title}</Link>
                <span className="font-sans text-[10px] ml-2" style={{ color: "var(--text-muted)" }}>{p.category} · {p.date?.slice(0, 10)}</span>
              </div>
              <div className="flex gap-2">
                <Link href={`/write?edit=${encodeURIComponent(p.slug)}`} className="font-sans text-[10px] hover:underline" style={{ color: "var(--accent)" }}>编辑</Link>
                <button onClick={() => delPost(p.slug, p.category, p.title)} className="font-sans text-[10px] hover:underline text-red-500">删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-sans text-lg font-semibold mb-4">评论管理 ({comments.length})</h2>
      {comments.length === 0 ? (
        <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>暂无评论</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs font-medium">{c.username}</span>
                  <Link href={`/posts/${encodeURIComponent(c.post_slug)}`} className="font-sans text-[10px] hover:underline" style={{ color: "var(--accent)" }}>查看文章</Link>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(c.created_at + "Z").toLocaleString("zh-CN")}</span>
                  <button onClick={() => delComment(c.id)} className="font-sans text-[10px] hover:underline text-red-500">删除</button>
                </div>
              </div>
              <p className="font-sans text-sm" style={{ color: "var(--text-secondary)" }}>{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
