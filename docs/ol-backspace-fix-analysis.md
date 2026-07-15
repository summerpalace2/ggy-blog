# 有序列表 Backspace 问题分析文档

## 一、问题描述

用户报告两个问题：
1. 在有序列表行首按 Backspace，列表没有先变成段落，而是直接删除块并合并内容到上一块
2. 行为不稳定：有时能合并，有时不能

## 二、根因分析

### 2.1 设计层面：缓冲带 vs 直接合并

**飞书云文档行为：**
- 列表项行首有内容按 Backspace → 内容合并到上一个列表项，当前块删除
- 空列表项按 Backspace → 退出列表，变为普通段落

**本项目应采用的行为（用户期望的缓冲带模式）：**
- 第一次 Backspace：列表项 → 段落（保留内容，光标在行首）
- 第二次 Backspace（现在是段落）：内容合并到上一块

**当前代码的问题：**
之前的改动将 ol/ul/todo 的有内容情况改为"直接合并"，但这与用户的期望不符。用户期望的是缓冲带模式。

### 2.2 技术层面：光标定位不稳定

即使恢复缓冲带模式，原有代码也存在光标不稳定问题：
```typescript
onChange({ ...block, type: "p" });
setTimeout(() => edRef.current?.focus(), 0); // focus() 不保证光标位置
```

`focus()` 不保证光标在行首，重新渲染后光标可能跑到末尾，导致第二次 Backspace 的 `atStart` 检测失败。

### 2.3 mergeUpward 函数中的缓冲带逻辑

`mergeUpward` 函数中已有对空 ol/ul/todo 的缓冲带处理：
```typescript
if (["ol", "ul", "todo"].includes(currentBlock.type)) {
  // 列表空块：先转段落（给第二次Backspace的机会）
  updated[realIndex] = { ...currentBlock, type: "p", html: "" };
  // ...
}
```

这说明项目原本的设计就是缓冲带模式，但 Backspace 处理器的逻辑与 mergeUpward 不完全一致。

## 三、修复方案

### 3.1 恢复缓冲带模式

将 ol/ul/todo 的 Backspace 行为恢复为：
- 有内容 → 退为段落（保留内容）
- 空 → 退为段落（给第二次 Backspace 机会）

### 3.2 修复光标定位

将 `focus()` 替换为 `setCursorToStart()`，确保光标始终在行首。

### 3.3 与 mergeUpward 保持一致

确保 Backspace 处理器和 mergeUpward 函数的逻辑一致：
- 空 ol/ul/todo：退为段落
- 有内容的 ol/ul/todo 在变为段落后，第二次 Backspace 时作为普通段落处理（合并到上一块）

## 四、影响范围

- `src/app/write/components/block-view/BlockView.tsx`：Backspace 处理器
- `src/app/write/store/block-operations.ts`：mergeUpward 函数（已有正确逻辑，无需修改）

## 五、验证方案

1. 创建有序列表项 "测试内容"
2. 光标放在行首
3. 按 Backspace → 应退为段落（列表标记消失）
4. 再按 Backspace → 内容应合并到上一块
