# 飞书式写作编辑器 TypeScript 数据结构设计

## 1. 设计目标

这份数据结构设计面向“块编辑器 + 富文本 + 后续协作扩展”的场景，目标是：
- 可序列化
- 可迁移
- 可扩展
- 可支持 block 级和 inline 级能力
- 能同时服务编辑态、阅读态、修订态

## 2. 设计原则

1. **文档、块、行内样式分离**
2. **持久化状态与运行时状态分离**
3. **Block 类型使用判别联合**
4. **所有结构都带版本号，便于迁移**
5. **UI 状态不要混入文档内容本身**

## 3. 顶层实体

### 3.1 文档实体

```ts
export type DocumentStatus = 'draft' | 'published' | 'archived';
export type EditorMode = 'edit' | 'review' | 'read';

export interface DocumentEntity {
  id: string;
  schemaVersion: number;
  title: string;
  coverImage?: string;
  category: 'tech' | 'life';
  tags: string[];
  description?: string;
  status: DocumentStatus;
  blockIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 说明
- `blockIds` 只保存顺序，不直接内嵌 block 内容
- `schemaVersion` 用来兼容未来迁移
- `status` 体现草稿、发布、归档状态

## 4. Block 结构

### 4.1 Block 类型

```ts
export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'list'
  | 'todo'
  | 'code'
  | 'image'
  | 'table'
  | 'divider'
  | 'callout'
  | 'toggle'
  | 'formula'
  | 'embed';
```

### 4.2 Block 基类

```ts
export interface BaseBlock {
  id: string;
  type: BlockType;
  parentId?: string;
  index: number;
  attrs: Record<string, unknown>;
  meta?: {
    createdAt: string;
    updatedAt: string;
  };
}
```

### 4.3 文本运行

```ts
export type InlineMarkType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'link'
  | 'color'
  | 'highlight'
  | 'mention';

export interface InlineMark {
  type: InlineMarkType;
  value?: string;
}

export interface TextRun {
  text: string;
  marks: InlineMark[];
}
```

### 4.4 文本块

```ts
export interface TextBlock extends BaseBlock {
  type: 'paragraph' | 'heading' | 'quote' | 'list' | 'todo' | 'callout' | 'toggle';
  content: TextRun[];
}
```

### 4.5 标题块

```ts
export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  content: TextRun[];
  anchorId: string;
}
```

### 4.6 代码块

```ts
export interface CodeBlock extends BaseBlock {
  type: 'code';
  language?: string;
  code: string;
  showLineNumbers?: boolean;
}
```

### 4.7 图片块

```ts
export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt?: string;
  caption?: TextRun[];
  width?: number;
  height?: number;
}
```

### 4.8 表格块

```ts
export interface TableCell {
  id: string;
  content: TextRun[];
  colspan?: number;
  rowspan?: number;
  align?: 'left' | 'center' | 'right';
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  rows: TableRow[];
  headerRowCount?: number;
}
```

### 4.9 其他特殊块

```ts
export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface FormulaBlock extends BaseBlock {
  type: 'formula';
  latex: string;
}

export interface EmbedBlock extends BaseBlock {
  type: 'embed';
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  variant: 'info' | 'tip' | 'warning' | 'danger';
  content: TextRun[];
}

export interface ToggleBlock extends BaseBlock {
  type: 'toggle';
  title: TextRun[];
  children: string[];
  collapsed: boolean;
}

export interface TodoBlock extends BaseBlock {
  type: 'todo';
  checked: boolean;
  content: TextRun[];
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  ordered: boolean;
  level: number;
  content: TextRun[];
}
```

## 5. Block 联合类型

```ts
export type BlockRecord =
  | TextBlock
  | HeadingBlock
  | CodeBlock
  | ImageBlock
  | TableBlock
  | DividerBlock
  | FormulaBlock
  | EmbedBlock
  | CalloutBlock
  | ToggleBlock
  | TodoBlock
  | ListBlock;
```

## 6. 运行时状态

### 6.1 光标与选区

```ts
export interface EditorSelectionState {
  blockId?: string;
  start?: number;
  end?: number;
}
```

### 6.2 `/` 菜单状态

```ts
export interface SlashMenuState {
  open: boolean;
  query: string;
  anchorBlockId?: string;
  anchorRect?: DOMRect;
}
```

### 6.3 工具条状态

```ts
export interface ToolbarState {
  open: boolean;
  anchorRect?: DOMRect;
  selectedText?: string;
}
```

### 6.4 拖拽状态

```ts
export interface DragState {
  activeBlockId?: string;
  overBlockId?: string;
  fromIndex?: number;
  toIndex?: number;
}
```

### 6.5 历史栈

```ts
export interface HistorySnapshot {
  document: DocumentEntity;
  blocksById: Record<string, BlockRecord>;
}
```

### 6.6 编辑器总状态

```ts
export interface EditorState {
  document: DocumentEntity;
  blocksById: Record<string, BlockRecord>;
  selection: EditorSelectionState;
  slashMenu: SlashMenuState;
  toolbar: ToolbarState;
  drag: DragState;
  mode: EditorMode;
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  loading: boolean;
  saving: boolean;
}
```

## 7. 与当前实现的映射关系

当前 `src/app/write/page.tsx` 里还在用较轻量的 HTML 结构保存内容，建议对应如下映射：
- `titleHtml` → `DocumentEntity.title` / `TextRun[]`
- `blocks: Block[]` → `BlockRecord[]`
- `category` → `DocumentEntity.category`
- `coverImage` → `DocumentEntity.coverImage`
- `undoStack` / `redoStack` → `HistorySnapshot[]`
- `showSC` / `linkOpen` / `importOpen` → 运行时 UI state

## 8. 序列化与迁移建议

### 8.1 推荐存储策略
- 编辑态优先存结构化 JSON
- 发布时再导出为 Markdown / MDX / HTML
- 兼容期可同时保留 `legacyHtml`

### 8.2 迁移步骤
1. 先定义新 schema
2. 新增转换器：HTML ↔ BlockRecord
3. 新旧并行存储一段时间
4. 验证后切换主存储格式
5. 最后删掉旧字段

## 9. 示例

### 9.1 文档 JSON

```json
{
  "id": "doc_001",
  "schemaVersion": 1,
  "title": "飞书式写作编辑器",
  "category": "tech",
  "tags": ["前端", "编辑器"],
  "description": "对标飞书的块式写作体验",
  "status": "draft",
  "blockIds": ["b1", "b2"],
  "createdAt": "2026-06-20T10:00:00.000Z",
  "updatedAt": "2026-06-20T10:10:00.000Z"
}
```

### 9.2 标题块 JSON

```json
{
  "id": "b1",
  "type": "heading",
  "level": 1,
  "content": [{ "text": "飞书式写作编辑器", "marks": [{ "type": "bold" }] }],
  "anchorId": "feishu-editor",
  "index": 0,
  "attrs": {},
  "meta": {
    "createdAt": "2026-06-20T10:00:00.000Z",
    "updatedAt": "2026-06-20T10:10:00.000Z"
  }
}
```

## 10. 落地建议

- 短期先保持 HTML 编辑方式，补齐命令系统和菜单体验
- 中期把块结构收敛到统一 store
- 长期逐步把 inline mark、table、callout、toggle 全部结构化
