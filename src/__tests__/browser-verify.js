/**
 * 飞书云文档块级交互 — 浏览器控制台验证脚本
 *
 * 使用方法：
 * 1. npm run dev 启动项目
 * 2. 打开 http://localhost:3000/write
 * 3. 打开浏览器开发者工具 → Console
 * 4. 复制粘贴此脚本全部内容并回车执行
 */

(function verifyFeishuBlocks() {
  const results: { test: string; pass: boolean; detail: string }[] = [];
  const log = (test: string, pass: boolean, detail: string) => {
    results.push({ test, pass, detail });
    console.log(`[${pass ? "✅" : "❌"}] ${test}: ${detail}`);
  };

  // T1: 检查块容器结构
  const blocks = document.querySelectorAll("[data-block]");
  log("T1.1 块容器存在", blocks.length > 0, `找到 ${blocks.length} 个块`);

  // T2: 检查每个块的左侧 gutter 存在
  let hasGutter = true;
  blocks.forEach((b) => {
    const gutter = b.querySelector(".w-10.shrink-0");
    if (!gutter) hasGutter = false;
  });
  log("T2.1 左侧 gutter 存在", hasGutter, `检查了 ${blocks.length} 个块`);

  // T3: 检查 ModeSwitcher 存在
  const modeBtns = document.querySelectorAll("button");
  const hasModeBtn = Array.from(modeBtns).some((b) =>
    b.textContent?.includes("编辑") || b.textContent?.includes("阅读") || b.textContent?.includes("修订")
  );
  log("T3.1 模式切换器", hasModeBtn, "查找编辑/阅读/修订按钮");

  // T4: 检查评论面板按钮
  const commentBtn = Array.from(modeBtns).some((b) => b.textContent?.includes("💬"));
  log("T4.1 评论面板入口", commentBtn, "顶部工具栏中的评论按钮");

  // T5: 检查 data-block 属性
  let allHaveDataBlock = true;
  const blockElements = document.querySelectorAll(".group.relative");
  blockElements.forEach((el) => {
    if (!(el as HTMLElement).dataset.block) allHaveDataBlock = false;
  });
  log("T5.1 data-block 属性", allHaveDataBlock, `检查了 ${blockElements.length} 个块元素`);

  // T6: 检查 contenteditable 元素
  const editables = document.querySelectorAll("[contenteditable]");
  log("T6.1 可编辑区域", editables.length > 0, `找到 ${editables.length} 个可编辑元素`);

  // T7: 检查 CSS 动画样式
  const styles = document.querySelectorAll("style");
  let hasCommentFlash = false;
  styles.forEach((s) => {
    if (s.textContent?.includes("comment-flash")) hasCommentFlash = true;
  });
  log("T7.1 评论闪烁动画", hasCommentFlash, "comment-flash CSS 动画定义");

  // T8: 检查 DragHandle 组件存在
  const dragHandles = document.querySelectorAll('[title*="拖拽排序"]');
  log("T8.1 拖拽把手", dragHandles.length > 0, `找到 ${dragHandles.length} 个拖拽把手元素`);

  // T9: 检查 header 中有标题元素
  const title = document.querySelector("[data-placeholder='文章标题…']");
  log("T9.1 标题输入区", !!title, title ? "找到标题 placeholder" : "未找到");

  // T10: 检查底部信息栏
  const footerText = document.body.innerText || "";
  const hasFooter = footerText.includes("个块") || footerText.includes("字符");
  log("T10.1 底部状态栏", hasFooter, footerText.includes("个块") ? "有块计数" : "有字符计数");

  // 汇总
  const passCount = results.filter((r) => r.pass).length;
  const totalCount = results.length;
  console.log("\n═══════════════════════════════════");
  console.log(`  验收结果: ${passCount}/${totalCount} 通过`);
  console.log("═══════════════════════════════════\n");

  results.filter((r) => !r.pass).forEach((r) => {
    console.log(`⚠️  ${r.test}: ${r.detail}`);
  });

  return { results, passCount, totalCount };
})();
