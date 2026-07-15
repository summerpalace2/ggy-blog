# ggy-blog Write 页 Backspace/Enter 逻辑深度排查

## 一、Bug 清单与现象

### Bug-1: 列表快删时内容全部消失
- 场景: `1.abcd + 2.aaaa|` 一直按 backspace
- 期望: 全部内容被删除 (只留一个空块)
- 实际: 快按时 B 块旧内容被合并到 A，看起来像删不掉
- 根因: React 重渲染时 B 的 `block.html` 仍是旧值 `"aaaa"`, 导致 mergeUpward 把 `"aaaa"` 拼到 A

### Bug-2: 文本段按 BS 一次成功一次失败
- 场景: `1.ad` → 手动创建 `2.|dd` → 按 BS
- 期望: `1.addd` 稳定合并
- 实际: 有时成功有时失败
- 原因: justDemoted 标记时机 + flushRef 与浏览器输入事件竞争

### Bug-3: mergeUpward 光标未稳定聚焦
- 场景: `1.ad + 2.manualCreate → 2.dd|` 按 BS 后, 应合并并聚焦末尾
- 期望: 合并后光标稳定在 A 末尾, 后续 BS 可继续删
- 实际: 光标被浏览器重置到块行首, 后续 BS 无法继续
- 修复: 4 处 DOM 操作均同步调用 `applyPendingCursorRestoration``1.ads + 2.ads|` 一直按 backspace
- 期望: 全部内容删除，只留一个空块
- 实际: `abcdsdsd`（文本段）— B 内容被合并到 A，A 没继续删

## 二、根因分析（对应 Bug → 代码级定位）

### 根因 A — `mergeUpward` 的 `isEmptyContent` 不 strip HTML 标签
- 文件: `store/block-operations.ts`  `mergeUpward` 函数
- 现码: `const isEmptyContent = !content.trim();`
- 问题: `"<br>".trim()` 是非空字符串 → 被判断为「有内容」→ 走合并分支 → 把 `"<br>"` 前一拼

### 根因 B — `mergeUpward` 不跳过空的前块
- 现码: `const previousBlock = realIndex > 0 ? prev[realIndex - 1] : undefined;`
- 问题: 直接取前一块, 无内容检查 → 前块空就拼空串

### 根因 C — BlockView 段落 BS 不判 vis 空
- 现码: 默认分支 `flushRef.current?.(); onBackspace(edEl.innerHTML || "");`
- 问题: 浏览器删光后面 DOM 可能剩下 `<br>` → 该值被当内容传到 mergeUpward

## 三、修复方案

### Fix-1 (P0): block-operations.ts mergeUpward — 加 HTML 判空 + 重构前块定位
```ts
const isEmptyContent = !content.replace(/<[^>]+>/g, "").trim();
// 前一块取最近的一个非特殊类型块
let prevIndex = realIndex - 1;
while (prevIndex >= 0 && ["code","hr","img","table"].includes(prev[prevIndex]?.type || "")) {
  prevIndex--;
}
const previousBlock = prevIndex >= 0 ? prev[prevIndex] : undefined;
```
前一块为空文本块时也正常合并 (把内容移过去), 只有 code/hr/img/table 不能合并.

### Fix-2 (P0): BlockView 段落 BS — vis 判空 + 同步光标恢复
```ts
flushRef.current?.();
const vis = edEl.innerHTML.replace(/<[^>]+>/g, "").trim();
onBackspace(vis ? edEl.innerHTML : "");
```

### Fix-3 (P0): mergeUpward 当前块为空 → 删块并聚焦前一有内容块
```ts
if (isEmptyContent && !["code","hr","img","table"].includes(currentBlock.type)) {
  if (prev.length <= 1) return prev;
  updated.splice(realIndex, 1);
  // 聚焦: 找最近的有内容块，如果没有就找后一块，如果都没有就末尾
  let fi = Math.max(0, realIndex - 1);
  focusTargetArr[0] = { blockId: updated[fi]?.id || "", type: "end" };
  return updated;
}
```

## 四、场景走查（修复后正确流程）

### S1: `1.ad|dd` → Enter → `1.ad  2.dd|`
- Enter 拆分: splitBlock(ad, dd) → dd 作为新块

### S2: `1.ad + 2.dd|` → BS × N (一直到空)
- BS1: atStart=false 浏览器删 d → DOM=d
- BS2: atStart=false 浏览器删 d → DOM=<br> 或空
- BS3: atStart=true vis="" → onBackspace("") → mergeUpward empty
  → isEmptyContent=true prev.length=2 >1 → splice B  → [A(ad)] 聚焦 A end

### S3: `1.ad + 2.|dd` → BS
- BS1: atStart=true vis="dd" 非空 → onBackspace("dd")
  → mergeUpward isEmptyContent=false prev=A(ad, 有内容) → A.html="addd" 删 B
  → [A(addd)]  offset 2 光标✓

### S4: `1.ad + 2.aaaa|` 连续 BS
- BS1-4: atStart=false 浏览器删 a
- BS5: atStart=true vis="" → onBackspace("") → mergeUpward empty
  → prev.length=2 → splice B → [A(ad)] end
- BS6: atStart=false 浏览器删 d
- BS7: atStart=false 删 d → DOM=<br>
- BS8: atStart=true vis="" → onBackspace("") → mergeUpward
  → prev.length=1 → return prev (保留最后空块)
✓ 全删保 1 空块

### S5: `ef|g` 回车
- split(g) → A(ef) B(g)✓

### S6: `abcd + e|fg` 三次 BS
- BS1: atStart=false 浏览器删 e → f|g
- BS2: atStart=true + ol + vis non empty → 退段落 B={p,"fg"}, justDemotedIdRef
- BS3: justDemotedIdRef match → onBackspace("fg") → mergeUpward
  → A.html="abcd"+"fg" 删 B → [A(abcdfg)]
✓ 正确: abcdfg

### S7: `1.qwes + 2.asd|` 有序列表 + Enter
- Enter: beforeText="asd" afterText="" → split(asd)
- BS1-3: 删 asd
- BS4: atStart=true ol empty → onBackspace("") → B 删除
✓ A 保留 qwes

### S8: `1. + 2.|dd` 前空 + dd 在行首 BS
- BS1: atStart=true vis="dd" 非空 → onBackspace("dd")
- mergeUpward: realIndex=1, prev[0].html 空 → 跳过 prevIndex=-1
  → previousBlock=undefined → 走 realIndex<=0 路径, prev.length=2>1 → splice B
✓ 光标回到 A (空)

### S9: `1.ad + 2.sdsd|` 连续 BS 全删
- BS1-4: 浏览器删 s d s d → DOM empty
- BS5: atStart=true ol empty → onBackspace("") → B 删除
- BS6-7: 浏览器删 a d → A empty
- BS8: atStart=true ol empty → onBackspace("") → prev.length=1 return
✓ A 空, 保留 1 空块

## 五、影响文件清单

| 文件 | 改动点 |
|------|--------|
| `store/block-operations.ts` | `mergeUpward`: isEmptyContent 加 strip HTML; 前块定位跳过空内容 |
| `components/block-view/BlockView.tsx` | 段落 BS 分支: 加 vis 判空: `onBackspace(vis ? html : "")` |