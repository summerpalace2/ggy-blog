import fs from "fs";
import path from "path";
import matter from "gray-matter";

/**
 * 文章元数据接口
 * slug — URL 标识，category — 分类（动态），published — 是否发布
 */
export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  category: string;
  description: string;
  published: boolean;
}

/** 文章内容目录 */
const contentDir = path.join(process.cwd(), "content");

/** 获取所有分类（扫描 content/ 下子目录） */
export function getAllCategories(): string[] {
  if (!fs.existsSync(contentDir)) return [];
  return fs.readdirSync(contentDir).filter((name) => {
    const stat = fs.statSync(path.join(contentDir, name));
    return stat.isDirectory() && !name.startsWith(".");
  });
}

/**
 * 获取所有已发布文章，按日期倒序
 * 动态遍历 content/ 下所有分类子目录
 */
export function getAllPosts(): PostMeta[] {
  const categories = getAllCategories();
  const posts: PostMeta[] = [];

  for (const cat of categories) {
    const dir = path.join(contentDir, cat);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".mdx")) continue;
      const slug = file.replace(/\.mdx$/, "");
      const source = fs.readFileSync(path.join(dir, file), "utf8");
      const { data } = matter(source);
      posts.push({
        slug,
        title: data.title || slug,
        date: data.date || "",
        tags: data.tags || [],
        category: cat,
        description: data.description || "",
        published: data.published !== false,
      });
    }
  }

  return posts
    .filter((p) => p.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * 按 slug 查找单篇文章（含正文内容）
 * 动态搜索所有分类目录
 */
export function getPostBySlug(slug: string) {
  const decoded = (() => { try { return decodeURIComponent(slug); } catch { return slug; } })();
  const categories = getAllCategories();

  for (const cat of categories) {
    const fp = path.join(contentDir, cat, `${decoded}.mdx`);
    if (fs.existsSync(fp)) {
      const source = fs.readFileSync(fp, "utf8");
      const { data, content } = matter(source);
      return {
        meta: {
          slug: decoded,
          title: data.title || decoded,
          date: data.date || "",
          tags: data.tags || [],
          category: cat,
          description: data.description || "",
          published: data.published !== false,
        } satisfies PostMeta,
        content,
      };
    }
  }
  return null;
}

/** 获取所有标签（去重、中文排序） */
export function getAllTags(): string[] {
  const set = new Set<string>();
  for (const p of getAllPosts()) for (const t of p.tags) set.add(t);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

/** 按标签筛选文章 */
export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPosts().filter((p) => p.tags.includes(tag));
}

/** 按分类筛选文章 */
export function getPostsByCategory(category: string): PostMeta[] {
  return getAllPosts().filter((p) => p.category === category);
}

/** 英文化 slug（用于文件名） */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || `post-${Date.now().toString(36)}`;
}

/**
 * 保存文章到文件系统（content/[category]/[slug].mdx）
 */
export function savePost(input: {
  slug: string; title: string; content: string;
  category: string; tags: string[]; description: string;
}) {
  const dir = path.join(contentDir, input.category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const date = new Date().toISOString();
  const yaml = [
    "---",
    `title: ${JSON.stringify(input.title)}`,
    `date: ${JSON.stringify(date)}`,
    `tags: ${JSON.stringify(input.tags)}`,
    `category: ${JSON.stringify(input.category)}`,
    `description: ${JSON.stringify(input.description)}`,
    `published: true`,
    "---", "",
    input.content.trimEnd(), "",
  ].join("\n");

  fs.writeFileSync(path.join(dir, `${input.slug}.mdx`), yaml, "utf8");
  return getPostBySlug(input.slug);
}

/**
 * 重命名分类：将目录下的所有 .mdx frontmatter 中的 category 字段更新
 */
export function renameCategory(oldName: string, newName: string): boolean {
  const oldDir = path.join(contentDir, oldName);
  const newDir = path.join(contentDir, newName);
  if (!fs.existsSync(oldDir) || fs.existsSync(newDir)) return false;

  fs.renameSync(oldDir, newDir);

  for (const file of fs.readdirSync(newDir)) {
    if (!file.endsWith(".mdx")) continue;
    const fp = path.join(newDir, file);
    const source = fs.readFileSync(fp, "utf8");
    const { data, content } = matter(source);
    data.category = newName;
    const newYaml = matter.stringify(content, data);
    fs.writeFileSync(fp, newYaml, "utf8");
  }
  return true;
}

/**
 * 删除分类：删除目录及其中所有文章
 */
export function deleteCategory(name: string): boolean {
  const dir = path.join(contentDir, name);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true });
  return true;
}

/**
 * 创建分类目录（用于长期保存空分类）
 */
export function createCategory(name: string): boolean {
  const dir = path.join(contentDir, name);
  if (fs.existsSync(dir)) return false;
  fs.mkdirSync(dir, { recursive: true });
  return true;
}
