# 飞书式写作编辑器组件拆分清单

## 1. 拆分目标

当前写作页的职责已经很多，未来要支持飞书式体验，必须把职责按层拆开：
- 页面壳层
- 文档状态层
- 块渲染层
- 浮层/弹窗层
- 工具函数层

## 2. 当前建议目录结构

```text
src/
  app/
    write/
      page.tsx
      components/
        WriteShell.tsx
        DocumentHeader.tsx
        TitleEditor.tsx
        MetaBar.tsx
        BlockEditor.tsx
        BlockItem.tsx
        BlockGutter.tsx
        SlashMenu.tsx
        TypePicker.tsx
        FormatToolbar.tsx
        FloatingTOC.tsx
        ImportDialog.tsx
        ShortcutModal.tsx
        LinkDialog.tsx
        ImageLightbox.tsx
      hooks/
        useEditorState.ts
        useSelectionState.ts
        useSlashMenu.ts
        useAutosave.ts
        useUndoRedo.ts
        useShortcutMap.ts
      lib/
        block-convert.ts
        block-types.ts
        editor-serialize.ts
```

## 3. 组件职责清单

### 3.1 页面壳层

| 组件 | 职责 | 输入 | 输出 |
|---|---|---|---|
| `WriteShell` | 组织页面整体布局 | `children`、主题、模式 | 页面框架 |
| `DocumentHeader` | 顶部工具栏 | 标题、保存状态、按钮回调 | 顶部操作区 |
| `MetaBar` | 分类、标签、封面、字数等元信息 | 文档元数据 | 元信息区域 |

### 3.2 文档编辑层

| 组件 | 职责 | 输入 | 输出 |
|---|---|---|---|
| `TitleEditor` | 标题块编辑 | `titleHtml` / `titleRuns` | 标题内容 |
| `BlockEditor` | 管理所有正文块 | `blocks`、操作回调 | 块列表 |
| `BlockItem` | 单个块渲染与交互 | `block`、`index`、回调 | 单块内容 |
| `BlockGutter` | 左侧 hover 区与按钮 | `block`、状态 | 左侧操作区 |

### 3.3 浮层与弹窗

| 组件 | 职责 | 触发方式 | 说明 |
|---|---|---|---|
| `SlashMenu` | `/` 命令面板 | 输入 `/` | 与 `+` 共用命令源 |
| `TypePicker` | 块类型选择器 | 点击 `+` 或类型标签 | 插入 / 转换块 |
| `FormatToolbar` | 选区格式工具条 | 选中文本 | inline 格式处理 |
| `ImportDialog` | Markdown 导入 | 点击导入按钮 | 粘贴/选择文件 |
| `ShortcutModal` | 快捷键配置 | 点击快捷键按钮 | 查看/修改快捷键 |
| `LinkDialog` | 插入链接 | 工具条按钮 | 选区或输入文本插链 |
| `ImageLightbox` | 图片预览 | 点击图片 | 大图查看 |
| `FloatingTOC` | 悬浮目录 | 标题块存在时 | 自动目录与跳转 |

### 3.4 辅助逻辑层

| Hook / 工具 | 职责 | 关键输入 | 关键输出 |
|---|---|---|---|
| `useEditorState` | 文档主状态 | 初始文档、草稿 | editor state |
| `useSelectionState` | 选区与光标 | DOM selection | selection 状态 |
| `useSlashMenu` | 命令菜单状态 | 输入事件、锚点 | 菜单开关与查询 |
| `useAutosave` | 草稿保存 | blocks、title、meta | 本地存储 |
| `useUndoRedo` | 历史栈 | snapshot | undo/redo |
| `useShortcutMap` | 快捷键映射 | 当前模式 | 键盘命中判断 |
| `block-convert.ts` | block/markdown 转换 | html、runs、blocks | 序列化结果 |
| `editor-serialize.ts` | 发布时序列化 | editor state | markdown/mdx/json |

## 4. 现有页面建议拆分

`src/app/write/page.tsx` 当前同时承担了：
- 页面布局
- block 渲染
- 内容编辑
- 保存逻辑
- 快捷键逻辑
- 导入导出
- 目录渲染
- 弹窗管理

建议按如下顺序拆分：
1. 先把 `TypePicker`、`SlashMenu`、`FormatToolbar`、`FloatingTOC` 拆出去
2. 再把 `BlockView` 拆成独立块组件
3. 再把 `ContentEditableArea` 抽成通用基础组件
4. 最后把状态和序列化逻辑抽到 hook / lib 中

## 5. 组件之间的依赖关系

```text
WriteShell
  ├─ DocumentHeader
  ├─ TitleEditor
  ├─ MetaBar
  ├─ BlockEditor
  │   └─ BlockItem
  │       ├─ BlockGutter
  │       ├─ TypePicker
  │       └─ BlockContentRenderer
  ├─ FormatToolbar
  ├─ SlashMenu
  ├─ FloatingTOC
  ├─ ImportDialog
  ├─ ShortcutModal
  ├─ LinkDialog
  └─ ImageLightbox
```

## 6. 单组件拆分标准

每个组件拆出去时，建议满足以下条件：
- 组件只负责一类职责
- 组件 props 不超过 8 个核心字段
- 组件内不直接调用保存接口
- 组件不直接修改全局本地存储
- 组件尽量只依赖自身局部状态和明确回调

## 7. 对当前 `page.tsx` 的具体拆分建议

### 7.1 必拆
- `ContentEditableArea`
- `FormatToolbar`
- `TypePicker`
- `FloatingTOC`
- `ImageLightbox`
- `ImportDialog`
- `ShortcutModal`
- `LinkDialog`
- `BlockView`

### 7.2 优先后拆
- `WritePage` 中的草稿恢复逻辑
- `WritePage` 中的 undo / redo 逻辑
- `WritePage` 中的保存逻辑
- `WritePage` 中的快捷键监听逻辑

### 7.3 可继续保留在 page.tsx 的内容
- 页面入口
- 最外层布局壳
- 仅组合级别的状态分发

## 8. 组件开发约定

- 组件文件名使用 PascalCase
- 组件目录按职责划分，而不是按技术手段划分
- hook 命名使用 `useXxx`
- 转换函数统一放到 `lib/`
- 复杂弹窗必须拆成受控组件，避免和页面状态耦合

## 9. 推荐优先级

### P0
- 拆 `BlockView`
- 拆 `TypePicker`
- 拆 `SlashMenu`
- 拆 `FormatToolbar`

### P1
- 拆 `ImportDialog`
- 拆 `ShortcutModal`
- 拆 `LinkDialog`
- 拆 `FloatingTOC`

### P2
- 新增 `useEditorState`
- 新增 `useAutosave`
- 新增 `editor-serialize.ts`
- 新增 `block-convert.ts`
