import { query } from "@/lib/db";

let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return;
  await query("CREATE TABLE IF NOT EXISTS posts (slug VARCHAR(500) NOT NULL, category VARCHAR(100) NOT NULL, title VARCHAR(500) NOT NULL, content LONGTEXT NOT NULL, description TEXT, tags JSON, published TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (slug, category))");
  _tableReady = true;
}

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  category: string;
  description: string;
  published: boolean;
}

function rowToMeta(r: any): PostMeta {
  let tags: string[] = [];
  try {
    if (r.tags) {
      tags = typeof r.tags === "string" ? JSON.parse(r.tags) : Array.isArray(r.tags) ? r.tags : [];
    }
  } catch { tags = []; }
  return {
    slug: r.slug || "", title: r.title || "",
    date: r.created_at ? new Date(r.created_at).toISOString() : "",
    tags,
    category: r.category || "", description: r.description || "", published: !!r.published,
  };
}

export async function getAllPosts(): Promise<PostMeta[]> {
  await ensureTable();
  const rows = await query("SELECT slug, title, created_at, tags, category, description, published FROM posts WHERE published = 1 ORDER BY created_at DESC");
  return rows.map(rowToMeta);
}

export async function getPostBySlug(slug: string): Promise<{ meta: PostMeta; content: string } | null> {
  const decoded = (() => { try { return decodeURIComponent(slug); } catch { return slug; } })();
  const rows = await query("SELECT * FROM posts WHERE slug = ? AND published = 1 LIMIT 1", [decoded]);
  if (rows.length === 0) return null;
  const r = rows[0];
  const content = typeof r.content === "string" ? r.content : String(r.content || "");
  return { meta: rowToMeta(r), content };
}

export async function getPostsByCategory(category: string): Promise<PostMeta[]> {
  const all = await getAllPosts();
  return all.filter(p => p.category === category);
}

export function slugify(title: string): string {
  return title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "untitled";
}

export async function savePost(input: {
  slug: string; title: string; content: string;
  category: string; tags: string[]; description: string;
}) {
  await query(
    `INSERT INTO posts (slug, category, title, content, description, tags, published, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content), description=VALUES(description), tags=VALUES(tags), created_at=NOW()`,
    [input.slug, input.category, input.title, input.content, input.description, JSON.stringify(input.tags)]
  );
  return getPostBySlug(input.slug);
}

export async function getAllCategories(): Promise<string[]> {
  const rows = await query("SELECT DISTINCT category FROM posts WHERE published = 1");
  return rows.map((r: any) => r.category);
}

export function getAllTags(): string[] { return []; }
export function getPostsByTag(): PostMeta[] { return []; }

export async function deletePost(slug: string, category: string): Promise<boolean> {
  await query("DELETE FROM posts WHERE slug = ? AND category = ?", [slug, category]);
  return true;
}

export async function renameCategory(oldName: string, newName: string): Promise<boolean> {
  await query("UPDATE posts SET category = ? WHERE category = ?", [newName, oldName]);
  return true;
}

export async function deleteCategory(name: string): Promise<boolean> {
  await query("DELETE FROM posts WHERE category = ?", [name]);
  return true;
}

export async function createCategory(): Promise<boolean> {
  return true;
}
