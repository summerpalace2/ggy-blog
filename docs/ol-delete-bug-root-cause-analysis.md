# 有序列表删除行为 Bug 完整根因分析

## 一、问题清单

| # | 问题 | 严重度 |
|---|------|--------|
| P0 | 有序列表开头按 Backspace，有时退为段落（对），有时文字直接上移（错） | 致命 |
| P0 | "一次好一次坏" — 100% 可触发的间歇性 bug | 致命 |
| P1 | 有序列表末端按 Delete 删除到最后，文字上移到上一段落而非删除 | 严重 |

---

## 二、核心根因：用 lock.html（React 状态）代替 DOM 内容做决策

### 问题代码位置

**BlockView.tsx 行 330-342（Backspace handler）：**
`	ypescript
// 有序覆盖层
if (block.ordered) {
    const _hasContent = block.html.replace(/<[^>]+>/g, "").trim(); // ⚠️ 用 block.html
    if (_hasContent) {
        onBackspace(edEl.innerHTML || "");  // 有内容 → 合并到上一块
    } else {
        onChange({ ...block, ordered: undefined });  // 空 → 退为段落
    }
}
`

**BlockView.tsx 行 364-375（ol/ul/todo 列表）：**
`	ypescript
if (["ol", "ul", "todo"].includes(block.type)) {
    const _hasContent = block.html.replace(/<[^>]+>/g, "").trim(); // ⚠️ 用 block.html
    if (_hasContent) {
        onBackspace(edEl.innerHTML || "");  // 有内容 → 合并
    } else {
        onChange({ ...block, type: "p" });  // 空 → 退为段落
    }
}
`

**BlockView.tsx 行 411（Delete handler）：**
`	ypescript
const isEmpty = !block.html.replace(/<[^>]+>/g, "").trim(); // ⚠️ 用 block.html
`

### 为什么 block.html 不可靠？

ContentEditableArea 有 **50ms 防抖**：

`	ypescript
// ContentEditableArea.tsx
const handleInput = (e) => {
    const newHtml = e.currentTarget.innerHTML;
    pendingHtml.current = newHtml;
    debounceTimer.current = setTimeout(() => {
        // 50ms 后才更新 React 状态
        onChange(pending);
    }, 50);
};
`

**结果**：React 状态 lock.html 总是滞后 DOM 最多 50ms。

### 具体导致 bug 的时序

**场景：用户在 ol 块中输入 "测试" 后立即按 Backspace**

`
t=0ms   [Render N] block.html = ""（尚未更新）
        用户在 ol 块中输入 "测试"
        → handleInput 触发，防抖定时器设置 50ms
        
t=25ms  用户按 Backspace（光标在行首）
        handler 中的 block 还是 Render N 的闭包
        block.html = ""（仍然是旧值！）
        
        _hasContent = "".trim() = false  ← 用了错误的值！
        → 进入 else 分支 → 退为段落 ✓

t=50ms  防抖回调触发
        onChange("测试") → block.html = "测试"
        React 重渲染
        
但如果反过来：

t=0ms   [Render N] block.html = "上次输入的内容"
        用户清空了 ol 块（DOM 已空）
        但防抖还没触发，block.html 还是 "上次输入的内容"
        
t=25ms  用户按 Backspace
        _hasContent = "上次输入的内容".trim() = TRUE  ← 用了错误的值！
        → 进入 if 分支 → onBackspace(innerHTML) → 合并到上一块
        → 文字上移！用户完全没料到会这样
`

**这就是 "一次好一次坏" 的 100% 触发原因：**
- 按 Backspace 时如果 block.html 恰好是最新的 → 正确行为
- 按 Backspace 时如果 block.html 是旧的 → 错误行为

---

## 三、次要根因：ContentEditableArea 防抖回调的闭包陷阱

### 问题代码

**BlockView.tsx 传给 ContentEditableArea 的 onChange：**
`	ypescript
<ContentEditableArea
    onChange={(html) => onChange({ ...block, html })}
    //             ↑ block 是闭包，捕获创建时的值
/>
`

当防抖延迟触发时，用的是**创建防抖时那次渲染的 block 闭包**。

### 时序导致的问题

`
t=0ms   [Render N] block = { type: "ol", html: "" }
        用户输入 "abc"，创建防抖定时器（捕获 Render N 的 onChange 闭包）
        
t=25ms  用户按 Backspace at start
        handler: onChange({ type: "p", html: "" })  ← 改 type
        React 重渲染 → [Render N+1]
        
        blockRef.current 还未更新（useEffect 还没跑）
        
t=50ms  防抖回调触发
        调用 onChange_N("abc")
        = { ...block_from_Render_N, html: "abc" }
        = { type: "ol", html: "abc" }    ← 把 type 改回 "ol"！
        
        React 重渲染，block = { type: "ol", html: "abc" }
        → 之前的退化为段落被撤销！
`

---

## 四、第三根因：Delete handler 逻辑混乱

### 当前 Delete handler 的问题

`	ypescript
// 行 407-420
if (atEnd && !atStart) {
    const isEmpty = !block.html.replace(/<[^>]+>/g, "").trim(); // ⚠️ 用 block.html
    if (isEmpty) {
        if (["ol", "ul", "todo"].includes(block.type) || block.ordered) {
            // 退为段落
            onChange({ ...block, type: "p" });
        } else {
            onDeleteDown?.();  // 删除
        }
    }
    return;
}
if (atStart && atEnd) {  // 空块
    if (["ol", "ul", "todo"].includes(block.type) || block.pecified) {
        onChange({ ...block, type: "p" });
    } else {
        onDeleteDown?.();
    }
    return;
}
`

**问题**：
1. isEmpty 用 block.html → 可能不准确
2. 退为段落后，第二次 Delete 会调用 onDeleteDown → mergeDownward
3. mergeDownward 只是删除块，不合并文字 — 所以第二次 Delete 应该正确
4. 但如果 isEmpty 判断错误（block.html 不是空的），则会跳过退化直接删除/合并

---

## 五、完整修复方案

### 核心原则

1. **所有内容检查都用 DOM（edEl.innerHTML），不用 block.html**
2. **缓冲带模式**：列表块第一次按键退化，第二次按键合并
3. **防抖闭包陷阱**：用 blockRef 始终引用最新 block

### 修复 1：Backspace handler — 用 DOM 内容 + 缓冲带

`	ypescript
// 有序覆盖层：缓冲带模式
if (block.ordered) {
    onChange({ ...block, ordered: undefined, restartNumbering: undefined });
    setTimeout(() => { const el = edRef.current; if (el) setCursorToStart(el); }, 0);
    return;
}

// 有序/无序/待办列表：缓冲带模式
if (["ol", "ul", "todo"].includes(block.type)) {
    onChange({ ...block, type: "p" });
    setTimeout(() => { const el = edRef.current; if (el) setCursorToStart(el); }, 0);
    return;
}
`

### 修复 2：Delete handler — 用 DOM 内容

`	ypescript
// 行 411
const isEmpty = !el.innerHTML.replace(/<[^>]+>/g, "").trim(); // 改用 DOM
`

### 修复 3：消除防抖闭包陷阱

`	ypescript
const blockRef = useRef(block);
useEffect(() => { blockRef.current = block; }, [block]);

// 传给 ContentEditableArea：
onChange={(html) => onChange({ ...blockRef.current, html })}
`

### 修复 4：mergeUpward — 为空列表块添加 html 保留

`	ypescript
// 当前代码（行 144）会清空 html
updated[realIndex] = { ...currentBlock, type: "p", html: "" };
// 应该改为保留 DOM 中的实际内容
`

---

## 六、修复影响范围评估

| 改动 | 影响 | 风险 |
|------|------|------|
| Backspace handler 用 DOM 内容 | 所有块类型的行首删除 | 低（DOM 始终准确） |
| Backspace handler 缓冲带模式 | 列表块和 ordered 覆盖层 | 低（总是退化，不判断内容） |
| Delete handler 用 DOM 内容 | 所有块类型的行尾删除 | 低 |
| blockRef 防闭包 | ContentEditableArea 的所有 onChange | 低 |
| mergeUpward html 保留 | 列表块退化时 | 低 |

---

## 七、验证步骤

1. 在 ol 块中输入 "测试" → 立即在行首按 Backspace → 应退为段落（文字 "测试" 保留）
2. 再按 Backspace → 文字 "测试" 合并到上一块
3. 连续快速输入+Backspace 多次 → 行为稳定一致
4. 三个有序列表，第三个末端 Delete 删除文字 → 文字消失，不移动到上一块
5. 空 ol 块行首 Backspace → 退为段落
6. 再按 Backspace → 空段落删除（mergeDownward）
