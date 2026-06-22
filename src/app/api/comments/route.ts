import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

// GET /api/comments?slug=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "缺少slug" }, { status: 400 });
  await initDb();
  const rows = await query<{ id: number; content: string; created_at: string; username: string }>(
    "SELECT c.id, c.content, c.created_at, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_slug = ? ORDER BY c.created_at ASC",
    [slug]
  );
  return NextResponse.json(rows);
}

// POST /api/comments { slug, content }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const { slug, content } = await request.json();
    if (!slug || !content?.trim()) return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    await initDb();
    await query("INSERT INTO comments (post_slug, user_id, content) VALUES (?, ?, ?)", [slug, Number(session.user.id), content.trim()]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "评论失败" }, { status: 500 });
  }
}

// DELETE /api/comments?id=xxx
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少id" }, { status: 400 });
  await initDb();
  await query("DELETE FROM comments WHERE id = ?", [Number(id)]);
  return NextResponse.json({ ok: true });
}
