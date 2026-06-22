import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllPosts, deletePost } from "@/lib/posts";

// GET /api/admin/posts — 获取所有文章
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json(await getAllPosts());
}

// DELETE /api/admin/posts?slug=xxx&category=yyy
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const category = searchParams.get("category");
  if (!slug || !category) return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  const ok = deletePost(slug, category);
  return NextResponse.json({ ok });
}
