"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Comment {
  id: number;
  content: string;
  created_at: string;
  username: string;
}

export function Comments({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`);
    if (res.ok) setComments(await res.json());
  };

  useEffect(() => { fetchComments(); }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, content: text.trim() }),
    });
    setText("");
    setLoading(false);
    fetchComments();
  };

  const del = async (id: number) => {
    if (!confirm("确定删除这条评论？")) return;
    await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    fetchComments();
  };

  return (
    <div className="mt-12 pt-10 border-t" style={{ borderColor: "var(--border-light)" }}>
      <h2 className="font-sans text-lg font-semibold mb-6">评论 ({comments.length})</h2>

      {session?.user ? (
        <form onSubmit={submit} className="card p-4 mb-6 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="写下你的评论…" rows={3}
            className="w-full px-3 py-2 rounded-lg border font-sans text-sm outline-none resize-none"
            style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
          <button disabled={loading || !text.trim()} className="px-4 py-1.5 rounded-lg font-sans text-xs font-medium"
            style={{ backgroundColor: "var(--accent)", color: "#fff", opacity: text.trim() ? 1 : 0.5 }}>
            {loading ? "提交中…" : "发表评论"}
          </button>
        </form>
      ) : (
        <p className="font-sans text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/login" className="hover:underline" style={{ color: "var(--accent)" }}>登录</Link> 后可以发表评论
        </p>
      )}

      {comments.length === 0 ? (
        <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>暂无评论</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-sans text-xs font-medium">{c.username}</span>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(c.created_at + "Z").toLocaleString("zh-CN")}</span>
                  {session?.user?.role === "admin" && (
                    <button onClick={() => del(c.id)} className="font-sans text-[10px] hover:underline" style={{ color: "var(--text-muted)" }}>删除</button>
                  )}
                </div>
              </div>
              <p className="font-sans text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
