# 飞书式写作编辑器文档索引

## 文档清单

- `docs/feishu-editor-prd.md`：产品需求文档，定义目标、交互和验收标准
- `docs/feishu-editor-data-model.md`：TypeScript 数据结构设计，定义文档、Block、Inline、运行时状态
- `docs/feishu-editor-components.md`：组件拆分清单，定义页面壳、编辑层、浮层、hooks 的职责边界
- `docs/feishu-editor-todo.md`：开发 TODO 列表，按优先级整理实现顺序
- `docs/feishu-writing-requirements.md`：原始观察与分析记录，保留飞书写作体验的补充结论

## 推荐阅读顺序

1. 先看 `docs/feishu-editor-prd.md`，理解要做什么
2. 再看 `docs/feishu-editor-data-model.md`，明确数据怎么存
3. 然后看 `docs/feishu-editor-components.md`，明确代码怎么拆
4. 最后看 `docs/feishu-editor-todo.md`，按优先级开始实现

## 说明

- 以上文档是面向“飞书式写作编辑器”的统一资料集合
- 如果后续需求发生变化，优先更新 PRD 和 TODO，再回写数据模型与组件拆分
