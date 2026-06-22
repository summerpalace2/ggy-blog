import { NextResponse } from "next/server";
import { savePost, slugify } from "@/lib/posts";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const IMG_DIR = path.join(process.cwd(), "public", "images");

function ensureDir() {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
}

function extractImages(content: string): string {
  const re = /!\[([^\]]*)\]\(data:(image\/\w+);base64,([^)]+)\)/g;
  return content.replace(re, (full, alt, mime, b64) => {
    try {
      const buf = Buffer.from(b64, "base64");
      const ext = mime.split("/")[1] || "png";
      const hash = crypto.createHash("md5").update(buf).digest("hex").slice(0, 8);
      const filename = `${hash}.${ext}`;
      ensureDir();
      fs.writeFileSync(path.join(IMG_DIR, filename), buf);
      return `![${alt}](/images/${filename})`;
    } catch {
      return full;
    }
  });
}

/**
 * POST /api/posts — 保存文章到文件系统（自动提取base64图片存文件）
 * @body { title, content, category, tags, description }
 */
export async function POST(request: Request) {
  try {
    const { title, content, category, tags, description } = await request.json();
    if (!title || !content) {
      return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 });
    }
    const slug = slugify(title);
    const cleaned = extractImages(content);
    const post = await savePost({ slug, title, content: cleaned, category: category || "tech", tags: tags || [], description: description || "" });
    return NextResponse.json({ post }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
