import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, initDb } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });
  await initDb();
  const rows = await query<{ id: number; content: string; created_at: string; post_slug: string; username: string }>(
    "SELECT c.id, c.content, c.created_at, c.post_slug, u.username FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC"
  );
  return NextResponse.json(rows);
}
