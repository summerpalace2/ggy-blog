# 有序列表逻辑分析文档（更新版）

## 一、飞书云文档有序列表行为实测

### 1.1 数据结构

飞书云文档的有序列表采用**扁平化结构**，每个段落是一个独立的块。有序列表的核心特征：

- **类型即列表**：块类型直接是 \ol\，不存在"有序覆盖层"概念
- **标题即标题**：标题块（h1-h5）本身可以是有序列表的一部分（标题也可以带编号）
- **编号连续**：同类型列表项之间编号连续，遇到非列表块或更高级标题时断编号
- **无 restartNumbering**：飞书不提供"重新开始编号"的手算选项，编号完全由位置决定

### 1.2 交互行为

#### Enter 行为
| 场景 | 飞书行为 |
|------|---------|
| 列表项中间按Enter | 拆分为两个列表项，编号重新计算 |
| 列表项末尾按Enter（有内容） | 新建一个同类型空列表项，光标移入 |
| 空列表项按Enter | 退出列表，当前块变为普通段落 |
| 最后一个列表项空块按Enter | 退出列表，新建空段落 |

#### Backspace 行为
| 场景 | 飞书行为 |
|------|---------|
| 列表项行首有内容按Backspace | 内容合并到上一个列表项，当前块删除 |
| 空列表项行首按Backspace | 退出列表，变为普通段落（光标在行首） |
| 标题行首有内容按Backspace | 标题退化为正文（不删除） |
| 空标题行首按Backspace | 删除标题块，合并到上一块 |

#### 浮选框（Floating Selection Bar）
- 鼠标悬停在段落左侧时出现浮选框
- 浮选框包含：拖拽手柄、添加按钮
- 点击拖拽手柄可以拖动段落调整顺序
- **选中段落后**出现更多操作按钮：同步块、缩进、评论、剪切、复制、删除
- 浮选框出现在选中段落的**上方或下方**，取决于选中位置

#### 标题有序列表
- 飞书支持标题（h1-h5）直接作为有序列表项
- 标题的编号规则与正文有序列表一致
- 标题有序列表和普通有序列表可以混排，编号连续

---

## 二、当前项目实现分析

### 2.1 数据结构

项目采用**"二维度法则"**：

\\\	ypescript
interface Block {
  type: BType;           // 块类型
  ordered?: boolean;     // 有序覆盖层（标题/正文可叠加）
  restartNumbering?: boolean;  // 手动重编号标记
}
\\\

- \	ype === "ol"\：纯有序列表块
- \ordered === true\：有序覆盖层（标题或正文叠加有序属性）
- \estartNumbering === true\：手动重新开始编号

### 2.2 编号计算逻辑（ol-numbering.ts）

\\\
calculateOlNumber(index, blocks):
  1. 如果 block.restartNumbering → 返回 1
  2. 向前遍历：
     - 高维（标题+ordered）：只计同级ordered标题，遇更高级标题断
     - 低维（ol/正文+ordered）：遇任意标题断
  3. 累计编号
\\\

### 2.3 Enter 行为（BlockView.tsx handleKeyDown）

\\\
Enter:
  1. 块为空 + ordered覆盖层 → 脱ordered
  2. 块为空 + type=ol → 退为段落
  3. 块有内容 + ordered覆盖层 → 延续有序块（keepOrdered=true）
  4. 块有内容 + type=ol → 延续有序块（keepOrdered=false）
  5. 光标在中间拆分 → 根据类型决定新块类型
\\\

### 2.4 Backspace 行为

\\\
Backspace（行首）:
  1. ordered覆盖层 + 有内容 → 脱ordered
  2. ordered覆盖层 + 空 → 合并到上一块
  3. 标题 + 有内容 → 退为段落（justDemotedRef=true）
  4. 标题 + 空 → 合并到上一块
  5. ol/ul/todo → 退为段落（justDemotedRef=true）
  6. 普通段落 → 合并到上一块
\\\

---

## 三、差异对比与 Bug 列表

### Bug #1：totalInGroup 计算包含 ordered 标题导致计数偏大

**位置**：\BlockView.tsx\ 第602-614行

\\\	ypescript
for (let i = scopeStart; i < scopeEnd; i++) {
  if (blks[i]?.type === "ol" || blks[i]?.ordered) totalInGroup++;
}
\\\

**问题**：\	otalInGroup\ 包含了 \ordered\ 标题，但 \ordered\ 标题的编号是独立计算的（高维编号），不应计入低维编号总数。

**影响**：ol 菜单显示"共 N 项"时数字偏大。

---

### Bug #2：ordered 标题和 ol 块的 Enter 行为不一致

**位置**：\BlockView.tsx\ handleKeyDown Enter 分支

**问题**：
- \ordered\ 覆盖层空块按 Enter → 直接脱 ordered（当前块变普通标题/段落）
- \ol\ 块空块按 Enter → 退为段落（当前块类型变 p）

这两种行为逻辑不同但效果类似，但 \keepOrdered\ 参数导致 \splitBlock\ 中生成的新块类型不同：
- \keepOrdered=true\ → 新块保持原类型 + \ordered=true\
- \keepOrdered=false\ → 新块类型为 \ol\

**影响**：编号计算需要区分两种路径，增加复杂度。

---

### Bug #3：Backspace 中 ordered 和 ol 的处理逻辑不同

**位置**：\BlockView.tsx\ handleKeyDown Backspace 分支

**问题**：
- \ordered\ 覆盖层有内容时按 Backspace → 脱 ordered（块还在，只是去掉编号）
- \ol\ 块有内容时按 Backspace → 退为段落（块类型变了）

飞书的行为是：列表项有内容时按 Backspace → 内容合并到上一个列表项。

---

### Bug #4：justDemotedRef 是脆弱的 hack

**位置**：\BlockView.tsx\ 多处

**问题**：
- 这个 ref 用于跟踪"刚刚从标题降级为段落"的状态
- 但它的生命周期不可靠：如果用户快速连续按键，ref 可能被重置
- 它解决的是"标题退为段落后，再按 Backspace 应该删除而不是合并"这个伪需求
- 飞书中没有这个行为——标题退为段落后，Backspace 就是正常合并

---

### Bug #5：ordered 覆盖层概念与飞书不符

**核心问题**：飞书云文档中没有"有序覆盖层"这个概念。

飞书的做法是：
- 标题就是标题，可以带编号（本身就是 ol 类型）
- 不存在"标题 + ordered = 有序标题"的叠加

项目的 \ordered\ 覆盖层是为了实现"标题也可以有编号"而引入的间接方案，但这导致：
1. 数据结构复杂化（type + ordered 两个维度）
2. 编号计算需要区分高维/低维
3. Enter/Backspace 需要处理两种不同的有序状态

---

### Bug #6：缺少浮选框（Floating Selection Bar）

**问题**：飞书云文档在鼠标悬停段落左侧时显示浮选框，支持：
- 拖拽调整段落顺序
- 快速操作（复制、删除等）

项目完全没有实现这个功能，段落无法通过拖拽重排。

---

### Bug #7：restartNumbering 功能不完整

**位置**：\ol-numbering.ts\、\BlockView.tsx\ ol 菜单

**问题**：
- \estartNumbering\ 只是一个布尔标记
- 设置后该块编号从 1 开始，但后续块的编号计算依赖前一个块的 \estartNumbering\ 状态
- 如果中间插入了新块，\estartNumbering\ 不会自动传播
- 飞书中没有这个功能，编号完全由位置决定

---

## 四、修复方案建议

### 方案 A：简化数据结构（推荐）

**核心思路**：消除 \ordered\ 覆盖层，统一使用 \	ype === "ol"\ 表示有序列表。

1. **移除 \ordered\ 属性**：标题如果需要编号，直接设为 \	ype: "ol"\ + \level\ 属性
2. **移除 \estartNumbering**：编号完全由位置决定
3. **简化编号计算**：统一按类型计算，不需要区分高维/低维
4. **统一 Enter/Backspace**：只处理 \	ype === "ol"\ 一种情况

### 方案 B：保留当前架构，修复 Bug

如果不想大改数据结构，至少需要修复：
1. \	otalInGroup\ 计算排除 \ordered\ 标题
2. 统一 \ordered\ 和 \ol\ 的 Enter/Backspace 行为
3. 移除 \justDemotedRef\ hack
4. 修复 \estartNumbering\ 的传播问题

---

## 五、优先级排序

| 优先级 | Bug | 影响 |
|--------|-----|------|
| P0 | Bug #5：ordered 覆盖层概念错误 | 根本性设计问题，影响所有有序列表逻辑 |
| P0 | Bug #3：Backspace 行为不符 | 用户最常触发的操作，体验差异大 |
| P1 | Bug #2：Enter 行为不一致 | 列表延续时产生两种不同的块类型 |
| P1 | Bug #1：totalInGroup 计数偏大 | 菜单显示错误 |
| P2 | Bug #4：justDemotedRef hack | 代码健壮性问题 |
| P2 | Bug #7：restartNumbering 不完整 | 功能逻辑缺陷 |
| P3 | Bug #6：缺少浮选框 | 功能缺失，但不影响核心编辑 |

---

## 六、TODO List

- [x] 通读项目代码
- [x] 分析飞书云文档行为
- [x] 撰写分析文档
- [ ] 等待用户确认分析文档
- [ ] 按优先级修复 Bug
- [ ] 每步自我审查
- [ ] 最终验证
