import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query, initDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password || username.length < 2 || password.length < 4) {
      return NextResponse.json({ error: "用户名至少2位，密码至少4位" }, { status: 400 });
    }
    await initDb();
    const rows = await query<{ id: number }>("SELECT id FROM users WHERE username = ?", [username]);
    if (rows.length > 0) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
    }
    const hash = bcrypt.hashSync(password, 10);
    await query("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, "user"]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
