# 有序列表删除 Bug 修复 — 经验总结

> 2026-07-01 ~ 2026-07-08 | ggy-blog 写作编辑器项目

---

## 一、问题全景

仿飞书云文档的写作编辑器，有序列表/无序列表的 Backspace/Delete 行为存在**间歇性 bug**：

| 现象 | 频率 |
|------|------|
| 行首按 Backspace：有时退为段落（对），有时文字上移（错） | 100% 可触发 |
| 末端按 Delete 删除到最后：文字上移而非删除 | 100% 可触发 |

---

## 二、排查历程（5 轮迭代）

### 第 1 轮：缓冲带模式（commit 290fe2f）

**分析**：认为是旧代码"飞书直接合并模式"的 hasContent 分支导致行为不稳定。

**修改**：去掉 hasContent 判断，改为缓冲带模式（总是退化，不合并）。

**结果**：引入了新 bug — 用户反馈"原来的 bug 没改好，还出现了新 bug"。

**教训**：❌ 没有理解用户真正想修什么。用户要的是"先退化再合并"，但更根本的问题是 _hasContent 判断用的数据不准确。

---

### 第 2 轮：blockRef 防闭包（commit 1261c0f）

**分析**：写了分析文档 docs/ol-backspace-fix-analysis.md，认为是"防抖回调闭包陷阱" — 防抖延迟触发时用旧的 onChange 闭包覆盖了新状态。

**修改**：添加 lockRef + useEffect 保持最新引用；ContentEditableArea 的 onChange 改用 lockRef.current。

**结果**：回退（1ba3d53），因为用户说"改的有问题还造成了新的 bug"。

**教训**：⚠️ 虽然 blockRef 方向正确，但没有先验证用户看到的具体新 bug 是什么就推送了。应先问清楚新 bug 的具体表现。

---

### 第 3 轮：回退后重新分析（revert 1ba3d53）

**分析**：回退到飞书模式代码，重新从用户描述中提取关键信息：
- "在第三个有序列表末端一直点击删除，当前有序列表被删除后文字上移"
- "有序列表开头点击删除没有变成文本段，而是文字直接上移"
- "一次可以一次不可以"

**教训**：💡 用户第三次描述时终于说清了**所有三个 bug 的具体操作场景**，这是找到根因的转折点。

---

### 第 4 轮：根因分析文档（docs/ol-delete-bug-root-cause-analysis.md）

**发现核心根因**：所有判断逻辑使用 lock.html（React 状态），而 ContentEditableArea 有 50ms 防抖，导致 lock.html 始终滞后真实 DOM 最多 50ms。

`
t=0ms   block.html = "旧内容"（防抖还没触发）
t=25ms  用户按 Backspace → _hasContent 用的是 "旧内容" → 错误分支
`

**结论**：
1. 内容判断必须用 DOM（edEl.innerHTML），不能用 React 状态
2. 防抖回调闭包陷阱确实存在，blockRef 是正确的修复手段
3. 两个问题需要同时修复

**教训**：💡 写分析文档的过程就是理清思路的过程。把时序图画出来后，一切豁然开朗。

---

### 第 5 轮：完整修复（commit e8b1fd）

**最终修复方案**：

| 改动 | 目的 |
|------|------|
| lockRef = useRef(block) + useEffect | 消除防抖闭包陷阱 |
| 所有 _hasContent / isEmpty 改用 edEl.innerHTML | 用准确数据做决策 |
| 列表块改为缓冲带模式 | 对齐飞书退化→合并流程 |
| 退化时保留 DOM html | 防止文字丢失 |
| 11 处 onChange 用 lockRef.current | 防抖回调读最新 block |
| focus() → setCursorToEnd/Start | 光标位置精确 |
| mergeUpward 从 DOM 读 html | 退化不清空 |

**TypeScript 编译**：✅ 零错误
**部署**：✅ 已推送 main，等待用户验证

---

## 三、关键经验教训

### 1. 不要跳过"让用户描述具体操作步骤"这一步

前两次修复失败，根本原因是**没有充分理解用户的操作场景**。
直到用户第三次描述时说清了"第三个有序列表末端点击删除"、"开头点击删除没变成文本段"，
才真正理解了问题。

> 💡 **SOP**：遇到 bug 时，先让用户描述完整操作步骤 + 期望行为 vs 实际行为，再开始分析代码。

### 2. 时序分析是排查 React 状态问题的杀手锏

React 状态更新是异步的，加上防抖、批处理、闭包等因素，
"看起来没问题"的代码在实际运行时可能有微妙的时序差异。

画出时序图后，问题一目了然：
`
用户输入 → DOM 立即更新 → 50ms 后 React 状态才更新
用户按键 → handler 用的是 React 状态（可能过时）→ 决策错误
`

> 💡 **SOP**：遇到间歇性 bug，先问"是否有异步/防抖/setTimeout"，再画时序图。

### 3. 写分析文档不是浪费时间，是必须的

这次写了 3 个分析文档：
- ol-logic-analysis.md — 飞书逻辑分析
- ol-backspace-fix-analysis.md— 闭包陷阱分析
- ol-delete-bug-root-cause-analysis.md — 最终根因分析

每次写文档都逼着把思路理清，最终版本直接就是修复方案的设计文档。

> 💡 **SOP**：复杂 bug 先写分析文档，经确认后再改代码。

### 4. 先回退再修复，不要叠加修改

第 1 轮修改没验证就做了第 2 轮，导致问题叠加。
用户说"改的有问题还造成了新的 bug"后，正确的做法是：
1. 立即回退到已知可用状态
2. 重新分析
3. 一次性修复

> 💡 **SOP**：修复失败时先 revert，重新分析后一次性提交完整修复。

### 5. 理解"退化时保留 DOM html"这个细节

最初只改了 	ype: "p"，没注意 html 字段。
如果 lock.html 是空的（stale），{ ...block, type: "p" } 会把 html 也变成空字符串，
导致挂载 effect 清空 DOM。

修复：const currentHtml = edEl.innerHTML; onChange({ ...block, type: "p", html: currentHtml });

> 💡 **SOP**：修改 block 对象时，检查所有字段是否有 stale 值。

### 6. PowerShell 和 Python 字符串转义的坑

多次因为 PowerShell 不支持 &&、Python 三引号内嵌套引号等问题导致脚本失败。

> 💡 **SOP**：Windows 环境下用分号 ; 代替 &&；复杂替换写 Python 脚本文件而非内联。

---

## 四、最终修复方案要点

`
ContentEditableArea (50ms 防抖)
    ↓ 用户输入
    DOM 立即更新 → block.html 延迟更新（React 状态）
    ↓ 用户按键
    BlockView handler 读取 block.html → 可能得到旧值 → 错误决策
    
修复：
    ┌─ 决策时用 edEl.innerHTML（DOM 始终准确）
    ├─ 防抖回调用 blockRef.current（最新 block 闭包）
    ├─ 退化时显式保留 html 字段
    └─ 缓冲带模式（退化→合并，不判断内容）
`

---

## 五、修复影响范围

- **Backspace handler**：4 个分支（ordered / heading / quote / list）全部改为 DOM 判断
- **Delete handler**：2 个条件（isEmpty / 列表退化）改为 DOM 判断 + 保留 html
- **ContentEditableArea onChange**：11 处改为 blockRef
- **mergeUpward**：退化时从 DOM 读取 html
- **focus() 统一**：4 处改为 setCursorToEnd/setCursorToStart

TypeScript 编译通过 ✅
