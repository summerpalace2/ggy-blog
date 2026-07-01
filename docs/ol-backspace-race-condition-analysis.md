# 有序列表 Backspace「一次好一次坏」Bug 根因分析

## 问题现象

在有序列表/无序列表块行首按 Backspace：
- **好**：退为普通段落（光标行首），第二次 Backspace 才合并
- **坏**：直接删除块，内容合并到上一块

两种行为**交替出现**，稳定复现。

---

## 代码现状

BlockView.tsx 的 handleKeyDown handler（已改为缓冲带模式）：

`	ypescript
// 行 358-363
if (["ol", "ul", "todo"].includes(block.type)) {
  onChange({ ...block, type: "p" });
  setTimeout(() => setCursorToStart(edEl), 0);
  return;
}
`

逻辑本身没有问题——**所有 ol/ul/todo 块都应该走这个分支**。
行为不一致的根因不在这里，而在**状态更新的时序竞争**。

---

## 根因：ContentEditableArea 的防抖回调闭包捕获了过时的 block 引用

### 关键代码

**ContentEditableArea.tsx - 防抖 handleInput：**

`	ypescript
const handleInput = (e) => {
  const newHtml = e.currentTarget.innerHTML;
  pendingHtml.current = newHtml;
  debounceTimer.current = setTimeout(() => {
    const pending = pendingHtml.current;
    if (pending !== null && ref.current && ref.current.innerHTML === pending) {
      isInternalUpdate.current = true;
      prevHtml.current = pending;
      onChange(pending);   // ← onChange 是 prop，闭包捕获创建时的值
    }
  }, 50);
};
`

每个 handleInput 都是**新函数**（组件每次渲染时重建），它通过闭包捕获**创建它那次渲染时**的 onChange prop。

**BlockView.tsx - 传给 ContentEditableArea 的 onChange：**

`	ypescript
<ContentEditableArea
  onChange={(html) => onChange({ ...block, html })}
  //             ↑ block 也是闭包捕获，来自创建那次渲染
/>
`

**page.tsx - 传给 BlockView 的 onChange：**

`	ypescript
<BlockView
  onChange={(b) => {
    pushSnapshot();
    setBlocks(prev => prev.map(bl => bl.id === b.id ? b : bl));
  }}
/>
`

### 竞态时序

以用户输入"测试文本"后立即 Backspace 为例：

`
t=0ms   [Render N] block = { type: "ol", html: "" }
        用户在 ol 块中输入"测试文本"
        handleInput_N 被调用 → 创建防抖定时器（50ms）
        定时器闭包捕获：onChange_N（对应 Render N 的 block）

t=25ms  用户按 Backspace（光标在行首）
        handleKeyDown 闭包中的 block 还是 Render N 的值 { type: "ol", html: "" }
        → 匹配 ol 分支 → onChange({ type: "p", html: "" })
        
        React 触发重渲染 → [Render N+1]
        block = { type: "p", html: "" } ← type 变更成功
        
t=50ms  防抖定时器触发！
        调用 onChange_N("测试文本")  ← 这是 Render N 的 onChange！
        展开：{ ...block_from_Render_N, html: "测试文本" }
             = { ...{ type: "ol", html: "" }, html: "测试文本" }
             = { type: "ol", html: "测试文本" }
        
        ！！！type 从 "p" 被改回 "ol" ！！！
`

**结果**：Backspace 明明把 type 改成了 "p"，但 50ms 后防抖回调用旧的闭包把 type 改回了 "ol"。

### 为什么「一次好一次坏」

| 场景 | 时序 | 结果 |
|------|------|------|
| 先按 Backspace，50ms 内无操作 | type 先改为 "p"，但 50ms 后防抖回调把它改回 "ol" | ❌ 坏：type 还原为列表 |
| 先等 Backspace（防抖已清空），再按 | 防抖已失效，不会触发任何回调 | ✅ 好：只改了 type |
| 快速连续输入多个字符再 Backspace | 每次 handleInput 都重建防抖+闭包 | 随机取决于哪个闭包最后触发 |

### 为什么「直接删除块」

当 type 被改回 "ol" 后，用户看到的还是有序列表。此时再按 Backspace：
- handler 仍然匹配 ol 分支 → 改 type 为 "p"
- 防抖回调再次触发 → 又把 type 改回 "ol"

结果就是：有时 first Backspace 就被防抖撤销，用户以为没生效；第二次 Backspace 时恰好防抖还没有新回调，type 修改成功。

更极端的情况下，如果 edEl.innerHTML 被 syncToDom 清空了（html 从 "" 变为 ""），mergeUpward 会走删除分支，直接把当前块删掉。

---

## 根因总结

| 层次 | 问题 |
|------|------|
| **架构缺陷** | ContentEditableArea 的防抖 onChange 闭包捕获父组件的过时状态 |
| **闭包陷阱** | handleInput 每次渲染都重建，但旧的防抖定时器还在运行时使用旧的闭包 |
| **没有用 ref 保持最新引用** | lock 和 onChange 都依赖闭包，而非 ref |

---

## 修复方案

### 方案 A（推荐）：用 ref 保持 BlockView 中最新 block 引用

`	ypescript
// BlockView.tsx
const blockRef = useRef(block);
useEffect(() => { blockRef.current = block; }, [block]);

// 传递给 ContentEditableArea 时从 ref 读取
<ContentEditableArea
  onChange={(html) => onChange({ ...blockRef.current, html })}
/>
`

这样即使防抖回调延迟触发，也会读取**最新的 block**（包括最新的 type）。

### 方案 B：ContentEditableArea 用函数式更新代替闭包

将 onChange(html) 改为 setHtml(html) 模式，由 ContentEditableArea 自己持有 html 状态，通过父组件传入的 setHtml 函数更新：

`	ypescript
// 父组件
const [html, setHtml] = useState(block.html);
const latestHtml = useRef(html);

useEffect(() => { latestHtml.current = html; }, [html]);

<ContentEditableArea
  html={html}
  onHtmlChange={(newHtml) => {
    latestHtml.current = newHtml;
    onChange({ ...blockRef.current, html: newHtml });
  }}
/>
`

### 方案 C：防抖在创建时记录版本，触发时对比版本

防抖 timer 创建时记录当前 block 的版本号（或 type 值），触发时对比当前最新值，如果 type 已变更，则只更新 html 不覆盖 type。

---

## 推荐实现：方案 A

**理由：**
1. 改动最小（只加一个 ref + 一处 onChange 改动）
2. 不改变 ContentEditableArea 架构
3. 同时解决所有闭包导致的 stale state 问题
4. 也适用于快速输入+Enter、快速输入+Delete 等场景

**风险：** 几乎为零。ref + useEffect 标准模式。
