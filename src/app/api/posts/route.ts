import { NextResponse } from "next/server";
import { savePost, slugify } from "@/lib/posts";

/**
 * POST /api/posts — 保存文章到文件系统
 * @body { title, content, category, tags, description }
 */
export async function POST(request: Request) {
  try {
    const { title, content, category, tags, description } = await request.json();
    if (!title || !content) {
      return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 });
    }
    const slug = slugify(title);
    const post = savePost({ slug, title, content, category: category || "tech", tags: tags || [], description: description || "" });
    return NextResponse.json({ post }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
