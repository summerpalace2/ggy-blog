import { NextResponse } from "next/server";
import { getAllCategories, renameCategory, deleteCategory, createCategory } from "@/lib/posts";

/** GET /api/categories — 获取所有分类 */
export async function GET() {
  try {
    const categories = getAllCategories();
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ error: "获取分类失败" }, { status: 500 });
  }
}

/** POST /api/categories — 创建分类 */
export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: "分类名不能为空" }, { status: 400 });
    createCategory(name);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

/** PUT /api/categories — 重命名分类 */
export async function PUT(request: Request) {
  try {
    const { oldName, newName } = await request.json();
    if (!oldName || !newName) return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    const ok = renameCategory(oldName, newName);
    if (!ok) return NextResponse.json({ error: "重命名失败" }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

/** DELETE /api/categories — 删除分类 */
export async function DELETE(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    const ok = deleteCategory(name);
    if (!ok) return NextResponse.json({ error: "删除失败" }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
